"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useDatabase, useCollection, useMemoDatabase, addDocumentNonBlocking, updateDocumentNonBlocking } from "@/database";
import { collection, query, orderBy, serverTimestamp, doc } from "@/database/mongo";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, ArrowUpDown, ChevronUp, ChevronDown, Wallet, IndianRupee, Loader2, X, CheckCircle2, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getRecordPlantIds } from "@/lib/plant-master";
import { formatAmount, sanitizeAmountInput, roundToTwo } from "@/lib/number-utils";

const FULLY_PAID_TOLERANCE = 10; // ₹10.00 - Balance less than this = Fully Paid

export default function F51() {
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

  // 2. Filter State
  const [filterPlant, setFilterPlant] = useState("ALL");
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  // 3. Master Data Queries
  const plantsQuery = useMemoDatabase(() => collection(db, "plants"), [db]);
  const { data: plants } = useCollection(plantsQuery);

  const vendorsQuery = useMemoDatabase(() => collection(db, "vendors"), [db]);
  const { data: vendors } = useCollection(vendorsQuery);

  const firmsQuery = useMemoDatabase(() => collection(db, "firms"), [db]);
  const { data: firms } = useCollection(firmsQuery);

  const receiptsQuery = useMemoDatabase(() => query(collection(db, "invoice_receipts"), orderBy("createdAt", "desc")), [db]);
  const { data: allReceipts, isLoading: isReceiptsLoading } = useCollection(receiptsQuery);

  const paymentsQuery = useMemoDatabase(() => collection(db, "outgoing_payments"), [db]);
  const { data: allPayments } = useCollection(paymentsQuery);

  // 4. Derived Maps
  const filteredPlants = useMemo(() => {
    if (isAdmin) return plants || [];
    return plants?.filter(p => p.plantId === assignedPlantId) || [];
  }, [plants, isAdmin, assignedPlantId]);

  const vendorMap = useMemo(() => {
    const map: Record<string, any> = {};
    vendors?.forEach(v => { map[v.vendorId] = v; });
    return map;
  }, [vendors]);

const firmMap = useMemo(() => {
    const map: Record<string, any> = {};
    firms?.forEach(f => {
      getRecordPlantIds(f).forEach(pid => { map[pid] = f; });
      if (f.firmId) map[f.firmId] = f;
    });
    return map;
  }, [firms]);

  // Aggregate payments by Plant + Invoice No (outgoing payments from F51)
  const paymentAggregateMap = useMemo(() => {
    const map: Record<string, { totalPaid: number; tds: number; deduction: number; count: number }> = {};
    allPayments?.forEach(p => {
      const key = `${p.plantId}_${p.invoiceNo}`;
      if (!map[key]) map[key] = { totalPaid: 0, tds: 0, deduction: 0, count: 0 };
      map[key].totalPaid += (Number(p.payAmount) || 0) + (Number(p.tds) || 0) + (Number(p.deduction) || 0);
      map[key].tds += Number(p.tds) || 0;
      map[key].deduction += Number(p.deduction) || 0;
      map[key].count += 1;
    });
    return map;
  }, [allPayments]);

  // 5. Processed Grid Data
  const processedData = useMemo(() => {
    if (!allReceipts) return [];
    return allReceipts
      .filter(r => {
        if (!isAdmin && r.plantId !== assignedPlantId) return false;
        if (filterPlant !== "ALL" && r.plantId !== filterPlant) return false;
        const vendor = vendorMap[r.vendorId];
        const vendorName = vendor?.vendorName || r.vendorName || "";
        const invNo = r.invoiceNo || "";
        if (search && !`${invNo} ${vendorName} ${r.vendorGstin || ""}`.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      })
      .map(r => {
        const vendor = vendorMap[r.vendorId] || {};
        const firm = firmMap[r.firmId || r.plantId] || {};
        const gross = r.totals?.total || r.totals?.grossAmount || 0;
        const paid = paymentAggregateMap[`${r.plantId}_${r.invoiceNo}`]?.totalPaid || 0;
        const balance = gross - paid;
        const isFullyPaid = balance < FULLY_PAID_TOLERANCE;
        return {
          ...r,
          vendorName: vendor?.vendorName || r.vendorName || r.vendorId || "N/A",
          vendorState: vendor?.state || vendor?.stateName || r.state || "N/A",
          billToName: firm?.name || "N/A",
          billToGstin: firm?.gstin || "N/A",
          billToState: firm?.state || "N/A",
          grossPayable: gross,
          paidAmount: paid,
          balanceAmount: balance,
          isFullyPaid,
        };
      });
  }, [allReceipts, isAdmin, assignedPlantId, filterPlant, search, vendorMap, firmMap, paymentAggregateMap]);

  const sortedData = useMemo(() => {
    if (!sortConfig) return processedData;
    return [...processedData].sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];
      if (typeof aVal === 'number' && typeof bVal === 'number') return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      const aStr = String(aVal || "").toLowerCase();
      const bStr = String(bVal || "").toLowerCase();
      if (aStr < bStr) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aStr > bStr) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [processedData, sortConfig]);

  const SortIcon = ({ col }: { col: string }) => {
    if (sortConfig?.key !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-20" />;
    return sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3 ml-1 text-blue-600" /> : <ChevronDown className="h-3 w-3 ml-1 text-blue-600" />;
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig?.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  return (
    <div className="w-full flex flex-col bg-white min-h-full select-text">
      <div className="sap-header-title">F51 - Post Outgoing Payment</div>

      {/* Filter Section */}
      <div className="bg-[#e7ebf1] border-b border-[#b5c7de] p-3 grid grid-cols-2 gap-6 items-end">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-gray-500 uppercase">Plant</label>
          <Select value={filterPlant} onValueChange={setFilterPlant}>
            <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Authorized Plants</SelectItem>
              {filteredPlants.map(p => <SelectItem key={p.id} value={p.plantId}>{p.plantId} - {p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-gray-500 uppercase">Search</label>
          <div className="relative flex items-center bg-white border border-gray-400 h-6 px-1 group focus-within:border-blue-500">
            <Search className="h-3.5 w-3.5 text-gray-400 mr-1" />
            <input value={search} onChange={e => setSearch(e.target.value)} className="w-full text-xs outline-none" placeholder="Invoice No / Vendor / GSTIN..." />
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-[#dae8f5] px-4 py-1.5 border-y border-gray-300 flex items-center justify-between shadow-sm">
        <h3 className="text-[11px] font-black text-blue-900 uppercase tracking-widest">MIGO Invoice Receipts (Outgoing Payment)</h3>
        <span className="text-[10px] font-bold text-gray-600">Records: {sortedData.length}</span>
      </div>

      {/* ALV Grid */}
      <div className="flex-1 overflow-auto bg-white no-scrollbar">
        <Table className="min-w-[1800px] sap-alv-grid">
          <TableHeader className="sap-alv-header">
            <TableRow className="h-8 border-b-[#b5c7de]">
              <TableHead className="w-12 text-center text-[10px] font-bold border-r border-[#b5c7de]">#</TableHead>
              <TableHead onClick={() => handleSort('plantId')} className="w-20 text-[10px] font-bold border-r border-[#b5c7de] cursor-pointer hover:bg-gray-200"><div className="flex items-center">Plant <SortIcon col="plantId" /></div></TableHead>
              <TableHead onClick={() => handleSort('vendorName')} className="text-[10px] font-bold border-r border-[#b5c7de] cursor-pointer hover:bg-gray-200"><div className="flex items-center">Vendor Name <SortIcon col="vendorName" /></div></TableHead>
              <TableHead className="w-44 text-[10px] font-bold border-r border-[#b5c7de]">Vendor GSTIN</TableHead>
              <TableHead onClick={() => handleSort('vendorState')} className="w-28 text-[10px] font-bold border-r border-[#b5c7de] cursor-pointer hover:bg-gray-200"><div className="flex items-center">Vendor State <SortIcon col="vendorState" /></div></TableHead>
              <TableHead onClick={() => handleSort('billToName')} className="text-[10px] font-bold border-r border-[#b5c7de] cursor-pointer hover:bg-gray-200"><div className="flex items-center">Bill To <SortIcon col="billToName" /></div></TableHead>
              <TableHead className="w-44 text-[10px] font-bold border-r border-[#b5c7de]">Bill To GSTIN</TableHead>
              <TableHead onClick={() => handleSort('billToState')} className="w-28 text-[10px] font-bold border-r border-[#b5c7de] cursor-pointer hover:bg-gray-200"><div className="flex items-center">Bill To State <SortIcon col="billToState" /></div></TableHead>
              <TableHead onClick={() => handleSort('invoiceNo')} className="w-36 text-[10px] font-bold border-r border-[#b5c7de] cursor-pointer hover:bg-gray-200"><div className="flex items-center">Invoice Number <SortIcon col="invoiceNo" /></div></TableHead>
              <TableHead onClick={() => handleSort('date')} className="w-28 text-[10px] font-bold border-r border-[#b5c7de] cursor-pointer hover:bg-gray-200"><div className="flex items-center">Invoice Date <SortIcon col="date" /></div></TableHead>
              <TableHead className="text-[10px] font-bold border-r border-[#b5c7de]">Description</TableHead>
              <TableHead className="w-32 text-right text-[10px] font-bold border-r border-[#b5c7de]">Taxable Amount</TableHead>
              <TableHead className="w-28 text-right text-[10px] font-bold border-r border-[#b5c7de]">CGST</TableHead>
              <TableHead className="w-28 text-right text-[10px] font-bold border-r border-[#b5c7de]">SGST</TableHead>
              <TableHead className="w-28 text-right text-[10px] font-bold border-r border-[#b5c7de]">IGST</TableHead>
              <TableHead className="w-32 text-right text-[10px] font-bold border-r border-[#b5c7de] bg-blue-50/50">Total Payable</TableHead>
              <TableHead className="w-32 text-right text-[10px] font-bold border-r border-[#b5c7de] bg-red-50/30">Balance</TableHead>
              <TableHead className="w-24 text-center text-[10px] font-bold">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isReceiptsLoading ? (
              <TableRow><TableCell colSpan={18} className="text-center py-20 text-[11px] uppercase tracking-widest animate-pulse">Syncing Invoice Receipts...</TableCell></TableRow>
            ) : sortedData.length === 0 ? (
              <TableRow><TableCell colSpan={18} className="text-center py-20 text-[11px] font-bold text-gray-400 uppercase">No MIGO Invoice Receipt records found for the selected criteria</TableCell></TableRow>
            ) : sortedData.map((row, idx) => (
              <TableRow key={row.id} className="h-8 hover:bg-blue-50/30 transition-colors border-b border-gray-100 group">
                <TableCell className="p-0 text-center text-[10px] border-r border-gray-100 text-gray-400 group-hover:text-blue-600">{idx + 1}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 font-bold text-center">{row.plantId}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 truncate max-w-[180px] font-semibold uppercase">{row.vendorName}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 font-mono text-center">{row.vendorGstin || "-"}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 uppercase text-center">{row.vendorState}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 truncate max-w-[160px] font-semibold uppercase">{row.billToName}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 font-mono text-center">{row.billToGstin || "-"}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 uppercase text-center">{row.billToState}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 font-mono font-black text-blue-800">{row.invoiceNo}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 font-mono text-center">{row.date || "-"}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 truncate max-w-[200px] font-semibold text-blue-900 uppercase">{row.items?.[0]?.desc || "---"}</TableCell>
<TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 text-right font-mono">{formatAmount(row.totals?.amount)}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 text-right font-mono text-gray-500">{formatAmount(row.totals?.cgst)}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 text-right font-mono text-gray-500">{formatAmount(row.totals?.sgst)}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 text-right font-mono text-gray-500">{formatAmount(row.totals?.igst)}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 text-right font-black text-blue-900 bg-blue-50/20">{formatAmount(row.grossPayable)}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 text-right font-black text-red-700 bg-red-50/10">{formatAmount(row.balanceAmount)}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 text-center">
                  {row.isFullyPaid ? (
                    <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-gray-400" title="Balance below ₹10.00 - fully paid"><Ban className="h-3 w-3" /> Settled</span>
                  ) : (
                    <PayButton
                      row={row}
                      vendorMap={vendorMap}
                      db={db}
                      isAdmin={isAdmin}
                      assignedPlantId={assignedPlantId}
                    />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Footer Status Bar */}
      <div className="bg-[#333e4f] p-2 flex justify-between items-center text-white text-[10px] font-bold uppercase tracking-widest shadow-inner sticky bottom-0 z-20">
        <div className="flex items-center gap-6">
          <span>F51 - Outgoing Payment</span>
          <span className="opacity-40">|</span>
          <span>{sortedData.length} Invoice Receipt(s)</span>
        </div>
        <div className="flex items-center gap-8 pr-4">
          <div className="flex flex-col items-end"><span className="opacity-50 text-[8px]">Total Payable</span><span className="text-[12px] font-black text-blue-300">₹ {formatAmount(sortedData.reduce((s, r) => s + (r.grossPayable || 0), 0))}</span></div>
          <div className="flex flex-col items-end border-l border-white/20 pl-6"><span className="opacity-50 text-[8px]">Outstanding</span><span className="text-[12px] font-black text-red-400">₹ {formatAmount(sortedData.reduce((s, r) => s + (r.balanceAmount || 0), 0))}</span></div>
        </div>
      </div>
    </div>
  );
}

// ============ Pay Dialog Component ============
function PayButton({ row, vendorMap, db, isAdmin, assignedPlantId }: { row: any; vendorMap: Record<string, any>; db: any; isAdmin: boolean; assignedPlantId: string }) {
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [paymentType, setPaymentType] = useState("Banking");
  const [bankingUtr, setBankingUtr] = useState("");
  const [voucherNo, setVoucherNo] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [tds, setTds] = useState("");
  const [deduction, setDeduction] = useState("");
  const [deductionRemark, setDeductionRemark] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);

  const gross = row.grossPayable || 0;
  const availableBalance = row.balanceAmount || 0;

  // Balance Amount = Total Payable - (Pay Amount + TDS + Deduction) [applied to current outstanding balance]
  const computedBalance = useMemo(() => {
    return availableBalance - ((Number(payAmount) || 0) + (Number(tds) || 0) + (Number(deduction) || 0));
  }, [availableBalance, payAmount, tds, deduction]);

  const isFullyPaidAfter = computedBalance < 10;

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (v) {
      setPaymentType("Banking");
      setBankingUtr("");
      setVoucherNo("");
      setPayAmount("");
      setTds("");
      setDeduction("");
      setDeductionRemark("");
      setPaymentDate(new Date().toISOString().split("T")[0]);
    }
  };

  const handleSave = async () => {
    // Validation
    if (!paymentDate) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Error: Payment Date is mandatory", isError: true } }));
      return;
    }
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
    const payVal = Number(payAmount) || 0;
    if (payVal <= 0) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Error: Pay Amount must be greater than zero", isError: true } }));
      return;
    }
    if (payVal > availableBalance) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: `Error: Pay Amount cannot exceed available balance of ₹${formatAmount(availableBalance)}`, isError: true } }));
      return;
    }
    if (computedBalance < -0.01) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Error: Payment details exceed the available balance", isError: true } }));
      return;
    }

    setIsSaving(true);
    try {
      const payDoc = {
        plantId: row.plantId,
        invoiceNo: row.invoiceNo,
        invoiceReceiptDocId: row.id,
        vendorId: row.vendorId,
        vendorName: row.vendorName,
        paymentType,
        bankingUtr: paymentType === "Banking" ? bankingUtr.trim() : "",
        voucherNo: paymentType === "Cash" ? voucherNo.trim() : "",
        payAmount: payVal,
        tds: Number(tds) || 0,
        deduction: Number(deduction) || 0,
        deductionRemark: deductionRemark.trim(),
        paymentDate,
        balanceAfterPayment: computedBalance,
        isFullyPaid: isFullyPaidAfter,
        createdBy: (typeof window !== "undefined" ? JSON.parse(localStorage.getItem("sikka_user") || "{}")?.name : "") || "USER",
        createdAt: serverTimestamp(),
        editHistory: [],
      };

      await addDocumentNonBlocking(collection(db, "outgoing_payments"), payDoc);

      // Update invoice_receipts paidAmount
      const newPaid = (row.paidAmount || 0) + payVal + (Number(tds) || 0) + (Number(deduction) || 0);
      await updateDocumentNonBlocking(doc(db, "invoice_receipts", row.id), {
        paidAmount: newPaid,
        paymentStatus: isFullyPaidAfter ? "Fully Paid" : "Partially Paid",
        updatedAt: serverTimestamp(),
      });

window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: `Outgoing payment of ₹${formatAmount(payVal)} posted for Invoice ${row.invoiceNo}`, isError: false } }));
      setOpen(false);
    } catch (e) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "System Error: Failed to post outgoing payment", isError: true } }));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="h-6 rounded-none bg-emerald-700 hover:bg-emerald-800 text-[9px] font-black uppercase px-3 shadow-sm gap-1">
          <Wallet className="h-3 w-3" /> Pay
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl rounded-none border-gray-400 p-0 overflow-hidden shadow-2xl">
        <div className="bg-[#333e4f] text-white p-3 flex justify-between items-center">
          <DialogTitle className="text-[11px] font-black uppercase tracking-widest flex items-center gap-2">
            <IndianRupee className="h-4 w-4 text-emerald-400" /> Post Outgoing Payment: {row.invoiceNo}
          </DialogTitle>
          <DialogTrigger asChild><button className="hover:bg-white/10 p-1"><X className="h-4 w-4" /></button></DialogTrigger>
        </div>

        <div className="p-4 space-y-4 bg-white max-h-[80vh] overflow-y-auto">
          {/* Invoice Information (Read Only) */}
          <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
            <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700 flex justify-between items-center">
              <span>Invoice Information</span>
              <span className="text-[10px] text-gray-500 italic">Read-Only View</span>
            </div>
            <div className="p-3 grid grid-cols-2 gap-x-8 gap-y-2">
              <div className="sap-selection-row"><label className="sap-label">Invoice Number</label><Input value={row.invoiceNo} readOnly className="bg-gray-100 font-mono font-black text-blue-800" /></div>
              <div className="sap-selection-row"><label className="sap-label">Invoice Date</label><Input value={row.date || "-"} readOnly className="bg-gray-100" /></div>
              <div className="sap-selection-row"><label className="sap-label">Vendor Name</label><Input value={row.vendorName} readOnly className="bg-gray-100 font-bold" /></div>
<div className="sap-selection-row"><label className="sap-label">Available Balance</label><Input value={`₹ ${formatAmount(availableBalance)}`} readOnly className="bg-red-50 font-black text-red-700 border-red-200" /></div>
              <div className="sap-selection-row"><label className="sap-label">Taxable Amount</label><Input value={formatAmount(row.totals?.amount)} readOnly className="bg-gray-100 text-right font-mono" /></div>
              <div className="sap-selection-row"><label className="sap-label">CGST</label><Input value={formatAmount(row.totals?.cgst)} readOnly className="bg-gray-100 text-right font-mono" /></div>
              <div className="sap-selection-row"><label className="sap-label">SGST</label><Input value={formatAmount(row.totals?.sgst)} readOnly className="bg-gray-100 text-right font-mono" /></div>
              <div className="sap-selection-row"><label className="sap-label">IGST</label><Input value={formatAmount(row.totals?.igst)} readOnly className="bg-gray-100 text-right font-mono" /></div>
              <div className="sap-selection-row col-span-2"><label className="sap-label font-bold text-blue-800">Total Payable Amount</label><Input value={formatAmount(gross)} readOnly className="bg-gray-200 text-right font-black text-blue-900 border-blue-300" /></div>
            </div>
          </div>

          {/* Payment Details */}
          <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
            <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700">Payment Details</div>
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
              <div className="sap-selection-row"><label className="sap-label">Payment Date *</label><Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} /></div>
              {paymentType === "Banking" ? (
                <div className="sap-selection-row">
                  <label className="sap-label">Banking UTR No. *</label>
                  <Input value={bankingUtr} onChange={e => setBankingUtr(e.target.value.toUpperCase())} className="font-mono uppercase" placeholder="Enter UTR..." />
                </div>
              ) : (
                <div className="sap-selection-row">
                  <label className="sap-label">Voucher No. *</label>
                  <Input value={voucherNo} onChange={e => setVoucherNo(e.target.value.toUpperCase())} className="font-mono uppercase" placeholder="Enter voucher no..." />
                </div>
              )}
<div className="sap-selection-row"><label className="sap-label font-bold text-emerald-700">Pay Amount *</label><Input type="number" value={sanitizeAmountInput(payAmount)} onChange={e => setPayAmount(sanitizeAmountInput(e.target.value))} className="font-bold text-emerald-700" placeholder="0.00" /></div>
              <div className="sap-selection-row"><label className="sap-label">TDS</label><Input type="number" value={sanitizeAmountInput(tds)} onChange={e => setTds(sanitizeAmountInput(e.target.value))} /></div>
              <div className="sap-selection-row"><label className="sap-label">Deduction</label><Input type="number" value={sanitizeAmountInput(deduction)} onChange={e => setDeduction(sanitizeAmountInput(e.target.value))} /></div>
              {Number(deduction) > 0 && (
                <div className="sap-selection-row animate-in fade-in duration-200">
                  <label className="sap-label">Deduction Remark *</label>
                  <Input value={deductionRemark} onChange={e => setDeductionRemark(e.target.value)} placeholder="Reason for deduction..." />
                </div>
              )}
              <div className="sap-selection-row col-span-2">
                <label className="sap-label font-bold text-blue-800">Balance Amount (Auto)</label>
                <div className="flex items-center gap-3">
                  <Input value={`₹ ${formatAmount(computedBalance)}`} readOnly className={`bg-gray-100 text-right font-black border ${isFullyPaidAfter ? "text-emerald-700 border-emerald-300 bg-emerald-50" : "text-blue-900 border-blue-300"}`} />
                  {isFullyPaidAfter && <span className="text-[9px] font-black uppercase text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-sm whitespace-nowrap">Fully Paid</span>}
                </div>
              </div>
              {computedBalance > 0 && computedBalance < 10 && (
                <div className="col-span-2 p-2 border border-emerald-300 bg-emerald-50 text-[10px] text-emerald-800 font-bold italic">
                  Balance after this payment will be below ₹10.00. Invoice shall be considered Fully Paid and no further payment will be allowed.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#e1e1e1] p-3 flex justify-end gap-3 shadow-inner border-t border-gray-400">
          <Button onClick={handleSave} disabled={isSaving} className="h-8 rounded-none bg-emerald-700 hover:bg-emerald-800 text-[11px] font-bold uppercase px-6 shadow-sm gap-1.5">
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {isSaving ? "Posting..." : "Post Payment"}
          </Button>
          <Button onClick={() => setOpen(false)} variant="outline" className="h-8 rounded-none bg-white border-gray-400 text-gray-700 text-[11px] font-bold uppercase px-6 shadow-sm hover:bg-gray-100">
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

