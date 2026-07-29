"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useDatabase, useCollection, useMemoDatabase, updateDocumentNonBlocking } from "@/database";
import { collection, query, where, getDocs, doc } from "@/database/mongo";
import { Search, Loader2, QrCode, FileEdit, Trash2, AlertTriangle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Image from "next/image";
import { toSAPDate, toInputDate } from "@/lib/date-utils";
import { cn } from "@/lib/utils";

export default function IRN02() {
  const db = useDatabase();
  const [searchInvoiceNo, setSearchInvoiceNo] = useState("");
  const [searchPlantId, setSearchPlantId] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);

  const [irnData, setIrnData] = useState({
    irnNumber: "",
    ackNo: "",
    ackDate: "",
    qrData: "",
  });

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

  const isLockedByTime = useMemo(() => {
    if (!selectedInvoice?.irnUpdatedAt) return false;
    // Allow admin to bypass if needed, otherwise strict 24h rule
    if (isAdmin) return false; 
    
    const genTime = new Date(selectedInvoice.irnUpdatedAt).getTime();
    const now = new Date().getTime();
    const diffHours = (now - genTime) / (1000 * 60 * 60);
    return diffHours > 24;
  }, [selectedInvoice, isAdmin]);

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
        const data = snap.docs[0].data();
        setSelectedInvoice({ ...data, id: snap.docs[0].id });
        setIrnData({
          irnNumber: data.irnNumber || "",
          ackNo: data.ackNo || "",
          ackDate: toInputDate(data.ackDate) || new Date().toISOString().split('T')[0],
          qrData: data.qrData || "",
        });
        window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Record retrieved for modification", isError: false } }));
      }
    } catch (e) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "System Error: Search failed", isError: true } }));
    } finally {
      setIsSearching(false);
    }
  };

  const handleExecute = useCallback(() => {
    if (!selectedInvoice || isLockedByTime) return;
    
    updateDocumentNonBlocking(doc(db, "sales_invoices", selectedInvoice.id), {
      ...irnData,
      ackDate: toSAPDate(irnData.ackDate),
      irnStatus: "Modified",
      irnUpdatedAt: new Date().toISOString()
    });
    window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: `IRN for invoice ${selectedInvoice.invoiceNumber} updated successfully`, isError: false } }));
  }, [db, selectedInvoice, irnData, isLockedByTime]);

  useEffect(() => {
    const onExec = () => handleExecute();
    window.addEventListener('sap-execute', onExec);
    return () => window.removeEventListener('sap-execute', onExec);
  }, [handleExecute]);

  return (
    <div className="w-full flex flex-col bg-white min-h-full select-text">
      <div className="bg-[#dae8f5] px-4 py-1 border-b border-gray-300"><h2 className="text-[13px] font-bold text-gray-800 uppercase italic tracking-wider">IRN02 - Change E-Invoicing Data</h2></div>
      <div className="p-4 space-y-4">
        {isLockedByTime && (
          <Alert variant="destructive" className="rounded-none border-red-200 bg-red-50 py-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="text-xs font-black uppercase">Modification Restriction</AlertTitle>
            <AlertDescription className="text-[11px] font-bold">
              IRN cannot be modified after 24 hours from generation time. Current record is locked.
            </AlertDescription>
          </Alert>
        )}

        <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
          <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[11px] font-semibold text-gray-700 flex items-center gap-2"><Search className="h-3.5 w-3.5" /> Selection</div>
          <div className="p-3 grid grid-cols-3 gap-6 items-end">
            <div className="sap-selection-row"><label className="sap-label w-32">Invoice No</label><Input value={searchInvoiceNo} onChange={e => setSearchInvoiceNo(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} /></div>
            <div className="sap-selection-row"><label className="sap-label w-24">Plant</label>
              <Select value={searchPlantId} onValueChange={setSearchPlantId} disabled={!isAdmin}>
                <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]"><SelectValue /></SelectTrigger>
                <SelectContent>{plants?.map(p => <SelectItem key={p.id} value={p.plantId}>{p.plantId} - {p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button onClick={handleSearch} disabled={isSearching} variant="outline" className="h-6 rounded-none text-[11px] font-bold border-gray-400 gap-2 hover:bg-white shadow-sm">{isSearching ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileEdit className="h-3.5 w-3.5" />} Fetch IRN Data</Button>
          </div>
        </div>

        {selectedInvoice && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
              <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[11px] font-semibold text-gray-700">Invoice Information (Read-Only)</div>
              <div className="p-3 grid grid-cols-5 gap-x-6 gap-y-3 text-[11px]">
                <div><label className="text-gray-500 block uppercase font-bold text-[9px]">Invoice No</label><span className="font-bold text-blue-700">{selectedInvoice.invoiceNumber}</span></div>
                <div><label className="text-gray-500 block uppercase font-bold text-[9px]">Date</label><span className="font-bold">{selectedInvoice.invoiceDate}</span></div>
                <div><label className="text-gray-500 block uppercase font-bold text-[9px]">FY</label><span className="font-bold">{selectedInvoice.billYear}</span></div>
                <div><label className="text-gray-500 block uppercase font-bold text-[9px]">Consignee</label><span className="font-bold truncate">{(customerMap[selectedInvoice.shipTo] || customerMap[selectedInvoice.billTo])?.name}</span></div>
                <div className="bg-emerald-700 p-1.5 rounded-sm text-white col-span-5 flex justify-between items-center"><span className="uppercase font-bold text-[9px]">Gross Payable</span><span className="font-black text-[12px]">₹ {selectedInvoice.totals?.grossAmount?.toLocaleString()}</span></div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-6">
              <div className="col-span-2 border border-[#b5c7de] rounded-sm overflow-hidden bg-white">
                <div className="bg-[#dae8f5] px-3 py-1 border-b border-[#b5c7de] text-[12px] font-bold text-blue-900 flex items-center justify-between">
                  <div className="flex items-center gap-2"><QrCode className="h-4 w-4" /> Maintain IRN Details</div>
                  {isLockedByTime && <span className="text-[10px] text-red-600 font-black uppercase flex items-center gap-1"><Lock className="h-3 w-3" /> System Locked</span>}
                </div>
                <div className="p-4 space-y-4">
                  <div className="sap-selection-row">
                    <label className="sap-label w-40">IRN Number</label>
                    <Input 
                      value={irnData.irnNumber} 
                      onChange={e => setIrnData({...irnData, irnNumber: e.target.value})} 
                      disabled={isLockedByTime}
                      className={cn("font-mono text-[11px] tracking-widest uppercase", isLockedByTime && "bg-gray-50")} 
                    />
                  </div>
                  <div className="sap-selection-row">
                    <label className="sap-label w-40">ACK Number</label>
                    <Input 
                      value={irnData.ackNo} 
                      onChange={e => setIrnData({...irnData, ackNo: e.target.value})} 
                      disabled={isLockedByTime}
                      className={cn("font-mono w-64", isLockedByTime && "bg-gray-50")} 
                    />
                  </div>
                  <div className="sap-selection-row">
                    <label className="sap-label w-40">ACK Date</label>
                    <Input 
                      type="date" 
                      value={irnData.ackDate} 
                      onChange={e => setIrnData({...irnData, ackDate: e.target.value})} 
                      disabled={isLockedByTime}
                      className={cn("w-48", isLockedByTime && "bg-gray-50")} 
                    />
                  </div>
                </div>
              </div>
              <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-white">
                <div className="bg-[#dae8f5] px-3 py-1 border-b border-[#b5c7de] text-[12px] font-bold text-gray-700">QR Image Control</div>
                <div onPaste={(e) => {
                  if (isLockedByTime) return;
                  const items = e.clipboardData.items;
                  for (const item of Array.from(items)) {
                    if (item.type.indexOf("image") !== -1) {
                      const reader = new FileReader();
                      reader.onload = (ev) => setIrnData(prev => ({ ...prev, qrData: ev.target?.result as string }));
                      reader.readAsDataURL(item.getAsFile()!);
                    }
                  }
                }} className={cn("h-48 m-4 border-2 border-dashed border-gray-300 flex flex-col items-center justify-center relative group", isLockedByTime ? "bg-gray-100 cursor-not-allowed" : "bg-gray-50")}>
                  {irnData.qrData ? (
                    <>
                      <Image src={irnData.qrData} alt="QR" fill className="object-contain p-2" />
                      {!isLockedByTime && (
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Button onClick={() => setIrnData({...irnData, qrData: ""})} size="sm" variant="destructive" className="h-7 rounded-none gap-2">
                            <Trash2 className="h-3.5 w-3.5" /> Remove QR
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-gray-400 text-center">
                      <QrCode className="h-10 w-10 mx-auto opacity-20" />
                      <p className="text-[10px] uppercase font-bold">{isLockedByTime ? "Record Locked" : "Ctrl+V to update QR"}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


