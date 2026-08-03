
"use client";

import { useState, useMemo, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDatabase, useCollection, useMemoDatabase } from "@/database";
import { collection, query, orderBy } from "@/database/mongo";
import { Search, ArrowUpDown, ChevronUp, ChevronDown, Filter, Printer, Download, LayoutDashboard, Receipt, Wallet, ArrowRight, FileSpreadsheet, MinusCircle, PlusCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getFinancialYears, getCurrentFinancialYear } from "@/lib/date-utils";

export default function FB03() {
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
  const [filterConsignee, setFilterConsignee] = useState("ALL");
  const [filterFY, setFilterYear] = useState(getCurrentFinancialYear());
  const [showDetail, setShowDetail] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const financialYears = useMemo(() => getFinancialYears(), []);

  // 3. Data Fetching
  const invoicesQuery = useMemoDatabase(() => query(collection(db, "sales_invoices"), orderBy("createdAt", "desc")), [db]);
  const { data: allInvoices, isLoading: isInvoicesLoading } = useCollection(invoicesQuery);

  const receiptsQuery = useMemoDatabase(() => query(collection(db, "payment_receipts")), [db]);
  const { data: allReceipts } = useCollection(receiptsQuery);

  const plantsQuery = useMemoDatabase(() => collection(db, "plants"), [db]);
  const { data: plants } = useCollection(plantsQuery);

  const customersQuery = useMemoDatabase(() => collection(db, "customers"), [db]);
  const { data: customers } = useCollection(customersQuery);

  // 4. Derived Logic
  const filteredPlants = useMemo(() => {
    if (isAdmin) return plants || [];
    return plants?.filter(p => p.plantId === assignedPlantId) || [];
  }, [plants, isAdmin, assignedPlantId]);

// Aggregate receipts by Invoice Number (separate posted vs reversed)
  const invoiceReceiptMap = useMemo(() => {
    const map: Record<string, any> = {};
    allReceipts?.forEach(r => {
      const invNo = r.invoiceNo;
      if (!map[invNo]) {
        map[invNo] = { receiptAmount: 0, tds: 0, deduction: 0, reversedAmount: 0, reversedTds: 0, reversedDeduction: 0, paymentDate: r.paymentDate, paymentAdviceNo: r.paymentAdviceNo, bankingUtr: r.bankingUtr };
      }
      const amount = Number(r.receiptAmount) || 0;
      const tds = Number(r.tds) || 0;
      const deduction = Number(r.deduction) || 0;
      if (r.status === "Reversed") {
        map[invNo].reversedAmount += amount;
        map[invNo].reversedTds += tds;
        map[invNo].reversedDeduction += deduction;
      } else {
        map[invNo].receiptAmount += amount;
        map[invNo].tds += tds;
        map[invNo].deduction += deduction;
      }
    });
    return map;
  }, [allReceipts]);

  // Main Processing Logic
  const processedData = useMemo(() => {
    if (!allInvoices) return [];
    let base = allInvoices.filter(inv => {
      if (!isAdmin && inv.plantId !== assignedPlantId) return false;
      if (inv.status === "Cancelled") return false;
      if (filterPlant !== "ALL" && inv.plantId !== filterPlant) return false;
      if (filterConsignee !== "ALL" && inv.billTo !== filterConsignee) return false;
      if (filterFY !== "ALL" && inv.billYear !== filterFY) return false;
      return true;
    });
return base.map(inv => {
      const receipt = invoiceReceiptMap[inv.invoiceNumber] || { receiptAmount: 0, tds: 0, deduction: 0, reversedAmount: 0, reversedTds: 0, reversedDeduction: 0 };
      const gross = inv.totals?.grossAmount || 0;
      const totalCollection = (receipt.receiptAmount || 0) + (receipt.tds || 0) + (receipt.deduction || 0);
      const totalReversed = (receipt.reversedAmount || 0) + (receipt.reversedTds || 0) + (receipt.reversedDeduction || 0);
      return {
        ...inv,
        receiptAmount: receipt.receiptAmount,
        tdsAmount: receipt.tds,
        deductionAmount: receipt.deduction,
        paymentDate: receipt.paymentDate,
        paymentAdviceNo: receipt.paymentAdviceNo,
        bankingUtr: receipt.bankingUtr,
        balanceAmount: gross - totalCollection + totalReversed
      };
    });
  }, [allInvoices, isAdmin, assignedPlantId, filterPlant, filterConsignee, filterFY, invoiceReceiptMap]);

  const pendingInvoices = useMemo(() => processedData.filter(i => i.balanceAmount > 1), [processedData]);

  const summary = useMemo(() => {
    return processedData.reduce((acc, curr) => ({
      total: acc.total + (curr.totals?.grossAmount || 0),
      receipt: acc.receipt + (curr.receiptAmount || 0),
      tds: acc.tds + (curr.tdsAmount || 0),
      deduction: acc.deduction + (curr.deductionAmount || 0),
      balance: acc.balance + curr.balanceAmount
    }), { total: 0, receipt: 0, tds: 0, deduction: 0, balance: 0 });
  }, [processedData]);

  const sortedData = useMemo(() => {
    if (!sortConfig) return pendingInvoices;
    return [...pendingInvoices].sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];
      if (sortConfig.key.includes('totals.')) {
        const key = sortConfig.key.split('.')[1];
        aVal = a.totals?.[key] || 0;
        bVal = b.totals?.[key] || 0;
      }
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [pendingInvoices, sortConfig]);

  const hasIgst = useMemo(() => pendingInvoices.some(i => (i.totals?.igst || 0) > 0), [pendingInvoices]);
  const hasCsgst = useMemo(() => pendingInvoices.some(i => (i.totals?.cgst || 0) > 0), [pendingInvoices]);

  const SortIcon = ({ col }: { col: string }) => {
    if (sortConfig?.key !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-20" />;
    return sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3 ml-1 text-blue-600" /> : <ChevronDown className="h-3 w-3 ml-1 text-blue-600" />;
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig?.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const handleExport = () => {
    if (sortedData.length === 0) return;
    const csvContent = [
      ["#", "Plant", "Invoice No", "Inv. Date", "Bill Month", "Charge type", "Description", "Taxable Amt", "CGST", "SGST", "IGST", "Gross Payable", "Receipt Amt", "TDS Amt", "Deduction Amt", "Balance", "Pay Date", "Advice No", "UTR"].join(","),
      ...sortedData.map((row, idx) => [
        idx + 1,
        row.plantId,
        row.invoiceNumber,
        row.invoiceDate,
        row.billMonth,
        `"${row.docCategory || ""}"`,
        `"${row.items?.[0]?.desc || ""}"`,
        row.totals?.taxableAmount || 0,
        row.totals?.cgst || 0,
        row.totals?.sgst || 0,
        row.totals?.igst || 0,
        row.totals?.grossAmount || 0,
        row.receiptAmount || 0,
        row.tdsAmount || 0,
        row.deductionAmount || 0,
        row.balanceAmount || 0,
        row.paymentDate || "",
        row.paymentAdviceNo || "",
        row.bankingUtr || ""
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `FB03_Pending_Payment_List_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Excel Export triggered successfully", isError: false } }));
  };

  return (
    <div className="w-full flex flex-col bg-white min-h-full select-text">
      <div className="sap-header-title">FB03 - Invoice Payment Status Control Center</div>

      <div className="bg-[#e7ebf1] border-b border-[#b5c7de] p-3 grid grid-cols-4 gap-6 items-end">
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
          <label className="text-[10px] font-bold text-gray-500 uppercase">Consignee (Bill To)</label>
          <Select value={filterConsignee} onValueChange={setFilterConsignee}>
            <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Partners</SelectItem>
              {customers?.filter(c => filterPlant === "ALL" || c.plantId === filterPlant).map(c => (
                <SelectItem key={c.id} value={c.customerId}>{c.customerId} - {c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-gray-500 uppercase">Financial Year</label>
          <Select value={filterFY} onValueChange={setFilterYear}>
            <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Years</SelectItem>
              {financialYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setShowDetail(!showDetail)} className="h-6 rounded-none bg-blue-700 hover:bg-blue-800 text-[11px] font-bold gap-2 shadow-sm">
          <LayoutDashboard className="h-3.5 w-3.5" />
          {showDetail ? "Hide Details" : "View Detail"}
        </Button>
      </div>

      <div className="p-4 grid grid-cols-5 gap-4">
        <div className="bg-white border border-gray-200 rounded-sm shadow-sm p-4 flex items-center gap-4 group hover:border-blue-300 transition-colors">
          <div className="bg-blue-50 p-3 rounded-full group-hover:bg-blue-100 transition-colors"><Receipt className="h-6 w-6 text-blue-600" /></div>
          <div><p className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Total Invoice Amount</p><p className="text-xl font-black text-gray-800 font-mono">₹ {summary.total.toLocaleString()}</p></div>
        </div>
        <div className="bg-white border border-gray-200 rounded-sm shadow-sm p-4 flex items-center gap-4 group hover:border-emerald-300 transition-colors">
          <div className="bg-emerald-50 p-3 rounded-full group-hover:bg-emerald-100 transition-colors"><Wallet className="h-6 w-6 text-emerald-600" /></div>
          <div><p className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Total Receipt Amount</p><p className="text-xl font-black text-emerald-700 font-mono">₹ {summary.receipt.toLocaleString()}</p></div>
        </div>
        <div className="bg-white border border-gray-200 rounded-sm shadow-sm p-4 flex items-center gap-4 group hover:border-orange-300 transition-colors">
          <div className="bg-orange-50 p-3 rounded-full group-hover:bg-orange-100 transition-colors"><MinusCircle className="h-6 w-6 text-orange-600" /></div>
          <div><p className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Total TDS Amount</p><p className="text-xl font-black text-orange-700 font-mono">₹ {summary.tds.toLocaleString()}</p></div>
        </div>
        <div className="bg-white border border-gray-200 rounded-sm shadow-sm p-4 flex items-center gap-4 group hover:border-purple-300 transition-colors">
          <div className="bg-purple-50 p-3 rounded-full group-hover:bg-purple-100 transition-colors"><PlusCircle className="h-6 w-6 text-purple-600" /></div>
          <div><p className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Total Deduction Amount</p><p className="text-xl font-black text-purple-700 font-mono">₹ {summary.deduction.toLocaleString()}</p></div>
        </div>
        <div className="bg-white border border-gray-200 rounded-sm shadow-sm p-4 flex items-center gap-4 group hover:border-red-300 transition-colors">
          <div className="bg-red-50 p-3 rounded-full group-hover:bg-red-100 transition-colors"><ArrowRight className="h-6 w-6 text-red-600" /></div>
          <div><p className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Total Balance Amount</p><p className="text-xl font-black text-red-700 font-mono">₹ {summary.balance.toLocaleString()}</p></div>
        </div>
      </div>

      {showDetail && (
        <div className="flex-1 flex flex-col animate-in slide-in-from-bottom-4 duration-500 overflow-hidden">
          <div className="bg-[#dae8f5] px-4 py-1.5 border-y border-gray-300 flex items-center justify-between shadow-sm">
            <h3 className="text-[11px] font-black text-blue-900 uppercase tracking-widest">Pending Payment Invoice Details (ALV Grid)</h3>
            <Button onClick={handleExport} variant="outline" className="h-6 rounded-none bg-white border-gray-400 text-emerald-700 text-[10px] font-bold uppercase gap-1.5 shadow-sm hover:bg-emerald-50">
              <Download className="h-3.5 w-3.5" /> Export Excel
            </Button>
          </div>
          <div className="flex-1 overflow-auto bg-white no-scrollbar">
            <Table className="min-w-[1700px] sap-alv-grid">
              <TableHeader className="sap-alv-header">
                <TableRow className="h-8 border-b-[#b5c7de]">
                  <TableHead className="w-12 text-center text-[10px] font-bold border-r border-[#b5c7de]">#</TableHead>
                  <TableHead onClick={() => handleSort('plantId')} className="w-24 text-[10px] font-bold border-r border-[#b5c7de] cursor-pointer hover:bg-gray-200"><div className="flex items-center">Plant <SortIcon col="plantId" /></div></TableHead>
                  <TableHead onClick={() => handleSort('invoiceNumber')} className="w-40 text-[10px] font-bold border-r border-[#b5c7de] cursor-pointer hover:bg-gray-200"><div className="flex items-center">Invoice No <SortIcon col="invoiceNumber" /></div></TableHead>
                  <TableHead onClick={() => handleSort('invoiceDate')} className="w-32 text-[10px] font-bold border-r border-[#b5c7de] cursor-pointer hover:bg-gray-200"><div className="flex items-center">Inv. Date <SortIcon col="invoiceDate" /></div></TableHead>
                  <TableHead className="w-24 text-[10px] font-bold border-r border-[#b5c7de]">Bill Month</TableHead>
                  <TableHead className="w-40 text-[10px] font-bold border-r border-[#b5c7de]">Charge type</TableHead>
                  <TableHead className="text-[10px] font-bold border-r border-[#b5c7de]">Description</TableHead>
                  <TableHead onClick={() => handleSort('totals.taxableAmount')} className="w-32 text-right text-[10px] font-bold border-r border-[#b5c7de] cursor-pointer hover:bg-gray-200"><div className="flex items-center justify-end">Taxable Amt <SortIcon col="totals.taxableAmount" /></div></TableHead>
                  {hasCsgst && (
                    <>
                      <TableHead className="w-28 text-right text-[10px] font-bold border-r border-[#b5c7de]">CGST</TableHead>
                      <TableHead className="w-28 text-right text-[10px] font-bold border-r border-[#b5c7de]">SGST</TableHead>
                    </>
                  )}
                  {hasIgst && <TableHead className="w-28 text-right text-[10px] font-bold border-r border-[#b5c7de]">IGST</TableHead>}
                  <TableHead onClick={() => handleSort('totals.grossAmount')} className="w-32 text-right text-[10px] font-bold border-r border-[#b5c7de] cursor-pointer hover:bg-gray-200 bg-blue-50/50"><div className="flex items-center justify-end">Gross Payable <SortIcon col="totals.grossAmount" /></div></TableHead>
                  <TableHead onClick={() => handleSort('receiptAmount')} className="w-32 text-right text-[10px] font-bold border-r border-[#b5c7de] cursor-pointer hover:bg-gray-200">Receipt Amt</TableHead>
                  <TableHead onClick={() => handleSort('tdsAmount')} className="w-28 text-right text-[10px] font-bold border-r border-[#b5c7de] cursor-pointer hover:bg-gray-200">TDS Amt</TableHead>
                  <TableHead onClick={() => handleSort('deductionAmount')} className="w-28 text-right text-[10px] font-bold border-r border-[#b5c7de] cursor-pointer hover:bg-gray-200">Deduction Amt</TableHead>
                  <TableHead className="w-32 text-[10px] font-bold border-r border-[#b5c7de]">Pay Date</TableHead>
                  <TableHead className="w-32 text-[10px] font-bold border-r border-[#b5c7de]">Advice No.</TableHead>
                  <TableHead className="w-32 text-[10px] font-bold border-r border-[#b5c7de]">Bank UTR</TableHead>
                  <TableHead onClick={() => handleSort('balanceAmount')} className="w-32 text-right text-[10px] font-bold text-red-700 bg-red-50/30">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isInvoicesLoading ? (
                  <TableRow><TableCell colSpan={14} className="text-center py-20 text-[11px] uppercase tracking-widest animate-pulse">Syncing System Records...</TableCell></TableRow>
                ) : sortedData.length === 0 ? (
                  <TableRow><TableCell colSpan={14} className="text-center py-20 text-[11px] font-bold text-emerald-600 uppercase">All Invoices in this view are fully settled.</TableCell></TableRow>
                ) : sortedData.map((row, idx) => (
                  <TableRow key={row.id} className="h-8 hover:bg-blue-50/30 transition-colors border-b border-gray-100 group">
                    <TableCell className="p-0 text-center text-[10px] border-r border-gray-100 text-gray-400 group-hover:text-blue-600">{idx + 1}</TableCell>
                    <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 font-bold text-center">{row.plantId}</TableCell>
                    <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 font-mono font-black text-blue-800">{row.invoiceNumber}</TableCell>
                    <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 font-mono text-center">{row.invoiceDate}</TableCell>
                    <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 uppercase">{row.billMonth}</TableCell>
                    <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 truncate max-w-[150px] uppercase italic text-gray-600">{row.docCategory}</TableCell>
                    <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 truncate max-w-[250px] font-semibold text-blue-900 uppercase">{row.items?.[0]?.desc || "---"}</TableCell>
                    <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 text-right font-mono">{(row.totals?.taxableAmount || 0).toLocaleString()}</TableCell>
                    {hasCsgst && (
                      <>
                        <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 text-right font-mono text-gray-500">{(row.totals?.cgst || 0).toLocaleString()}</TableCell>
                        <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 text-right font-mono text-gray-500">{(row.totals?.sgst || 0).toLocaleString()}</TableCell>
                      </>
                    )}
                    {hasIgst && <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 text-right font-mono text-gray-500">{(row.totals?.igst || 0).toLocaleString()}</TableCell>}
                    <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 text-right font-black text-blue-900 bg-blue-50/20">{(row.totals?.grossAmount || 0).toLocaleString()}</TableCell>
                    <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 text-right font-bold text-emerald-700">{(row.paidAmount || 0).toLocaleString()}</TableCell>
                    <TableCell className="p-0 px-2 text-[10px] text-right font-black text-red-700 bg-red-50/10">{(row.balanceAmount || 0).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="bg-[#333e4f] p-2 flex justify-between items-center text-white text-[10px] font-bold uppercase tracking-widest shadow-inner sticky bottom-0 z-20">
            <div className="flex items-center gap-6"><span>ALV Grid Status: {sortedData.length} Document(s) Displayed</span></div>
            <div className="flex items-center gap-10 pr-4">
              <div className="flex flex-col items-end"><span className="opacity-50 text-[8px]">Net Payable</span><span className="text-[12px] font-black text-blue-300">₹ {sortedData.reduce((s, r) => s + (r.totals?.grossAmount || 0), 0).toLocaleString()}</span></div>
              <div className="flex flex-col items-end border-l border-white/20 pl-6"><span className="opacity-50 text-[8px]">Outstanding</span><span className="text-[12px] font-black text-red-400">₹ {sortedData.reduce((s, r) => s + (r.balanceAmount || 0), 0).toLocaleString()}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
