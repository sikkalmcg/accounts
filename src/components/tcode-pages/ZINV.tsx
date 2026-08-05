"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDatabase, useCollection, useMemoDatabase, addDocumentNonBlocking } from "@/database";
import { collection, query, orderBy, where, getDocs } from "@/database/mongo";
import { 
  Search, 
  ArrowUpDown, 
  ChevronUp, 
  ChevronDown, 
  FileSpreadsheet, 
  Loader2,
  ChevronRight,
  ChevronLeft,
  ChevronsRight,
  ChevronsLeft,
  X,
  CheckCircle2,
  LayoutGrid,
  LayoutList
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { parse } from "date-fns";
import { getRecordPlantIds } from "@/lib/plant-master";

const BASE_COLUMNS = [
  { id: 'billMonth', label: 'Bill Month/Year' },
  { id: 'plantId', label: 'Plant ID' },
  { id: 'consignorName', label: 'Consignor Name' },
  { id: 'consignorGstin', label: 'Consignor GSTIN' },
  { id: 'consigneeName', label: 'Consignee Name' },
  { id: 'gstin', label: 'Consignee GSTIN' },
  { id: 'state', label: 'State' },
  { id: 'shipToName', label: 'Ship To Name' },
  { id: 'shipToGstin', label: 'Ship To GSTIN' },
  { id: 'docType', label: 'Doc Type' },
  { id: 'docCategory', label: 'Charge Type' },
  { id: 'material', label: 'Material' },
  { id: 'customValue0', label: 'Custom Col 1' },
  { id: 'customValue1', label: 'Custom Col 2' },
  { id: 'customValue2', label: 'Custom Col 3' },
  { id: 'hsn', label: 'HSN/SAC' },
  { id: 'qty', label: 'Qty' },
  { id: 'rate', label: 'Rate' },
  { id: 'amount', label: 'Amount' },
  { id: 'cgst', label: 'CGST' },
  { id: 'sgst', label: 'SGST' },
  { id: 'igst', label: 'IGST' },
  { id: 'grossAmount', label: 'Gross Amt' },
  { id: 'irn', label: 'IRN Number' },
  { id: 'ackNo', label: 'ACK No' },
  { id: 'ackDate', label: 'ACK Date' },
  { id: 'paymentMode', label: 'Pay Mode' },
  { id: 'receiptAmount', label: 'Receipt Amt' },
  { id: 'tds', label: 'TDS' },
  { id: 'deduction', label: 'Deduction' },
  { id: 'interest', label: 'Interest' },
  { id: 'deductionRemark', label: 'Ded. Remark' },
  { id: 'remark', label: 'Remark' },
  { id: 'utr', label: 'Banking UTR' },
  { id: 'advice', label: 'Payment Advice' },
  { id: 'balance', label: 'Balance' },
  { id: 'status', label: 'Status' },
];

const DEFAULT_COLUMNS = ['billMonth', 'plantId', 'consignorName', 'consigneeName', 'material', 'qty', 'rate', 'amount', 'grossAmount', 'balance', 'status'];

export default function ZINV() {
  const db = useDatabase();
  
  // 1. Context & Auth
  const [assignedPlantId, setAssignedPlantId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [userName, setUserName] = useState("USER");
  
  // 2. Filter State
  const [filterPlant, setFilterPlant] = useState("ALL");
  const [filterConsignee, setFilterConsignee] = useState("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [isExecuted, setIsExecuted] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  // 3. Data Fetching
  const invoicesQuery = useMemoDatabase(() => query(collection(db, "sales_invoices"), orderBy("createdAt", "desc")), [db]);
  const { data: invoices, isLoading: isInvoicesLoading } = useCollection(invoicesQuery);

  const receiptsQuery = useMemoDatabase(() => collection(db, "payment_receipts"), [db]);
  const { data: receipts } = useCollection(receiptsQuery);

  const plantsQuery = useMemoDatabase(() => collection(db, "plants"), [db]);
  const { data: plants } = useCollection(plantsQuery);

  const customersQuery = useMemoDatabase(() => collection(db, "customers"), [db]);
  const { data: customers } = useCollection(customersQuery);

  const firmsQuery = useMemoDatabase(() => collection(db, "firms"), [db]);
  const { data: firms } = useCollection(firmsQuery);

  const layoutsQuery = useMemoDatabase(() => query(collection(db, "zinv_layouts")), [db]);
  const { data: savedLayouts } = useCollection(layoutsQuery);

  // 4. Dynamic Column Resolution
  const dynamicColumns = useMemo(() => {
    let labels = ["Custom Col 1", "Custom Col 2", "Custom Col 3"];
    
    if (invoices && invoices.length > 0) {
      const sample = invoices.find(inv => inv.customHeaders && inv.customHeaders.length > 0);
      if (sample) {
        sample.customHeaders.forEach((h: string, idx: number) => {
          if (h && h.trim()) labels[idx] = h;
        });
      }
    }

    return BASE_COLUMNS.map(col => {
      if (col.id === 'customValue0') return { ...col, label: labels[0] };
      if (col.id === 'customValue1') return { ...col, label: labels[1] };
      if (col.id === 'customValue2') return { ...col, label: labels[2] };
      return col;
    });
  }, [invoices]);

  // 5. Layout Management State
  const [isLayoutOpen, setIsLayoutOpen] = useState(false);
  const [isSelectLayoutOpen, setIsSelectLayoutOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_COLUMNS);
  const [tempVisible, setTempVisible] = useState<string[]>(DEFAULT_COLUMNS);
  const [selectedInTemp, setSelectedInTemp] = useState<string[]>([]);
  const [selectedInHidden, setSelectedInHidden] = useState<string[]>([]);
  const [newLayoutName, setNewLayoutName] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("sikka_user");
    if (stored) {
      const parsed = JSON.parse(stored);
      const admin = parsed.username === "ajaysomra" || parsed.role === 'admin';
      setIsAdmin(admin);
      setUserName(parsed.name || parsed.username);
      setAssignedPlantId(parsed.assignedPlantId || "");
      if (!admin && parsed.assignedPlantId) setFilterPlant(parsed.assignedPlantId);
    }

    const onLayout = () => {
      setTempVisible([...visibleColumns]);
      setSelectedInTemp([]);
      setSelectedInHidden([]);
      setIsLayoutOpen(true);
    };

    const onSelectLayout = () => {
      setIsSelectLayoutOpen(true);
    };

    window.addEventListener('sap-change-layout', onLayout);
    window.addEventListener('sap-select-layout', onSelectLayout);
    return () => {
      window.removeEventListener('sap-change-layout', onLayout);
      window.removeEventListener('sap-select-layout', onSelectLayout);
    };
  }, [visibleColumns]);

  // 6. Mappings
  const customerMap = useMemo(() => {
    const map: Record<string, any> = {};
    customers?.forEach(c => { map[c.customerId] = c; });
    return map;
  }, [customers]);

const firmMap = useMemo(() => {
    const map: Record<string, any> = {};
    firms?.forEach(f => {
      getRecordPlantIds(f).forEach(pid => { map[pid] = f; });
    });
    return map;
  }, [firms]);

  const invoiceReceiptMap = useMemo(() => {
    const map: Record<string, any> = {};
    receipts?.forEach(r => {
      const invNo = r.invoiceNo;
      if (!map[invNo]) {
        map[invNo] = { ...r, totalReceipt: 0 };
      }
      map[invNo].totalReceipt += Number(r.receiptAmount) || 0;
    });
    return map;
  }, [receipts]);

  // 7. Processing Logic
  const processedData = useMemo(() => {
    if (!invoices || !isExecuted) return [];

    const result: any[] = [];
    invoices.forEach(inv => {
      if (!isAdmin && inv.plantId !== assignedPlantId) return;
      if (filterPlant !== "ALL" && inv.plantId !== filterPlant) return;
      if (filterConsignee !== "ALL" && inv.billTo !== filterConsignee) return;

      if (fromDate || toDate) {
        if (inv.invoiceDate) {
          try {
            const invDate = parse(inv.invoiceDate, 'dd-MMM-yyyy', new Date());
            if (fromDate && invDate < new Date(fromDate)) return;
            if (toDate && invDate > new Date(toDate)) return;
          } catch(e) { /* ignore invalid dates */ }
        }
      }

      const firm = firmMap[inv.plantId];
      const consignee = customerMap[inv.billTo];
      const shipTo = customerMap[inv.shipTo] || consignee;
      const payment = invoiceReceiptMap[inv.invoiceNumber] || {};
      
      const isInterstate = firm?.stateCode !== consignee?.stateCode;

      inv.items?.forEach((item: any) => {
        const amt = Number(item.amount) || 0;
        const gstRate = Number(item.gstRate) || 0;

        result.push({
          id: `${inv.id}-${item.id}`,
          billMonth: inv.billMonth || "---",
          plantId: inv.plantId,
          consignorName: firm?.name || "N/A",
          consignorGstin: firm?.gstin || "N/A",
          consigneeName: consignee?.name || "N/A",
          gstin: consignee?.gstin || "N/A",
          state: consignee?.stateName || "N/A",
          shipToName: shipTo?.name || "N/A",
          shipToGstin: shipTo?.gstin || "N/A",
          docType: inv.docType || "N/A",
          docCategory: inv.docCategory || "N/A",
          material: item.desc,
          hsn: item.hsn,
          qty: Number(item.qty) || 0,
          rate: Number(item.rate) || 0,
          amount: amt,
          cgst: isInterstate ? 0 : (amt * (gstRate / 200)),
          sgst: isInterstate ? 0 : (amt * (gstRate / 200)),
          igst: isInterstate ? (amt * (gstRate / 100)) : 0,
          grossAmount: Number(inv.totals?.grossAmount) || 0, 
          irn: inv.irnNumber || "---",
          ackNo: inv.ackNo || "---",
          ackDate: inv.ackDate || "---",
          paymentMode: payment.paymentMode || "---",
          receiptAmount: payment.totalReceipt || 0,
          tds: payment.tds || 0,
          deduction: payment.deduction || 0,
          interest: payment.interest || 0,
          deductionRemark: payment.deductionRemark || "---",
          remark: payment.remark || "---",
          utr: payment.bankingUtr || "---",
          advice: payment.paymentAdviceNo || "---",
          balance: payment.balanceAmount || ((inv.totals?.grossAmount || 0) - (payment.totalReceipt || 0)),
          status: inv.status || "Active",
          isInterstate,
          customValue0: item.customValues?.[0] || "-",
          customValue1: item.customValues?.[1] || "-",
          customValue2: item.customValues?.[2] || "-",
        });
      });
    });

    return result;
  }, [invoices, isAdmin, assignedPlantId, filterPlant, filterConsignee, fromDate, toDate, isExecuted, firmMap, customerMap, invoiceReceiptMap]);

  const sortedData = useMemo(() => {
    if (!sortConfig) return processedData;
    return [...processedData].sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) return -1;
      if (a[sortConfig.key] > b[sortConfig.key]) return 1;
      return 0;
    });
  }, [processedData, sortConfig]);

  const handleExecute = useCallback(() => {
    setIsExecuted(true);
    window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Report generation complete", isError: false } }));
  }, []);

  useEffect(() => {
    window.addEventListener('sap-execute', handleExecute);
    return () => window.removeEventListener('sap-execute', handleExecute);
  }, [handleExecute]);

  const handleExport = () => {
    if (processedData.length === 0) return;
    const activeHeaders = dynamicColumns.filter(c => visibleColumns.includes(c.id));
    const csvContent = [
      activeHeaders.map(h => h.label).join(","),
      ...sortedData.map(r => activeHeaders.map(h => `"${r[h.id] || ""}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `ZINV_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLayoutSave = async () => {
    if (newLayoutName.trim()) {
      addDocumentNonBlocking(collection(db, "zinv_layouts"), {
        name: newLayoutName.trim(),
        columns: tempVisible,
        createdBy: userName,
        createdAt: new Date().toISOString()
      });
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: `Layout variant '${newLayoutName}' saved`, isError: false } }));
      setNewLayoutName("");
    }
    setVisibleColumns(tempVisible);
    setIsLayoutOpen(false);
    window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Layout applied successfully", isError: false } }));
  };

  const loadLayout = (layout: any) => {
    setVisibleColumns(layout.columns);
    setIsSelectLayoutOpen(false);
    window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: `Layout '${layout.name}' loaded`, isError: false } }));
  };

  // SAP ALV Dual Pane Logic
  const moveRight = () => {
    if (selectedInTemp.length === 0) return;
    setTempVisible(prev => prev.filter(c => !selectedInTemp.includes(c)));
    setSelectedInTemp([]);
  };

  const moveLeft = () => {
    if (selectedInHidden.length === 0) return;
    setTempVisible(prev => [...prev, ...selectedInHidden]);
    setSelectedInHidden([]);
  };

  const moveAllRight = () => {
    setTempVisible([]);
    setSelectedInTemp([]);
  };

  const moveAllLeft = () => {
    setTempVisible(dynamicColumns.map(c => c.id));
    setSelectedInHidden([]);
  };

  const moveUp = () => {
    if (selectedInTemp.length !== 1) return;
    const cid = selectedInTemp[0];
    const idx = tempVisible.indexOf(cid);
    if (idx <= 0) return;
    const updated = [...tempVisible];
    [updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]];
    setTempVisible(updated);
  };

  const moveDown = () => {
    if (selectedInTemp.length !== 1) return;
    const cid = selectedInTemp[0];
    const idx = tempVisible.indexOf(cid);
    if (idx === -1 || idx >= tempVisible.length - 1) return;
    const updated = [...tempVisible];
    [updated[idx + 1], updated[idx]] = [updated[idx], updated[idx + 1]];
    setTempVisible(updated);
  };

  return (
    <div className="w-full flex flex-col bg-white min-h-full select-text">
      <div className="sap-header-title">ZINV - Comprehensive ALV Grid Report</div>

      <div className="sap-selection-area">
        <div className="max-w-6xl mx-auto grid grid-cols-2 gap-x-12 gap-y-6">
          <div className="sap-selection-row">
            <label className="sap-label">Plant ID</label>
            <div className="sap-input-wrapper max-w-[300px]">
              <Select value={filterPlant} onValueChange={setFilterPlant} disabled={!isAdmin}>
                <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Authorized Plants</SelectItem>
                  {plants?.map(p => <SelectItem key={p.id} value={p.plantId}>{p.plantId} - {p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="sap-selection-row">
            <label className="sap-label">From Date</label>
            <div className="sap-input-wrapper max-w-[300px]"><Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} /></div>
          </div>
          <div className="sap-selection-row">
            <label className="sap-label">Consignee Filter</label>
            <div className="sap-input-wrapper max-w-[300px]">
              <Select value={filterConsignee} onValueChange={setFilterConsignee}>
                <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Business Partners</SelectItem>
{customers?.filter(c => filterPlant === "ALL" || getRecordPlantIds(c).includes(filterPlant)).map(c => (
                    <SelectItem key={c.id} value={c.customerId}>{c.customerId} - {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="sap-selection-row">
            <label className="sap-label">To Date</label>
            <div className="sap-input-wrapper max-w-[300px]"><Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} /></div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto no-scrollbar relative bg-[#f8f9fa]">
        {!isExecuted ? (
          <div className="flex flex-col items-center justify-center py-40 text-gray-400 opacity-40 select-none">
            <Search className="h-20 w-20 stroke-1 mb-4" /><p className="text-sm font-black uppercase tracking-[0.3em]">Enter parameters and execute (F8)</p>
          </div>
        ) : isInvoicesLoading ? (
          <div className="flex flex-col items-center justify-center py-40 animate-pulse">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-2" /><p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Syncing System Data...</p>
          </div>
        ) : (
          <Table className="min-w-max sap-alv-grid">
            <TableHeader className="sap-alv-header">
              <TableRow className="h-8">
                <TableHead className="w-10 text-center text-[10px] font-bold border-r border-[#b5c7de]">#</TableHead>
                {dynamicColumns.filter(c => visibleColumns.includes(c.id)).sort((a,b) => visibleColumns.indexOf(a.id) - visibleColumns.indexOf(b.id)).map(col => (
                  <TableHead 
                    key={col.id} 
                    onClick={() => {
                      let dir: 'asc' | 'desc' = 'asc';
                      if(sortConfig?.key === col.id && sortConfig.direction === 'asc') dir = 'desc';
                      setSortConfig({ key: col.id, direction: dir });
                    }}
                    className={cn(
                      "px-2 text-[10px] font-bold border-r border-[#b5c7de] cursor-pointer hover:bg-gray-200 transition-colors",
                      ['qty', 'rate', 'amount', 'cgst', 'sgst', 'igst', 'grossAmount', 'receiptAmount', 'tds', 'deduction', 'interest', 'balance'].includes(col.id) && "text-right"
                    )}
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      {sortConfig?.key === col.id ? (sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ArrowUpDown className="h-2.5 w-2.5 opacity-20" />}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.map((row, idx) => (
                <TableRow key={row.id} className="h-8 hover:bg-blue-50/20 border-b border-gray-200 transition-colors group">
                  <TableCell className="p-0 text-center text-[10px] border-r text-gray-400 group-hover:text-blue-600">{idx + 1}</TableCell>
                  {dynamicColumns.filter(c => visibleColumns.includes(c.id)).sort((a,b) => visibleColumns.indexOf(a.id) - visibleColumns.indexOf(b.id)).map(col => {
                    const val = row[col.id];
                    return (
                      <TableCell 
                        key={col.id} 
                        className={cn(
                          "p-0 px-2 text-[10px] border-r whitespace-nowrap overflow-hidden text-ellipsis max-w-[300px]",
                          ['qty', 'rate', 'amount', 'cgst', 'sgst', 'igst', 'grossAmount', 'receiptAmount', 'tds', 'deduction', 'interest', 'balance'].includes(col.id) && "text-right font-mono",
                          ['grossAmount', 'balance'].includes(col.id) && "font-bold",
                          col.id === 'status' && (val === 'Cancelled' ? 'text-red-600 font-bold' : 'text-emerald-700 font-bold')
                        )}
                      >
                        {typeof val === 'number' ? val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : val}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Select Layout Dialog */}
      <Dialog open={isSelectLayoutOpen} onOpenChange={setIsSelectLayoutOpen}>
        <DialogContent className="max-w-[500px] p-0 rounded-none border-gray-400 shadow-2xl overflow-hidden">
          <div className="bg-[#dae8f5] border-b border-gray-300 p-2 flex justify-between items-center">
            <DialogTitle className="text-[12px] font-bold text-gray-700 flex items-center gap-2">
              <LayoutList className="h-4 w-4 text-blue-700" /> Select Layout
            </DialogTitle>
            <button onClick={() => setIsSelectLayoutOpen(false)} className="p-1 hover:bg-red-100 transition-colors"><X className="h-4 w-4" /></button>
          </div>
          <div className="p-4 bg-white max-h-[400px] overflow-y-auto no-scrollbar">
            <div className="space-y-1">
              <div 
                onClick={() => setVisibleColumns(DEFAULT_COLUMNS)}
                className="p-2 border border-gray-100 hover:bg-blue-50 cursor-pointer text-xs font-bold text-blue-800 flex justify-between items-center"
              >
                <span>/ Standard Layout</span>
                <span className="text-[9px] opacity-40 uppercase">System Default</span>
              </div>
              {savedLayouts?.map(layout => (
                <div 
                  key={layout.id}
                  onClick={() => loadLayout(layout)}
                  className="p-2 border border-gray-100 hover:bg-blue-50 cursor-pointer text-xs flex justify-between items-center"
                >
                  <span className="font-medium text-gray-700">{layout.name}</span>
                  <span className="text-[9px] opacity-40 uppercase">Created by {layout.createdBy}</span>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Change Layout Dialog */}
      <Dialog open={isLayoutOpen} onOpenChange={setIsLayoutOpen}>
        <DialogContent className="max-w-[900px] p-0 rounded-none border-gray-400 shadow-2xl overflow-hidden">
          <div className="bg-[#dae8f5] border-b border-gray-300 p-2 flex justify-between items-center">
            <DialogTitle className="text-[12px] font-bold text-gray-700 flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 text-blue-700" /> Change Layout: {userName.toUpperCase()}
            </DialogTitle>
            <button onClick={() => setIsLayoutOpen(false)} className="hover:bg-red-100 p-1 transition-colors"><X className="h-4 w-4" /></button>
          </div>
          
          <div className="p-6 bg-[#f0f3f5] flex gap-4 h-[550px]">
            {/* Displayed Columns */}
            <div className="flex-1 flex flex-col border border-gray-300 bg-white rounded-sm shadow-inner">
              <div className="bg-[#e7ebf1] px-3 py-1 text-[11px] font-bold border-b text-gray-600 uppercase italic">LINE 1 (DISPLAYED FIELDS)</div>
              <div className="flex-1 overflow-y-auto no-scrollbar">
                {tempVisible.map((cid, i) => {
                  const col = dynamicColumns.find(c => c.id === cid);
                  return (
                    <div 
                      key={cid}
                      onClick={() => setSelectedInTemp([cid])}
                      className={cn(
                        "px-3 py-1 text-[11px] cursor-pointer border-b border-gray-50 flex items-center justify-between",
                        selectedInTemp.includes(cid) ? "bg-[#2A6BD5] text-white" : "hover:bg-blue-50 text-gray-700"
                      )}
                    >
                      <span>{col?.label}</span>
                      <span className="text-[9px] opacity-40 font-mono">{i + 1}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Controls */}
            <div className="w-12 flex flex-col justify-center gap-2">
              <Button onClick={moveAllRight} title="Remove All" variant="outline" size="icon" className="h-8 w-8 rounded-none border-gray-400 bg-white shadow-sm hover:bg-gray-50"><ChevronsRight className="h-4 w-4" /></Button>
              <Button onClick={moveRight} title="Remove Selected" variant="outline" size="icon" className="h-8 w-8 rounded-none border-gray-400 bg-white shadow-sm hover:bg-gray-50"><ChevronRight className="h-4 w-4" /></Button>
              <Button onClick={moveLeft} title="Add Selected" variant="outline" size="icon" className="h-8 w-8 rounded-none border-gray-400 bg-white shadow-sm hover:bg-gray-50"><ChevronLeft className="h-4 w-4" /></Button>
              <Button onClick={moveAllLeft} title="Add All" variant="outline" size="icon" className="h-8 w-8 rounded-none border-gray-400 bg-white shadow-sm hover:bg-gray-50"><ChevronsLeft className="h-4 w-4" /></Button>
              <div className="h-8" />
              <Button onClick={moveUp} title="Move Up" variant="outline" size="icon" className="h-8 w-8 rounded-none border-gray-400 bg-white shadow-sm hover:bg-gray-50"><ChevronUp className="h-4 w-4" /></Button>
              <Button onClick={moveDown} title="Move Down" variant="outline" size="icon" className="h-8 w-8 rounded-none border-gray-400 bg-white shadow-sm hover:bg-gray-50"><ChevronDown className="h-4 w-4" /></Button>
            </div>

            {/* Hidden Fields */}
            <div className="flex-1 flex flex-col border border-gray-300 bg-white rounded-sm shadow-inner">
              <div className="bg-[#e7ebf1] px-3 py-1 text-[11px] font-bold border-b text-gray-600 uppercase italic">HIDDEN FIELDS</div>
              <div className="flex-1 overflow-y-auto no-scrollbar">
                {dynamicColumns.filter(c => !tempVisible.includes(c.id)).map((col) => (
                  <div 
                    key={col.id}
                    onClick={() => setSelectedInHidden([col.id])}
                    className={cn(
                      "px-3 py-1 text-[11px] cursor-pointer border-b border-gray-50",
                      selectedInHidden.includes(col.id) ? "bg-[#2A6BD5] text-white" : "hover:bg-blue-50 text-gray-700"
                    )}
                  >
                    {col.label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-[#e1e1e1] p-3 border-t border-gray-300 flex items-center justify-between shadow-inner px-6">
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase">Save Variant As:</label>
              <Input 
                value={newLayoutName} 
                onChange={e => setNewLayoutName(e.target.value)} 
                className="h-7 w-48 text-[11px] bg-white border-gray-400 rounded-none shadow-inner" 
                placeholder="e.g. My Audit Layout"
              />
            </div>
            <div className="flex gap-3">
              <Button onClick={handleLayoutSave} className="rounded-none bg-[#333e4f] hover:bg-[#252d3a] text-white text-[11px] font-black uppercase px-8 h-8 gap-2 shadow-md">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" /> COPY LAYOUT
              </Button>
              <Button onClick={() => setIsLayoutOpen(false)} variant="outline" className="rounded-none h-8 text-[11px] font-bold border-gray-400 bg-white uppercase shadow-sm">CANCEL</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="bg-[#333e4f] p-1 px-4 flex justify-between items-center text-white text-[10px] font-bold uppercase shadow-inner shadow-black/40">
        <div className="flex gap-10 items-center">
          <span>ALV Grid Status: {sortedData.length} Records</span>
          <span className="opacity-50">|</span>
          <div className="flex gap-2"><span>Plant ID:</span> <span className="text-emerald-400">{filterPlant === "ALL" ? "GLOBAL" : filterPlant}</span></div>
        </div>
        <div className="flex gap-12 pr-6">
          <div className="flex flex-col items-end leading-none"><span className="text-[8px] opacity-60">Net Value</span><span className="text-[12px] font-black text-blue-300">₹ {sortedData.reduce((s, r) => s + r.amount, 0).toLocaleString()}</span></div>
          <div className="flex flex-col items-end leading-none border-l border-white/20 pl-6"><span className="text-[8px] opacity-60">Balance</span><span className="text-[12px] font-black text-red-400">₹ {sortedData.reduce((s, r) => s + (r.balance || 0), 0).toLocaleString()}</span></div>
        </div>
      </div>
    </div>
  );
}


