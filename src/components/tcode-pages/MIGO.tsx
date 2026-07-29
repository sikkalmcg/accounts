"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useDatabase, useCollection, useMemoDatabase, addDocumentNonBlocking } from "@/database";
import { collection, query, where, getDocs, serverTimestamp } from "@/database/mongo";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Loader2, Upload, CheckCircle2, Search } from "lucide-react";
import { parseGSTIN } from "@/lib/gst-utils";

type ReceiptType = "Payment Receipt" | "Invoice Receipt" | "Stock Receipt";

export default function MIGO() {
  const db = useDatabase();
  const fileRef = useRef<HTMLInputElement>(null);
  
  // Header State
  const [plantId, setPlantId] = useState("");
  const [receiptType, setReceiptType] = useState<ReceiptType | "">("");

  // Master Data
  const plantsQuery = useMemoDatabase(() => collection(db, "plants"), [db]);
  const { data: plants, isLoading: isPlantsLoading } = useCollection(plantsQuery);

  const firmsQuery = useMemoDatabase(() => collection(db, "firms"), [db]);
  const { data: firms } = useCollection(firmsQuery);

  const vendorsQuery = useMemoDatabase(() => collection(db, "vendors"), [db]);
  const { data: vendors } = useCollection(vendorsQuery);

  const customersQuery = useMemoDatabase(() => collection(db, "customers"), [db]);
  const { data: customers } = useCollection(customersQuery);

  const materialsQuery = useMemoDatabase(() => collection(db, "materials"), [db]);
  const { data: materials } = useCollection(materialsQuery);

  const customerMap = useMemo(() => {
    const map: Record<string, any> = {};
    customers?.forEach(c => { map[c.customerId] = c; });
    return map;
  }, [customers]);

  // --- Payment Receipt State ---
  const [paymentData, setPaymentData] = useState({
    invoiceNo: "",
    date: "",
    consigneeName: "",
    invoiceType: "",
    taxableAmount: 0,
    taxAmount: 0,
    grossAmount: 0,
    receiptAmount: "",
    tds: "",
    deduction: "",
    deductionRemark: "",
    interest: "",
    balanceAmount: 0,
    remark: "",
    paymentMode: "Banking",
    bankingUtr: "",
    paymentAdviceNo: "",
    proofData: "",
    paymentDate: new Date().toISOString().split('T')[0],
  });

  // --- Invoice/Stock Receipt State ---
  const [receiptHeader, setReceiptHeader] = useState({
    firmId: "",
    invoiceNo: "",
    date: new Date().toISOString().split('T')[0],
    invoiceType: "Tax Invoice",
    vendorId: "",
    vendorGstin: "",
    address: "",
    state: "",
    stateCode: "",
    pin: "",
    gstRate: "18",
    proofData: "",
  });

  const [items, setItems] = useState<any[]>([{ id: '1', desc: '', matCode: '', hsn: '', qty: '', rate: '', amount: 0 }]);

  // --- Calculations ---
  const calculatedBalance = useMemo(() => {
    if (receiptType !== "Payment Receipt") return 0;
    const gross = Number(paymentData.grossAmount) || 0;
    const interest = Number(paymentData.interest) || 0;
    const receipt = Number(paymentData.receiptAmount) || 0;
    const tds = Number(paymentData.tds) || 0;
    const deduction = Number(paymentData.deduction) || 0;
    
    // Balance Amount = Gross Payable Value + Interest - Receipt Amount - TDS - Deduction
    return (gross + interest) - (receipt + tds + deduction);
  }, [paymentData.grossAmount, paymentData.interest, paymentData.receiptAmount, paymentData.tds, paymentData.deduction, receiptType]);

  // --- Shared Logic ---

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
      if (receiptType === "Payment Receipt") {
        setPaymentData(prev => ({ ...prev, proofData: result }));
      } else {
        setReceiptHeader(prev => ({ ...prev, proofData: result }));
      }
    };
    reader.readAsDataURL(file);
  };

  const resetAll = () => {
    setReceiptType("");
    setPlantId("");
    setPaymentData({
      invoiceNo: "", date: "", consigneeName: "", invoiceType: "", taxableAmount: 0, taxAmount: 0, grossAmount: 0,
      receiptAmount: "", tds: "", deduction: "", deductionRemark: "", interest: "", balanceAmount: 0, remark: "", 
      paymentMode: "Banking", bankingUtr: "", 
      paymentAdviceNo: "", proofData: "", paymentDate: new Date().toISOString().split('T')[0]
    });
    setReceiptHeader({
      firmId: "", invoiceNo: "", date: new Date().toISOString().split('T')[0], invoiceType: "Tax Invoice",
      vendorId: "", vendorGstin: "", address: "", state: "", stateCode: "", pin: "", gstRate: "18", proofData: ""
    });
    setItems([{ id: '1', desc: '', matCode: '', hsn: '', qty: '', rate: '', amount: 0 }]);
  };

  // --- Payment Receipt Logic ---

  const fetchInvoiceDetails = async () => {
    if (!plantId || !paymentData.invoiceNo) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Enter Plant and Invoice Number to fetch details", isError: true } }));
      return;
    }

    try {
      const q = query(collection(db, "sales_invoices"), 
        where("invoiceNumber", "==", paymentData.invoiceNo),
        where("plantId", "==", plantId)
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: `Invoice ${paymentData.invoiceNo} not found in Plant ${plantId}`, isError: true } }));
        setPaymentData(p => ({ ...p, date: "", consigneeName: "", invoiceType: "", taxableAmount: 0, taxAmount: 0, grossAmount: 0 }));
        return;
      }

      const inv = snap.docs[0].data();
      if (inv.status === "Cancelled") {
        window.dispatchEvent(new CustomEvent('sap-status', { 
          detail: { text: "Error: Selected Invoice is CANCELLED. No payments allowed.", isError: true } 
        }));
        setPaymentData(p => ({ ...p, date: "", consigneeName: "", invoiceType: "", taxableAmount: 0, taxAmount: 0, grossAmount: 0 }));
        return;
      }

      const billToName = customerMap[inv.billTo]?.name || inv.billTo || "N/A";
      const totalTax = (inv.totals?.cgst || 0) + (inv.totals?.sgst || 0) + (inv.totals?.igst || 0);

      setPaymentData(prev => ({
        ...prev,
        date: inv.invoiceDate || "",
        consigneeName: billToName,
        invoiceType: inv.docType || inv.docCategory || "Tax Invoice",
        taxableAmount: inv.totals?.taxableAmount || 0,
        taxAmount: totalTax,
        grossAmount: inv.totals?.grossAmount || 0
      }));

      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: `Details for Invoice ${paymentData.invoiceNo} fetched successfully`, isError: false } }));
    } catch (e) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "System Error: Failed to fetch invoice details", isError: true } }));
    }
  };

  // --- Invoice/Stock Receipt Logic ---

  const handleVendorSelect = (id: string) => {
    const v = vendors?.find(vend => vend.vendorId === id);
    if (v) {
      const gstin = v.gstin || "";
      const parsed = parseGSTIN(gstin);
      setReceiptHeader(prev => ({
        ...prev,
        vendorId: id,
        vendorGstin: gstin,
        address: v.address || "",
        state: parsed?.state || "",
        stateCode: parsed?.stateCode || "",
      }));
    }
  };

  const updateItem = (id: string, field: string, val: any) => {
    setItems(prev => prev.map(i => {
      if (i.id === id) {
        const updated = { ...i, [field]: val };
        if (field === 'qty' || field === 'rate') {
          updated.amount = (Number(updated.qty) || 0) * (Number(updated.rate) || 0);
        }
        return updated;
      }
      return i;
    }));
  };

  const totals = useMemo(() => {
    const qty = items.reduce((acc, i) => acc + (Number(i.qty) || 0), 0);
    const amount = items.reduce((acc, i) => acc + (i.amount || 0), 0);
    
    // GST Logic
    const selectedFirm = firms?.find(f => f.firmId === receiptHeader.firmId);
    const firmStateCode = selectedFirm?.gstin?.substring(0, 2);
    const isSameState = firmStateCode === receiptHeader.stateCode;
    const rate = Number(receiptHeader.gstRate) / 100;
    
    let cgst = 0, sgst = 0, igst = 0;
    if (receiptHeader.invoiceType === "Tax Invoice") {
      if (isSameState) {
        cgst = (amount * rate) / 2;
        sgst = (amount * rate) / 2;
      } else {
        igst = amount * rate;
      }
    }

    return { qty, amount, cgst, sgst, igst, total: amount + cgst + sgst + igst };
  }, [items, receiptHeader, firms]);

  const handleExecute = useCallback(() => {
    if (!plantId || !receiptType) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Error: Plant and Type are mandatory", isError: true } }));
      return;
    }

    if (receiptType === "Payment Receipt") {
      // Rule: If balance is > 100, Remark is mandatory
      if (calculatedBalance > 100 && !paymentData.remark) {
        window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Error: Remark is mandatory for balance amount > 100", isError: true } }));
        return;
      }
      // Rule: If deduction exists, Deduction Remark is mandatory
      if (Number(paymentData.deduction) > 0 && !paymentData.deductionRemark) {
        window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Error: Deduction Remark is mandatory", isError: true } }));
        return;
      }

      addDocumentNonBlocking(collection(db, "payment_receipts"), { 
        ...paymentData, 
        balanceAmount: calculatedBalance,
        plantId, 
        createdAt: serverTimestamp() 
      });
    } else {
      if (receiptHeader.invoiceType === "Tax Invoice" && !receiptHeader.vendorGstin) {
        window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Error: Vendor GSTIN is mandatory for Tax Invoice", isError: true } }));
        return;
      }
      const col = receiptType === "Invoice Receipt" ? "invoice_receipts" : "stock_receipts";
      addDocumentNonBlocking(collection(db, col), { 
        ...receiptHeader, 
        plantId, 
        items, 
        totals,
        createdAt: serverTimestamp() 
      });
    }

    window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: `${receiptType} saved successfully`, isError: false } }));
    resetAll();
  }, [db, plantId, receiptType, paymentData, receiptHeader, items, totals, calculatedBalance]);

  useEffect(() => {
    const onExec = () => handleExecute();
    const onCan = () => resetAll();
    window.addEventListener('sap-execute', onExec);
    window.addEventListener('sap-cancel', onCan);
    return () => {
      window.removeEventListener('sap-execute', onExec);
      window.removeEventListener('sap-cancel', onCan);
    };
  }, [handleExecute]);

  return (
    <div className="w-full flex flex-col bg-white min-h-full">
      <div className="bg-[#dae8f5] px-4 py-1 border-b border-gray-300">
        <h2 className="text-[13px] font-bold text-gray-800 uppercase italic tracking-wider">
          MIGO - Goods Movement / Receipts
        </h2>
      </div>

      <div className="p-4 space-y-4">
        {/* Main Header */}
        <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
          <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700">General Selection</div>
          <div className="p-2 grid grid-cols-2 gap-4">
            <div className="sap-selection-row">
              <label className="sap-label">Plant</label>
              <div className="sap-input-wrapper max-w-[200px]">
                <Select value={plantId} onValueChange={setPlantId}>
                  <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]">
                    <SelectValue placeholder="" />
                  </SelectTrigger>
                  <SelectContent>
                    {plants?.map(p => <SelectItem key={p.id} value={p.plantId}>{p.plantId} - {p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="sap-selection-row">
              <label className="sap-label">Type</label>
              <div className="sap-input-wrapper max-w-[200px]">
                <Select value={receiptType} onValueChange={(val: any) => setReceiptType(val)}>
                  <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]">
                    <SelectValue placeholder="" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Payment Receipt">Payment Receipt</SelectItem>
                    <SelectItem value="Invoice Receipt">Invoice Receipt</SelectItem>
                    <SelectItem value="Stock Receipt">Stock Receipt</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Receipt View */}
        {receiptType === "Payment Receipt" && (
          <div className="space-y-4 animate-in fade-in duration-300 select-text">
            <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
              <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700 flex justify-between items-center">
                <span>Invoice Reference (Auto-Fill)</span>
                <span className="text-[10px] text-blue-600 font-bold uppercase italic">Press Enter on Invoice No to fetch</span>
              </div>
              <div className="p-2 grid grid-cols-2 gap-x-8 gap-y-1">
                <div className="sap-selection-row">
                  <label className="sap-label">Invoice Number</label>
                  <div className="sap-input-wrapper relative">
                    <Input 
                      value={paymentData.invoiceNo} 
                      onChange={e => setPaymentData({...paymentData, invoiceNo: e.target.value})} 
                      onKeyDown={e => e.key === 'Enter' && fetchInvoiceDetails()}
                      placeholder="Enter and press Enter..."
                      className="pr-8"
                    />
                    <button onClick={fetchInvoiceDetails} className="absolute right-2 text-gray-400 hover:text-blue-600"><Search className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
                <div className="sap-selection-row"><label className="sap-label">Invoice Date</label><Input value={paymentData.date} readOnly className="bg-gray-100" /></div>
                <div className="sap-selection-row"><label className="sap-label">Consignee Name</label><Input value={paymentData.consigneeName} readOnly className="bg-gray-100 font-bold" /></div>
                <div className="sap-selection-row"><label className="sap-label">Invoice Type</label><Input value={paymentData.invoiceType} readOnly className="bg-gray-100 uppercase" /></div>
                <div className="sap-selection-row"><label className="sap-label">Taxable Amount</label><Input value={paymentData.taxableAmount.toLocaleString()} readOnly className="bg-gray-100 text-right font-mono" /></div>
                <div className="sap-selection-row"><label className="sap-label">Tax Amount</label><Input value={paymentData.taxAmount.toLocaleString()} readOnly className="bg-gray-100 text-right font-mono" /></div>
                <div className="sap-selection-row"><label className="sap-label font-bold text-blue-800">Gross Payable Value</label><Input value={paymentData.grossAmount.toLocaleString()} readOnly className="bg-gray-200 text-right font-black text-blue-900 border-blue-300" /></div>
              </div>
            </div>

            <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
              <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700">Receipt Details</div>
              <div className="p-2 grid grid-cols-2 gap-x-8 gap-y-1">
                <div className="sap-selection-row">
                  <label className="sap-label">Payment Mode</label>
                  <div className="sap-input-wrapper max-w-[200px]">
                    <Select value={paymentData.paymentMode} onValueChange={v => setPaymentData({...paymentData, paymentMode: v})}>
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
                <div className="sap-selection-row"><label className="sap-label">Receipt Amount</label><Input type="number" value={paymentData.receiptAmount} onChange={e => setPaymentData({...paymentData, receiptAmount: e.target.value})} className="font-bold text-emerald-700" /></div>
                <div className="sap-selection-row"><label className="sap-label">TDS</label><Input type="number" value={paymentData.tds} onChange={e => setPaymentData({...paymentData, tds: e.target.value})} /></div>
                <div className="sap-selection-row"><label className="sap-label">Deduction</label><Input type="number" value={paymentData.deduction} onChange={e => setPaymentData({...paymentData, deduction: e.target.value})} /></div>
                
                {/* Conditional Deduction Remark */}
                {Number(paymentData.deduction) > 0 && (
                  <div className="sap-selection-row animate-in fade-in duration-200">
                    <label className="sap-label">Deduction Remark *</label>
                    <Input value={paymentData.deductionRemark} onChange={e => setPaymentData({...paymentData, deductionRemark: e.target.value})} placeholder="Reason for deduction..." />
                  </div>
                )}

                <div className="sap-selection-row">
                  <label className="sap-label">Interest</label>
                  <Input type="number" value={paymentData.interest} onChange={e => setPaymentData({...paymentData, interest: e.target.value})} className="text-orange-700 font-bold" />
                </div>
                <div className="sap-selection-row">
                  <label className="sap-label font-bold text-red-700">Balance Amount</label>
                  <Input value={calculatedBalance.toLocaleString()} readOnly className="bg-gray-100 text-right font-black text-red-900 border-red-200" />
                </div>
                {/* Logic: Show Remark only if Balance > 100 */}
                {calculatedBalance > 100 && (
                  <div className="sap-selection-row animate-in fade-in duration-200">
                    <label className="sap-label">Remark *</label>
                    <Input value={paymentData.remark} onChange={e => setPaymentData({...paymentData, remark: e.target.value})} placeholder="Reason for high balance..." />
                  </div>
                )}

                {/* Conditional Banking Fields */}
                {paymentData.paymentMode === "Banking" && (
                  <>
                    <div className="sap-selection-row"><label className="sap-label">Banking UTR</label><Input value={paymentData.bankingUtr} onChange={e => setPaymentData({...paymentData, bankingUtr: e.target.value})} className="font-mono uppercase" /></div>
                    <div className="sap-selection-row"><label className="sap-label">Payment Advice No.</label><Input value={paymentData.paymentAdviceNo} onChange={e => setPaymentData({...paymentData, paymentAdviceNo: e.target.value})} /></div>
                    <div className="sap-selection-row mt-2">
                      <label className="sap-label">Payment Proof</label>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="h-7 rounded-none" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4 mr-2" /> Select File</Button>
                        <input type="file" ref={fileRef} className="hidden" accept=".pdf,image/*" onChange={handleFileUpload} />
                        {paymentData.proofData && <span className="text-[11px] text-emerald-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> File Attached</span>}
                      </div>
                    </div>
                  </>
                )}

                <div className="sap-selection-row mt-2">
                  <label className="sap-label">Payment Date</label>
                  <Input type="date" value={paymentData.paymentDate} onChange={e => setPaymentData({...paymentData, paymentDate: e.target.value})} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Invoice / Stock Receipt View */}
        {(receiptType === "Invoice Receipt" || receiptType === "Stock Receipt") && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
              <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700">Receipt Header</div>
              <div className="p-2 grid grid-cols-2 gap-x-8 gap-y-1">
                <div className="sap-selection-row">
                  <label className="sap-label">Firm</label>
                  <Select value={receiptHeader.firmId} onValueChange={v => setReceiptHeader({...receiptHeader, firmId: v})}>
                    <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]"><SelectValue placeholder="" /></SelectTrigger>
                    <SelectContent>{firms?.map(f => <SelectItem key={f.id} value={f.firmId}>{f.firmId} - {f.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="sap-selection-row"><label className="sap-label">Invoice Number</label><Input value={receiptHeader.invoiceNo} onChange={e => setReceiptHeader({...receiptHeader, invoiceNo: e.target.value})} /></div>
                <div className="sap-selection-row"><label className="sap-label">Date</label><Input type="date" value={receiptHeader.date} onChange={e => setReceiptHeader({...receiptHeader, date: e.target.value})} /></div>
                <div className="sap-selection-row">
                  <label className="sap-label">Invoice Type</label>
                  <Select value={receiptHeader.invoiceType} onValueChange={v => setReceiptHeader({...receiptHeader, invoiceType: v})}>
                    <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]"><SelectValue placeholder="" /></SelectTrigger>
                    <SelectContent><SelectItem value="Tax Invoice">Tax Invoice</SelectItem><SelectItem value="Non-Tax Invoice">Non-Tax Invoice</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
              <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700">Vendor Details</div>
              <div className="p-2 grid grid-cols-2 gap-x-8 gap-y-1">
                <div className="sap-selection-row">
                  <label className="sap-label">Vendor Name</label>
                  <Select value={receiptHeader.vendorId} onValueChange={handleVendorSelect}>
                    <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]"><SelectValue placeholder="" /></SelectTrigger>
                    <SelectContent>{vendors?.map(v => <SelectItem key={v.id} value={v.vendorId}>{v.vendorId} - {v.vendorName}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="sap-selection-row"><label className="sap-label">Vendor GSTIN {receiptHeader.invoiceType === "Tax Invoice" && "*"}</label><Input value={receiptHeader.vendorGstin} readOnly className="bg-gray-100 font-mono" /></div>
                <div className="sap-selection-row"><label className="sap-label">Address</label><Input value={receiptHeader.address} readOnly className="bg-gray-100" /></div>
                <div className="sap-selection-row gap-1">
                  <label className="sap-label">State / Code</label>
                  <Input value={receiptHeader.stateCode} readOnly className="w-12 bg-gray-100 text-center" />
                  <Input value={receiptHeader.state} readOnly className="bg-gray-100" />
                </div>
                <div className="sap-selection-row"><label className="sap-label">PIN</label><Input value={receiptHeader.pin} onChange={e => setReceiptHeader({...receiptHeader, pin: e.target.value})} /></div>
              </div>
            </div>

            <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-white">
              <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] flex items-center justify-between">
                <span className="text-[12px] font-semibold text-gray-700">Line Items</span>
                <Button size="sm" variant="ghost" className="h-5 text-[10px] hover:bg-white/50" onClick={() => setItems([...items, { id: Math.random().toString(), desc: '', matCode: '', hsn: '', qty: '', rate: '', amount: 0 }])}><Plus className="h-3 w-3 mr-1" /> Add Row</Button>
              </div>
              <Table>
                <TableHeader className="bg-[#e7ebf1]">
                  <TableRow className="h-7">
                    {receiptType === "Stock Receipt" && <TableHead className="text-[11px] font-bold border-r w-32">MATERIAL</TableHead>}
                    <TableHead className="text-[11px] font-bold border-r">Description</TableHead>
                    <TableHead className="text-[11px] font-bold border-r w-24">HSN</TableHead>
                    <TableHead className="text-[11px] font-bold border-r w-20">Qty</TableHead>
                    <TableHead className="text-[11px] font-bold border-r w-24">Rate</TableHead>
                    <TableHead className="text-[11px] font-bold border-r w-32 text-right">Amount</TableHead>
                    <TableHead className="w-8"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((row, idx) => (
                    <TableRow key={row.id} className="h-7 hover:bg-blue-50/30">
                      {receiptType === "Stock Receipt" && (
                        <TableCell className="p-0 border-r">
                          <Select value={row.matCode} onValueChange={v => {
                            const m = materials?.find(mat => mat.productName === v);
                            updateItem(row.id, 'matCode', v);
                            updateItem(row.id, 'desc', m?.productName || '');
                          }}>
                            <SelectTrigger className="h-full border-none bg-transparent text-xs rounded-none px-2 shadow-none focus:bg-[#fff9c4]"><SelectValue placeholder="" /></SelectTrigger>
                            <SelectContent>{materials?.map(m => <SelectItem key={m.id} value={m.productName}>{m.productName}</SelectItem>)}</SelectContent>
                          </Select>
                        </TableCell>
                      )}
                      <TableCell className="p-0 border-r"><Input className="h-full border-none shadow-none focus:bg-[#fff9c4]" value={row.desc} onChange={e => updateItem(row.id, 'desc', e.target.value)} /></TableCell>
                      <TableCell className="p-0 border-r"><Input className="h-full border-none shadow-none focus:bg-[#fff9c4]" value={row.hsn} onChange={e => updateItem(row.id, 'hsn', e.target.value)} /></TableCell>
                      <TableCell className="p-0 border-r"><Input type="number" className="h-full border-none shadow-none text-right focus:bg-[#fff9c4]" value={row.qty} onChange={e => updateItem(row.id, 'qty', e.target.value)} /></TableCell>
                      <TableCell className="p-0 border-r"><Input type="number" className="h-full border-none shadow-none text-right focus:bg-[#fff9c4]" value={row.rate} onChange={e => updateItem(row.id, 'rate', e.target.value)} /></TableCell>
                      <TableCell className="p-0 border-r bg-gray-50/50 text-right text-[11px] px-2">{row.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="p-0 text-center"><Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => items.length > 1 && setItems(items.filter(i => i.id !== row.id))}><Trash2 className="h-3 w-3" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="bg-[#e7ebf1] p-1 flex justify-between items-center px-4 border-t border-[#b5c7de] text-[11px] font-bold text-gray-600 uppercase">
                <span>Total Items: {items.length}</span>
                <div className="flex gap-10">
                  <span>Total Qty: {totals.qty}</span>
                  <span>Sub Total: {totals.amount.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
                <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700">Tax & Attachment</div>
                <div className="p-2 space-y-1">
                  <div className="sap-selection-row">
                    <label className="sap-label">GST Rate</label>
                    <Select value={receiptHeader.gstRate} onValueChange={v => setReceiptHeader({...receiptHeader, gstRate: v})}>
                      <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]"><SelectValue placeholder="" /></SelectTrigger>
                      <SelectContent><SelectItem value="5">5%</SelectItem><SelectItem value="18">18%</SelectItem><SelectItem value="40">40%</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="sap-selection-row pt-2">
                    <label className="sap-label">Invoice Attachment</label>
                    <Button variant="outline" size="sm" className="h-7 rounded-none" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4 mr-2" /> Upload Copy</Button>
                    {receiptHeader.proofData && <CheckCircle2 className="h-4 w-4 text-emerald-600 ml-2" />}
                  </div>
                </div>
              </div>

              <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-white shadow-inner">
                <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700 uppercase">Calculation Preview</div>
                <div className="p-3 space-y-1 text-xs">
                  <div className="flex justify-between border-b pb-1"><span>Taxable Amount</span><span className="font-mono">{totals.amount.toLocaleString()}</span></div>
                  {totals.igst > 0 ? (
                    <div className="flex justify-between text-blue-700"><span>IGST ({receiptHeader.gstRate}%)</span><span className="font-mono">{totals.igst.toLocaleString()}</span></div>
                  ) : (
                    <>
                      <div className="flex justify-between text-emerald-700"><span>CGST ({Number(receiptHeader.gstRate)/2}%)</span><span className="font-mono">{totals.cgst.toLocaleString()}</span></div>
                      <div className="flex justify-between text-emerald-700"><span>SGST ({Number(receiptHeader.gstRate)/2}%)</span><span className="font-mono">{totals.sgst.toLocaleString()}</span></div>
                    </>
                  )}
                  <div className="flex justify-between pt-2 border-t text-sm font-black text-blue-900 uppercase"><span>Total Gross Value</span><span className="font-mono text-base">{totals.total.toLocaleString()}</span></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="fixed bottom-10 right-10 flex flex-col gap-2">
         {isPlantsLoading && <div className="bg-[#333e4f] text-white px-4 py-2 text-xs flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Fetching System Data...</div>}
      </div>
    </div>
  );
}


