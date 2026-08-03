"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useDatabase, useCollection, useMemoDatabase, updateDocumentNonBlocking } from "@/database";
import { collection, query, where, getDocs } from "@/database/mongo";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Search, Loader2, Receipt, Upload, CheckCircle2, X, Download, Save, RotateCcw, Eye, FileImage, Undo2, Lock } from "lucide-react";
import Image from "next/image";

export default function MBST() {
  const db = useDatabase();
  const fileRef = useRef<HTMLInputElement>(null);

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

  // 2. Search Criteria State
  const [searchPlant, setSearchPlant] = useState("");
  const [searchInvoiceNo, setSearchInvoiceNo] = useState("");
  const [searchBankUtr, setSearchBankUtr] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // 3. Master Data Queries
  const plantsQuery = useMemoDatabase(() => collection(db, "plants"), [db]);
  const { data: plants } = useCollection(plantsQuery);

  const customersQuery = useMemoDatabase(() => collection(db, "customers"), [db]);
  const { data: customers } = useCollection(customersQuery);

  const firmsQuery = useMemoDatabase(() => collection(db, "firms"), [db]);
  const { data: firms } = useCollection(firmsQuery);

  // 4. Found Record State
  const [foundPayment, setFoundPayment] = useState<any>(null);
  const [foundInvoice, setFoundInvoice] = useState<any>(null);
  const [bankingBalance, setBankingBalance] = useState<number | null>(null);
  const [paymentDocId, setPaymentDocId] = useState<string | null>(null);

  // 4b. Reversal State
  const [isReversing, setIsReversing] = useState(false);
  const [reversalReason, setReversalReason] = useState("");
  const [isReversedRecord, setIsReversedRecord] = useState(false);

  // 5. Editable Fields State
  const [editPaymentMode, setEditPaymentMode] = useState("");
  const [editReceiptAmount, setEditReceiptAmount] = useState("");
  const [editTdsAmount, setEditTdsAmount] = useState("");
  const [editDeductionAmount, setEditDeductionAmount] = useState("");
  const [editDeductionRemark, setEditDeductionRemark] = useState("");
  const [editBankUtr, setEditBankUtr] = useState("");
  const [editPaymentAdviceNo, setEditPaymentAdviceNo] = useState("");
  const [editPaymentDate, setEditPaymentDate] = useState("");
  const [editProofData, setEditProofData] = useState("");

  // 6. Derived Data
  const filteredPlants = useMemo(() => {
    if (isAdmin) return plants || [];
    return plants?.filter(p => p.plantId === assignedPlantId) || [];
  }, [plants, isAdmin, assignedPlantId]);

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

  // 7. GST Display Logic
  const hasCgstSgst = useMemo(() => {
    if (!foundInvoice?.totals) return false;
    return (foundInvoice.totals.cgst || 0) > 0 && (foundInvoice.totals.sgst || 0) > 0;
  }, [foundInvoice]);

  const hasIgst = useMemo(() => {
    if (!foundInvoice?.totals) return false;
    return (foundInvoice.totals.igst || 0) > 0;
  }, [foundInvoice]);

  // 8. Search Handler
  const handleSearch = useCallback(async () => {
    if (!searchPlant) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Error: Plant is mandatory", isError: true } }));
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    setFoundPayment(null);
    setFoundInvoice(null);
    setBankingBalance(null);
    setPaymentDocId(null);
    setIsReversedRecord(false);
    setReversalReason("");
    setIsReversing(false);

    try {
      // Search payment_receipts by Plant + Invoice No + Bank UTR
      let paymentsQuery = query(
        collection(db, "payment_receipts"),
        where("plantId", "==", searchPlant)
      );

      if (searchInvoiceNo) paymentsQuery = query(paymentsQuery, where("invoiceNo", "==", searchInvoiceNo));
      if (searchBankUtr) paymentsQuery = query(paymentsQuery, where("bankingUtr", "==", searchBankUtr));

      const paymentSnap = await getDocs(paymentsQuery);

      if (paymentSnap.empty) {
        window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: `No payment record found with the specified criteria in Plant ${searchPlant}`, isError: true } }));
        setIsSearching(false);
        return;
      }

      // Take the latest payment record
      const paymentDoc = paymentSnap.docs[0];
      const payment = paymentDoc.data();
      setPaymentDocId(paymentDoc.id);
      setFoundPayment(payment);
      setIsReversedRecord(payment.status === "Reversed"); // Lock editing for already-reversed records
      setReversalReason(payment.reversalReason || "");

      // Populate editable fields
      setEditPaymentMode(payment.paymentMode || "");
      setEditReceiptAmount(String(payment.receiptAmount || ""));
      setEditTdsAmount(String(payment.tds || ""));
      setEditDeductionAmount(String(payment.deduction || ""));
      setEditDeductionRemark(payment.deductionRemark || "");
      setEditBankUtr(payment.bankingUtr || "");
      setEditPaymentAdviceNo(payment.paymentAdviceNo || "");
      setEditPaymentDate(payment.paymentDate || "");
      setEditProofData(payment.proofData || "");

      // The invoice number to search for is the one from the found payment record
      const invoiceToSearch = payment.invoiceNo || searchInvoiceNo;

      // Fetch associated invoice from sales_invoices
      const invoiceQuery = query(
        collection(db, "sales_invoices"),
        where("plantId", "==", searchPlant),
        where("invoiceNumber", "==", invoiceToSearch)
      );
      const invoiceSnap = await getDocs(invoiceQuery);

      if (!invoiceSnap.empty) {
        const invDoc = invoiceSnap.docs[0];
        const inv = invDoc.data();
        const firm = firmMap[inv.plantId];
        const consignee = customerMap[inv.billTo];

        setFoundInvoice({
          ...inv,
          consignorName: firm?.name || "N/A",
          consignorGstin: firm?.gstin || "N/A",
          billToName: consignee?.name || inv.billTo || "N/A",
          billToGstin: consignee?.gstin || "N/A",
          state: consignee?.stateName || "N/A",
        });
      } else {
        setFoundInvoice(null);
      }

// Fetch all payments for the invoice to calculate banking balance (posted - reversed)
      const allPaymentsQuery = query(
        collection(db, "payment_receipts"),
        where("invoiceNo", "==", invoiceToSearch)
      );
      const allPaymentsSnap = await getDocs(allPaymentsQuery);
      if (!allPaymentsSnap.empty) {
        let totalPosted = 0;
        let totalReversed = 0;
        allPaymentsSnap.docs.forEach(doc => {
          const p = doc.data();
          const total = (Number(p.receiptAmount) || 0) + (Number(p.tds) || 0) + (Number(p.deduction) || 0);
          if (p.status === "Reversed") {
            totalReversed += total;
          } else {
            totalPosted += total;
          }
        });
        const grossAmount = invoiceSnap.docs[0]?.data().totals?.grossAmount || 0;
        // Balance = Gross - Total Posted + Total Reversed (restored)
        setBankingBalance(grossAmount - totalPosted + totalReversed);
      } else {
        setFoundInvoice(null);
      }

      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: `Payment record found for Invoice ${invoiceToSearch}`, isError: false } }));
    } catch (e) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "System Error: Failed to fetch payment record", isError: true } }));
    } finally {
      setIsSearching(false);
    }
  }, [db, searchPlant, searchInvoiceNo, searchBankUtr, firmMap, customerMap]);

  // 9. File Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Error: File exceeds 2MB limit", isError: true } }));
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setEditProofData(result);
    };
    reader.readAsDataURL(file);
  };

// 10. Reverse Handler
  const handleReverse = useCallback(async () => {
    if (!paymentDocId || !foundPayment) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Error: No payment record loaded to reverse", isError: true } }));
      return;
    }
    if (!reversalReason.trim()) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Error: Reversal Reason is mandatory", isError: true } }));
      return;
    }

    setIsReversing(true);
    try {
      const currentUser = (typeof window !== "undefined" ? JSON.parse(localStorage.getItem("sikka_user") || "{}")?.name : "") || "USER";
      const reversalData = {
        status: "Reversed",
        reversalReason: reversalReason.trim(),
        reversedAt: new Date().toISOString(),
        reversedBy: currentUser,
        originalReceiptAmount: foundPayment.receiptAmount,
        originalTds: foundPayment.tds,
        originalDeduction: foundPayment.deduction,
        updatedAt: new Date().toISOString(),
      };

      await updateDocumentNonBlocking(
        { type: 'document', path: `payment_receipts/${paymentDocId}`, collection: 'payment_receipts', id: paymentDocId },
        reversalData
      );

      // Restore paidAmount on the invoice (decrement by the reversed amount)
      if (foundInvoice?.id) {
        const reversedTotal = (Number(foundPayment.receiptAmount) || 0) + (Number(foundPayment.tds) || 0) + (Number(foundPayment.deduction) || 0);
        const currentPaid = Number(foundInvoice.paidAmount) || 0;
        await updateDocumentNonBlocking(
          { type: 'document', path: `sales_invoices/${foundInvoice.id}`, collection: 'sales_invoices', id: foundInvoice.id },
          {
            paidAmount: Math.max(0, currentPaid - reversedTotal),
            updatedAt: new Date().toISOString(),
          }
        );
      }

      setIsReversedRecord(true);
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Payment receipt reversed successfully. Amount restored to invoice balance.", isError: false } }));
    } catch (e) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "System Error: Failed to reverse payment record", isError: true } }));
    } finally {
      setIsReversing(false);
    }
  }, [paymentDocId, foundPayment, foundInvoice, reversalReason]);

  // 11. Save Handler
  const handleSave = useCallback(async () => {
    if (!paymentDocId) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Error: No payment record loaded to update", isError: true } }));
      return;
    }

    // Block save for already-reversed records
    if (isReversedRecord) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Error: Cannot modify a reversed payment record", isError: true } }));
      return;
    }

    // Validation
    if (Number(editDeductionAmount) > 0 && !editDeductionRemark) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Error: Deduction Remark is mandatory when deduction amount > 0", isError: true } }));
      return;
    }

    setIsSaving(true);
    try {
      const updateData: any = {
        paymentMode: editPaymentMode,
        receiptAmount: Number(editReceiptAmount) || 0,
        tds: Number(editTdsAmount) || 0,
        deduction: Number(editDeductionAmount) || 0,
        deductionRemark: editDeductionRemark,
        bankingUtr: editBankUtr,
        paymentAdviceNo: editPaymentAdviceNo,
        paymentDate: editPaymentDate,
        proofData: editProofData,
        updatedAt: new Date().toISOString(),
      };

      await updateDocumentNonBlocking(
        { type: 'document', path: `payment_receipts/${paymentDocId}`, collection: 'payment_receipts', id: paymentDocId },
        updateData
      );

      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Payment record updated successfully", isError: false } }));
    } catch (e) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "System Error: Failed to update payment record", isError: true } }));
    } finally {
      setIsSaving(false);
    }
  }, [paymentDocId, editPaymentMode, editReceiptAmount, editTdsAmount, editDeductionAmount, editDeductionRemark, editBankUtr, editPaymentAdviceNo, editPaymentDate, editProofData]);

  // 11. Reset Handler
  const handleReset = useCallback(() => {
    setSearchPlant("");
    setSearchInvoiceNo("");
    setSearchBankUtr("");
    setHasSearched(false);
    setFoundPayment(null);
    setFoundInvoice(null);
    setBankingBalance(null);
    setPaymentDocId(null);
setEditPaymentMode("");
    setEditReceiptAmount("");
    setEditTdsAmount("");
    setEditDeductionAmount("");
    setEditDeductionRemark("");
    setEditBankUtr("");
    setEditPaymentAdviceNo("");
    setEditPaymentDate("");
    setEditProofData("");
    setIsReversedRecord(false);
    setReversalReason("");
    setIsReversing(false);
  }, []);

  // 12. Keyboard Shortcuts
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
      <div className="sap-header-title">MBST - Reverse Payment / Modify Payment</div>

      {/* Search Criteria Section */}
      <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9] mx-4 mt-4">
        <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700 flex justify-between items-center">
          <span>Search Criteria</span>
          <span className="text-[10px] text-blue-600 font-bold uppercase italic">F8 to Execute</span>
        </div>
        <div className="p-3 grid grid-cols-3 gap-x-8 gap-y-3">
          <div className="sap-selection-row">
            <label className="sap-label">Plant *</label>
            <div className="sap-input-wrapper max-w-[250px]">
              <Select value={searchPlant} onValueChange={setSearchPlant}>
                <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]">
                  <SelectValue placeholder="Select Plant" />
                </SelectTrigger>
                <SelectContent>
                  {filteredPlants.map(p => (
                    <SelectItem key={p.id} value={p.plantId}>
                      {p.plantId} - {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="sap-selection-row">
            <label className="sap-label">Invoice Number</label>
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
          <div className="sap-selection-row">
            <label className="sap-label">Bank UTR No.</label>
            <div className="sap-input-wrapper max-w-[250px]">
              <Input
                value={searchBankUtr}
                onChange={e => setSearchBankUtr(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="Enter bank UTR number..."
                className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]"
              />
            </div>
          </div>
        </div>
        <div className="bg-[#e7ebf1] px-3 py-2 border-t border-[#b5c7de] flex gap-3">
          <Button
            onClick={handleSearch}
            disabled={isSearching}
            className="h-7 rounded-none bg-blue-700 hover:bg-blue-800 text-[11px] font-bold uppercase gap-1.5 shadow-sm"
          >
            {isSearching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            Search (F8)
          </Button>
          <Button
            onClick={handleReset}
            variant="outline"
            className="h-7 rounded-none bg-white border-gray-400 text-gray-700 text-[11px] font-bold uppercase gap-1.5 shadow-sm hover:bg-gray-100"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </Button>
        </div>
      </div>

      {/* Results Area */}
      {isSearching && (
        <div className="flex items-center justify-center py-20">
          <div className="flex items-center gap-3 text-blue-700">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-sm font-bold uppercase tracking-widest">Searching Payment Records...</span>
          </div>
        </div>
      )}

      {hasSearched && !isSearching && !foundPayment && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 select-none">
          <Receipt className="h-16 w-16 stroke-1 mb-4 opacity-30" />
          <p className="text-sm font-black uppercase tracking-[0.2em] opacity-50">No payment record found</p>
          <p className="text-[10px] font-bold text-gray-400 mt-2">Check the search criteria and try again</p>
        </div>
      )}

      {foundPayment && foundInvoice && !isSearching && (
        <div className="p-4 space-y-4 animate-in fade-in duration-300">
          {/* Invoice Information (Read-Only) */}
          <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
            <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700 flex justify-between items-center">
              <span>Invoice Information</span>
              <span className="text-[10px] text-gray-500 italic">Read-Only View</span>
            </div>
            <div className="p-3 grid grid-cols-2 gap-x-8 gap-y-2">
              <div className="sap-selection-row">
                <label className="sap-label">Plant</label>
                <Input value={foundInvoice.plantId || searchPlant} readOnly className="bg-gray-100 font-bold" />
              </div>
              <div className="sap-selection-row">
                <label className="sap-label">Invoice Number</label>
                <Input value={foundInvoice.invoiceNumber || searchInvoiceNo} readOnly className="bg-gray-100 font-mono font-black text-blue-800" />
              </div>
              <div className="sap-selection-row">
                <label className="sap-label">Invoice Date</label>
                <Input value={foundInvoice.invoiceDate || "N/A"} readOnly className="bg-gray-100" />
              </div>
              <div className="sap-selection-row">
                <label className="sap-label">Consignor</label>
                <Input value={foundInvoice.consignorName || "N/A"} readOnly className="bg-gray-100 font-bold" />
              </div>
              <div className="sap-selection-row">
                <label className="sap-label">Bill-to Party</label>
                <Input value={foundInvoice.billToName || "N/A"} readOnly className="bg-gray-100 font-bold" />
              </div>
              <div className="sap-selection-row">
                <label className="sap-label">State</label>
                <Input value={foundInvoice.state || "N/A"} readOnly className="bg-gray-100" />
              </div>
              <div className="sap-selection-row">
                <label className="sap-label">Bill Month</label>
                <Input value={foundInvoice.billMonth || "N/A"} readOnly className="bg-gray-100 uppercase" />
              </div>
              <div className="sap-selection-row">
                <label className="sap-label">Document Type</label>
                <Input value={foundInvoice.docType || foundInvoice.docCategory || "N/A"} readOnly className="bg-gray-100 uppercase" />
              </div>
              <div className="sap-selection-row">
                <label className="sap-label">Taxable Amount</label>
                <Input value={(foundInvoice.totals?.taxableAmount || 0).toLocaleString()} readOnly className="bg-gray-100 text-right font-mono" />
              </div>
              {/* Conditional GST Display */}
              {hasCgstSgst && (
                <>
                  <div className="sap-selection-row">
                    <label className="sap-label">CGST</label>
                    <Input value={(foundInvoice.totals?.cgst || 0).toLocaleString()} readOnly className="bg-gray-100 text-right font-mono" />
                  </div>
                  <div className="sap-selection-row">
                    <label className="sap-label">SGST</label>
                    <Input value={(foundInvoice.totals?.sgst || 0).toLocaleString()} readOnly className="bg-gray-100 text-right font-mono" />
                  </div>
                </>
              )}
              {hasIgst && (
                <div className="sap-selection-row">
                  <label className="sap-label">IGST</label>
                  <Input value={(foundInvoice.totals?.igst || 0).toLocaleString()} readOnly className="bg-gray-100 text-right font-mono" />
                </div>
              )}
              <div className="sap-selection-row">
                <label className="sap-label font-bold text-blue-800">Gross Payable Amount</label>
                <Input value={(foundInvoice.totals?.grossAmount || 0).toLocaleString()} readOnly className="bg-gray-200 text-right font-black text-blue-900 border-blue-300" />
              </div>
            </div>
          </div>

{/* Reversed Record Banner */}
          {isReversedRecord && (
            <div className="border border-red-400 bg-red-50 rounded-sm overflow-hidden">
              <div className="bg-red-100 px-3 py-1 text-[12px] font-bold text-red-800 flex items-center gap-2">
                <Lock className="h-3.5 w-3.5" /> This payment receipt has been reversed. Editing is locked.
              </div>
              {reversalReason && (
                <div className="px-3 py-1 text-[11px] text-red-700 border-t border-red-200">
                  Reversal Reason: {reversalReason}
                </div>
              )}
            </div>
          )}

          {/* Editable Payment Fields */}
          <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
            <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700 flex justify-between items-center">
              <span>Payment Details {isReversedRecord ? "(Read-Only - Reversed)" : "(Editable)"}</span>
              {isReversedRecord ? (
                <span className="text-[10px] text-red-600 font-bold italic flex items-center gap-1"><Lock className="h-3 w-3" /> Locked</span>
              ) : (
                <span className="text-[10px] text-emerald-600 font-bold italic">Modify fields as needed</span>
              )}
            </div>
            <div className="p-3 grid grid-cols-2 gap-x-8 gap-y-2">
              <div className="sap-selection-row">
                <label className="sap-label">Payment Mode</label>
                <div className="sap-input-wrapper max-w-[200px]">
                  <Select value={editPaymentMode} onValueChange={setEditPaymentMode}>
                    <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]">
                      <SelectValue placeholder="" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Banking">Banking</SelectItem>
                      <SelectItem value="Cash">Cash</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {bankingBalance !== null && (
                <div className="sap-selection-row">
                  <label className="sap-label font-bold text-red-700">Banking Balance</label>
                  <Input
                    value={bankingBalance.toLocaleString()} readOnly className="bg-gray-100 text-right font-black text-red-900 border-red-200 h-6 rounded-none border-gray-400 text-xs px-1.5"
                  />
                </div>
              )}
              <div className="sap-selection-row">
                <label className="sap-label">Receipt Amount</label>
                <Input
                  type="number"
                  value={editReceiptAmount}
                  onChange={e => setEditReceiptAmount(e.target.value)}
                  className="font-bold text-emerald-700 h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]"
                />
              </div>
              <div className="sap-selection-row">
                <label className="sap-label">TDS Amount</label>
                <Input
                  type="number"
                  value={editTdsAmount}
                  onChange={e => setEditTdsAmount(e.target.value)}
                  className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]"
                />
              </div>
              <div className="sap-selection-row">
                <label className="sap-label">Deduction Amount</label>
                <Input
                  type="number"
                  value={editDeductionAmount}
                  onChange={e => setEditDeductionAmount(e.target.value)}
                  className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]"
                />
              </div>
              {/* Conditional Deduction Remark */}
              {Number(editDeductionAmount) > 0 && (
                <div className="sap-selection-row animate-in fade-in duration-200">
                  <label className="sap-label">Deduction Remark *</label>
                  <Input
                    value={editDeductionRemark}
                    onChange={e => setEditDeductionRemark(e.target.value)}
                    placeholder="Reason for deduction..."
                    className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]"
                  />
                </div>
              )}
              <div className="sap-selection-row">
                <label className="sap-label">Bank UTR No.</label>
                <Input
                  value={editBankUtr}
                  onChange={e => setEditBankUtr(e.target.value)}
                  className="font-mono uppercase h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]"
                />
              </div>
              <div className="sap-selection-row">
                <label className="sap-label">Payment Advice No.</label>
                <Input
                  value={editPaymentAdviceNo}
                  onChange={e => setEditPaymentAdviceNo(e.target.value)}
                  className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]"
                />
              </div>
              <div className="sap-selection-row">
                <label className="sap-label">Payment Date</label>
                <Input
                  type="date"
                  value={editPaymentDate}
                  onChange={e => setEditPaymentDate(e.target.value)}
                  className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]"
                />
              </div>
              <div className="sap-selection-row col-span-2">
                <label className="sap-label">Payment Proof</label>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 rounded-none border-gray-400 bg-white text-xs gap-1.5"
                    onClick={() => fileRef.current?.click()}
                  >
                    <Upload className="h-3.5 w-3.5" /> {editProofData ? "Replace File" : "Select File"}
                  </Button>
                  <input
                    type="file"
                    ref={fileRef}
                    className="hidden"
                    accept=".pdf,image/*"
                    onChange={handleFileUpload}
                  />
                  {editProofData && (
                    <>
                      <span className="text-[11px] text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> File Attached
                      </span>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-[10px] font-bold text-blue-700 hover:bg-blue-100 gap-1 rounded-none"
                          >
                            <Eye className="h-3.5 w-3.5" /> View
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg rounded-none border-gray-400 p-0 overflow-hidden shadow-2xl">
                          <div className="bg-[#333e4f] text-white p-3 flex justify-between items-center">
                            <DialogTitle className="text-[11px] font-black uppercase tracking-widest flex items-center gap-2">
                              <FileImage className="h-4 w-4 text-emerald-400" /> Payment Proof: {searchInvoiceNo}
                            </DialogTitle>
                            <DialogTrigger asChild>
                              <button className="hover:bg-white/10 p-1">
                                <X className="h-4 w-4" />
                              </button>
                            </DialogTrigger>
                          </div>
                          <div className="p-4 flex items-center justify-center min-h-[300px] relative bg-white">
                            <div className="relative w-full h-[400px]">
                              <Image src={editProofData} alt="Payment Proof" fill className="object-contain" />
                            </div>
                          </div>
                          <div className="bg-[#e1e1e1] p-3 flex justify-end gap-3">
                            <a
                              href={editProofData}
                              download={`Proof_${searchInvoiceNo}.png`}
                              className="h-8 rounded-none bg-[#333e4f] text-white text-[11px] font-bold uppercase px-6 shadow-sm flex items-center gap-2 hover:bg-gray-700"
                            >
                              <Download className="h-3.5 w-3.5" /> Download
                            </a>
                            <DialogTrigger asChild>
                              <Button className="h-8 rounded-none bg-gray-600 text-white text-[11px] font-bold uppercase px-6 shadow-sm hover:bg-gray-700">
                                Close
                              </Button>
                            </DialogTrigger>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </>
                  )}
                  {!editProofData && (
                    <span className="text-[10px] text-gray-400 italic">No document attached</span>
                  )}
                </div>
              </div>
            </div>
          </div>

{/* Action Buttons */}
          <div className="flex gap-3 justify-end border-t border-[#b5c7de] pt-4">
            {!isReversedRecord && (
              <>
                <div className="flex-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Reversal Reason (for reversing payment)</label>
                  <div className="flex gap-2 items-center">
                    <Input
                      value={reversalReason}
                      onChange={e => setReversalReason(e.target.value)}
                      placeholder="Enter reason for reversal..."
                      className="h-7 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4] flex-1"
                    />
                    <Button
                      onClick={handleReverse}
                      disabled={isReversing}
                      className="h-7 rounded-none bg-orange-700 hover:bg-orange-800 text-[11px] font-bold uppercase gap-1.5 shadow-sm px-4"
                    >
                      {isReversing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
                      Reverse Payment
                    </Button>
                  </div>
                </div>
              </>
            )}
            <Button
              onClick={handleSave}
              disabled={isSaving || isReversedRecord}
              className="h-8 rounded-none bg-green-700 hover:bg-green-800 text-[11px] font-bold uppercase gap-1.5 shadow-sm px-6"
            >
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save Changes
            </Button>
            <Button
              onClick={handleReset}
              variant="outline"
              className="h-8 rounded-none bg-white border-gray-400 text-gray-700 text-[11px] font-bold uppercase gap-1.5 shadow-sm hover:bg-gray-100 px-6"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Empty State - No Search Yet */}
      {!hasSearched && !isSearching && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 select-none">
          <Receipt className="h-20 w-20 stroke-1 mb-4 opacity-20" />
          <p className="text-sm font-black uppercase tracking-[0.2em] opacity-40">Enter search criteria and Execute (F8)</p>
          <p className="text-[10px] font-bold text-gray-400 mt-2">Search by Plant, Invoice Number, and Bank UTR No.</p>
        </div>
      )}

      {/* Footer Status Bar */}
      <div className="bg-[#333e4f] p-2 flex justify-between items-center text-white text-[10px] font-bold uppercase tracking-widest shadow-inner mt-auto">
        <div className="flex items-center gap-6">
          <span>MBST - Reverse Payment</span>
          <span className="opacity-40">|</span>
          <span>Status: {foundPayment ? "Record Loaded" : hasSearched ? "No Record" : "Ready"}</span>
        </div>
        <div className="flex items-center gap-4 pr-4">
          {foundPayment && (
            <>
              <span className="opacity-50">Invoice:</span>
              <span className="text-emerald-400">{searchInvoiceNo}</span>
              <span className="opacity-30">|</span>
              <span className="opacity-50">UTR:</span>
              <span className="text-blue-300 font-mono">{searchBankUtr}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
