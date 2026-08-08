import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getFallbackDb } from '@/lib/fallbackDb';

const FULLY_PAID_TOLERANCE = 10;
const normalizeValue = (value: unknown): string => (value ?? '').toString().trim().toUpperCase();

const parseDate = (value?: string | null): string | null => {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.substring(0, 10);
  const monthMap: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  };
  const parts = value.split(/[-/]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    const day = parts[0].padStart(2, '0');
    const month = monthMap[parts[1].toLowerCase()] || parts[1].padStart(2, '0');
    const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
    return `${year}-${month}-${day}`;
  }
  return null;
};

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const plantIds = searchParams.getAll('plantId');
    const plantIdValues = plantIds.length ? plantIds : (searchParams.get('plantIds') || '').split(',').map(item => item.trim()).filter(Boolean);
    const fromDate = searchParams.get('fromDate') || '';
    const toDate = searchParams.get('toDate') || '';
    const billTo = searchParams.get('billTo') || '';
    const consignor = searchParams.get('consignor') || '';
    const inventoryType = searchParams.get('inventoryType') || '';
    const chargeType = searchParams.get('chargeType') || '';
    const isMb5bReport = searchParams.get('report') === 'mb5b';

    let db: any;
    try {
      db = await getDb();
    } catch (err) {
      console.error('MongoDB payment-complete failed, using fallback DB', err);
      db = getFallbackDb();
    }

    const invoicesCollection = (await db).collection('sales_invoices');
    const receiptsCollection = (await db).collection('payment_receipts');

    const filter: Record<string, any> = {};
    if (plantIdValues.length) filter.plantId = { $in: plantIdValues };

    const invoiceDocs = await invoicesCollection.find(filter).toArray();
    const receiptDocs = await receiptsCollection.find({}).toArray();

    const receiptsByInvoice = new Map<string, any[]>();
    for (const receipt of receiptDocs) {
      const invoiceNo = normalizeValue(receipt.invoiceNo || receipt.invoiceNumber || receipt.invoice || '');
      if (!invoiceNo) continue;
      const current = receiptsByInvoice.get(invoiceNo) || [];
      current.push(receipt);
      receiptsByInvoice.set(invoiceNo, current);
    }

    const allowedInventoryTypes = new Set(['SERVICE INVOICE', 'SUPPLY INVOICE']);
    const invoiceMatchesFilters = (invoice: any) => {
      if (invoice.status === 'Cancelled') return false;
      const invoiceType = normalizeValue(invoice.inventoryType);
      if (!allowedInventoryTypes.has(invoiceType)) return false;
      if (inventoryType) {
        const normalizedInventory = normalizeValue(invoice.inventoryType);
        if (normalizedInventory !== normalizeValue(inventoryType)) return false;
      }
      if (chargeType) {
        const chargeValues = [invoice.docCategory, invoice.chargeType, invoice.chargeTypeCode, invoice.docType]
          .filter(Boolean)
          .map(value => normalizeValue(value));
        if (!chargeValues.includes(normalizeValue(chargeType))) return false;
      }
      if (billTo) {
        const billToValues = [invoice.billTo, invoice.customerCode, invoice.customerId, invoice.billToParty, invoice.billToCode]
          .filter(Boolean)
          .map(value => normalizeValue(value));
        if (!billToValues.includes(normalizeValue(billTo))) return false;
      }
      if (consignor) {
        const consignorValues = [
          invoice.consignorName,
          invoice.consignorCode,
          invoice.firmId,
          invoice.snapshotFirm?.firmId,
          invoice.snapshotFirm?.consignorCode,
        ].filter(Boolean).map(value => normalizeValue(value));
        if (!consignorValues.includes(normalizeValue(consignor))) return false;
      }
      if (!isMb5bReport) {
        const invDate = parseDate(invoice.invoiceDate);
        if (invDate && fromDate && invDate < fromDate) return false;
        if (invDate && toDate && invDate > toDate) return false;
      }
      return true;
    };

    const rows = invoiceDocs
      .filter(invoiceMatchesFilters)
      .map((invoice: any) => {
        const invoiceNo = normalizeValue(invoice.invoiceNumber || invoice.invoiceNo || invoice.invoice || '');
        const relevantReceipts = (receiptsByInvoice.get(invoiceNo) || []).filter((receipt: any) => receipt.status !== 'Reversed');

const receiptAmount = relevantReceipts.reduce((sum, receipt) => sum + (Number(receipt.receiptAmount) || 0), 0);
        const tds = relevantReceipts.reduce((sum, receipt) => sum + (Number(receipt.tds) || 0), 0);
        const deduction = relevantReceipts.reduce((sum, receipt) => sum + (Number(receipt.deduction) || 0), 0);
        const interest = relevantReceipts.reduce((sum, receipt) => sum + (Number(receipt.interest) || 0), 0);
        const grossAmount = Number(invoice.totals?.grossAmount || invoice.grossAmount || 0);
        const balanceAmount = grossAmount - receiptAmount - tds - deduction;
        const isPaymentComplete = balanceAmount < FULLY_PAID_TOLERANCE;

        if (!isMb5bReport && !isPaymentComplete) return null;

        const paymentDate = relevantReceipts.length ? relevantReceipts[0].paymentDate || '' : '';
        const paymentAdviceNo = relevantReceipts.length ? relevantReceipts[0].paymentAdviceNo || '' : '';
        const bankingUtr = relevantReceipts.length ? relevantReceipts[0].bankingUtr || '' : '';
        const proofData = relevantReceipts.length ? relevantReceipts[0].proofData || '' : '';
        const paymentMode = relevantReceipts.length ? relevantReceipts[0].paymentMode || '' : '';

        return {
          ...invoice,
          invoiceNumber: invoice.invoiceNumber || invoice.invoiceNo || invoice.invoice,
receiptAmount,
          tdsAmount: tds,
          deductionAmount: deduction,
          interestAmount: interest,
          balanceAmount,
          paymentDate,
          paymentAdviceNo,
          bankingUtr,
          proofData,
          paymentMode,
          paymentCompleted: isPaymentComplete,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ rows, receipts: receiptDocs.filter((receipt: any) => receipt.status !== 'Reversed') });
  } catch (error) {
    console.error('payment-complete route failed', error);
    return NextResponse.json({ error: 'Unable to load completed-payment data.' }, { status: 503 });
  }
}
