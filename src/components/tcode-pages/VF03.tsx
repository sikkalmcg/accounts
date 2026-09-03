"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDatabase, useCollection, useMemoDatabase } from "@/database";
import { collection, query, orderBy } from "@/database/mongo";
import { Search, Filter, Download, Printer, ArrowUpDown, ChevronUp, ChevronDown, PrinterIcon, X, Clock, CheckCircle2, FileDown, RotateCcw } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import { cn } from "@/lib/utils";
import PlantMultiSelect from "./PlantMultiSelect";
import { downloadCsv, formatSapDateTime } from "@/lib/csv-export";
import { getRecordPlantIds } from "@/lib/plant-master";
import { matchesDateRange } from "./IRNShared";

const getInitialDates = () => {
  const now = new Date();
  const past7 = new Date();
  past7.setDate(now.getDate() - 7);
  const toISO = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  return {
    from: toISO(past7),
    to: toISO(now)
  };
};

// Utility to convert number to Indian words
const numberToWords = (num: number): string => {
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const n = ('000000000' + Math.floor(num)).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return '';
  let str = '';
  str += (Number(n[1]) != 0) ? (a[Number(n[1])] || b[Number(n[1][0])] + ' ' + a[Number(n[1][1])]) + 'Crore ' : '';
  str += (Number(n[2]) != 0) ? (a[Number(n[2])] || b[Number(n[2][0])] + ' ' + a[Number(n[2][1])]) + 'Lakh ' : '';
  str += (Number(n[3]) != 0) ? (a[Number(n[3])] || b[Number(n[3][0])] + ' ' + a[Number(n[3][1])]) + 'Thousand ' : '';
  str += (Number(n[4]) != 0) ? (a[Number(n[4])] || b[Number(n[4][0])] + ' ' + a[Number(n[4][1])]) + 'Hundred ' : '';
  str += (Number(n[5]) != 0) ? ((str != '') ? 'And ' : '') + (a[Number(n[5])] || b[Number(n[5][0])] + ' ' + a[Number(n[5][1])]) : '';
  return `Rupees ${str.trim()} Only`;
};
export const InvoicePreview = ({ invoice, copyLabel, firms, customerMap }: { invoice: any; copyLabel: string, firms: any[] | null, customerMap: Record<string, any> }) => {
  const firm = invoice.snapshotFirm || firms?.find(f => getRecordPlantIds(f).includes(invoice.plantId)) || {};
  const billToCust = invoice.snapshotBillTo || customerMap[invoice.billTo] || {};
  const shipToCust = invoice.snapshotShipTo || customerMap[invoice.shipTo] || billToCust || {};

  const totals = invoice.totals || {};
  const taxable = totals.taxableAmount || 0;
  const cgst = totals.cgst || 0;
  const sgst = totals.sgst || 0;
  const igst = totals.igst || 0;
  const isInterstate = totals.isInterstate || false;
  const avgGst = totals.avgGst || 0;

  const rawTotal = taxable + cgst + sgst + igst;
  const roundedTotal = Math.round(rawTotal);
  const roundOff = (roundedTotal - rawTotal).toFixed(2);

  const isNonTax = invoice.docType?.toUpperCase() === "NON-TAX INVOICE";
  const customHeaders = invoice.customHeaders || [];
  const items = invoice.items || [];

  // Determine whether the Activity column should be printed (only if any item has a non-blank Activity value)
  const showActivityColumn = items.some((item: any) => item?.activity && String(item.activity).trim() !== "");

  // Filter custom Billing Item columns: keep only columns where at least one item has a non-blank value
  const visibleCustomHeaders = customHeaders.filter((_: string, idx: number) =>
    items.some((item: any) => item?.customValues?.[idx] !== undefined && String(item.customValues[idx]).trim() !== "")
  );

  const docTypeLabel = useMemo(() => {
    const t = invoice.docType?.toUpperCase() || "";
    if (t.includes("CREDIT NOTE")) return { no: "Credit Note Number", header: "CREDIT NOTE" };
    if (t.includes("DEBIT NOTE")) return { no: "Debit Note Number", header: "DEBIT NOTE" };
    if (t.includes("DELIVERY CHALLAN")) return { no: "Delivery Challan Number", header: "DELIVERY CHALLAN" };
    return { no: "Invoice Number", header: isNonTax ? "NON-TAX INVOICE" : "TAX INVOICE" };
  }, [invoice.docType, isNonTax]);

  // Logic: Hide Ship To if identical to Bill To
  const isShipToApplicable = invoice.shipTo && invoice.shipTo !== invoice.billTo;

  return (
    <div className="bg-white p-10 font-sans text-[11px] text-black border-2 border-black max-w-[800px] mx-auto overflow-hidden invoice-container relative min-h-[1100px] flex flex-col">
      {invoice.status === "Cancelled" && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.1] z-0 select-none">
          <h1 className="text-[200px] font-black text-red-600 rotate-[-45deg] whitespace-nowrap uppercase tracking-tighter watermark-text">CANCEL</h1>
        </div>
      )}
      <div className="relative z-10 flex-1 flex flex-col">
        <div className="py-1.5 flex justify-between px-2 font-bold text-[16px] text-black mb-3">
          <span className="text-center flex-1 uppercase tracking-[0.2em]">
            <span className="border-b-2 border-black pb-1 inline-block">
              {docTypeLabel.header}
            </span>
          </span>
        </div>

        <div className="flex justify-between items-start mb-4">
          <div className="flex gap-4 items-start">
            {firm?.logoData ? (
              <div className="w-16 h-16 relative border border-gray-200"><Image src={firm.logoData} alt="Logo" fill className="object-contain" /></div>
            ) : (
              <div className="w-16 h-16 bg-gray-100 flex items-center justify-center font-bold text-gray-400">LOGO</div>
            )}
            <div className="leading-tight">
              <h1 className="text-sm font-black uppercase mb-1">{firm?.name || "SIKKA INDUSTRIES AND LOGISTICS"}</h1>
              <p className="max-w-xs">{firm?.address || "PLOT NO. C-17, INDUSTRIAL AREA, SSGT ROAD, GHAZIABAD 201009"}</p>
              <p className="font-bold mt-1">GSTIN: {firm?.gstin || "09AYQPS6936B1ZV"} | PAN: {firm?.pan || "AYQPS6936B"}</p>
              <p>State: {firm?.state?.toUpperCase() || "UTTAR PRADESH"} (Code: {firm?.stateCode || "09"})</p>
              <p>Contact: {firm?.mobile || "9911008000"} | Email: {firm?.email || "sil@sikkaenterprises.com"}</p>
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-[10px] font-bold uppercase mb-4">{copyLabel}</h2>
            <h3 className="text-[10px] font-bold text-center uppercase mb-1">e-Invoice</h3>
            <div className="w-24 h-24 bg-gray-50 border border-black ml-auto flex flex-col items-center justify-center text-center">
              {invoice.qrData ? (
                <div className="relative w-full h-full"><Image src={invoice.qrData} alt="QR" fill className="object-contain" /></div>
              ) : (
                <span className="text-[8px] text-gray-400 text-center px-1 uppercase font-bold opacity-40">QR Code</span>
              )}
            </div>
          </div>
        </div>

        {!isNonTax && invoice.irnNumber && (
          <div className="border-y-2 border-black mb-3 p-2 space-y-1.5 bg-gray-50">
            <p className="break-all leading-tight text-left">
              <span className="text-[11px] text-gray-500 font-bold block">IRN: {invoice.irnNumber || "N/A"}</span>
            </p>
            <div className="grid grid-cols-2 gap-x-4 text-[11px]">
              <p className="text-left">
                <span className="text-[10px] text-gray-500 font-bold uppercase">Ack No:</span> <span className="font-mono font-bold ml-1">{invoice.ackNo || "N/A"}</span>
              </p>
              <p className="text-left"><span className="text-[10px] text-gray-500 font-bold uppercase">Ack Date:</span> <span className="font-bold ml-1">{invoice.ackDate || "N/A"}</span></p>
            </div>
          </div>
        )}

        <div className="mb-3 px-2">
          <div className="flex justify-between items-center mb-2">
            <div className="flex-1">
              <p className="text-[11px] font-black"><span className="text-[10px] text-gray-500 font-bold uppercase">{docTypeLabel.no}:</span> {invoice.invoiceNumber}</p>
            </div>
            <div className="flex-1 text-center">
              <p className="text-[11px] font-bold"><span className="text-[9px] text-gray-500 font-bold uppercase">Date:</span> {invoice.invoiceDate}</p>
            </div>
            <div className="flex-1 text-right">
              <p className="text-[11px] font-bold uppercase"><span className="text-[9px] text-gray-500 font-bold uppercase">Working Month:</span> {invoice.billMonth}</p>
            </div>
          </div>
          {!isNonTax && (
            <div className="grid grid-cols-2 gap-x-0 text-[10px] border-t border-gray-100 pt-2 mt-2">
              <p className="text-left"><span className="text-[8px] text-gray-500 font-bold uppercase">Plant:</span> <span className="font-mono font-bold ml-1">{invoice.plantId}</span></p>
              <p className="text-left"><span className="text-[8px] text-gray-500 font-bold uppercase">Charge Type:</span> <span className="font-bold ml-1 uppercase">{invoice.docCategory}</span></p>
            </div>
          )}
        </div>

        <div className={cn("grid gap-0 border-y-2 border-black mb-3", isShipToApplicable ? "grid-cols-2" : "grid-cols-1")}>
          <div className={cn("p-3 pb-6", isShipToApplicable && "border-r border-black")}>
            <h3 className="font-bold mb-2 text-[10px] uppercase underline">Bill to Party</h3>
            <p className="font-black text-[12px] mb-1">{billToCust?.name?.toUpperCase()}</p>
            <p className={cn("whitespace-pre-wrap", isShipToApplicable ? "max-w-[280px]" : "max-w-full")}>{billToCust?.address}</p>
            <p>State: {billToCust?.stateName?.toUpperCase() || "N/A"} (Code: {billToCust?.stateCode || ""})</p>
            <p className="font-bold mt-1 uppercase">GSTIN: {billToCust?.gstin} {billToCust?.pan && `| PAN: ${billToCust.pan}`}</p>
          </div>
          {isShipToApplicable && (
            <div className="p-3 pb-6 pl-4">
              <h3 className="font-bold mb-2 text-[10px] uppercase underline">SHIP TO</h3>
              <p className="font-black text-[12px] mb-1">{shipToCust?.name?.toUpperCase()}</p>
              <p className="max-w-[280px] whitespace-pre-wrap">{shipToCust?.address}</p>
              <p>State: {shipToCust?.stateName?.toUpperCase() || "N/A"} (Code: {shipToCust?.stateCode || ""})</p>
              <p className="font-bold mt-1 uppercase">GSTIN: {shipToCust?.gstin} {shipToCust?.pan && `| PAN: ${shipToCust.pan}`}</p>
            </div>
          )}
        </div>

        <table className="w-full border-x border-black">
          <thead>
            <tr className="bg-white text-[10px] font-bold border-b-2 border-black">
              <th className="border-r border-black w-8 text-center py-2">#</th>
              <th className="border-r border-black text-left py-2 px-2">Item Description</th>{/* Activity Column */}
              {showActivityColumn && <th className="border-r border-black text-left py-2">Activity</th>}
              {visibleCustomHeaders.map((header: string, i: number) => (
                <th key={i} className="border-r border-black text-center py-2">{header}</th>
              ))}
              <th className="border-r border-black w-20 text-center py-2">HSN/SAC</th>{/* No newline */}
              <th className="border-r border-black w-16 text-center py-2">Qty</th>
              <th className="border-r border-black w-16 text-center py-2">UOM</th>
              <th className="border-r border-black w-14 text-center py-2">Rate</th>
              <th className="w-28 text-right py-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items?.map((item: any, idx: number) => (
              <tr key={idx} className="border-b border-gray-200 h-9 text-[10px] font-normal">
                <td className="border-r border-black text-center text-[10px] font-normal">{idx + 1}</td>
                <td className="border-r border-black uppercase px-2 text-[10px] font-normal">{item.descName || item.desc}</td>
                {showActivityColumn && (
                  <td className="border-r border-black text-left px-2 text-[10px] font-normal">{item.activity || "-"}</td>
                )}
                {visibleCustomHeaders.map((_: string, vi: number) => {
                  const origIdx = customHeaders.indexOf(visibleCustomHeaders[vi]);
                  return (
                    <td key={vi} className="border-r border-black text-center px-2 text-[10px] font-normal">{item.customValues?.[origIdx] || "-"}</td>
                  );
                })}
                <td className="border-r border-black text-center text-[10px] font-normal">{item.hsn}</td>
                <td className="border-r border-black text-center text-[10px] font-normal">{item.qty}</td>
                <td className="border-r border-black text-center text-[10px] font-normal">{item.uom}</td>
                <td className="border-r border-black text-center text-[10px] font-normal">{parseFloat(item.rate).toFixed(2)}</td>
                <td className="text-right px-2 text-[10px] font-normal">{parseFloat(item.amount).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex border-x border-b border-black">
          <div className="flex-1 border-r border-black p-2"></div>
          <div className="w-[300px]">
            {!isNonTax ? (
              <>
                <div className="flex justify-between px-2 py-1.5 font-bold border-b border-gray-200 bg-gray-50/30">
                  <span>Taxable Amount</span>
                  <span>{taxable.toFixed(2)}</span>
                </div>
                {isInterstate ? (
                  <div className="flex justify-between px-2 py-1.5 border-b border-gray-200 italic text-gray-700">
                    <span>IGST @ {avgGst}%</span>
                    <span>{igst.toFixed(2)}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between px-2 py-1.5 border-b border-gray-200">
                      <span className="font-medium">CGST @ {avgGst / 2}%</span>
                      <span>{cgst.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between px-2 py-1.5 border-b border-gray-200">
                      <span className="font-medium">SGST @ {avgGst / 2}%</span>
                      <span>{sgst.toFixed(2)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between px-2 py-1.5 border-b border-gray-200 text-gray-500">
                  <span>Round Off</span>
                  <span>{roundOff}</span>
                </div>
              </>
            ) : (
              <div className="px-2 py-4 text-center border-b border-gray-200 text-gray-400 italic">
                No taxes applicable for Non-Tax Invoice
              </div>
            )}
            <div className="flex justify-between px-2 py-2.5 font-black text-[13px] bg-gray-100 border-t-2 border-black uppercase">
              <span>{isNonTax ? "Net Total Amount" : "Net Payable Amount"}</span>
              <span>₹ {roundedTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        <div className="border-x border-b-2 border-black p-3 bg-white font-bold italic">
          Amount in Words: {numberToWords(roundedTotal)}
        </div>

        {invoice.note && (
          <div className="border-x border-b-2 border-black p-3 bg-white font-bold italic">
            Note: <span className="font-normal not-italic uppercase">{invoice.note}</span>
          </div>
        )}

        <div className="mt-auto flex justify-between items-end pb-2 pt-6">
          <div className="flex-1">
            {firm?.bankName && firm?.accountNumber && (
              <div className="border-2 border-black p-3 relative h-28 w-64">
                <h4 className="text-[10px] font-bold uppercase underline">Bank Details:</h4>
                <p className="mt-1 font-bold">Bank: <span className="font-normal uppercase">{firm.bankName}</span></p>
                <p className="font-bold">A/c No: <span className="font-normal uppercase">{firm.accountNumber}</span></p>
                <p className="font-bold">IFSC: <span className="font-normal uppercase">{firm.ifscCode}</span></p>
              </div>
            )}
          </div>
          <div className="text-right pr-4">
            <p className="font-bold text-[10px] uppercase border-t border-black pt-1 inline-block min-w-[150px] text-center">Authorized Signature</p>
          </div>
        </div>
      </div>
    </div>
  );
};

/** Downloads the invoice as a PDF-like HTML file named by Invoice Number only */
const downloadInvoice = (invoice: any, firms: any[] | null, customerMap: Record<string, any>) => {
  const content = document.getElementById('invoice-print-area')?.innerHTML;
  if (!content) return;

  const html = `
    <html>
      <head>
        <title>${invoice.invoiceNumber}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          @page { size: A4 portrait; margin: 0; }
          body { font-family: 'Inter', sans-serif; padding: 0; margin: 0; background: white; -webkit-print-color-adjust: exact; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #000; padding: 4px 6px; }
          .invoice-container { margin: 0 !important; }
          .watermark-text { opacity: 0.1 !important; color: #dc2626 !important; }
          .page-break { page-break-after: always; }
        </style>
      </head>
      <body>
        ${content}
      </body>
    </html>
  `;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${invoice.invoiceNumber}.pdf`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  window.dispatchEvent(new CustomEvent('sap-status', {
    detail: { text: `Invoice ${invoice.invoiceNumber} downloaded`, isError: false }
  }));
};

export default function VF03() {
  const db = useDatabase();
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [authorizedPlantIds, setAuthorizedPlantIds] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [filterPlants, setFilterPlants] = useState<string[]>([]);

  const closePreview = useCallback(() => {
    setIsPreviewOpen(false);
    setSelectedInvoice(null);
    if (typeof document !== "undefined") {
      document.body.style.pointerEvents = "";
    }
  }, []);

  // Ensure pointer-events is cleaned up whenever preview closes
  useEffect(() => {
    if (!isPreviewOpen && typeof document !== "undefined") {
      document.body.style.pointerEvents = "";
    }
  }, [isPreviewOpen]);

  // Handle Esc key directly to close preview and prevent page freeze
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isPreviewOpen) {
        e.preventDefault();
        e.stopPropagation();
        closePreview();
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isPreviewOpen, closePreview]);

  // Handle SAP cancel events
  useEffect(() => {
    const handleCancel = () => {
      if (isPreviewOpen) {
        closePreview();
      }
    };
    window.addEventListener("sap-toolbar-cancel", handleCancel);
    window.addEventListener("sap-cancel", handleCancel);
    return () => {
      window.removeEventListener("sap-toolbar-cancel", handleCancel);
      window.removeEventListener("sap-cancel", handleCancel);
    };
  }, [isPreviewOpen, closePreview]);

  // Date range filters (Default 1 week)
  const initialDates = useMemo(() => getInitialDates(), []);
  const [fromDate, setFromDate] = useState(initialDates.from);
  const [toDate, setToDate] = useState(initialDates.to);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageJumpInput, setPageJumpInput] = useState("");
  const PAGE_SIZE = 15;

  useEffect(() => {
    const stored = localStorage.getItem("sikka_user");
    if (stored) {
      const parsed = JSON.parse(stored);
      setIsAdmin(parsed.username === "ajaysomra" || parsed.role === 'admin');
      setAuthorizedPlantIds(parsed.assignedPlantIds || []);
    }
  }, []);

  const invoicesQuery = useMemoDatabase(() => query(collection(db, "sales_invoices"), orderBy("createdAt", "desc")), [db]);
  const { data: invoices, isLoading: isInvoicesLoading } = useCollection(invoicesQuery);
  const customersQuery = useMemoDatabase(() => collection(db, "customers"), [db]);
  const { data: customers } = useCollection(customersQuery);
  const firmsQuery = useMemoDatabase(() => collection(db, "firms"), [db]);
  const { data: firms } = useCollection(firmsQuery);
  const plantsQuery = useMemoDatabase(() => collection(db, "plants"), [db]);
  const { data: plants } = useCollection(plantsQuery);

  const customerMap = useMemo(() => {
    const map: Record<string, any> = {};
    customers?.forEach(c => { map[c.customerId] = c; });
    return map;
  }, [customers]);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedData = useMemo(() => {
    if (!invoices) return [];

    let baseData = isAdmin ? invoices : invoices.filter(i => authorizedPlantIds.includes(i.plantId));

    // Apply multi-plant filter
    if (filterPlants.length > 0) {
      baseData = baseData.filter(i => filterPlants.includes(i.plantId));
    }

    // Apply Date Range Filter (From Date - To Date)
    if (fromDate || toDate) {
      baseData = baseData.filter(i => {
        const invDate = i.invoiceDate || i.createdAt;
        return matchesDateRange(invDate, fromDate, toDate);
      });
    }

    const filtered = baseData.filter(i => {
      const consigneeName = i.snapshotBillTo?.name || customerMap[i.billTo]?.name || "";
      const searchLower = search.toLowerCase();
      return i.invoiceNumber?.toLowerCase().includes(searchLower) ||
        i.billTo?.toLowerCase().includes(searchLower) ||
        consigneeName.toLowerCase().includes(searchLower) ||
        i.plantId?.toLowerCase().includes(searchLower) ||
        i.inventoryType?.toLowerCase().includes(searchLower) ||
        i.status?.toLowerCase().includes(searchLower);
    });
    if (!sortConfig) return filtered;
    return [...filtered].sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];
      if (sortConfig.key.includes('.')) {
        const parts = sortConfig.key.split('.');
        aVal = a[parts[0]]?.[parts[1]];
        bVal = b[parts[0]]?.[parts[1]];
      }
      if (typeof aVal === 'number' && typeof bVal === 'number') return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      const aStr = String(aVal || "").toLowerCase();
      const bStr = String(bVal || "").toLowerCase();
      if (aStr < bStr) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aStr > bStr) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [invoices, search, sortConfig, isAdmin, authorizedPlantIds, customerMap, filterPlants, fromDate, toDate]);

  // Reset to first page whenever filters/search change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterPlants, authorizedPlantIds, isAdmin, fromDate, toDate]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedData = sortedData.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const goToPage = (page: number) => {
    setCurrentPage(Math.min(Math.max(1, page), totalPages));
  };

  const handlePageJump = () => {
    const p = parseInt(pageJumpInput, 10);
    if (!isNaN(p) && p >= 1) {
      goToPage(p);
    }
    setPageJumpInput("");
  };

  const handleCsvExport = () => {
    if (sortedData.length === 0) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "No records to export", isError: true } }));
      return;
    }
    const headers = ["#", "Output", "Plant", "Invoice Number", "Invoice Date", "Consignor Name", "Bill to Party Name", "Charge Type", "Taxable Amount", "CGST", "SGST", "IGST", "Gross Amount", "IRN Status"];
    const rows = sortedData.map((inv, i) => {
      const consigneeName = inv.snapshotBillTo?.name || (customerMap[inv.billTo] ? customerMap[inv.billTo].name : inv.billTo);
      const isNonTaxInv = inv.docType?.toUpperCase() === "NON-TAX INVOICE";
      const irnStatus = inv.status === "Cancelled" ? "Cancelled" : isNonTaxInv ? "Non-Tax" : (!inv.irnNumber ? "Pending IRN" : "Completed");
      return [
        i + 1,
        "",
        inv.plantId,
        inv.invoiceNumber,
        inv.invoiceDate,
        inv.consignorName || customerMap[inv.billTo]?.name || "-",
        consigneeName,
        inv.docCategory || "-",
        inv.totals?.taxableAmount || 0,
        inv.totals?.cgst || 0,
        inv.totals?.sgst || 0,
        inv.totals?.igst || 0,
        inv.totals?.grossAmount || 0,
        irnStatus,
      ];
    });
    downloadCsv("VF03", headers, rows);
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortConfig?.key !== column) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
    return sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3 ml-1 text-blue-600" /> : <ChevronDown className="h-3 w-3 ml-1 text-blue-600" />;
  };

  const handlePrint = (invoiceNumber?: string) => {
    const invNo = invoiceNumber || selectedInvoice?.invoiceNumber || "Invoice";
    const printWindow = window.open('', '_blank');
    const content = document.getElementById('invoice-print-area')?.innerHTML;
    if (printWindow && content) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${invNo}</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
              @page { size: A4 portrait; margin: 0; }
              @media print {
                body { padding: 0; margin: 0; background: white; -webkit-print-color-adjust: exact; }
                .no-print { display: none; }
                .page-break { page-break-after: always; }
                #invoice-print-area { width: 100% !important; max-width: none !important; margin: 0 !important; padding: 0 !important; }
                .invoice-container { margin: 0 !important; border-top: none !important; border-left: none !important; border-right: none !important; border-bottom: none !important; }
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
      printWindow.document.close();
    }
  };

  return (
    <div className="w-full flex flex-col bg-white min-h-full">
      <div className="sap-header-title">Billing Documents List: ALV Grid</div>

      <div className="sap-selection-area">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex items-center bg-white border border-gray-400 h-7 w-60 px-1 group focus-within:border-blue-500 shadow-inner">
              <Search className="h-3.5 w-3.5 text-gray-400 mr-1 shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-full text-xs outline-none bg-transparent"
                placeholder="Search Invoice / Status..."
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="text-gray-400 hover:text-red-600 text-xs px-1"
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Plant MultiSelect */}
            <div className="w-52">
              <PlantMultiSelect
                plants={plants}
                selected={filterPlants}
                onChange={setFilterPlants}
                allowedPlantIds={isAdmin ? undefined : authorizedPlantIds}
                placeholder="Filter by Plant(s)"
              />
            </div>

            {/* From Date */}
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-bold text-gray-700 uppercase whitespace-nowrap">From:</label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-7 w-36 text-xs bg-white border-gray-400 rounded-none px-2 shadow-inner focus:bg-[#fff9c4]"
              />
            </div>

            {/* To Date */}
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-bold text-gray-700 uppercase whitespace-nowrap">To:</label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-7 w-36 text-xs bg-white border-gray-400 rounded-none px-2 shadow-inner focus:bg-[#fff9c4]"
              />
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const init = getInitialDates();
                  setFromDate(init.from);
                  setToDate(init.to);
                }}
                className="h-7 text-[10px] font-bold uppercase rounded-none bg-white border-gray-400 text-gray-700 hover:bg-gray-100 px-2"
                title="Filter to Last 7 Days (1 Week)"
              >
                1 Week
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setFromDate("");
                  setToDate("");
                }}
                className="h-7 text-[10px] font-bold uppercase rounded-none bg-white border-gray-400 text-gray-700 hover:bg-gray-100 px-2"
                title="Show All Dates"
              >
                All Dates
              </Button>
              {(fromDate || toDate || filterPlants.length > 0 || search) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const init = getInitialDates();
                    setFromDate(init.from);
                    setToDate(init.to);
                    setFilterPlants([]);
                    setSearch("");
                  }}
                  className="h-7 text-[10px] font-bold uppercase text-red-600 hover:bg-red-50 hover:text-red-700 px-2 flex items-center gap-1"
                  title="Reset all filters to default"
                >
                  <RotateCcw className="h-3 w-3" /> Reset
                </Button>
              )}
            </div>
          </div>

          {/* Records & CSV Download */}
          <div className="flex items-center gap-3">
            <div className="text-[11px] font-bold text-gray-700 uppercase tracking-tight bg-gray-100 border border-gray-300 px-2.5 py-1 rounded-sm shadow-sm whitespace-nowrap">
              Records: <span className="text-blue-900 font-extrabold">{sortedData.length}</span>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={handleCsvExport} className="p-1 hover:bg-blue-100 rounded text-blue-700 transition-colors" title="Download CSV">
                    <FileDown className="h-5 w-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Download CSV</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto no-scrollbar">
        <Table className="min-w-[1900px] sap-alv-grid">
          <TableHeader className="sap-alv-header">
            <TableRow className="h-8">
              <TableHead className="w-10 text-center text-[10px] font-bold border-r w-12 text-center">#</TableHead>
              <TableHead className="text-[11px] font-bold border-r w-16 text-center">Output</TableHead>
              <TableHead onClick={() => handleSort('plantId')} className="text-[11px] font-bold border-r w-24 text-center cursor-pointer hover:bg-gray-200">
                <div className="flex items-center justify-center">Plant <SortIcon column="plantId" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('invoiceNumber')} className="text-[11px] font-bold border-r w-32 cursor-pointer hover:bg-gray-200">
                <div className="flex items-center">Invoice Number <SortIcon column="invoiceNumber" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('invoiceDate')} className="text-[11px] font-bold border-r w-32 cursor-pointer hover:bg-gray-200">
                <div className="flex items-center">Invoice Date <SortIcon column="invoiceDate" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('consignorName')} className="text-[11px] font-bold border-r cursor-pointer hover:bg-gray-200">
                <div className="flex items-center">Consignor Name <SortIcon column="consignorName" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('billTo')} className="text-[11px] font-bold border-r cursor-pointer hover:bg-gray-200">
                <div className="flex items-center">Bill to Party Name <SortIcon column="billTo" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('docCategory')} className="text-[11px] font-bold border-r cursor-pointer hover:bg-gray-200">
                <div className="flex items-center">Charge Type <SortIcon column="docCategory" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('totals.taxableAmount')} className="text-[11px] font-bold border-r w-32 text-right cursor-pointer hover:bg-gray-200">
                <div className="flex items-center justify-end">Taxable Amount <SortIcon column="totals.taxableAmount" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('totals.cgst')} className="text-[11px] font-bold border-r w-32 text-right cursor-pointer hover:bg-gray-200">
                <div className="flex items-center justify-end">CGST <SortIcon column="totals.cgst" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('totals.sgst')} className="text-[11px] font-bold border-r w-32 text-right cursor-pointer hover:bg-gray-200">
                <div className="flex items-center justify-end">SGST <SortIcon column="totals.sgst" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('totals.igst')} className="text-[11px] font-bold border-r w-32 text-right cursor-pointer hover:bg-gray-200">
                <div className="flex items-center justify-end">IGST <SortIcon column="totals.igst" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('totals.grossAmount')} className="text-[11px] font-bold border-r text-right w-40 cursor-pointer hover:bg-gray-200">
                <div className="flex items-center justify-end">Gross Amount <SortIcon column="totals.grossAmount" /></div>
              </TableHead>
              <TableHead className="text-[11px] font-bold border-r w-32 text-center">IRN Status</TableHead>
              <TableHead className="w-20 text-center text-[11px] font-bold">Download</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isInvoicesLoading ? (
              <TableRow><TableCell colSpan={15} className="text-center py-10 text-xs">LOADING...</TableCell></TableRow>
            ) : sortedData.length === 0 ? (
              <TableRow><TableCell colSpan={15} className="text-center py-10 text-xs text-red-500 font-bold uppercase">Please select at least one Plant.</TableCell></TableRow>
            ) : paginatedData.map((inv, i) => {
              const consigneeName = inv.snapshotBillTo?.name || (customerMap[inv.billTo] ? customerMap[inv.billTo].name : inv.billTo);
              const rowNumber = (safePage - 1) * PAGE_SIZE + i + 1;

              const isNonTax = inv.docType?.toUpperCase() === "NON-TAX INVOICE";
              const isPending = !inv.irnNumber && !isNonTax;
              const isCancelled = inv.status === "Cancelled";
              const irnStatus = isCancelled ? (
                <span className="bg-gray-100 text-red-600 px-2 py-0.5 rounded-full font-black border border-red-200 inline-flex items-center gap-1 uppercase tracking-tighter">Cancelled</span>
              ) : isNonTax ? (
                <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-bold border border-blue-200 inline-flex items-center gap-1 uppercase tracking-tighter">Non-Tax</span>
              ) : isPending ? (
                <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded-full font-bold border border-red-200 inline-flex items-center gap-1 uppercase tracking-tighter"><Clock className="h-2.5 w-2.5" /> Pending IRN</span>
              ) : (
                <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold border border-emerald-200 inline-flex items-center gap-1 uppercase tracking-tighter"><CheckCircle2 className="h-2.5 w-2.5" /> Completed</span>
              );
              return (
                <TableRow key={inv.id} className="h-8 hover:bg-blue-50/20 transition-colors border-b border-gray-100 group">
                  <TableCell className="p-0 text-center text-[10px] border-r text-gray-400 group-hover:text-blue-600">{rowNumber}</TableCell>
                  <TableCell className="p-0 border-r text-center">
                    <button
                      onClick={() => {
                        setSelectedInvoice(inv);
                        setIsPreviewOpen(true);
                      }}
                      className="p-1 hover:text-blue-600 transition-colors cursor-pointer"
                      title="Preview & Print Invoice"
                    >
                      <PrinterIcon className="h-3.5 w-3.5" />
                    </button>
                  </TableCell>
                  <TableCell className="p-0 px-2 text-[11px] border-r text-center font-bold text-gray-600">{inv.plantId}</TableCell>
                  <TableCell className="p-0 px-2 text-[11px] border-r font-bold text-blue-700 font-mono">{inv.invoiceNumber}</TableCell>
                  <TableCell className="p-0 px-2 text-[11px] border-r font-mono">{inv.invoiceDate}</TableCell>
                  <TableCell className="p-0 px-2 text-[11px] border-r text-gray-600 truncate max-w-[150px]">{inv.consignorName || customerMap[inv.billTo]?.name || "-"}</TableCell>
                  <TableCell className="p-0 px-2 text-[11px] border-r text-gray-700 truncate max-w-[180px]">{consigneeName}</TableCell>
                  <TableCell className="p-0 px-2 text-[11px] border-r text-center uppercase">{inv.docCategory || "-"}</TableCell>
                  <TableCell className="p-0 px-2 text-[11px] border-r text-right pr-2 text-gray-600">₹ {(inv.totals?.taxableAmount || 0).toLocaleString()}</TableCell>
                  <TableCell className="p-0 px-2 text-[11px] border-r text-right pr-2 text-gray-600">₹ {(inv.totals?.cgst || 0).toLocaleString()}</TableCell>
                  <TableCell className="p-0 px-2 text-[11px] border-r text-right pr-2 text-gray-600">₹ {(inv.totals?.sgst || 0).toLocaleString()}</TableCell>
                  <TableCell className="p-0 px-2 text-[11px] border-r text-right pr-2 text-gray-600">₹ {(inv.totals?.igst || 0).toLocaleString()}</TableCell>
                  <TableCell className="p-0 px-2 text-[11px] border-r text-right font-black text-emerald-800 pr-2">₹ {(inv.totals?.grossAmount || 0).toLocaleString()}</TableCell>
                  <TableCell className="p-0 px-2 text-[10px] border-r text-center">{irnStatus}</TableCell>
                  <TableCell className="p-0 text-center">
                    <button
                      onClick={() => downloadInvoice(inv, firms, customerMap)}
                      className="p-1 hover:text-blue-600 text-blue-500"
                      title="Download Invoice"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {sortedData.length > 0 && (
        <div className="bg-[#333e4f] border-t border-black/30 px-4 py-2 flex items-center justify-between gap-4">
          <div className="text-[10px] font-bold text-white/80 uppercase tracking-widest">
            Page {safePage} of {totalPages} • {sortedData.length} Records
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-6 rounded-none text-[10px] font-bold border-white/30 bg-white/10 text-white hover:bg-white/20 gap-1"
              onClick={() => goToPage(safePage - 1)}
              disabled={safePage <= 1}
            >
              <ChevronUp className="h-3 w-3 rotate-180" /> Previous Page
            </Button>
            <div className="flex items-center gap-1 bg-white/10 border border-white/30 px-2 h-6">
              <span className="text-[9px] font-bold text-white/70 uppercase">Jump to</span>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={pageJumpInput}
                onChange={e => setPageJumpInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handlePageJump()}
                className="w-12 h-4 text-center text-[10px] bg-white text-gray-800 outline-none rounded-sm"
                placeholder={String(safePage)}
              />
              <button
                onClick={handlePageJump}
                className="text-white/80 hover:text-white text-[10px] font-bold uppercase"
              >
                Go
              </button>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-6 rounded-none text-[10px] font-bold border-white/30 bg-white/10 text-white hover:bg-white/20 gap-1"
              onClick={() => goToPage(safePage + 1)}
              disabled={safePage >= totalPages}
            >
              Next Page <ChevronDown className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Invoice Output & Print Preview Dialog */}
      <Dialog
        open={isPreviewOpen}
        onOpenChange={(open) => {
          if (!open) {
            closePreview();
          } else {
            setIsPreviewOpen(true);
          }
        }}
      >
        <DialogContent
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            closePreview();
          }}
          onPointerDownOutside={() => closePreview()}
          className="max-w-[850px] max-h-[98vh] overflow-y-auto p-0 rounded-none border-none shadow-2xl"
        >
          {selectedInvoice && (
            <>
              <div className="bg-[#333e4f] p-2 flex justify-between items-center text-white sticky top-0 z-50">
                <DialogTitle className="text-[11px] font-bold uppercase tracking-widest pl-2">
                  Document Output: {selectedInvoice.invoiceNumber}
                </DialogTitle>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handlePrint(selectedInvoice.invoiceNumber)}
                    className="h-7 rounded-none bg-emerald-600 hover:bg-emerald-700 gap-2 text-[10px] font-bold px-4"
                  >
                    <Printer className="h-3.5 w-3.5" /> PRINT COPIES
                  </Button>
                  <DialogClose asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={closePreview}
                      className="h-7 w-7 text-white hover:bg-white/10 rounded-none cursor-pointer"
                      title="Close (Esc)"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </DialogClose>
                </div>
              </div>
              <div className="bg-white" id="invoice-print-area">
                <InvoicePreview invoice={selectedInvoice} copyLabel="ORIGINAL: FOR RECIPIENT" firms={firms} customerMap={customerMap} />
                <div className="page-break"></div>
                <InvoicePreview invoice={selectedInvoice} copyLabel="DUPLICATE: FOR CONSIGNEE" firms={firms} customerMap={customerMap} />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
