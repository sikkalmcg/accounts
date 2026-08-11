import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getFallbackDb } from "@/lib/fallbackDb";

const normalize = (value: unknown) => String(value ?? "").trim();
const invoiceKey = (value: unknown) => normalize(value).toUpperCase();

const amount = (value: unknown) => {
  const parsed = Number(String(value ?? 0).replace(/,/g, "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const text = normalize(value);
  const match = text.match(/^(\d{2})[./-](\d{2})[./-](\d{4})$/);
  const date = match
    ? new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]))
    : new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
};

export async function GET(request: NextRequest) {
  try {
    const userId = normalize(request.headers.get("x-sikka-user-id"));
    if (!userId) {
      return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
    }

    let db: any;
    try {
      db = await getDb();
    } catch (error) {
      console.error("F110 MongoDB lookup failed; using fallback DB", error);
      db = getFallbackDb();
    }

    const database = await db;
    const user = await database.collection("users").findOne({ username: userId });
    if (!user) {
      return NextResponse.json({ error: "Authenticated user was not found." }, { status: 403 });
    }

    const isAdmin = user.role === "admin" || user.username === "ajaysomra";
    const assignedPlants = new Set(
      (Array.isArray(user.assignedPlantIds) ? user.assignedPlantIds : [])
        .map(normalize)
        .filter(Boolean)
    );
    const requestedPlants = (request.nextUrl.searchParams.get("plantIds") || "")
      .split(",")
      .map(normalize)
      .filter(Boolean);

    if (!requestedPlants.length) {
      return NextResponse.json({ error: "At least one Plant must be selected." }, { status: 400 });
    }

    // Authorization is applied before the selected-plant filter, so a forged
    // Plant parameter cannot expand the invoice result set for a normal user.
    const permittedPlants = isAdmin
      ? requestedPlants
      : requestedPlants.filter((plantId) => assignedPlants.has(plantId));

    if (!permittedPlants.length) {
      return NextResponse.json({ error: "No selected Plant is authorized for this user." }, { status: 403 });
    }

    const fromDate = parseDate(request.nextUrl.searchParams.get("fromDate"));
    const toDate = parseDate(request.nextUrl.searchParams.get("toDate"));
    if (!fromDate || !toDate || fromDate > toDate) {
      return NextResponse.json({ error: "A valid invoice date range is required." }, { status: 400 });
    }
    fromDate.setHours(0, 0, 0, 0);
    toDate.setHours(23, 59, 59, 999);

    // MB03 displays these invoice records. F110 deliberately starts from this
    // invoice dataset, then enriches it only with matching payment records.
    const mb03Invoices = await database.collection("sales_invoices")
      .find({ plantId: { $in: permittedPlants } })
      .toArray();
    const paymentRecords = await database.collection("payment_receipts").find({}).toArray();

    const paymentsByInvoice = new Map<string, { totalPaid: number; latestPaymentDate: Date | null }>();
    for (const payment of paymentRecords) {
      if (normalize(payment.status).toLowerCase() === "reversed") continue;
      const key = invoiceKey(payment.invoiceNo || payment.invoiceNumber || payment.invoice);
      if (!key) continue;
      const summary = paymentsByInvoice.get(key) || { totalPaid: 0, latestPaymentDate: null };
      summary.totalPaid += amount(payment.receiptAmount) + amount(payment.tds) + amount(payment.deduction) + amount(payment.interest);
      const paymentDate = parseDate(payment.paymentDate || payment.postingDate || payment.receiptDate);
      if (paymentDate && (!summary.latestPaymentDate || paymentDate > summary.latestPaymentDate)) {
        summary.latestPaymentDate = paymentDate;
      }
      paymentsByInvoice.set(key, summary);
    }

    const invoices = mb03Invoices
      .filter((invoice: any) => {
        const invoiceDate = parseDate(invoice.invoiceDate || invoice.billingDate || invoice.date);
        return invoiceDate && invoiceDate >= fromDate && invoiceDate <= toDate;
      })
      .map((invoice: any) => {
        const invoiceNumber = normalize(invoice.invoiceNumber || invoice.invoiceNo || invoice.invoice_num);
        const grossAmount = amount(invoice.totals?.grossAmount ?? invoice.invoiceGrossAmount ?? invoice.grossAmount ?? invoice.invoiceAmount);
        const payment = paymentsByInvoice.get(invoiceKey(invoiceNumber));
        return {
          ...invoice,
          id: invoice._id.toString(),
          invoiceNumber,
          grossAmount,
          totalPaidAmount: payment?.totalPaid ?? 0,
          paymentDate: payment?.latestPaymentDate?.toISOString() ?? "",
        };
      });

    return NextResponse.json({ invoices, permittedPlants });
  } catch (error) {
    console.error("F110 report lookup failed", error);
    return NextResponse.json({ error: "Unable to load the F110 report." }, { status: 503 });
  }
}
