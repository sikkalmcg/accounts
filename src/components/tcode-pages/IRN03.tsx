
"use client";

import { useState, useMemo, useEffect } from "react";
import { useDatabase, useCollection, useMemoDatabase } from "@/database";
import { collection, query, where, getDocs } from "@/database/mongo";
import { Search, Loader2, QrCode, FileText, CheckCircle2, AlertCircle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Image from "next/image";

export default function IRN03() {
  const db = useDatabase();
  const [searchInvoiceNo, setSearchInvoiceNo] = useState("");
  const [searchPlantId, setSearchPlantId] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [assignedPlantId, setAssignedPlantId] = useState("");

  const plantsQuery = useMemoDatabase(() => collection(db, "plants"), [db]);
  const { data: plants } = useCollection(plantsQuery);
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
      const sysAdmin = parsed.username === "ajaysomra" || parsed.role === 'admin';
      setIsAdmin(sysAdmin);
      setAssignedPlantId(parsed.assignedPlantId || "");
      if (!sysAdmin && parsed.assignedPlantId) setSearchPlantId(parsed.assignedPlantId);
    }
  }, []);

  const handleSearch = async () => {
    if (!searchInvoiceNo || !searchPlantId) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Error: Enter Invoice Number and Plant ID", isError: true } }));
      return;
    }
    setIsSearching(true);
    try {
      const q = query(collection(db, "sales_invoices"), where("invoiceNumber", "==", searchInvoiceNo), where("plantId", "==", searchPlantId));
      const snap = await getDocs(q);
      if (snap.empty) {
        window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: `Invoice ${searchInvoiceNo} not found`, isError: true } }));
        setSelectedInvoice(null);
      } else {
        setSelectedInvoice({ ...snap.docs[0].data(), id: snap.docs[0].id });
        window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Document displayed successfully", isError: false } }));
      }
    } catch (e) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "System Error: Search failed", isError: true } }));
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="w-full flex flex-col bg-white min-h-full select-text">
      <div className="bg-[#dae8f5] px-4 py-1 border-b border-gray-300"><h2 className="text-[13px] font-bold text-gray-800 uppercase italic tracking-wider">IRN03 - Display E-Invoicing Data</h2></div>
      <div className="p-4 space-y-4">
        <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
          <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[11px] font-semibold text-gray-700 flex items-center gap-2"><Search className="h-3.5 w-3.5" /> Selection Criteria</div>
          <div className="p-3 grid grid-cols-3 gap-6 items-end">
            <div className="sap-selection-row"><label className="sap-label w-32">Invoice No</label><Input value={searchInvoiceNo} onChange={e => setSearchInvoiceNo(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} /></div>
            <div className="sap-selection-row"><label className="sap-label w-24">Plant</label>
              <Select value={searchPlantId} onValueChange={setSearchPlantId} disabled={!isAdmin}>
                <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]"><SelectValue /></SelectTrigger>
                <SelectContent>{plants?.map(p => <SelectItem key={p.id} value={p.plantId}>{p.plantId} - {p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button onClick={handleSearch} disabled={isSearching} variant="outline" className="h-6 rounded-none text-[11px] font-bold border-gray-400 gap-2 shadow-sm">{isSearching ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3.5 w-3.5" />} Display Record</Button>
          </div>
        </div>
        {selectedInvoice ? (
          <div className="animate-in fade-in slide-in-from-right-2 duration-300 space-y-4">
            <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
              <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[11px] font-semibold text-gray-700">Billing Summary</div>
              <div className="p-3 grid grid-cols-5 gap-x-6 gap-y-3 text-[11px]">
                <div><label className="text-gray-400 block uppercase font-bold text-[8px]">Invoice No</label><span className="font-bold text-blue-700">{selectedInvoice.invoiceNumber}</span></div>
                <div><label className="text-gray-400 block uppercase font-bold text-[8px]">Date</label><span className="font-medium">{selectedInvoice.invoiceDate}</span></div>
                <div><label className="text-gray-400 block uppercase font-bold text-[8px]">FY</label><span className="font-bold">{selectedInvoice.billYear}</span></div>
                <div><label className="text-gray-400 block uppercase font-bold text-[8px]">Period</label><span className="font-bold">{selectedInvoice.billMonth}</span></div>
                <div><label className="text-gray-400 block uppercase font-bold text-[8px]">Consignee</label><span className="font-bold truncate">{(customerMap[selectedInvoice.shipTo] || customerMap[selectedInvoice.billTo])?.name}</span></div>
                <div className="bg-emerald-800 p-1.5 rounded-sm text-white col-span-5 flex justify-between items-center"><span className="uppercase font-bold text-[8px]">Gross Amt</span><span className="font-black text-[12px]">₹ {selectedInvoice.totals?.grossAmount?.toLocaleString()}</span></div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-6">
              <div className="col-span-2 border border-[#b5c7de] rounded-sm overflow-hidden bg-white">
                <div className="bg-[#dae8f5] px-3 py-1 border-b border-[#b5c7de] text-[12px] font-bold text-gray-700 flex items-center justify-between">
                  <div className="flex items-center gap-2"><QrCode className="h-4 w-4" /> E-Invoice (IRN) Details</div>
                  {selectedInvoice.irnNumber ? <span className="text-[10px] text-emerald-700 font-black flex items-center gap-1 uppercase bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100"><CheckCircle2 className="h-3 w-3" /> Valid IRN</span> : <span className="text-[10px] text-red-700 font-black flex items-center gap-1 uppercase bg-red-50 px-2 py-0.5 rounded border border-red-100"><AlertCircle className="h-3 w-3" /> IRN Pending</span>}
                </div>
                <div className="p-6 space-y-6">
                  <div className="flex flex-col gap-1 border-b border-gray-100 pb-2"><label className="text-[10px] font-bold text-gray-500 uppercase">IRN Number</label><span className="font-mono text-sm font-black tracking-widest break-all text-blue-900">{selectedInvoice.irnNumber || "---"}</span></div>
                  <div className="grid grid-cols-2 gap-12">
                    <div className="flex flex-col gap-1"><label className="text-[10px] font-bold text-gray-500 uppercase">ACK Number</label><span className="font-mono text-sm font-bold text-gray-700">{selectedInvoice.ackNo || "---"}</span></div>
                    <div className="flex flex-col gap-1"><label className="text-[10px] font-bold text-gray-500 uppercase">ACK Date</label><span className="text-sm font-bold text-gray-700">{selectedInvoice.ackDate || "---"}</span></div>
                  </div>
                </div>
              </div>
              <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-white">
                <div className="bg-[#dae8f5] px-3 py-1 border-b border-[#b5c7de] text-[12px] font-bold text-gray-700 flex items-center gap-2"><QrCode className="h-4 w-4" /> QR Data</div>
                <div className="h-48 m-4 border border-gray-200 flex items-center justify-center bg-gray-50 relative">
                  {selectedInvoice.qrData ? <Image src={selectedInvoice.qrData} alt="QR" fill className="object-contain p-2" /> : <div className="text-center space-y-2 opacity-30"><QrCode className="h-12 w-12 mx-auto" /><p className="text-[10px] font-bold uppercase">No QR Data</p></div>}
                </div>
              </div>
            </div>
          </div>
        ) : <div className="flex flex-col items-center justify-center py-20 text-gray-400 space-y-4 opacity-50 select-none"><FileText className="h-20 w-20 stroke-1" /><div className="text-center"><p className="text-sm font-black uppercase tracking-[0.2em]">Ready for Selection</p></div></div>}
      </div>
    </div>
  );
}


