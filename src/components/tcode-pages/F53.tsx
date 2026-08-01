"use client";

import { useState, useMemo, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDatabase, useCollection, useMemoDatabase } from "@/database";
import { collection, query, orderBy } from "@/database/mongo";
import { Search, ArrowUpDown, ChevronUp, ChevronDown, Download, FileSpreadsheet, Eye, X, Receipt, IndianRupee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const FULLY_PAID_TOLERANCE = 10;

export default function F53() {
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

  // 3. Data Queries
  const plantsQuery = useMemoDatabase(() => collection(db, "plants"), [db]);
  const { data: plants } = useCollection(plantsQuery);

  const vendorsQuery = useMemoDatabase(() => collection(db, "vendors"), [db]);
  const { data: vendors } = useCollection(vendorsQuery);

  const firmsQuery = useMemoDatabase(() => collection(db, "firms"), [db]);
  const { data: firms } = useCollection(firmsQuery);

  const receiptsQuery = useMemoDatabase(() => query(collection(db, "invoice_receipts"), orderBy("createdAt", "desc")), [db]);
  const { data: allReceipts, isLoading: isReceiptsLoading } = useCollection(receiptsQuery);

  const paymentsQuery = useMemoDatabase(() => query(collection(db, "outgoing_payments"), orderBy("createdAt", "desc")), [db]);
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
      map[f.plantId] = f;
      if (f.firmId) map[f.firmId] = f;
    });
    return map;
  }, [firms]);

  // Group payments by Plant + Invoice No
  const paymentGroups = useMemo(() => {
    const map: Record<string, any[]> = {};
    allPayments?.forEach(p => {
      const key = `${p.plantId}_${p.invoiceNo}`;
      if (!map[key]) map[key] = [];
      map[key].push(p);
    });
    return map;
  }, [allPayments]);

  // 5. Processed Grid Data - consolidated records
  const processedData = useMemo(() => {
    if (!allReceipts) return [];

    const rows: any[] = [];
    allReceipts.forEach(r => {
      if (!isAdmin && r.plantId !== assignedPlantId) return;
      if (filterPlant !== "ALL" && r.plantId !== filterPlant) return;

      const vendor = vendorMap[r.vendorId] || {};
      const firm = firmMap[r.firmId || r.plantId] || {};
      const gross = r.totals?.total || r.totals?.grossAmount || 0;
      const key = `${r.plantId}_${r.invoiceNo}`;
      const payments = paymentGroups[key] || [];

      const baseInfo = {
        plantId: r.plantId,
        vendorName: vendor?.vendorName || r.vendorName || r.vendorId || "N/A",
        vendorGstin: vendor?.gstin || r.vendorGstin || "",
        vendorState: vendor?.state || vendor?.stateName || r.state || "N/A",
        billToName: firm?.name || "N/A",
        billToGstin: firm?.gstin || "N/A",
        billToState: firm?.state || "N/A",
        invoiceNo: r.invoiceNo,
        invoiceDate: r.date || "",
        description: r.items?.[0]?.desc || "---",
        taxableAmount: r.totals?.amount || 0,
        cgst: r.totals?.cgst || 0,
        sgst: r.totals?.sgst || 0,
        igst: r.totals?.igst || 0,
        totalPayable: gross,
        payments,
      };

      if (payments.length === 0) {
        // No payment - show the invoice record with blank payment columns
        rows.push({
          ...baseInfo,
          paymentType: "",
          paidAmount: 0,
          tds: 0,
          deduction: 0,
          deductionRemark: "",
          paymentDate: "",
          bankingUtr: "",
          voucherNo: "",
          balanceAmount: gross,
          isFullyPaid: gross < FULLY_PAID_TOLERANCE,
        });
      } else {
        // One row per payment record (consolidated detail)
        payments.forEach(p => {
          rows.push({
            ...baseInfo,
            paymentType: p.paymentType || "",
            paidAmount: Number(p.payAmount) || 0,
            tds: Number(p.tds) || 0,
            deduction: Number(p.deduction) || 0,
            deductionRemark: p.deductionRemark || "",
            paymentDate: p.paymentDate || "",
            bankingUtr: p.bankingUtr || "",
            voucherNo: p.voucherNo || "",
            // Placeholder - recomputed correctly in dataWithBalances below
            balanceAmount: 0,
          });
        });
      }
    });

    // Filter by search
    let filtered = rows;
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(r =>
        `${r.invoiceNo} ${r.vendorName} ${r.vendorGstin} ${r.paymentType}`.toLowerCase().includes(s)
      );
    }
    return filtered;
  }, [allReceipts, isAdmin, assignedPlantId, filterPlant, search, vendorMap, firmMap, paymentGroups]);

  // Recompute balance properly per row: balance = totalPayable - sum of all payments for that invoice
  const dataWithBalances = useMemo(() => {
    // Compute aggregate paid per invoice from all payments
    const aggPaid: Record<string, number> = {};
    allPayments?.forEach(p => {
      const key = `${p.plantId}_${p.invoiceNo}`;
      aggPaid[key] = (aggPaid[key] || 0) + (Number(p.payAmount) || 0) + (Number(p.tds) || 0) + (Number(p.deduction) || 0);
    });

    return processedData.map(r => {
      const key = `${r.plantId}_${r.invoiceNo}`;
      const totalPaidForInvoice = aggPaid[key] || 0;
      const balance = (r.totalPayable || 0) - totalPaidForInvoice;
      return { ...r, balanceAmount: balance, isFullyPaid: balance < FULLY_PAID_TOLERANCE };
    });
  }, [processedData, allPayments]);

  const sortedData = useMemo(() => {
    if (!sortConfig) return dataWithBalances;
    return [...dataWithBalances].sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];
      if (typeof aVal === 'number' && typeof bVal === 'number') return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      const aStr = String(aVal || "").toLowerCase();
      const bStr = String(bVal || "").toLowerCase();
      if (aStr < bStr) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aStr > bStr) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [dataWithBalances, sortConfig]);

  const SortIcon = ({ col }: { col: string }) => {
    if (sortConfig?.key !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-20" />;
    return sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3 ml-1 text-blue-600" /> : <ChevronDown className="h-3 w-3 ml-1 text-blue-600" />;
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig?.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  // 6. Excel Export (CSV) - includes every visible column + Deduction Remark
  const handleExport = () => {
    if (sortedData.length === 0) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "No records to export", isError: true } }));
      return;
    }
    const headers = [
      "#", "Plant", "Vendor Name", "Vendor GSTIN", "Vendor State",
      "Bill To", "Bill To GSTIN", "Bill To State",
      "Invoice Number", "Invoice Date", "Description",
      "Taxable Amount", "CGST", "SGST", "IGST", "Total Payable Amount",
      "Payment Type", "Paid Amount", "TDS", "Deduction", "Deduction Remark",
      "Payment Date", "Banking UTR No", "Voucher No", "Balance Amount",
    ];
    const csvContent = [
      headers.join(","),
      ...sortedData.map((row, idx) => [
        idx + 1,
        row.plantId,
        `"${row.vendorName || ""}"`,
        row.vendorGstin || "",
        `"${row.vendorState || ""}"`,
        `"${row.billToName || ""}"`,
        row.billToGstin || "",
        `"${row.billToState || ""}"`,
        row.invoiceNo,
        row.invoiceDate,
        `"${row.description || ""}"`,
        row.taxableAmount || 0,
        row.cgst || 0,
        row.sgst || 0,
        row.igst || 0,
        row.totalPayable || 0,
        row.paymentType || "",
        row.paidAmount || 0,
        row.tds || 0,
        row.deduction || 0,
        `"${row.deductionRemark || ""}"`,
        row.paymentDate || "",
        row.bankingUtr || "",
        row.voucherNo || "",
        row.balanceAmount || 0,
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `F53_Outgoing_Payment_Record_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: `Excel export triggered: ${sortedData.length} record(s)`, isError: false } }));
  };

  return (
    <div className="w-full flex flex-col bg-white min-h-full select-text">
      <div className="sap-header-title">F53 - Post Outgoing Payment Record</div>

      {/* Filter Section */}
      <div className="bg-[#e7ebf1] border-b border-[#b5c7de] p-3 grid grid-cols-3 gap-6 items-end">
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
            <input value={search} onChange={e => setSearch(e.target.value)} className="w-full text-xs outline-none" placeholder="Invoice / Vendor / GSTIN / Type..." />
          </div>
        </div>
        <div className="flex justify-end">
          {/* Download Excel icon in header */}
          <Button onClick={handleExport} variant="outline" className="h-7 rounded-none bg-white border-emerald-600 text-emerald-700 text-[10px] font-bold uppercase gap-1.5 shadow-sm hover:bg-emerald-50">
            <Download className="h-3.5 w-3.5" /> Download Excel
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-[#dae8f5] px-4 py-1.5 border-y border-gray-300 flex items-center justify-between shadow-sm">
        <h3 className="text-[11px] font-black text-blue-900 uppercase tracking-widest">Consolidated Payment Records (ALV Grid)</h3>
        <span className="text-[10px] font-bold text-gray-600">Records: {sortedData.length}</span>
      </div>

      {/* ALV Grid */}
      <div className="flex-1 overflow-auto bg-white no-scrollbar">
        <Table className="min-w-[2600px] sap-alv-grid">
          <TableHeader className="sap-alv-header">
            <TableRow className="h-8 border-b-[#b5c7de]">
              <TableHead className="w-12 text-center text-[10px] font-bold border-r border-[#b5c7de]">#</TableHead>
              <TableHead onClick={() => handleSort('plantId')} className="w-20 text-[10px] font-bold border-r border-[#b5c7de] cursor-pointer hover:bg-gray-200"><div className="flex items-center">Plant <SortIcon col="plantId" /></div></TableHead>
              <TableHead onClick={() => handleSort('vendorName')} className="text-[10px] font-bold border-r border-[#b5c7de] cursor-pointer hover:bg-gray-200"><div className="flex items-center">Vendor Name <SortIcon col="vendorName" /></div></TableHead>
              <TableHead className="w-40 text-[10px] font-bold border-r border-[#b5c7de]">Vendor GSTIN</TableHead>
              <TableHead className="w-28 text-[10px] font-bold border-r border-[#b5c7de]">Vendor State</TableHead>
              <TableHead onClick={() => handleSort('billToName')} className="text-[10px] font-bold border-r border-[#b5c7de] cursor-pointer hover:bg-gray-200"><div className="flex items-center">Bill To <SortIcon col="billToName" /></div></TableHead>
              <TableHead className="w-40 text-[10px] font-bold border-r border-[#b5c7de]">Bill To GSTIN</TableHead>
              <TableHead className="w-28 text-[10px] font-bold border-r border-[#b5c7de]">Bill To State</TableHead>
              <TableHead onClick={() => handleSort('invoiceNo')} className="w-36 text-[10px] font-bold border-r border-[#b5c7de] cursor-pointer hover:bg-gray-200"><div className="flex items-center">Invoice Number <SortIcon col="invoiceNo" /></div></TableHead>
              <TableHead className="w-28 text-[10px] font-bold border-r border-[#b5c7de]">Invoice Date</TableHead>
              <TableHead className="text-[10px] font-bold border-r border-[#b5c7de]">Description</TableHead>
              <TableHead className="w-28 text-right text-[10px] font-bold border-r border-[#b5c7de]">Taxable Amt</TableHead>
              <TableHead className="w-24 text-right text-[10px] font-bold border-r border-[#b5c7de]">CGST</TableHead>
              <TableHead className="w-24 text-right text-[10px] font-bold border-r border-[#b5c7de]">SGST</TableHead>
              <TableHead className="w-24 text-right text-[10px] font-bold border-r border-[#b5c7de]">IGST</TableHead>
              <TableHead onClick={() => handleSort('totalPayable')} className="w-32 text-right text-[10px] font-bold border-r border-[#b5c7de] bg-blue-50/50 cursor-pointer hover:bg-gray-200"><div className="flex items-center justify-end">Total Payable <SortIcon col="totalPayable" /></div></TableHead>
              <TableHead className="w-24 text-[10px] font-bold border-r border-[#b5c7de] text-center">Payment Type</TableHead>
              <TableHead onClick={() => handleSort('paidAmount')} className="w-28 text-right text-[10px] font-bold border-r border-[#b5c7de] bg-emerald-50/30 cursor-pointer hover:bg-gray-200"><div className="flex items-center justify-end">Paid Amount <SortIcon col="paidAmount" /></div></TableHead>
              <TableHead className="w-24 text-right text-[10px] font-bold border-r border-[#b5c7de]">TDS</TableHead>
              <TableHead className="w-24 text-right text-[10px] font-bold border-r border-[#b5c7de]">Deduction</TableHead>
              <TableHead className="text-[10px] font-bold border-r border-[#b5c7de]">Deduction Remark</TableHead>
              <TableHead className="w-28 text-[10px] font-bold border-r border-[#b5c7de] text-center">Payment Date</TableHead>
              <TableHead className="w-32 text-[10px] font-bold border-r border-[#b5c7de] text-center">Banking UTR No</TableHead>
              <TableHead className="w-28 text-[10px] font-bold border-r border-[#b5c7de] text-center">Voucher No</TableHead>
              <TableHead onClick={() => handleSort('balanceAmount')} className="w-28 text-right text-[10px] font-bold border-r border-[#b5c7de] text-red-700 bg-red-50/30 cursor-pointer hover:bg-gray-200"><div className="flex items-center justify-end">Balance <SortIcon col="balanceAmount" /></div></TableHead>
              <TableHead className="w-20 text-center text-[10px] font-bold">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isReceiptsLoading ? (
              <TableRow><TableCell colSpan={26} className="text-center py-20 text-[11px] uppercase tracking-widest animate-pulse">Syncing Payment Records...</TableCell></TableRow>
            ) : sortedData.length === 0 ? (
              <TableRow><TableCell colSpan={26} className="text-center py-20 text-[11px] font-bold text-gray-400 uppercase">No payment records found for the selected criteria</TableCell></TableRow>
            ) : sortedData.map((row, idx) => (
              <TableRow key={idx} className="h-8 hover:bg-blue-50/30 transition-colors border-b border-gray-100 group">
                <TableCell className="p-0 text-center text-[10px] border-r border-gray-100 text-gray-400 group-hover:text-blue-600">{idx + 1}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 font-bold text-center">{row.plantId}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 truncate max-w-[160px] font-semibold uppercase">{row.vendorName}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 font-mono text-center">{row.vendorGstin || "-"}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 uppercase text-center">{row.vendorState}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 truncate max-w-[140px] font-semibold uppercase">{row.billToName}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 font-mono text-center">{row.billToGstin || "-"}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 uppercase text-center">{row.billToState}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 font-mono font-black text-blue-800">{row.invoiceNo}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 font-mono text-center">{row.invoiceDate || "-"}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 truncate max-w-[160px] font-semibold text-blue-900 uppercase">{row.description}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 text-right font-mono">{(row.taxableAmount || 0).toLocaleString()}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 text-right font-mono text-gray-500">{(row.cgst || 0).toLocaleString()}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 text-right font-mono text-gray-500">{(row.sgst || 0).toLocaleString()}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 text-right font-mono text-gray-500">{(row.igst || 0).toLocaleString()}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 text-right font-black text-blue-900 bg-blue-50/20">{(row.totalPayable || 0).toLocaleString()}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 font-bold uppercase text-center">{row.paymentType || "-"}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 text-right font-bold text-emerald-700 bg-emerald-50/20">{(row.paidAmount || 0).toLocaleString()}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 text-right font-bold text-orange-700">{(row.tds || 0).toLocaleString()}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 text-right font-bold text-purple-700">{(row.deduction || 0).toLocaleString()}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 italic truncate max-w-[140px]">{row.deductionRemark || "---"}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 font-mono text-center">{row.paymentDate || "-"}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 font-mono text-center truncate max-w-[100px]">{row.bankingUtr || "-"}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 font-mono text-center">{row.voucherNo || "-"}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 text-right font-black text-red-700 bg-red-50/10">{(row.balanceAmount || 0).toLocaleString()}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] text-center">
                  <ViewButton row={row} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Footer Status Bar */}
      <div className="bg-[#333e4f] p-2 flex justify-between items-center text-white text-[10px] font-bold uppercase tracking-widest shadow-inner sticky bottom-0 z-20">
        <div className="flex items-center gap-6">
          <span>F53 - Outgoing Payment Record</span>
          <span className="opacity-40">|</span>
          <span>{sortedData.length} Record(s)</span>
        </div>
        <div className="flex items-center gap-8 pr-4">
          <div className="flex flex-col items-end"><span className="opacity-50 text-[8px]">Total Payable</span><span className="text-[12px] font-black text-blue-300">₹ {sortedData.reduce((s, r) => s + (r.totalPayable || 0), 0).toLocaleString()}</span></div>
          <div className="flex flex-col items-end border-l border-white/20 pl-6"><span className="opacity-50 text-[8px]">Total Paid</span><span className="text-[12px] font-black text-emerald-400">₹ {sortedData.reduce((s, r) => s + (r.paidAmount || 0), 0).toLocaleString()}</span></div>
          <div className="flex flex-col items-end border-l border-white/20 pl-6"><span className="opacity-50 text-[8px]">Outstanding</span><span className="text-[12px] font-black text-red-400">₹ {sortedData.reduce((s, r) => s + (r.balanceAmount || 0), 0).toLocaleString()}</span></div>
        </div>
      </div>
    </div>
  );
}

// ============ View Payment History Dialog ============
function ViewButton({ row }: { row: any }) {
  const payments = row.payments || [];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="h-6 rounded-none bg-blue-700 hover:bg-blue-800 text-[9px] font-black uppercase px-3 shadow-sm gap-1">
          <Eye className="h-3 w-3" /> View
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl rounded-none border-gray-400 p-0 overflow-hidden shadow-2xl">
        <div className="bg-[#333e4f] text-white p-3 flex justify-between items-center">
          <DialogTitle className="text-[11px] font-black uppercase tracking-widest flex items-center gap-2">
            <Receipt className="h-4 w-4 text-emerald-400" /> Payment History: {row.invoiceNo}
          </DialogTitle>
          <DialogTrigger asChild><button className="hover:bg-white/10 p-1"><X className="h-4 w-4" /></button></DialogTrigger>
        </div>

        <div className="p-4 space-y-4 bg-white max-h-[80vh] overflow-y-auto">
          {/* Invoice Summary */}
          <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
            <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700">Invoice Summary</div>
            <div className="p-3 grid grid-cols-4 gap-x-6 gap-y-2 text-[11px]">
              <div><label className="text-gray-400 block uppercase font-bold text-[8px]">Invoice No</label><span className="font-black text-blue-700 font-mono">{row.invoiceNo}</span></div>
              <div><label className="text-gray-400 block uppercase font-bold text-[8px]">Vendor</label><span className="font-bold uppercase truncate">{row.vendorName}</span></div>
              <div><label className="text-gray-400 block uppercase font-bold text-[8px]">Total Payable</label><span className="font-black">₹ {(row.totalPayable || 0).toLocaleString()}</span></div>
              <div><label className="text-gray-400 block uppercase font-bold text-[8px]">Available Balance</label><span className={`font-black ${row.balanceAmount < FULLY_PAID_TOLERANCE ? "text-emerald-700" : "text-red-700"}`}>₹ {(row.balanceAmount || 0).toLocaleString()}</span></div>
            </div>
            <div className="px-3 pb-3 grid grid-cols-4 gap-x-6 gap-y-1 text-[11px] border-t border-gray-100 pt-2">
              <div><label className="text-gray-400 block uppercase font-bold text-[8px]">Taxable</label><span className="font-mono">₹ {(row.taxableAmount || 0).toLocaleString()}</span></div>
              <div><label className="text-gray-400 block uppercase font-bold text-[8px]">CGST</label><span className="font-mono">₹ {(row.cgst || 0).toLocaleString()}</span></div>
              <div><label className="text-gray-400 block uppercase font-bold text-[8px]">SGST</label><span className="font-mono">₹ {(row.sgst || 0).toLocaleString()}</span></div>
              <div><label className="text-gray-400 block uppercase font-bold text-[8px]">IGST</label><span className="font-mono">₹ {(row.igst || 0).toLocaleString()}</span></div>
            </div>
          </div>

          {/* Payment History Table */}
          <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-white">
            <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700">
              Payment History ({payments.length} payment(s) posted against this invoice)
            </div>
            {payments.length === 0 ? (
              <div className="p-8 text-center text-[11px] font-bold text-gray-400 uppercase">No payments posted for this invoice yet</div>
            ) : (
              <Table>
                <TableHeader className="bg-[#e7ebf1]">
                  <TableRow className="h-7">
                    <TableHead className="text-[11px] font-bold border-r w-10 text-center">#</TableHead>
                    <TableHead className="text-[11px] font-bold border-r">Payment Type</TableHead>
                    <TableHead className="text-[11px] font-bold border-r w-28 text-right">Pay Amount</TableHead>
                    <TableHead className="text-[11px] font-bold border-r w-24 text-right">TDS</TableHead>
                    <TableHead className="text-[11px] font-bold border-r w-24 text-right">Deduction</TableHead>
                    <TableHead className="text-[11px] font-bold border-r">Deduction Remark</TableHead>
                    <TableHead className="text-[11px] font-bold border-r w-28 text-center">Payment Date</TableHead>
                    <TableHead className="text-[11px] font-bold border-r w-32 text-center">Banking UTR</TableHead>
                    <TableHead className="text-[11px] font-bold border-r w-24 text-center">Voucher No</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p: any, idx: number) => (
                    <TableRow key={p.id || idx} className="h-8 hover:bg-blue-50/30 border-b border-gray-100">
                      <TableCell className="p-0 text-center text-[10px] border-r text-gray-400">{idx + 1}</TableCell>
                      <TableCell className="p-0 px-2 text-[10px] border-r font-bold uppercase">{p.paymentType}</TableCell>
                      <TableCell className="p-0 px-2 text-[10px] border-r text-right font-bold text-emerald-700">₹ {(Number(p.payAmount) || 0).toLocaleString()}</TableCell>
                      <TableCell className="p-0 px-2 text-[10px] border-r text-right">₹ {(Number(p.tds) || 0).toLocaleString()}</TableCell>
                      <TableCell className="p-0 px-2 text-[10px] border-r text-right">₹ {(Number(p.deduction) || 0).toLocaleString()}</TableCell>
                      <TableCell className="p-0 px-2 text-[10px] border-r italic">{p.deductionRemark || "---"}</TableCell>
                      <TableCell className="p-0 px-2 text-[10px] border-r font-mono text-center">{p.paymentDate || "-"}</TableCell>
                      <TableCell className="p-0 px-2 text-[10px] border-r font-mono text-center truncate max-w-[100px]">{p.bankingUtr || "-"}</TableCell>
                      <TableCell className="p-0 px-2 text-[10px] text-center font-mono">{p.voucherNo || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Current Available Balance Summary */}
          <div className={`p-3 rounded-sm flex justify-between items-center shadow-sm border ${row.balanceAmount < FULLY_PAID_TOLERANCE ? "bg-emerald-50 border-emerald-300" : "bg-red-50 border-red-200"}`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full text-white ${row.balanceAmount < FULLY_PAID_TOLERANCE ? "bg-emerald-600" : "bg-red-600"}`}>
                <IndianRupee className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase text-gray-500">Current Available Balance</p>
                <p className={`text-lg font-black ${row.balanceAmount < FULLY_PAID_TOLERANCE ? "text-emerald-800" : "text-red-800"}`}>₹ {(row.balanceAmount || 0).toLocaleString()}</p>
              </div>
            </div>
            {row.balanceAmount < FULLY_PAID_TOLERANCE && (
              <span className="text-[10px] font-black uppercase text-emerald-700 bg-white border border-emerald-300 px-3 py-1 rounded-sm">Fully Paid</span>
            )}
          </div>
        </div>

        <div className="bg-[#e1e1e1] p-3 flex justify-end shadow-inner border-t border-gray-400">
          <DialogTrigger asChild>
            <Button className="h-8 rounded-none bg-[#333e4f] text-white text-[11px] font-bold uppercase px-8 shadow-md">Close</Button>
          </DialogTrigger>
        </div>
      </DialogContent>
    </Dialog>
  );
}

