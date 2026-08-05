
"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useDatabase, useCollection, useMemoDatabase, updateDocumentNonBlocking, addDocumentNonBlocking } from "@/database";
import { collection, query, where, getDocs, doc, serverTimestamp } from "@/database/mongo";
import { Search, Loader2, XCircle, Printer, CheckCircle2, AlertCircle, FileText, FileEdit, Calendar, Hash, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import Image from "next/image";
import { toSAPDate } from "@/lib/date-utils";
import { cn } from "@/lib/utils";
import { getRecordPlantIds } from "@/lib/plant-master";

// Utility to convert number to Indian words
function numberToWords(num: number): string {
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
}

export default function VF11() {
  const db = useDatabase();
  const [searchInvoiceNo, setSearchInvoiceNo] = useState("");
  const [searchPlantId, setSearchPlantId] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userName, setUserName] = useState("USER");

  // Cancellation / Credit Note State
  const [cnNumber, setCnNumber] = useState("");
  const [cnDate, setCnDate] = useState(new Date().toISOString().split('T')[0]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Master Data
  const plantsQuery = useMemoDatabase(() => collection(db, "plants"), [db]);
  const { data: plants } = useCollection(plantsQuery);
  const firmsQuery = useMemoDatabase(() => collection(db, "firms"), [db]);
  const { data: firms } = useCollection(firmsQuery);
  const customersQuery = useMemoDatabase(() => collection(db, "customers"), [db]);
  const { data: customers } = useCollection(customersQuery);

  const customerMap = useMemo(() => {
    const map: Record<string, any> = {};
    customers?.forEach(c => { map[c.customerId] = c; });
    return map;
  }, [customers]);

  useEffect(() => {
    const stored = localStorage.getItem("sikka_user");
    if (stored) {
      const parsed = JSON.parse(stored);
      const isSysAdmin = parsed.username === "ajaysomra" || parsed.role === 'admin';
      setIsAdmin(isSysAdmin);
      setUserName(parsed.name || parsed.username || "USER");
      if (!isSysAdmin && parsed.assignedPlantId) {
        setSearchPlantId(parsed.assignedPlantId);
      }
    }
  }, []);

  const handleSearch = async () => {
    if (!searchInvoiceNo || !searchPlantId) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Error: Enter Number and Plant ID", isError: true } }));
      return;
    }
    setIsSearching(true);
    try {
      const q = query(collection(db, "sales_invoices"), where("invoiceNumber", "==", searchInvoiceNo.toUpperCase()), where("plantId", "==", searchPlantId));
      const snap = await getDocs(q);
      if (snap.empty) {
        window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: `Document ${searchInvoiceNo} not found`, isError: true } }));
        setSelectedInvoice(null);
      } else {
        setSelectedInvoice({ ...snap.docs[0].data(), id: snap.docs[0].id });
        window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Document retrieved successfully", isError: false } }));
      }
    } catch (e) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "System Error: Search failed", isError: true } }));
    } finally {
      setIsSearching(false);
    }
  };

  const handleCancelInvoice = useCallback(async () => {
    if (!selectedInvoice || !cnNumber || !cnDate) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Error: Credit Note Number and Date are mandatory", isError: true } }));
      return;
    }

    setIsProcessing(true);
    try {
      const qCn = query(
        collection(db, "sales_invoices"), 
        where("invoiceNumber", "==", cnNumber.toUpperCase()),
        where("plantId", "==", selectedInvoice.plantId),
        where("docType", "==", "CREDIT NOTE")
      );
      
      const snapCn = await getDocs(qCn);
      if (!snapCn.empty) {
        window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Credit Note Number already exists.", isError: true } }));
        setIsProcessing(false);
        return;
      }

      const cancellationTime = new Date().toISOString();
      updateDocumentNonBlocking(doc(db, "sales_invoices", selectedInvoice.id), {
        status: "Cancelled",
        cancelledAt: cancellationTime,
        cancelledBy: userName,
        cancellationReference: cnNumber.toUpperCase(),
        creditNoteRef: cnNumber.toUpperCase(),
        creditNoteDate: toSAPDate(cnDate)
      });

      const creditNoteData = {
        ...selectedInvoice,
        id: undefined,
        docType: "CREDIT NOTE",
        invoiceNumber: cnNumber.toUpperCase(),
        invoiceDate: toSAPDate(cnDate),
        originalInvoiceRef: selectedInvoice.invoiceNumber,
        originalInvoiceDate: selectedInvoice.invoiceDate,
        status: "Completed",
        createdBy: userName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      addDocumentNonBlocking(collection(db, "sales_invoices"), creditNoteData);

      setSelectedInvoice({ 
        ...selectedInvoice, 
        status: "Cancelled", 
        cancelledBy: userName,
        creditNoteRef: cnNumber.toUpperCase(), 
        creditNoteDate: toSAPDate(cnDate) 
      });

      window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: `Document ${selectedInvoice.invoiceNumber} cancelled. Credit Note ${cnNumber} generated.`, isError: false } 
      }));
    } catch (e) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "CANCELLATION FAILED", isError: true } }));
    } finally {
      setIsProcessing(false);
    }
  }, [db, selectedInvoice, cnNumber, cnDate, userName]);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    const content = document.getElementById('cancelled-invoice-area')?.innerHTML;
    if (printWindow && content) {
      printWindow.document.write(`
        <html>
          <head>
            <title>DOCUMENT OUTPUT - ${selectedInvoice.invoiceNumber}</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
              @page { size: A4 portrait; margin: 0; }
              @media print { 
                body { padding: 0; margin: 0; background: white; -webkit-print-color-adjust: exact; } 
                #print-wrapper { width: 100% !important; margin: 0 !important; padding: 0 !important; } 
                .invoice-container { margin: 0 !important; border: none !important; }
                .watermark-text { opacity: 0.1 !important; color: #dc2626 !important; }
              }
              body { font-family: 'Inter', sans-serif; }
              table { width: 100%; border-collapse: collapse; }
              th, td { border: 1px solid #000; padding: 4px 6px; }
            </style>
          </head>
          <body onload="window.print(); window.close();">
            <div id="print-wrapper">${content}</div>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const InvoicePreview = ({ invoice, copyLabel }: { invoice: any; copyLabel: string }) => {
const firm = invoice.snapshotFirm || firms?.find(f => getRecordPlantIds(f).includes(invoice.plantId));
    const billToCust = invoice.snapshotBillTo || customerMap[invoice.billTo];
    const shipToCust = invoice.snapshotShipTo || customerMap[invoice.shipTo] || billToCust;
    
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
    
    const isCancelled = invoice.status === "Cancelled";
    const isCreditNote = invoice.docType === "CREDIT NOTE";
    const isNonTax = invoice.docType?.toUpperCase() === "NON-TAX INVOICE";

    const docTypeLabel = useMemo(() => {
      const t = invoice.docType?.toUpperCase() || "";
      if (t.includes("CREDIT NOTE")) return { no: "Credit Note Number", header: "CREDIT NOTE" };
      if (t.includes("DEBIT NOTE")) return { no: "Debit Note Number", header: "DEBIT NOTE" };
      if (t.includes("DELIVERY CHALLAN")) return { no: "Delivery Challan Number", header: "DELIVERY CHALLAN" };
      return { no: "Invoice Number", header: isNonTax ? "NON-TAX INVOICE" : "TAX INVOICE" };
    }, [invoice.docType, isNonTax]);

    const isShipToApplicable = invoice.shipTo && invoice.shipTo !== invoice.billTo;

    return (
      <div className="bg-white p-10 font-sans text-[11px] text-black border-2 border-black max-w-[800px] mx-auto relative overflow-hidden invoice-container min-h-[1100px] flex flex-col shadow-sm">
        {isCancelled && !isCreditNote && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.1] z-0 select-none">
            <h1 className="text-[200px] font-black text-red-600 rotate-[-45deg] whitespace-nowrap uppercase tracking-tighter watermark-text">CANCEL</h1>
          </div>
        )}
        <div className="relative z-10 flex-1 flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <div className="flex gap-4 items-start">
              {firm?.logoData ? (
                <div className="w-16 h-16 relative border border-gray-200"><Image src={firm.logoData} alt="Logo" fill className="object-contain" /></div>
              ) : (
                <div className="w-16 h-16 bg-gray-100 flex items-center justify-center font-bold text-gray-400">LOGO</div>
              )}
              <div className="leading-tight">
                <h1 className="text-sm font-black uppercase mb-1">{firm?.name || "SIKKA INDUSTRIES AND LOGISTICS"}</h1>
                <p className="max-w-xs">{firm?.address || "GHAZIABAD 201009"}</p>
                <p className="font-bold mt-1 uppercase">GSTIN: {firm?.gstin} | PAN: {firm?.pan}</p>
                <p>State: {firm?.state?.toUpperCase()} ({firm?.stateCode})</p>
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-[10px] font-bold uppercase mb-4">{copyLabel}</h2>
              <div className="w-20 h-20 bg-gray-50 border border-black ml-auto flex items-center justify-center">
                 {invoice.qrData ? <div className="relative w-full h-full"><Image src={invoice.qrData} alt="QR" fill className="object-contain" /></div> : <span className="text-[8px] text-gray-400 text-center px-1 uppercase font-bold opacity-30">QR Area</span>}
              </div>
            </div>
          </div>
          <div className="border-y-2 border-black py-1.5 flex justify-between px-2 font-bold text-[12px] bg-gray-50 mb-3">
            <span>Plant: {invoice.plantId}</span>
            <span className="text-center flex-1">{docTypeLabel.header}</span>
            <span className="text-right uppercase">{isCancelled ? "CANCELLED DOCUMENT" : (invoice.docCategory || "SERVICE")}</span>
          </div>
          <div className="mb-3 px-2">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="text-[13px] font-black"><span className="text-[9px] text-gray-500 font-bold uppercase">{docTypeLabel.no}:</span> {invoice.invoiceNumber}</p>
                {isCreditNote && <p className="text-[10px] text-red-700 font-bold mt-1 uppercase">Ref Original Invoice: {invoice.originalInvoiceRef}</p>}
                {isCancelled && invoice.creditNoteRef && <p className="text-[10px] text-blue-700 font-bold mt-1 uppercase">Issued Credit Note: {invoice.creditNoteRef}</p>}
              </div>
              <div className="text-right">
                <p className="text-[11px] font-bold"><span className="text-[9px] text-gray-500 font-bold uppercase">Date:</span> {invoice.invoiceDate}</p>
                <p className="text-[11px] font-bold uppercase"><span className="text-[9px] text-gray-500 font-bold uppercase">Working Month:</span> {invoice.billMonth}</p>
              </div>
            </div>
          </div>
          <div className={cn("grid gap-0 border-y-2 border-black mb-3", isShipToApplicable ? "grid-cols-2" : "grid-cols-1")}>
            <div className={cn("p-3 pb-6", isShipToApplicable && "border-r border-black")}>
              <h3 className="font-bold mb-1 underline text-[10px] uppercase">CONSIGNEE</h3>
              <p className="font-black text-[12px] mb-1">{billToCust?.name?.toUpperCase()}</p>
              <p className={cn("whitespace-pre-wrap", isShipToApplicable ? "max-w-[280px]" : "max-w-full")}>{billToCust?.address}</p>
              <p>State: {billToCust?.stateName?.toUpperCase()} ({billToCust?.stateCode})</p>
              <p className="font-bold mt-1 uppercase">GSTIN: {billToCust?.gstin} | PAN: {billToCust?.pan}</p>
            </div>
            {isShipToApplicable && (
              <div className="p-3 pb-6 pl-4">
                <h3 className="font-bold mb-1 underline text-[10px] uppercase">SHIP TO</h3>
                <p className="font-black text-[12px] mb-1">{(shipToCust?.name || billToCust?.name)?.toUpperCase()}</p>
                <p className="max-w-[280px] whitespace-pre-wrap">{shipToCust?.address || billToCust?.address}</p>
                <p>State: {(shipToCust?.stateName || billToCust?.stateName)?.toUpperCase()} ({shipToCust?.stateCode || shipToCust?.stateCode})</p>
                <p className="font-bold mt-1 uppercase">GSTIN: {shipToCust?.gstin || billToCust?.gstin}</p>
              </div>
            )}
          </div>
          <table className="w-full border-x border-black mb-4">
            <thead>
              <tr className="bg-white text-[10px] font-bold border-b-2 border-black">
                <th className="w-8 py-2">#</th>
                <th className="text-left py-2">Description</th>
                <th className="w-20 text-center py-2">HSN/SAC</th>
                <th className="w-16 text-center py-2">Qty</th>
                <th className="w-14 text-center py-2">Rate</th>
                <th className="w-28 text-right py-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items?.map((item: any, idx: number) => (
                <tr key={idx} className="border-b border-gray-200 h-10">
                  <td className="text-center">{idx + 1}</td>
                  <td className="font-bold uppercase">{item.desc}</td>
                  <td className="text-center font-mono">{item.hsn}</td>
                  <td className="text-center">{item.qty}</td>
                  <td className="text-center font-bold">{parseFloat(item.rate).toFixed(2)}</td>
                  <td className="text-right font-bold">{parseFloat(item.amount).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex border-x border-b border-black">
            <div className="flex-1 p-2"></div>
            <div className="w-[300px] border-l border-black">
              <div className="flex justify-between px-2 py-1.5 font-bold border-b border-gray-200 bg-gray-50/30">
                <span>Taxable Amount</span>
                <span>{taxable.toFixed(2)}</span>
              </div>
              {!isNonTax && (
                <>
                  <div className="flex justify-between px-2 py-1 flex-col">
                    <div className="flex justify-between">
                      <span className="font-medium">CGST @ {avgGst / 2}%</span>
                      <span>{cgst.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">SGST @ {avgGst / 2}%</span>
                      <span>{sgst.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between italic text-blue-800">
                      <span>IGST @ {avgGst}%</span>
                      <span>{igst.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="flex justify-between px-2 py-1.5 border-t border-gray-200 text-gray-500">
                    <span>Round Off</span>
                    <span>{roundOff}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between px-2 py-3 font-black text-[13px] bg-gray-100 border-t-2 border-black uppercase">
                <span>{isCreditNote ? "Net Reversed Amount" : "Net Payable Amount"}</span>
                <span>₹ {roundedTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
          <div className="border-x border-b-2 border-black p-3 bg-white font-bold italic">Amount in Words: {numberToWords(roundedTotal)}</div>
          
          {invoice.billType && (
            <div className="border-x border-b-2 border-black p-2 px-3 bg-gray-50/50 text-[10px] font-black text-blue-900 uppercase italic tracking-wider">
              {invoice.billType}
            </div>
          )}

          {invoice.note && (
            <div className="border-x border-b-2 border-black p-3 bg-white font-bold italic">
              Note: <span className="font-normal not-italic uppercase">{invoice.note}</span>
            </div>
          )}
          
          <div className="mt-auto flex justify-between items-end pt-4 pb-2 pr-4 pt-6">
            <div className="flex-1"></div>
            <div className="text-right">
              <p className="font-bold text-[10px] uppercase border-t border-black pt-1 inline-block min-w-[150px] text-center">Authorized Signature</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full flex flex-col bg-white min-h-full select-text">
      <div className="sap-header-title">VF11 - Cancel Billing Document</div>
      <div className="p-4 space-y-4 flex-1 overflow-auto">
        <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
          <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[11px] font-semibold text-gray-700 flex items-center gap-2"><Search className="h-3.5 w-3.5" /> Selection</div>
          <div className="p-3 grid grid-cols-3 gap-6 items-end">
            <div className="sap-selection-row"><label className="sap-label w-32">Number</label><Input value={searchInvoiceNo} onChange={e => setSearchInvoiceNo(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} /></div>
            <div className="sap-selection-row"><label className="sap-label w-24">Plant</label>
              <Select value={searchPlantId} onValueChange={setSearchPlantId} disabled={!isAdmin}>
                <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]"><SelectValue /></SelectTrigger>
                <SelectContent>{plants?.map(p => <SelectItem key={p.id} value={p.plantId}>{p.plantId} - {p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button onClick={handleSearch} disabled={isSearching} variant="outline" className="h-6 rounded-none text-[11px] font-bold border-gray-400 gap-2 hover:bg-white shadow-sm">{isSearching ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileEdit className="h-3.5 w-3.5" />} Fetch Data</Button>
          </div>
        </div>
        
        {selectedInvoice && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
             <div className={cn("border p-4 rounded-sm flex flex-col gap-4 shadow-sm", selectedInvoice.status === "Cancelled" ? "bg-red-50 border-red-200" : "bg-blue-50 border-blue-200")}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={selectedInvoice.status === "Cancelled" ? "text-red-700" : "text-blue-700"}>{selectedInvoice.status === "Cancelled" ? <AlertCircle className="h-10 w-10" /> : <FileText className="h-10 w-10" />}</div>
                    <div>
                      <h3 className="text-sm font-black uppercase">Document {selectedInvoice.invoiceNumber} ({selectedInvoice.plantId})</h3>
                      <p className="text-xs text-gray-600">Status: <span className="font-bold uppercase text-blue-800">{selectedInvoice.status || "Active"}</span></p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    {selectedInvoice.status !== "Cancelled" ? (
                      <Button 
                        onClick={handleCancelInvoice} 
                        disabled={isProcessing || !cnNumber || !cnDate}
                        className="rounded-none bg-red-700 hover:bg-red-800 text-white h-8 gap-2 uppercase text-xs font-black px-8 shadow-md"
                      >
                        {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} Cancel & Generate Credit Note
                      </Button>
                    ) : (
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-red-700 text-[10px] font-black uppercase">Cancellation Complete</p>
                          <p className="text-blue-700 text-[9px] font-bold uppercase italic">CN Ref: {selectedInvoice.creditNoteRef}</p>
                          <p className="text-gray-400 text-[8px] font-bold uppercase">By: {selectedInvoice.cancelledBy}</p>
                        </div>
                        <Button onClick={handlePrint} className="rounded-none bg-emerald-700 hover:bg-emerald-800 text-white h-8 gap-2 uppercase text-xs font-bold px-6 shadow-md"><Printer className="h-4 w-4" /> Print Output</Button>
                      </div>
                    )}
                  </div>
                </div>

                {selectedInvoice.status !== "Cancelled" && (
                  <div className="bg-white border border-blue-100 p-4 grid grid-cols-3 gap-6 items-end rounded-sm animate-in zoom-in-95">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-blue-900 uppercase flex items-center gap-1"><Hash className="h-3 w-3" /> Credit Note Number *</label>
                      <Input 
                        value={cnNumber} 
                        onChange={e => setCnNumber(e.target.value.toUpperCase())} 
                        placeholder="Required for Cancellation..."
                        className="border-blue-300 focus:bg-[#fffde7]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-blue-900 uppercase flex items-center gap-1"><Calendar className="h-3 w-3" /> Date *</label>
                      <Input 
                        type="date" 
                        value={cnDate} 
                        onChange={e => setCnDate(e.target.value)} 
                        className="border-blue-300 focus:bg-[#fffde7]"
                      />
                    </div>
                    <div className="text-[9px] text-blue-600 font-bold italic leading-tight pb-1">
                      Note: Cancellation will automatically generate a Credit Note reversal with identical line items and tax data.
                    </div>
                  </div>
                )}
             </div>

             <div className="border border-gray-200 bg-white p-6 shadow-inner"><div id="cancelled-invoice-area"><InvoicePreview invoice={selectedInvoice} copyLabel={selectedInvoice.status === 'Cancelled' ? "CANCELLED COPY" : "DRAFT CANCELLATION"} /></div></div>
          </div>
        )}
      </div>
    </div>
  );
}


