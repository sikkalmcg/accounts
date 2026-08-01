"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useDatabase, useCollection, useMemoDatabase, updateDocumentNonBlocking } from "@/database";
import { collection, query, where, getDocs, serverTimestamp } from "@/database/mongo";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Search, Loader2, Receipt, RotateCcw, Save, X, History, IndianRupee } from "lucide-react";

const FULLY_PAID_TOLERANCE = 10;

export default function F52() {
  const db = useDatabase();

  // 1. User Context & Permissions
  const [assignedPlantId, setAssignedPlantId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("sikka_user");
    if (stored) {
      const parsed = JSON.parse(stored);
      setIsAdmin(parsed.username === "ajaysomra" || parsed.role === 'admin');
      setAssignedPlantId(parsed.assignedPlantId || "");
    }
  }, []);

  // 2. Search Criteria
  const [searchPlant, setSearchPlant] = useState("");
  const [searchInvoiceNo, setSearchInvoiceNo] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // 3. Results
  const [invoice, setInvoice] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);

  // 4. Master Data
  const plantsQuery = useMemoDatabase(() => collection(db, "plants"), [db]);
  const { data: plants } = useCollection(plantsQuery);

  const filteredPlants = useMemo(() => {
    if (isAdmin) return plants || [];
    return plants?.filter(p => p.plantId === assignedPlantId) || [];
  }, [plants, isAdmin, assignedPlantId]);

  // 5. Derived
  const grossPayable = useMemo(() => invoice?.totals?.total || invoice?.totals?.grossAmount || 0, [invoice]);
  const totalPaid = useMemo(() => payments.reduce((s, p) => s + (Number(p.payAmount) || 0) + (Number(p.tds) || 0) + (Number(p.deduction) || 0), 0), [payments]);
  const availableBalance = grossPayable - totalPaid;

  // 6. Search Handler
  const handleSearch = useCallback(async () => {
    if (!searchPlant) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Error: Plant is mandatory", isError: true } }));
      return;
    }
    if (!searchInvoiceNo) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Error: Invoice Number is mandatory", isError: true } }));
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    setInvoice(null);
    setPayments([]);

    try {
      // Fetch the invoice receipt
      const invQuery = query(
        collection(db, "invoice_receipts"),
        where("plantId", "==", searchPlant),
        where("invoiceNo", "==", searchInvoiceNo)
      );
      const invSnap = await getDocs(invQuery);

      // Fetch all outgoing payments from F51 for this invoice
      const payQuery = query(
        collection(db, "outgoing_payments"),
        where("plantId", "==", searchPlant),
        where("invoiceNo", "==", searchInvoiceNo)
      );
      const paySnap = await getDocs(payQuery);
      const payData = paySnap.docs.map(d => ({ id: d.id, ...d.data() }));

      if (!invSnap.empty) {
        setInvoice({ id: invSnap.docs[0].id, ...invSnap.docs[0].data() });
      } else {
        setInvoice(null);
      }
      setPayments(payData);

      if (payData.length === 0) {
        window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: `No F51 outgoing payment records found for Invoice ${searchInvoiceNo}`, isError: true } }));
      } else {
        window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: `${payData.length} payment record(s) found for Invoice ${searchInvoiceNo}`, isError: false } }));
      }
    } catch (e) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "System Error: Failed to search payment records", isError: true } }));
    } finally {
      setIsSearching(false);
    }
  }, [db, searchPlant, searchInvoiceNo]);

  // 7. Reset Handler
  const handleReset = useCallback(() => {
    setSearchPlant("");
    setSearchInvoiceNo("");
    setHasSearched(false);
    setInvoice(null);
    setPayments([]);
  }, []);

  useEffect(() => {
    const onExec = () => handleSearch();
    const onCan = () => handleReset();
    window.addEventListener('sap-execute', onExec);
    window.addEventListener('sap-cancel', onCan);
    return () => {
      window.removeEventListener('sap-execute', onExec);
      window.removeEventListener('sap-cancel', onCan);
    };
  }, [handleSearch, handleReset]);

  return (
    <div className="w-full flex flex-col bg-white min-h-full select-text">
      <div className="sap-header-title">F52 - Post Outgoing Payment Revise</div>

      {/* Search Criteria Section */}
      <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9] mx-4 mt-4">
        <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700 flex justify-between items-center">
          <span>Search Criteria</span>
          <span className="text-[10px] text-blue-600 font-bold uppercase italic">F8 to Execute</span>
        </div>
        <div className="p-3 grid grid-cols-2 gap-x-8 gap-y-3">
          <div className="sap-selection-row">
            <label className="sap-label">Plant *</label>
            <div className="sap-input-wrapper max-w-[250px]">
              <Select value={searchPlant} onValueChange={setSearchPlant}>
                <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]"><SelectValue placeholder="Select Plant" /></SelectTrigger>
                <SelectContent>
                  {filteredPlants.map(p => <SelectItem key={p.id} value={p.plantId}>{p.plantId} - {p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="sap-selection-row">
            <label className="sap-label">Invoice Number *</label>
            <div className="sap-input-wrapper max-w-[250px]">
              <Input
                value={searchInvoiceNo}
                onChange={e => setSearchInvoiceNo(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="Enter invoice number..."
                className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]"
              />
            </div>
          </div>
        </div>
        <div className="bg-[#e7ebf1] px-3 py-2 border-t border-[#b5c7de] flex gap-3">
          <Button onClick={handleSearch} disabled={isSearching} className="h-7 rounded-none bg-blue-700 hover:bg-blue-800 text-[11px] font-bold uppercase gap-1.5 shadow-sm">
            {isSearching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />} Search (F8)
          </Button>
          <Button onClick={handleReset} variant="outline" className="h-7 rounded-none bg-white border-gray-400 text-gray-700 text-[11px] font-bold uppercase gap-1.5 shadow-sm hover:bg-gray-100">
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </Button>
        </div>
      </div>

      {/* Empty State */}
      {!hasSearched && !isSearching && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 select-none">
          <Receipt className="h-20 w-20 stroke-1 mb-4 opacity-20" />
          <p className="text-sm font-black uppercase tracking-[0.2em] opacity-40">Enter Plant and Invoice Number and Execute (F8)</p>
          <p className="text-[10px] font-bold text-gray-400 mt-2">Displays all payment records created from F51 for the selected invoice</p>
        </div>
      )}

      {isSearching && (
        <div className="flex items-center justify-center py-20">
          <div className="flex items-center gap-3 text-blue-700"><Loader2 className="h-6 w-6 animate-spin" /><span className="text-sm font-bold uppercase tracking-widest">Searching Payment Records...</span></div>
        </div>
      )}

      {hasSearched && !isSearching && payments.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 select-none">
          <Receipt className="h-16 w-16 stroke-1 mb-4 opacity-30" />
          <p className="text-sm font-black uppercase tracking-[0.2em] opacity-50">No payment records found</p>
          <p className="text-[10px] font-bold text-gray-400 mt-2">No F51 payments exist for invoice {searchInvoiceNo}</p>
        </div>
      )}

      {/* Results Area */}
      {hasSearched && !isSearching && payments.length > 0 && (
        <div className="p-4 space-y-4 animate-in fade-in duration-300">
          {/* Invoice Summary */}
          <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
            <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700 flex justify-between items-center">
              <span>Invoice Summary</span>
              <span className="text-[10px] text-gray-500 italic">Read-Only</span>
            </div>
            <div className="p-3 grid grid-cols-4 gap-x-6 gap-y-2 text-[11px]">
              <div><label className="text-gray-400 block uppercase font-bold text-[8px]">Invoice No</label><span className="font-black text-blue-700 font-mono">{searchInvoiceNo}</span></div>
              <div><label className="text-gray-400 block uppercase font-bold text-[8px]">Plant</label><span className="font-bold">{searchPlant}</span></div>
              <div><label className="text-gray-400 block uppercase font-bold text-[8px]">Gross Payable</label><span className="font-black">₹ {grossPayable.toLocaleString()}</span></div>
              <div><label className="text-gray-400 block uppercase font-bold text-[8px]">Available Balance</label><span className="font-black text-red-700">₹ {availableBalance.toLocaleString()}</span></div>
            </div>
          </div>

          {/* Payment Records Grid */}
          <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-white">
            <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700 flex justify-between items-center">
              <span>Payment Records (F51) - {payments.length} Found</span>
            </div>
            <Table>
              <TableHeader className="bg-[#e7ebf1]">
                <TableRow className="h-7">
                  <TableHead className="text-[11px] font-bold border-r w-10 text-center">#</TableHead>
                  <TableHead className="text-[11px] font-bold border-r">Payment Type</TableHead>
                  <TableHead className="text-[11px] font-bold border-r w-36 text-right">Pay Amount</TableHead>
                  <TableHead className="text-[11px] font-bold border-r w-28 text-right">TDS</TableHead>
                  <TableHead className="text-[11px] font-bold border-r w-28 text-right">Deduction</TableHead>
                  <TableHead className="text-[11px] font-bold border-r">Deduction Remark</TableHead>
                  <TableHead className="text-[11px] font-bold border-r">Payment Date</TableHead>
                  <TableHead className="text-[11px] font-bold border-r">UTR / Voucher</TableHead>
                  <TableHead className="text-[11px] font-bold text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p, idx) => (
                  <TableRow key={p.id} className="h-8 hover:bg-blue-50/30 border-b border-gray-100">
                    <TableCell className="p-0 text-center text-[10px] border-r text-gray-400">{idx + 1}</TableCell>
                    <TableCell className="p-0 px-2 text-[10px] border-r font-bold uppercase">{p.paymentType}</TableCell>
                    <TableCell className="p-0 px-2 text-[10px] border-r text-right font-bold text-emerald-700">₹ {(Number(p.payAmount) || 0).toLocaleString()}</TableCell>
                    <TableCell className="p-0 px-2 text-[10px] border-r text-right">₹ {(Number(p.tds) || 0).toLocaleString()}</TableCell>
                    <TableCell className="p-0 px-2 text-[10px] border-r text-right">₹ {(Number(p.deduction) || 0).toLocaleString()}</TableCell>
                    <TableCell className="p-0 px-2 text-[10px] border-r italic">{p.deductionRemark || "---"}</TableCell>
                    <TableCell className="p-0 px-2 text-[10px] border-r font-mono text-center">{p.paymentDate || "-"}</TableCell>
                    <TableCell className="p-0 px-2 text-[10px] border-r font-mono text-center">{p.bankingUtr || p.voucherNo || "-"}</TableCell>
                    <TableCell className="p-0 px-2 text-[10px] text-center">
                      <EditPaymentDialog payment={p} invoice={invoice} searchPlant={searchPlant} availableBalance={availableBalance} db={db} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Footer Status Bar */}
      <div className="bg-[#333e4f] p-2 flex justify-between items-center text-white text-[10px] font-bold uppercase tracking-widest shadow-inner mt-auto">
        <div className="flex items-center gap-6">
          <span>F52 - Outgoing Payment Revise</span>
          <span className="opacity-40">|</span>
          <span>Status: {payments.length > 0 ? `${payments.length} Record(s) Loaded` : hasSearched ? "No Record" : "Ready"}</span>
        </div>
        <div className="flex items-center gap-4 pr-4">
          {payments.length > 0 && (
            <>
              <span className="opacity-50">Invoice:</span>
              <span className="text-emerald-400">{searchInvoiceNo}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ Edit Payment Dialog ============
function EditPaymentDialog({ payment, invoice, searchPlant, availableBalance, db }: { payment: any; invoice: any; searchPlant: string; availableBalance: number; db: any }) {
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Editable Fields
  const [paymentType, setPaymentType] = useState(payment.paymentType || "Banking");
  const [payAmount, setPayAmount] = useState(String(payment.payAmount || ""));
  const [tds, setTds] = useState(String(payment.tds || ""));
  const [deduction, setDeduction] = useState(String(payment.deduction || ""));
  const [deductionRemark, setDeductionRemark] = useState(payment.deductionRemark || "");
  const [paymentDate, setPaymentDate] = useState(payment.paymentDate || "");
  const [bankingUtr, setBankingUtr] = useState(payment.bankingUtr || "");
  const [voucherNo, setVoucherNo] = useState(payment.voucherNo || "");

  const [editHistoryOpen, setEditHistoryOpen] = useState(false);

  const originalTotal = (Number(payment.payAmount) || 0) + (Number(payment.tds) || 0) + (Number(payment.deduction) || 0);
  const newTotal = (Number(payAmount) || 0) + (Number(tds) || 0) + (Number(deduction) || 0);
  const delta = newTotal - originalTotal;
  const recalculatedBalance = availableBalance - delta;

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (v) {
      setPaymentType(payment.paymentType || "Banking");
      setPayAmount(String(payment.payAmount || ""));
      setTds(String(payment.tds || ""));
      setDeduction(String(payment.deduction || ""));
      setDeductionRemark(payment.deductionRemark || "");
      setPaymentDate(payment.paymentDate || "");
      setBankingUtr(payment.bankingUtr || "");
      setVoucherNo(payment.voucherNo || "");
    }
  };

  const handleSave = async () => {
    // Validation
    if (paymentType === "Banking" && !bankingUtr.trim()) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Error: Banking UTR No. is mandatory for Banking payments", isError: true } }));
      return;
    }
    if (paymentType === "Cash" && !voucherNo.trim()) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Error: Voucher No. is mandatory for Cash payments", isError: true } }));
      return;
    }
    if (Number(deduction) > 0 && !deductionRemark.trim()) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Error: Deduction Remark is mandatory when deduction value > 0", isError: true } }));
      return;
    }
    if (recalculatedBalance < -0.01) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Error: Revised amount exceeds the available balance for this invoice", isError: true } }));
      return;
    }

    setIsSaving(true);
    try {
      const currentUser = (typeof window !== "undefined" ? JSON.parse(localStorage.getItem("sikka_user") || "{}")?.name : "") || "USER";
      const historyEntry = {
        changedAt: new Date().toISOString(),
        changedBy: currentUser,
        changes: {
          paymentType: { from: payment.paymentType, to: paymentType },
          payAmount: { from: Number(payment.payAmount) || 0, to: Number(payAmount) || 0 },
          tds: { from: Number(payment.tds) || 0, to: Number(tds) || 0 },
          deduction: { from: Number(payment.deduction) || 0, to: Number(deduction) || 0 },
          deductionRemark: { from: payment.deductionRemark || "", to: deductionRemark },
          paymentDate: { from: payment.paymentDate || "", to: paymentDate },
          bankingUtr: { from: payment.bankingUtr || "", to: bankingUtr },
          voucherNo: { from: payment.voucherNo || "", to: voucherNo },
        },
      };

      const updateData = {
        paymentType,
        payAmount: Number(payAmount) || 0,
        tds: Number(tds) || 0,
        deduction: Number(deduction) || 0,
        deductionRemark: deductionRemark.trim(),
        paymentDate,
        bankingUtr: paymentType === "Banking" ? bankingUtr.trim() : "",
        voucherNo: paymentType === "Cash" ? voucherNo.trim() : "",
        balanceAfterPayment: recalculatedBalance,
        isFullyPaid: recalculatedBalance < FULLY_PAID_TOLERANCE,
        updatedAt: serverTimestamp(),
        editHistory: [...(payment.editHistory || []), historyEntry],
      };

      await updateDocumentNonBlocking(
        { type: 'document', path: `outgoing_payments/${payment.id}`, collection: 'outgoing_payments', id: payment.id },
        updateData
      );

      // Update the invoice_receipts paidAmount if invoice exists
      if (invoice?.id) {
        const currentPaid = Number(invoice.paidAmount) || 0;
        await updateDocumentNonBlocking(
          { type: 'document', path: `invoice_receipts/${invoice.id}`, collection: 'invoice_receipts', id: invoice.id },
          {
            paidAmount: currentPaid + delta,
            paymentStatus: recalculatedBalance < FULLY_PAID_TOLERANCE ? "Fully Paid" : "Partially Paid",
            updatedAt: serverTimestamp(),
          }
        );
      }

      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: `Payment record for Invoice ${payment.invoiceNo} revised successfully`, isError: false } }));
      setOpen(false);
      // Trigger re-search so the list refreshes
      window.dispatchEvent(new CustomEvent('sap-execute'));
    } catch (e) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "System Error: Failed to revise payment record", isError: true } }));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="h-6 rounded-none bg-blue-700 hover:bg-blue-800 text-[9px] font-black uppercase px-3 shadow-sm">Edit</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl rounded-none border-gray-400 p-0 overflow-hidden shadow-2xl">
        <div className="bg-[#333e4f] text-white p-3 flex justify-between items-center">
          <DialogTitle className="text-[11px] font-black uppercase tracking-widest flex items-center gap-2">
            <IndianRupee className="h-4 w-4 text-amber-400" /> Revise Payment: {payment.invoiceNo}
          </DialogTitle>
          <DialogTrigger asChild><button className="hover:bg-white/10 p-1"><X className="h-4 w-4" /></button></DialogTrigger>
        </div>

        <div className="p-4 space-y-4 bg-white max-h-[80vh] overflow-y-auto">
          {/* Edit History Toggle */}
          {(payment.editHistory?.length > 0 || editHistoryOpen) && (
            <div className="border border-amber-300 bg-amber-50 rounded-sm overflow-hidden">
              <div className="bg-amber-100 px-3 py-1 text-[11px] font-bold text-amber-800 flex items-center justify-between">
                <span className="flex items-center gap-1.5"><History className="h-3.5 w-3.5" /> Edit History / Audit Log ({payment.editHistory?.length || 0} change(s))</span>
                <button onClick={() => setEditHistoryOpen(!editHistoryOpen)} className="text-[9px] uppercase font-black hover:underline">{editHistoryOpen ? "Hide" : "Show"}</button>
              </div>
              {editHistoryOpen && (
                <div className="p-2 space-y-2 max-h-[180px] overflow-y-auto">
                  {(payment.editHistory || []).map((h: any, idx: number) => (
                    <div key={idx} className="text-[10px] border border-amber-200 bg-white p-2">
                      <div className="font-bold text-amber-800">#{idx + 1} • {new Date(h.changedAt).toLocaleString()} • {h.changedBy}</div>
                      <div className="text-gray-600 mt-1 font-mono">
                        Pay Amt: {h.changes.payAmount.from} → {h.changes.payAmount.to} | TDS: {h.changes.tds.from} → {h.changes.tds.to} | Deduction: {h.changes.deduction.from} → {h.changes.deduction.to} | Date: {h.changes.paymentDate.from} → {h.changes.paymentDate.to}
                      </div>
                      {h.changes.deductionRemark.from !== h.changes.deductionRemark.to && (
                        <div className="text-gray-500 mt-0.5">Remark: "{h.changes.deductionRemark.from}" → "{h.changes.deductionRemark.to}"</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Editable Payment Details */}
          <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
            <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700">Payment Details (Editable)</div>
            <div className="p-3 grid grid-cols-2 gap-x-8 gap-y-2">
              <div className="sap-selection-row">
                <label className="sap-label">Payment Type</label>
                <div className="sap-input-wrapper max-w-[200px]">
                  <Select value={paymentType} onValueChange={setPaymentType}>
                    <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Banking">Banking</SelectItem>
                      <SelectItem value="Cash">Cash</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="sap-selection-row"><label className="sap-label">Payment Date</label><Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5" /></div>
              {paymentType === "Banking" ? (
                <div className="sap-selection-row"><label className="sap-label">Banking UTR No. *</label><Input value={bankingUtr} onChange={e => setBankingUtr(e.target.value.toUpperCase())} className="font-mono uppercase h-6 rounded-none border-gray-400 bg-white text-xs px-1.5" /></div>
              ) : (
                <div className="sap-selection-row"><label className="sap-label">Voucher No. *</label><Input value={voucherNo} onChange={e => setVoucherNo(e.target.value.toUpperCase())} className="font-mono uppercase h-6 rounded-none border-gray-400 bg-white text-xs px-1.5" /></div>
              )}
              <div className="sap-selection-row"><label className="sap-label font-bold text-emerald-700">Pay Amount</label><Input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} className="font-bold text-emerald-700 h-6 rounded-none border-gray-400 bg-white text-xs px-1.5" /></div>
              <div className="sap-selection-row"><label className="sap-label">TDS</label><Input type="number" value={tds} onChange={e => setTds(e.target.value)} className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5" /></div>
              <div className="sap-selection-row"><label className="sap-label">Deduction</label><Input type="number" value={deduction} onChange={e => setDeduction(e.target.value)} className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5" /></div>
              {Number(deduction) > 0 && (
                <div className="sap-selection-row animate-in fade-in duration-200">
                  <label className="sap-label">Deduction Remark *</label>
                  <Input value={deductionRemark} onChange={e => setDeductionRemark(e.target.value)} placeholder="Reason for deduction..." className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5" />
                </div>
              )}
              <div className="sap-selection-row col-span-2">
                <label className="sap-label font-bold text-blue-800">Recalculated Balance (Auto)</label>
                <Input value={`₹ ${recalculatedBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} readOnly className="bg-gray-100 text-right font-black text-blue-900 border-blue-300" />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#e1e1e1] p-3 flex justify-end gap-3 shadow-inner border-t border-gray-400">
          <Button onClick={handleSave} disabled={isSaving} className="h-8 rounded-none bg-blue-700 hover:bg-blue-800 text-[11px] font-bold uppercase px-6 shadow-sm gap-1.5">
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
          <Button onClick={() => setOpen(false)} variant="outline" className="h-8 rounded-none bg-white border-gray-400 text-gray-700 text-[11px] font-bold uppercase px-6 shadow-sm hover:bg-gray-100">
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

