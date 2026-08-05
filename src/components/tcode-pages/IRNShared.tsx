"use client";

import { useMemo, type ReactNode } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Download, X, FileText } from "lucide-react";
import { parse } from "date-fns";
import { InvoicePreview } from "./VF03";
import { getRecordPlantIds } from "@/lib/plant-master";

/* ------------------------------------------------------------------ */
/*  Formatting Helpers                                                 */
/* ------------------------------------------------------------------ */

/** Fixed 2-decimal amount string (e.g. "1,234.56") */
export const fmtAmount = (num: any) => Number(num || 0).toFixed(2);

/** Locale-aware 2-decimal amount string with commas */
export const fmtAmountLoc = (num: any) =>
  Number(num || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/** Converts a DD-MMM-YYYY date string to epoch milliseconds (0 if invalid) */
export const sapDateToTime = (invoiceDate: string) => {
  if (!invoiceDate) return 0;
  try {
    const d = parse(invoiceDate, "dd-MMM-yyyy", new Date());
    return isNaN(d.getTime()) ? 0 : d.getTime();
  } catch {
    return 0;
  }
};

/**
 * Single-date / date-range filter against a DD-MMM-YYYY invoice date.
 * - fromDate == toDate  -> single date match
 * - fromDate < toDate   -> range match
 * - empty from/to       -> no boundary applied
 */
export const matchesDateRange = (invoiceDate: string, fromDate: string, toDate: string) => {
  if (!invoiceDate) return false;
  const time = sapDateToTime(invoiceDate);
  if (!time) return false;
  const d = new Date(time);
  if (fromDate) {
    const fd = new Date(fromDate);
    fd.setHours(0, 0, 0, 0);
    if (d < fd) return false;
  }
  if (toDate) {
    const td = new Date(toDate);
    td.setHours(23, 59, 59, 999);
    if (d > td) return false;
  }
  return true;
};

/* ------------------------------------------------------------------ */
/*  Print / Download PDF Helper                                        */
/* ------------------------------------------------------------------ */

export const openInvoicePrint = (invoiceNo: string, elementId: string) => {
  const content = document.getElementById(elementId)?.innerHTML;
  if (!content) return;
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(`
    <html>
      <head>
        <title>Invoice Print Preview - ${invoiceNo}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          @page { size: A4 portrait; margin: 0; }
          @media print {
            body { padding: 0; margin: 0; background: white; -webkit-print-color-adjust: exact; }
            #invoice-print-area { width: 100% !important; max-width: none !important; margin: 0 !important; padding: 0 !important; }
            .invoice-container { margin: 0 !important; border: none !important; }
            .watermark-text { opacity: 0.1 !important; color: #dc2626 !important; }
          }
          body { font-family: 'Inter', sans-serif; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #000; padding: 4px 6px; }
        </style>
      </head>
      <body onload="window.print(); window.close();">
        <div id="invoice-print-area">${content}</div>
      </body>
    </html>
  `);
  win.document.close();
};

/* ------------------------------------------------------------------ */
/*  Invoice Print Preview Popup                                        */
/* ------------------------------------------------------------------ */

export const IRNPreviewDialog = ({
  invoice,
  firms,
  customerMap,
  trigger,
}: {
  invoice: any;
  firms: any[] | null;
  customerMap: Record<string, any>;
  trigger?: ReactNode;
}) => {
  const runPrint = () => openInvoicePrint(invoice?.invoiceNumber, "irn-preview-print-area");
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <span className="cursor-pointer hover:underline text-blue-700 font-mono font-black text-[11px]">
            {invoice?.invoiceNumber}
          </span>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-[850px] max-h-[98vh] overflow-y-auto p-0 rounded-none border-none shadow-2xl">
        <div className="bg-[#333e4f] p-2 flex justify-between items-center text-white sticky top-0 z-50">
          <DialogTitle className="text-[11px] font-bold uppercase tracking-widest pl-2 flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 text-emerald-400" /> Invoice Print Preview: {invoice?.invoiceNumber}
          </DialogTitle>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={runPrint}
              className="h-7 rounded-none bg-emerald-600 hover:bg-emerald-700 gap-2 text-[10px] font-bold px-4"
            >
              <Printer className="h-3.5 w-3.5" /> PRINT
            </Button>
            <Button
              size="sm"
              onClick={runPrint}
              className="h-7 rounded-none bg-blue-600 hover:bg-blue-700 gap-2 text-[10px] font-bold px-4"
            >
              <Download className="h-3.5 w-3.5" /> DOWNLOAD PDF
            </Button>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-white hover:bg-white/10 rounded-none">
                <X className="h-4 w-4" />
              </Button>
            </DialogTrigger>
          </div>
        </div>
        <div className="bg-white" id="irn-preview-print-area">
          <InvoicePreview invoice={invoice} copyLabel="PREVIEW" firms={firms} customerMap={customerMap} />
        </div>
      </DialogContent>
    </Dialog>
  );
};

/* ------------------------------------------------------------------ */
/*  Shared IRN Result Grid (IRN02 / IRN03)                             */
/* ------------------------------------------------------------------ */

export const IRNResultGrid = ({
  invoices,
  firms,
  customerMap,
  showGeneratedBy,
  renderAction,
  isLoading,
}: {
  invoices: any[];
  firms: any[] | null;
  customerMap: Record<string, any>;
  showGeneratedBy?: boolean;
  renderAction?: (inv: any) => ReactNode;
  isLoading?: boolean;
}) => {
const firmMap = useMemo(() => {
    const m: Record<string, any> = {};
    firms?.forEach((f) => {
      const ids = getRecordPlantIds(f);
      ids.forEach((pid) => { m[pid] = f; });
    });
    return m;
  }, [firms]);

  const resolvedRows = useMemo(
    () =>
      invoices.map((inv) => {
        const firm = inv.snapshotFirm || firmMap[inv.plantId] || {};
        const billToCust = inv.snapshotBillTo || customerMap[inv.billTo] || {};
        return {
          inv,
          consignorName: firm?.name || inv.consignorName || "-",
          consignorState: firm?.stateName || firm?.state || "-",
          billToName: billToCust?.name || inv.billTo || "-",
          billToState: billToCust?.stateName || "-",
        };
      }),
    [invoices, firmMap, customerMap]
  );

  return (
    <Table className="min-w-[3200px] sap-alv-grid">
      <TableHeader className="sap-alv-header">
        <TableRow className="h-8">
          <TableHead className="w-10 text-center text-[11px] font-bold border-r border-[#b5c7de] bg-[#e1e1e1]">#</TableHead>
          {renderAction && (
            <TableHead className="w-24 text-center text-[11px] font-bold border-r border-[#b5c7de] bg-[#e1e1e1]">Action</TableHead>
          )}
          <TableHead className="w-28 text-center text-[11px] font-bold border-r border-[#b5c7de] bg-[#e1e1e1]">Invoice Preview</TableHead>
          <TableHead className="w-20 text-center text-[11px] font-bold border-r border-[#b5c7de]">Plant</TableHead>
          <TableHead className="w-40 text-[11px] font-bold border-r border-[#b5c7de]">Invoice No.</TableHead>
          <TableHead className="w-32 text-[11px] font-bold border-r border-[#b5c7de]">Invoice Date</TableHead>
          <TableHead className="w-48 text-[11px] font-bold border-r border-[#b5c7de]">Consignor Name</TableHead>
          <TableHead className="w-28 text-center text-[11px] font-bold border-r border-[#b5c7de]">Consignor State</TableHead>
          <TableHead className="w-48 text-[11px] font-bold border-r border-[#b5c7de]">Bill To Party</TableHead>
          <TableHead className="w-28 text-center text-[11px] font-bold border-r border-[#b5c7de]">Bill To Party State</TableHead>
          <TableHead className="w-28 text-center text-[11px] font-bold border-r border-[#b5c7de]">Document Type</TableHead>
          <TableHead className="w-32 text-center text-[11px] font-bold border-r border-[#b5c7de]">Invoice Type</TableHead>
          <TableHead className="w-28 text-center text-[11px] font-bold border-r border-[#b5c7de]">Charge Type</TableHead>
          <TableHead className="w-32 text-right text-[11px] font-bold border-r border-[#b5c7de]">Taxable Amount</TableHead>
          <TableHead className="w-28 text-right text-[11px] font-bold border-r border-[#b5c7de]">CGST Amount</TableHead>
          <TableHead className="w-28 text-right text-[11px] font-bold border-r border-[#b5c7de]">SGST Amount</TableHead>
          <TableHead className="w-28 text-right text-[11px] font-bold border-r border-[#b5c7de]">IGST Amount</TableHead>
          <TableHead className="w-36 text-right text-[11px] font-bold border-r border-[#b5c7de] bg-blue-50/50">Gross Amount</TableHead>
          <TableHead className="w-64 text-[11px] font-bold border-r border-[#b5c7de]">IRN No.</TableHead>
          <TableHead className="w-40 text-[11px] font-bold border-r border-[#b5c7de]">ACK No.</TableHead>
          <TableHead className="w-32 text-[11px] font-bold border-r border-[#b5c7de]">ACK Date</TableHead>
          {showGeneratedBy && (
            <TableHead className="w-40 text-[11px] font-bold border-r border-[#b5c7de]">IRN Generated by</TableHead>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          <TableRow>
            <TableCell colSpan={showGeneratedBy ? 22 : 21} className="text-center py-16 text-xs opacity-40">
              RETRIEVING IRN RECORDS...
            </TableCell>
          </TableRow>
        ) : resolvedRows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={showGeneratedBy ? 22 : 21} className="text-center py-16 text-xs text-red-500 font-bold uppercase tracking-widest">
              NO RECORDS MATCHING SELECTION CRITERIA
            </TableCell>
          </TableRow>
        ) : (
          resolvedRows.map(({ inv, consignorName, consignorState, billToName, billToState }, idx) => (
            <TableRow key={inv.id} className="h-8 hover:bg-blue-50/20 border-b border-gray-100 group transition-colors">
              <TableCell className="p-0 text-center text-[10px] border-r text-gray-400 group-hover:text-blue-600">{idx + 1}</TableCell>
              {renderAction && (
                <TableCell className="p-0 border-r text-center px-1">
                  {renderAction(inv)}
                </TableCell>
              )}
              <TableCell className="p-0 border-r text-center px-1">
                <IRNPreviewDialog
                  invoice={inv}
                  firms={firms}
                  customerMap={customerMap}
                  trigger={
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-full text-[9px] font-black uppercase text-blue-700 hover:bg-blue-100 rounded-none border border-blue-200"
                    >
                      <FileText className="h-3 w-3 mr-1" /> Preview
                    </Button>
                  }
                />
              </TableCell>
              <TableCell className="p-0 px-2 text-[11px] border-r text-center font-bold text-gray-600">{inv.plantId}</TableCell>
              <TableCell className="p-0 px-2 text-[11px] border-r">
                <IRNPreviewDialog invoice={inv} firms={firms} customerMap={customerMap} />
              </TableCell>
              <TableCell className="p-0 px-2 text-[11px] border-r font-mono">{inv.invoiceDate}</TableCell>
              <TableCell className="p-0 px-2 text-[11px] border-r truncate max-w-[180px] font-semibold uppercase">{consignorName}</TableCell>
              <TableCell className="p-0 px-2 text-[11px] border-r text-center uppercase">{consignorState}</TableCell>
              <TableCell className="p-0 px-2 text-[11px] border-r truncate max-w-[180px] font-semibold uppercase">{billToName}</TableCell>
              <TableCell className="p-0 px-2 text-[11px] border-r text-center uppercase">{billToState}</TableCell>
              <TableCell className="p-0 px-2 text-[11px] border-r text-center font-semibold">{inv.docType || "-"}</TableCell>
              <TableCell className="p-0 px-2 text-[11px] border-r text-center">{inv.inventoryType || "-"}</TableCell>
              <TableCell className="p-0 px-2 text-[11px] border-r text-center uppercase">{inv.docCategory || "-"}</TableCell>
              <TableCell className="p-0 px-2 text-[11px] border-r text-right font-mono pr-3">₹ {fmtAmountLoc(inv.totals?.taxableAmount)}</TableCell>
              <TableCell className="p-0 px-2 text-[11px] border-r text-right font-mono pr-3 text-gray-600">₹ {fmtAmountLoc(inv.totals?.cgst)}</TableCell>
              <TableCell className="p-0 px-2 text-[11px] border-r text-right font-mono pr-3 text-gray-600">₹ {fmtAmountLoc(inv.totals?.sgst)}</TableCell>
              <TableCell className="p-0 px-2 text-[11px] border-r text-right font-mono pr-3 text-gray-600">₹ {fmtAmountLoc(inv.totals?.igst)}</TableCell>
              <TableCell className="p-0 px-2 text-[11px] text-right font-black text-emerald-800 pr-3 bg-blue-50/10">₹ {fmtAmountLoc(inv.totals?.grossAmount)}</TableCell>
              <TableCell className="p-0 px-2 text-[10px] border-r font-mono font-bold text-blue-900 break-all max-w-[240px]">{inv.irnNumber || "-"}</TableCell>
              <TableCell className="p-0 px-2 text-[10px] border-r font-mono">{inv.ackNo || "-"}</TableCell>
              <TableCell className="p-0 px-2 text-[11px] border-r font-mono">{inv.ackDate || "-"}</TableCell>
              {showGeneratedBy && (
                <TableCell className="p-0 px-2 text-[11px] border-r font-semibold uppercase">{inv.irnGeneratedBy || inv.irnModifiedBy || "-"}</TableCell>
              )}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
};

