"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDatabase, useCollection, useMemoDatabase, updateDocumentNonBlocking } from "@/database";
import { collection, query, orderBy, doc } from "@/database/mongo";
import { Search, Loader2, QrCode, ArrowLeft, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import { toSAPDate } from "@/lib/date-utils";

export default function IRN01() {
  const db = useDatabase();
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [search, setSearch] = useState("");
  const [assignedPlantId, setAssignedPlantId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  const [irnData, setIrnData] = useState({
    irnNumber: "",
    ackNo: "",
    ackDate: new Date().toISOString().split('T')[0],
    qrData: "",
  });

  useEffect(() => {
    const stored = localStorage.getItem("sikka_user");
    if (stored) {
      const parsed = JSON.parse(stored);
      setIsAdmin(parsed.username === "ajaysomra" || parsed.role === 'admin');
      setAssignedPlantId(parsed.assignedPlantId || "");
    }
  }, []);

  const invoicesQuery = useMemoDatabase(() => query(collection(db, "sales_invoices"), orderBy("createdAt", "desc")), [db]);
  const { data: allInvoices, isLoading } = useCollection(invoicesQuery);
  const customersQuery = useMemoDatabase(() => collection(db, "customers"), [db]);
  const { data: customers } = useCollection(customersQuery);

  const customerMap = useMemo(() => {
    const map: Record<string, any> = {};
    customers?.forEach(c => { map[c.customerId] = c; });
    return map;
  }, [customers]);

  const filteredInvoices = useMemo(() => {
    if (!allInvoices) return [];
    let base = isAdmin ? allInvoices : allInvoices.filter(i => i.plantId === assignedPlantId);
    base = base.filter(i => (!i.irnNumber || i.irnNumber.trim() === "") && i.status !== "Cancelled");
    return base.filter(i => 
      i.invoiceNumber?.toLowerCase().includes(search.toLowerCase()) ||
      i.plantId?.toLowerCase().includes(search.toLowerCase()) ||
      customerMap[i.billTo]?.name?.toLowerCase().includes(search.toLowerCase()) ||
      customerMap[i.shipTo]?.name?.toLowerCase().includes(search.toLowerCase())
    );
  }, [allInvoices, search, isAdmin, assignedPlantId, customerMap]);

  const handleExecute = useCallback(() => {
    if (!selectedInvoice || !irnData.irnNumber || !irnData.ackNo) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Error: IRN and ACK details are mandatory", isError: true } }));
      return;
    }
    setIsGenerating(true);
    
    // Sync Invoice Date with ACK Date as per requirement
    const syncedDate = toSAPDate(irnData.ackDate);

    updateDocumentNonBlocking(doc(db, "sales_invoices", selectedInvoice.id), {
      ...irnData,
      invoiceDate: syncedDate, // Ensure Invoice Date is updated to match ACK Date
      ackDate: syncedDate,
      irnStatus: "Generated",
      irnUpdatedAt: new Date().toISOString()
    });

    window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: `IRN generated for invoice ${selectedInvoice.invoiceNumber}`, isError: false } }));
    setTimeout(() => {
      setSelectedInvoice(null);
      setIrnData({ irnNumber: "", ackNo: "", ackDate: new Date().toISOString().split('T')[0], qrData: "" });
      setIsGenerating(false);
    }, 500);
  }, [db, selectedInvoice, irnData]);

  if (selectedInvoice) {
    const consignee = customerMap[selectedInvoice.billTo];
    const shipTo = customerMap[selectedInvoice.shipTo] || consignee;
    const totals = selectedInvoice.totals || {};
    const item1 = selectedInvoice.items?.[0] || {};
    const gstPct = totals.avgGst || 0;
    const isInterstate = totals.isInterstate;

    return (
      <div className="w-full flex flex-col bg-white min-h-full select-text animate-in slide-in-from-right duration-300">
        <div className="bg-[#dae8f5] px-4 py-1 border-b border-gray-300 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => setSelectedInvoice(null)} className="p-1 hover:bg-black/5 rounded text-blue-800"><ArrowLeft className="h-4 w-4" /></button>
            <h2 className="text-[13px] font-bold text-gray-800 uppercase italic tracking-wider">Generate IRN: Invoice {selectedInvoice.invoiceNumber}</h2>
          </div>
        </div>
        <div className="p-4 space-y-4">
          <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
            <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[11px] font-semibold text-gray-700">Invoice Context</div>
            <div className="p-3 grid grid-cols-4 gap-x-6 gap-y-4 text-[11px]">
              {/* Row 1: Document Basics */}
              <div><label className="text-gray-500 block uppercase font-bold text-[9px]">Plant</label><span className="font-bold">{selectedInvoice.plantId}</span></div>
              <div><label className="text-gray-500 block uppercase font-bold text-[9px]">Invoice No</label><span className="font-bold text-blue-700">{selectedInvoice.invoiceNumber}</span></div>
              <div>
                <label className="text-gray-500 block uppercase font-bold text-[9px]">Date</label>
                {/* Visual sync with ACK Date */}
                <span className="font-bold text-emerald-700">{toSAPDate(irnData.ackDate)}</span>
              </div>
              <div><label className="text-gray-500 block uppercase font-bold text-[9px]">FY</label><span className="font-bold">{selectedInvoice.billYear}</span></div>
              
              {/* Row 2: Consignee Details */}
              <div><label className="text-gray-500 block uppercase font-bold text-[9px]">Consignee</label><span className="font-bold truncate">{consignee?.name || "N/A"}</span></div>
              <div><label className="text-gray-500 block uppercase font-bold text-[9px]">Consignee GSTIN</label><span className="font-bold font-mono">{consignee?.gstin || "N/A"}</span></div>
              <div><label className="text-gray-500 block uppercase font-bold text-[9px]">Consignee State</label><span className="font-bold">{consignee?.stateName || "N/A"}</span></div>
              <div><label className="text-gray-500 block uppercase font-bold text-[9px]">Document Type</label><span className="font-bold uppercase">{selectedInvoice.docType || "N/A"}</span></div>

              {/* Row 3: Ship To & Classification */}
              <div><label className="text-gray-500 block uppercase font-bold text-[9px]">Ship to Party</label><span className="font-bold truncate">{shipTo?.name || "N/A"}</span></div>
              <div><label className="text-gray-500 block uppercase font-bold text-[9px]">Ship to GSTIN</label><span className="font-bold font-mono">{shipTo?.gstin || "N/A"}</span></div>
              <div><label className="text-gray-500 block uppercase font-bold text-[9px]">Charge Type</label><span className="font-bold uppercase text-blue-800">{selectedInvoice.docCategory || "N/A"}</span></div>
              <div><label className="text-gray-500 block uppercase font-bold text-[9px]">HSN/SAC</label><span className="font-bold">{item1.hsn || "---"}</span></div>

              {/* Row 4: Item Details */}
              <div className="col-span-1"><label className="text-gray-500 block uppercase font-bold text-[9px]">Description</label><span className="font-bold truncate block">{item1.desc || "N/A"}</span></div>
              <div><label className="text-gray-500 block uppercase font-bold text-[9px]">Activity</label><span className="font-bold">{item1.activity || "---"}</span></div>
              <div><label className="text-gray-500 block uppercase font-bold text-[9px]">Qty</label><span className="font-bold">{item1.qty || 0}</span></div>
              <div><label className="text-gray-500 block uppercase font-bold text-[9px]">Rate</label><span className="font-bold">₹ {parseFloat(item1.rate || 0).toLocaleString()}</span></div>

              {/* Row 5: Financials & Taxes */}
              <div><label className="text-gray-500 block uppercase font-bold text-[9px]">Taxable Amount</label><span className="font-bold">₹ {totals.taxableAmount?.toLocaleString()}</span></div>

              {!isInterstate ? (
                <>
                  <div><label className="text-gray-500 block uppercase font-bold text-[9px]">CGST @ {gstPct / 2}%</label><span className="font-bold">₹ {(totals.cgst || 0).toLocaleString()}</span></div>
                  <div><label className="text-gray-500 block uppercase font-bold text-[9px]">SGST @ {gstPct / 2}%</label><span className="font-bold">₹ {(totals.sgst || 0).toLocaleString()}</span></div>
                </>
              ) : (
                <>
                  <div className="col-span-2"><label className="text-gray-500 block uppercase font-bold text-[9px]">IGST @ {gstPct}%</label><span className="font-bold">₹ {(totals.igst || 0).toLocaleString()}</span></div>
                </>
              )}

              <div className="bg-emerald-700 p-1.5 rounded-sm text-white col-span-4 flex justify-between items-center mt-2 shadow-sm">
                <span className="uppercase font-bold text-[9px] tracking-widest">Gross Payable Amount (Final Settlement)</span>
                <span className="font-black text-[13px]">₹ {selectedInvoice.totals?.grossAmount?.toLocaleString()}</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2 border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f0f4f8]">
              <div className="bg-[#dae8f5] px-3 py-1 border-b border-[#b5c7de] text-[12px] font-bold text-blue-900 flex items-center gap-2"><QrCode className="h-4 w-4" /> IRN Data Entry</div>
              <div className="p-4 space-y-4">
                <div className="sap-selection-row"><label className="sap-label w-40">IRN Number</label><Input value={irnData.irnNumber} onChange={e => setIrnData({...irnData, irnNumber: e.target.value})} className="font-mono text-[11px] tracking-widest uppercase" /></div>
                <div className="sap-selection-row"><label className="sap-label w-40">ACK Number</label><Input value={irnData.ackNo} onChange={e => setIrnData({...irnData, ackNo: e.target.value})} className="font-mono w-64" /></div>
                <div className="sap-selection-row"><label className="sap-label w-40">ACK Date</label><Input type="date" value={irnData.ackDate} onChange={e => setIrnData({...irnData, ackDate: e.target.value})} className="w-48" /></div>
              </div>
            </div>
            <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-white">
              <div className="bg-[#dae8f5] px-3 py-1 border-b border-[#b5c7de] text-[12px] font-bold text-gray-700">QR Code</div>
              <div onPaste={(e) => {
                const items = e.clipboardData.items;
                for (const item of Array.from(items)) {
                  if (item.type.indexOf("image") !== -1) {
                    const reader = new FileReader();
                    reader.onload = (ev) => setIrnData(prev => ({ ...prev, qrData: ev.target?.result as string }));
                    reader.readAsDataURL(item.getAsFile()!);
                  }
                }
              }} className="h-48 m-4 border-2 border-dashed border-gray-300 flex flex-col items-center justify-center bg-gray-50 relative">
                {irnData.qrData ? <><Image src={irnData.qrData} alt="QR" fill className="object-contain p-2" /><button onClick={() => setIrnData({...irnData, qrData: ""})} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5"><X className="h-3 w-3" /></button></> : <div className="text-gray-400 text-center"><QrCode className="h-10 w-10 mx-auto opacity-20" /><p className="text-[10px] uppercase font-bold">Ctrl+V to paste QR</p></div>}
              </div>
            </div>
          </div>
        </div>
        <div className="mt-auto border-t bg-[#e1e1e1] p-3 flex justify-end gap-3 shadow-inner">
          <Button onClick={() => setSelectedInvoice(null)} variant="outline" className="rounded-none h-8 uppercase text-xs font-bold">Cancel</Button>
          <Button onClick={handleExecute} disabled={isGenerating} className="rounded-none bg-emerald-700 hover:bg-emerald-800 text-white h-8 gap-2 uppercase text-xs font-bold">{isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Generate IRN</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col bg-white min-h-full select-text">
      <div className="sap-header-title">IRN01 - E-Invoicing Control Center (Pending IRN)</div>
      <div className="bg-[#e7ebf1] border-b border-[#b5c7de] px-4 py-1 flex items-center justify-between">
        <div className="relative flex items-center bg-white border border-gray-400 h-6 w-80 px-1 group focus-within:border-blue-500">
          <Search className="h-3.5 w-3.5 text-gray-400 mr-1" /><input value={search} onChange={e => setSearch(e.target.value)} className="w-full h-full text-xs outline-none" placeholder="Search Invoices..." />
        </div>
        <div className="text-[11px] font-bold text-red-700 uppercase tracking-tighter animate-pulse">Pending: {filteredInvoices.length}</div>
      </div>
      <div className="flex-1 overflow-auto no-scrollbar">
        <Table className="min-w-[1500px] sap-alv-grid">
          <TableHeader className="sap-alv-header">
            <TableRow className="h-8">
              <TableHead className="text-[11px] font-bold border-r w-12 text-center bg-[#e1e1e1]">#</TableHead>
              <TableHead className="text-[11px] font-bold border-r w-32 text-center bg-[#e1e1e1]">Action</TableHead>
              <TableHead className="text-[11px] font-bold border-r w-24 text-center">Plant</TableHead>
              <TableHead className="text-[11px] font-bold border-r w-40">Invoice Number</TableHead>
              <TableHead className="text-[11px] font-bold border-r w-32">Date</TableHead>
              <TableHead className="text-[11px] font-bold border-r w-28 text-center">FY</TableHead>
              <TableHead className="text-[11px] font-bold border-r w-64">Consignee</TableHead>
              <TableHead className="text-[11px] font-bold border-r w-32 text-center">State</TableHead>
              <TableHead className="text-[11px] font-bold text-right pr-6 bg-blue-50/50">Gross Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={9} className="text-center py-24 text-xs opacity-30">RETRIEVING RECORDS...</TableCell></TableRow> : filteredInvoices.map((inv, i) => (
              <TableRow key={inv.id} className="h-8 hover:bg-blue-50/50 border-b border-gray-100 group">
                <TableCell className="p-0 text-center text-gray-400 text-[10px] border-r group-hover:text-blue-600">{i + 1}</TableCell>
                <TableCell className="p-0 border-r text-center px-1"><Button onClick={() => setSelectedInvoice(inv)} variant="ghost" size="sm" className="h-6 w-full text-[9px] font-black uppercase text-emerald-700 hover:bg-emerald-100 rounded-none border border-emerald-200">Generate IRN</Button></TableCell>
                <TableCell className="p-0 px-2 text-[11px] border-r text-center font-bold text-gray-600">{inv.plantId}</TableCell>
                <TableCell className="p-0 px-2 text-[11px] border-r font-black font-mono text-blue-900">{inv.invoiceNumber}</TableCell>
                <TableCell className="p-0 px-2 text-[11px] border-r font-mono">{inv.invoiceDate}</TableCell>
                <TableCell className="p-0 px-2 text-[11px] border-r text-center">{inv.billYear}</TableCell>
                <TableCell className="p-0 px-2 text-[11px] border-r truncate font-semibold uppercase">{customerMap[inv.shipTo]?.name || customerMap[inv.billTo]?.name || inv.billTo}</TableCell>
                <TableCell className="p-0 px-2 text-[11px] border-r text-center">{customerMap[inv.shipTo]?.stateName || "-"}</TableCell>
                <TableCell className="p-0 px-2 text-[11px] text-right font-black text-emerald-900 pr-6 bg-blue-50/30 group-hover:bg-emerald-50 transition-colors">₹ {inv.totals?.grossAmount?.toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}


