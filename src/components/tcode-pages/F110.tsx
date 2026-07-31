"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDatabase, useCollection, useMemoDatabase } from "@/database";
import { collection, query, where, getDocs } from "@/database/mongo";
import { Search, Loader2, Receipt, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import Image from "next/image";

export default function F110() {
  const db = useDatabase();
  
  // Selection State
  const [filterPlant, setFilterPlant] = useState("");
  const [filterInvoice, setFilterInvoice] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [isExecuted, setIsExecuted] = useState(false);

  // Auth Context
  const [assignedPlantId, setAssignedPlantId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("sikka_user");
    if (stored) {
      const parsed = JSON.parse(stored);
      const admin = parsed.username === "ajaysomra" || parsed.role === 'admin';
      setIsAdmin(admin);
      setAssignedPlantId(parsed.assignedPlantId || "");
      if (!admin && parsed.assignedPlantId) setFilterPlant(parsed.assignedPlantId);
    }
  }, []);

  // Master Data
  const customersQuery = useMemoDatabase(() => collection(db, "customers"), [db]);
  const { data: customers } = useCollection(customersQuery);
  const firmsQuery = useMemoDatabase(() => collection(db, "firms"), [db]);
  const { data: firms } = useCollection(firmsQuery);
  const receiptsQuery = useMemoDatabase(() => collection(db, "payment_receipts"), [db]);
  const { data: allReceipts } = useCollection(receiptsQuery);

  const customerMap = useMemo(() => {
    const map: Record<string, any> = {};
    customers?.forEach(c => { map[c.customerId] = c; });
    return map;
  }, [customers]);

  const firmMap = useMemo(() => {
    const map: Record<string, any> = {};
    firms?.forEach(f => { map[f.plantId] = f; });
    return map;
  }, [firms]);

  const handleExecute = useCallback(async () => {
    if (!filterPlant) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Error: Plant ID is mandatory", isError: true } }));
      return;
    }

    setIsSearching(true);
    setIsExecuted(true);
    try {
      let q = query(collection(db, "sales_invoices"), where("plantId", "==", filterPlant));
      if (filterInvoice) {
        q = query(collection(db, "sales_invoices"), where("plantId", "==", filterPlant), where("invoiceNumber", "==", filterInvoice));
      }
      
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => {
        const inv = doc.data();
        const firm = firmMap[inv.plantId];
        const consignee = customerMap[inv.billTo];
        const shipTo = customerMap[inv.shipTo] || consignee;
        const receipt = allReceipts?.find(r => r.invoiceNo === inv.invoiceNumber && r.plantId === inv.plantId);
        
        return {
          id: doc.id,
          ...inv,
          consignorName: firm?.name || "N/A",
          consignorGstin: firm?.gstin || "N/A",
          consigneeName: consignee?.name || "N/A",
          gstin: consignee?.gstin || "N/A",
          state: consignee?.stateName || "N/A",
          shipToName: shipTo?.name || "N/A",
          shipToGstin: shipTo?.gstin || "N/A",
          receiptData: receipt || null,
          isInterstate: firm?.stateCode !== consignee?.stateCode
        };
      });
      setResults(data);
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: `Found ${data.length} document(s)`, isError: false } }));
    } catch (e) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "System Error during lookup", isError: true } }));
    } finally {
      setIsSearching(false);
    }
  }, [db, filterPlant, filterInvoice, firmMap, customerMap, allReceipts]);

  useEffect(() => {
    window.addEventListener('sap-execute', handleExecute);
    return () => window.removeEventListener('sap-execute', handleExecute);
  }, [handleExecute]);

  return (
    <div className="w-full flex flex-col bg-white min-h-full select-text">
      <div className="sap-header-title">F110 - Payment Proof / Receipt Auditor</div>

      <div className="sap-selection-area">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="sap-selection-row">
            <label className="sap-label">Plant ID</label>
            <div className="sap-input-wrapper max-w-[300px]">
              <Input value={filterPlant} onChange={e => setFilterPlant(e.target.value.toUpperCase())} disabled={!isAdmin} />
            </div>
          </div>
          <div className="sap-selection-row">
            <label className="sap-label">Invoice Number</label>
            <div className="sap-input-wrapper max-w-[300px]">
              <Input value={filterInvoice} onChange={e => setFilterInvoice(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleExecute()} placeholder="Optional for full list (F8 to Execute)..." />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto no-scrollbar relative">
        {isSearching && (
          <div className="absolute inset-0 bg-white/50 z-20 flex items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-blue-700" />
          </div>
        )}
        {!isExecuted ? (
          <div className="flex flex-col items-center justify-center py-32 text-gray-400 opacity-30 select-none">
            <Receipt className="h-20 w-20 stroke-1 mb-4" />
            <p className="text-sm font-black uppercase tracking-[0.2em]">Enter parameters and Execute (F8)</p>
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-red-500 font-bold uppercase text-xs">No matching invoices found in plant {filterPlant}</div>
        ) : (
          <Table className="min-w-[2200px] sap-alv-grid">
            <TableHeader className="sap-alv-header">
              <TableRow className="h-8">
                <TableHead className="w-12 text-center text-[10px] font-bold border-r border-[#b5c7de]">#</TableHead>
                <TableHead className="w-24 text-center text-[10px] font-bold border-r border-[#b5c7de]">Action</TableHead>
                <TableHead className="w-24 text-center text-[10px] font-bold border-r border-[#b5c7de]">Plant</TableHead>
                <TableHead className="w-64 text-[10px] font-bold border-r border-[#b5c7de]">Consignor Name</TableHead>
                <TableHead className="w-40 text-[10px] font-bold border-r border-[#b5c7de]">Consignor GSTIN</TableHead>
                <TableHead className="w-64 text-[10px] font-bold border-r border-[#b5c7de]">Consignee Name</TableHead>
                <TableHead className="w-40 text-[10px] font-bold border-r border-[#b5c7de]">GSTIN</TableHead>
                <TableHead className="w-32 text-[10px] font-bold border-r border-[#b5c7de]">State</TableHead>
                <TableHead className="w-64 text-[10px] font-bold border-r border-[#b5c7de]">Ship To Party</TableHead>
                <TableHead className="w-40 text-[10px] font-bold border-r border-[#b5c7de]">Ship To GSTIN</TableHead>
                <TableHead className="w-32 text-center text-[10px] font-bold border-r border-[#b5c7de]">Doc Type</TableHead>
                <TableHead className="w-32 text-center text-[10px] font-bold border-r border-[#b5c7de]">Charge Type</TableHead>
                <TableHead className="w-64 text-[10px] font-bold border-r border-[#b5c7de]">Material Detail</TableHead>
                <TableHead className="w-28 text-center text-[10px] font-bold border-r border-[#b5c7de]">HSN/SAC</TableHead>
                <TableHead className="w-24 text-right text-[10px] font-bold border-r border-[#b5c7de]">Qty</TableHead>
                <TableHead className="w-28 text-right text-[10px] font-bold border-r border-[#b5c7de]">Rate</TableHead>
                <TableHead className="w-32 text-right text-[10px] font-bold border-r border-[#b5c7de]">Taxable Amt</TableHead>
                <TableHead className="w-28 text-right text-[10px] font-bold border-r border-[#b5c7de]">CGST</TableHead>
                <TableHead className="w-28 text-right text-[10px] font-bold border-r border-[#b5c7de]">SGST</TableHead>
                <TableHead className="w-28 text-right text-[10px] font-bold border-r border-[#b5c7de]">IGST</TableHead>
                <TableHead className="w-36 text-right text-[10px] font-bold font-black bg-blue-50/50">Gross Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((inv, idx) => (
                <TableRow key={inv.id} className="h-8 hover:bg-blue-50/20 border-b border-gray-100 group transition-colors">
                  <TableCell className="p-0 text-center text-[10px] border-r text-gray-400 group-hover:text-blue-600">{idx + 1}</TableCell>
                  <TableCell className="p-0 border-r text-center px-1">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button disabled={!inv.receiptData} variant="ghost" className="h-6 w-full text-[9px] font-black uppercase text-blue-700 hover:bg-blue-100 rounded-none border border-blue-200">
                          {inv.receiptData ? "View Proof" : "---"}
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl rounded-none border-gray-400 p-0 overflow-hidden shadow-2xl">
                        <div className="bg-[#333e4f] text-white p-3 flex justify-between items-center">
                          <DialogTitle className="text-[11px] font-black uppercase tracking-widest flex items-center gap-2"><Receipt className="h-4 w-4 text-emerald-400" /> Payment Reconciliation: {inv.invoiceNumber}</DialogTitle>
                          <DialogTrigger asChild><button className="hover:bg-white/10 p-1"><X className="h-4 w-4" /></button></DialogTrigger>
                        </div>
                        <div className="p-6 bg-white space-y-6 overflow-y-auto max-h-[85vh]">
                          <div className="grid grid-cols-2 gap-6 border-b border-gray-100 pb-4">
                            <div><p className="text-[9px] font-bold text-gray-400 uppercase">Payment Date</p><p className="text-sm font-black text-gray-800">{inv.receiptData?.paymentDate || "---"}</p></div>
                            <div><p className="text-[9px] font-bold text-gray-400 uppercase">Payment Mode</p><p className="text-sm font-black text-blue-700 uppercase italic">{inv.receiptData?.paymentMode || "---"}</p></div>
                            <div><p className="text-[9px] font-bold text-gray-400 uppercase">Banking UTR / Reference</p><p className="text-sm font-mono font-black text-gray-800 break-all">{inv.receiptData?.bankingUtr || "---"}</p></div>
                            <div><p className="text-[9px] font-bold text-gray-400 uppercase">Payment Advice No.</p><p className="text-sm font-black text-gray-800">{inv.receiptData?.paymentAdviceNo || "---"}</p></div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-6 border-b border-gray-100 pb-4">
                            <div><p className="text-[9px] font-bold text-gray-400 uppercase">Receipt Amount</p><p className="text-sm font-black text-gray-800">₹ {Number(inv.receiptData?.receiptAmount || 0).toLocaleString()}</p></div>
                            <div><p className="text-[9px] font-bold text-gray-400 uppercase">TDS Amount</p><p className="text-sm font-black text-gray-800">₹ {Number(inv.receiptData?.tds || 0).toLocaleString()}</p></div>
                            <div><p className="text-[9px] font-bold text-gray-400 uppercase">Deduction Amount</p><p className="text-sm font-black text-red-700">₹ {Number(inv.receiptData?.deduction || 0).toLocaleString()}</p></div>
                            {Number(inv.receiptData?.deduction || 0) > 0 && <div><p className="text-[9px] font-bold text-gray-400 uppercase">Deduction Remark</p><p className="text-sm font-bold text-red-700 italic">{inv.receiptData?.deductionRemark || "NOT PROVIDED"}</p></div>}
                          </div>

                          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-sm flex justify-between items-center shadow-sm">
                            <div className="flex items-center gap-3 text-emerald-800 font-black uppercase text-[11px] tracking-tighter"><div className="bg-emerald-600 text-white p-2 rounded-full"><Receipt className="h-5 w-5" /></div> Total Collection Amount</div>
                            <div className="text-2xl font-black text-emerald-900 font-mono">₹ {(Number(inv.receiptData?.receiptAmount || 0) + Number(inv.receiptData?.tds || 0) + Number(inv.receiptData?.deduction || 0)).toLocaleString()}</div>
                          </div>

                          <div className="border border-gray-300 rounded-sm overflow-hidden bg-gray-50">
                            <div className="bg-[#dae8f5] px-3 py-1.5 border-b border-gray-300 text-[11px] font-black uppercase text-gray-700 flex justify-between items-center">
                              <span>Payment Attachment / Proof Copy</span>
                              {inv.receiptData?.proofData && <a href={inv.receiptData.proofData} download={`Proof_${inv.invoiceNumber}.png`} className="text-[9px] text-blue-700 flex items-center gap-1 hover:underline"><Download className="h-3 w-3" /> Save Copy</a>}
                            </div>
                            <div className="p-4 flex items-center justify-center min-h-[300px] relative bg-white">
                              {inv.receiptData?.proofData ? (
                                <div className="relative w-full h-[400px]"><Image src={inv.receiptData.proofData} alt="Proof" fill className="object-contain" /></div>
                              ) : (
                                <div className="text-center space-y-2 text-gray-400 opacity-40"><Receipt className="h-16 w-16 mx-auto stroke-1" /><p className="text-[10px] font-bold uppercase tracking-widest">No Document Attached</p></div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="bg-[#e1e1e1] p-3 flex justify-end gap-3 shadow-inner border-t border-gray-400">
                          <DialogTrigger asChild><Button className="rounded-none bg-[#333e4f] text-white text-[11px] font-bold uppercase px-8 shadow-md">Close Audit View</Button></DialogTrigger>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                  <TableCell className="p-0 px-2 text-[11px] border-r text-center font-bold text-gray-600">{inv.plantId}</TableCell>
                  <TableCell className="p-0 px-2 text-[10px] border-r truncate max-w-[200px]">{inv.consignorName}</TableCell>
                  <TableCell className="p-0 px-2 text-[10px] border-r font-mono text-center">{inv.consignorGstin}</TableCell>
                  <TableCell className="p-0 px-2 text-[10px] border-r truncate font-semibold uppercase">{inv.consigneeName}</TableCell>
                  <TableCell className="p-0 px-2 text-[10px] border-r font-mono text-center">{inv.gstin}</TableCell>
                  <TableCell className="p-0 px-2 text-[10px] border-r text-center uppercase">{inv.state}</TableCell>
                  <TableCell className="p-0 px-2 text-[10px] border-r truncate max-w-[200px]">{inv.shipToName}</TableCell>
                  <TableCell className="p-0 px-2 text-[10px] border-r font-mono text-center">{inv.shipToGstin}</TableCell>
                  <TableCell className="p-0 px-2 text-[10px] border-r text-center uppercase">{inv.docType}</TableCell>
                  <TableCell className="p-0 px-2 text-[10px] border-r text-center uppercase">{inv.docCategory}</TableCell>
                  <TableCell className="p-0 px-2 text-[10px] border-r font-bold text-blue-800 uppercase italic">
                    {inv.items?.[0]?.desc} {inv.items?.length > 1 && `(+ ${inv.items.length - 1} more)`}
                  </TableCell>
                  <TableCell className="p-0 px-2 text-[10px] border-r text-center font-mono">{inv.items?.[0]?.hsn}</TableCell>
                  <TableCell className="p-0 px-2 text-[10px] border-r text-right font-bold text-gray-700">{(inv.totals?.totalQty || 0).toLocaleString()}</TableCell>
                  <TableCell className="p-0 px-2 text-[10px] border-r text-right font-mono">{(inv.items?.[0]?.rate || 0).toLocaleString()}</TableCell>
                  <TableCell className="p-0 px-2 text-[10px] border-r text-right font-mono">{(inv.totals?.taxableAmount || 0).toLocaleString()}</TableCell>
                  <TableCell className="p-0 px-2 text-[10px] border-r text-right text-gray-500">{inv.isInterstate ? "0.00" : (inv.totals?.cgst || 0).toLocaleString()}</TableCell>
                  <TableCell className="p-0 px-2 text-[10px] border-r text-right text-gray-500">{inv.isInterstate ? "0.00" : (inv.totals?.sgst || 0).toLocaleString()}</TableCell>
                  <TableCell className="p-0 px-2 text-[10px] border-r text-right text-gray-500">{inv.isInterstate ? (inv.totals?.igst || 0).toLocaleString() : "0.00"}</TableCell>
                  <TableCell className="p-0 px-2 text-[10px] text-right font-black text-blue-900 bg-blue-50/10 font-mono">{(inv.totals?.grossAmount || 0).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="bg-[#333e4f] h-7 flex items-center px-4 text-white text-[10px] uppercase tracking-tighter shadow-inner border-t border-black/20">
          <div className="flex-1 flex gap-10">
            <span>Audit Readiness: {results.filter(r => !!r.receiptData).length} / {results.length} Document(s) Collected</span>
            <span className="opacity-40">|</span>
            <span>Plant: {filterPlant || "NONE"}</span>
          </div>
      </div>
    </div>
  );
}
