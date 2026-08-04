"use client";

import { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCollection, useMemoDatabase } from "@/database";
import { collection } from "@/database/mongo";
import { ArrowUpDown, ChevronDown, ChevronUp, Download, Filter, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PlantMultiSelect from "./PlantMultiSelect";

type SummaryData = {
  plant: string;
  inventoryType: string;
  chargeType: string;
  openingAmount: number;
  grossAmount: number;
  receiptsTotal: number;
  tds: number;
  deduction: number;
  balanceAmount: number;
  invoices: any[];
  openingInvoiceRows: any[];
  periodInvoiceRows: any[];
  receiptRows: any[];
  tdsRows: any[];
  deductionRows: any[];
  closingRows: any[];
};

type PopupType = 'opening' | 'invoice' | 'receipt' | 'tds' | 'deduction' | 'closing' | null;

const parseDate = (value?: string | null) => {
  if (!value) return null;
  const trimmed = `${value}`.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const normalized = trimmed.split(/[-/]/);
  if (normalized.length === 3) {
    const [first, second, third] = normalized;
    const year = first.length === 4 ? first : `20${third}`;
    const month = second.length === 1 ? `0${second}` : second;
    const day = first.length === 4 ? third : first;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return null;
};

export default function MB5B() {
  const [filterPlants, setFilterPlants] = useState<string[]>([]);
  const [filterInventoryType, setFilterInventoryType] = useState("ALL");
  const [filterChargeType, setFilterChargeType] = useState("");
  const [filterConsignor, setFilterConsignor] = useState("ALL");
  const [filterBillTo, setFilterBillTo] = useState("ALL");
  const [filterFromDate, setFilterFromDate] = useState("");
  const [filterToDate, setFilterToDate] = useState("");
  const [showReport, setShowReport] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const { data: plants } = useCollection(useMemoDatabase(() => collection(null as any, "plants"), []));
  const { data: customers } = useCollection(useMemoDatabase(() => collection(null as any, "customers"), []));
  const { data: firms } = useCollection(useMemoDatabase(() => collection(null as any, "firms"), []));
  const { data: users } = useCollection(useMemoDatabase(() => collection(null as any, "users"), []));

  const [invoices, setInvoices] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [popupData, setPopupData] = useState<any[]>([]);
  const [popupType, setPopupType] = useState<PopupType>(null);
  const [popupTitle, setPopupTitle] = useState("");

  const userNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    users?.forEach((user: any) => {
      const fullName = [user.name, user.fullName, user.displayName].filter(Boolean)[0] || user.username || user.id || '';
      const keys = [user.username, user.id, user.employeeId, user.userId, user.email].filter(Boolean);
      keys.forEach((key: string) => {
        const normalized = `${key}`.trim().toLowerCase();
        if (normalized) map[normalized] = fullName;
      });
    });
    return map;
  }, [users]);

  const getUserFullName = (value?: string | null) => {
    if (!value) return '';
    const normalized = `${value}`.trim().toLowerCase();
    return userNameMap[normalized] || `${value}`.trim();
  };

  const handleExecute = async () => {
    if (filterPlants.length === 0 || !filterFromDate || !filterToDate) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: 'Please select Plant, From Date, and To Date.', isError: true } }));
      return;
    }

    setIsLoading(true);
    setShowReport(true);

    try {
      const params = new URLSearchParams({
        fromDate: filterFromDate,
        toDate: filterToDate,
        plantIds: filterPlants.join(','),
        report: 'mb5b',
      });
      if (filterInventoryType !== 'ALL') params.set('inventoryType', filterInventoryType);
      if (filterChargeType.trim()) params.set('chargeType', filterChargeType.trim());
      if (filterConsignor !== 'ALL') params.set('consignor', filterConsignor);
      if (filterBillTo !== 'ALL') params.set('billTo', filterBillTo);

      const response = await fetch(`/api/payment-complete?${params.toString()}`);
      if (!response.ok) throw new Error('Unable to load payment-complete data');
      const data = await response.json();
      setInvoices(Array.isArray(data?.rows) ? data.rows : (Array.isArray(data) ? data : []));
      setReceipts(Array.isArray(data?.receipts) ? data.receipts : []);
    } catch (error) {
      console.error('MB5B fetch failed', error);
      setInvoices([]);
      setReceipts([]);
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: 'Unable to load outstanding-ledger data from backend.', isError: true } }));
    } finally {
      setIsLoading(false);
    }
  };

  const processedData = useMemo<SummaryData[]>(() => {
    const summaryMap: Record<string, SummaryData> = {};
    const normalizedInventoryFilter = filterInventoryType === 'ALL' ? '' : filterInventoryType.trim().toUpperCase();
    const normalizedChargeFilter = filterChargeType.trim().toUpperCase();

    const receiptMap = new Map<string, any[]>();
    receipts.forEach(receipt => {
      const invoiceNo = `${receipt.invoiceNo || receipt.invoiceNumber || receipt.invoice || ''}`.trim().toUpperCase();
      if (!invoiceNo) return;
      if (receipt.status === 'Reversed') return;
      const bucket = receiptMap.get(invoiceNo) || [];
      bucket.push(receipt);
      receiptMap.set(invoiceNo, bucket);
    });

    invoices.forEach(inv => {
      const inventoryType = `${inv.inventoryType || 'N/A'}`.trim() || 'N/A';
      const plant = `${inv.plantId || inv.plantCode || 'N/A'}`.trim() || 'N/A';
      const chargeType = `${inv.docCategory || inv.chargeType || 'N/A'}`.trim() || 'N/A';

      if (normalizedInventoryFilter && inventoryType.toUpperCase() !== normalizedInventoryFilter) {
        return;
      }
      if (normalizedChargeFilter && chargeType.toUpperCase().indexOf(normalizedChargeFilter) === -1) {
        return;
      }

      const key = `${plant}||${inventoryType}||${chargeType}`;
      if (!summaryMap[key]) {
        summaryMap[key] = {
          plant,
          inventoryType,
          chargeType,
          openingAmount: 0,
          grossAmount: 0,
          receiptsTotal: 0,
          tds: 0,
          deduction: 0,
          balanceAmount: 0,
          invoices: [],
          openingInvoiceRows: [],
          periodInvoiceRows: [],
          receiptRows: [],
          tdsRows: [],
          deductionRows: [],
          closingRows: [],
        };
      }

      const invoiceDate = parseDate(inv.invoiceDate);
      const grossAmount = Number(inv.totals?.grossAmount || inv.grossAmount || 0);
      const invoiceNo = `${inv.invoiceNumber || inv.invoiceNo || inv.invoice || ''}`.trim().toUpperCase();
      const relevantReceipts = invoiceNo ? (receiptMap.get(invoiceNo) || []) : [];

      let openingGross = 0;
      let openingReceiptAmount = 0;
      let openingTds = 0;
      let openingDeduction = 0;
      let periodGross = 0;
      let periodReceiptAmount = 0;
      let periodTds = 0;
      let periodDeduction = 0;

      if (invoiceDate && filterFromDate) {
        const fromDateValue = parseDate(filterFromDate);
        const toDateValue = parseDate(filterToDate);

        if (fromDateValue && invoiceDate < fromDateValue) {
          openingGross = grossAmount;
        }
        if (fromDateValue && toDateValue && invoiceDate >= fromDateValue && invoiceDate <= toDateValue) {
          periodGross = grossAmount;
        }

        relevantReceipts.forEach(receipt => {
          const receiptDate = parseDate(receipt.paymentDate || receipt.receiptDate || receipt.postingDate || receipt.date || '');
          if (!receiptDate) return;

          const receiptAmount = Number(receipt.receiptAmount || 0);
          const receiptTds = Number(receipt.tds || 0);
          const receiptDeduction = Number(receipt.deduction || 0);

          if (fromDateValue && receiptDate < fromDateValue) {
            openingReceiptAmount += receiptAmount;
            openingTds += receiptTds;
            openingDeduction += receiptDeduction;
          }

          if (fromDateValue && toDateValue && receiptDate >= fromDateValue && receiptDate <= toDateValue) {
            periodReceiptAmount += receiptAmount;
            periodTds += receiptTds;
            periodDeduction += receiptDeduction;
          }
        });
      }

      const openingBalance = openingGross - openingReceiptAmount - openingTds - openingDeduction;
      const closingBalance = openingBalance + periodGross - periodReceiptAmount - periodTds - periodDeduction;

      summaryMap[key].openingAmount += openingBalance;
      summaryMap[key].grossAmount += periodGross;
      summaryMap[key].receiptsTotal += periodReceiptAmount;
      summaryMap[key].tds += periodTds;
      summaryMap[key].deduction += periodDeduction;
      summaryMap[key].balanceAmount = summaryMap[key].openingAmount + summaryMap[key].grossAmount - summaryMap[key].receiptsTotal - summaryMap[key].tds - summaryMap[key].deduction;
      summaryMap[key].invoices.push(inv);

      if (openingGross > 0 || openingReceiptAmount > 0 || openingTds > 0 || openingDeduction > 0) {
        summaryMap[key].openingInvoiceRows.push({
          plant,
          inventoryType,
          chargeType,
          invoiceNumber: inv.invoiceNumber || inv.invoiceNo || inv.invoice,
          invoiceDate: inv.invoiceDate,
          createdBy: getUserFullName(inv.createdBy || inv.createdByUser || inv.updatedBy || inv.updatedByUser || ''),
          openingGross,
          openingReceiptAmount,
          openingTds,
          openingDeduction,
          openingBalance,
        });
      }

      if (periodGross > 0) {
        summaryMap[key].periodInvoiceRows.push({
          plant,
          inventoryType,
          chargeType,
          invoiceNumber: inv.invoiceNumber || inv.invoiceNo || inv.invoice,
          invoiceDate: inv.invoiceDate,
          periodGross,
        });
      }

      relevantReceipts.forEach(receipt => {
        const receiptDate = parseDate(receipt.paymentDate || receipt.receiptDate || receipt.postingDate || receipt.date || '');
        if (!receiptDate || !filterFromDate || !filterToDate) return;
        const fromDateValue = parseDate(filterFromDate);
        const toDateValue = parseDate(filterToDate);
        if (!fromDateValue || !toDateValue) return;
        if (receiptDate >= fromDateValue && receiptDate <= toDateValue) {
          const receiptAmount = Number(receipt.receiptAmount || 0);
          const receiptTds = Number(receipt.tds || 0);
          const receiptDeduction = Number(receipt.deduction || 0);
          summaryMap[key].receiptRows.push({
            plant,
            inventoryType,
            chargeType,
            invoiceNumber: inv.invoiceNumber || inv.invoiceNo || inv.invoice,
            paymentDate: receipt.paymentDate,
            entryBy: getUserFullName(receipt.updatedBy || receipt.createdBy || receipt.entryBy || receipt.userId || receipt.userName || ''),
            receiptAmount,
            tds: receiptTds,
            deduction: receiptDeduction,
            paymentMode: receipt.paymentMode,
            bankingUtr: receipt.bankingUtr,
            paymentAdviceNo: receipt.paymentAdviceNo,
          });
          if (receiptTds > 0) {
            summaryMap[key].tdsRows.push({
              plant,
              inventoryType,
              chargeType,
              invoiceNumber: inv.invoiceNumber || inv.invoiceNo || inv.invoice,
              paymentDate: receipt.paymentDate,
              tds: receiptTds,
            });
          }
          if (receiptDeduction > 0) {
            summaryMap[key].deductionRows.push({
              plant,
              inventoryType,
              chargeType,
              invoiceNumber: inv.invoiceNumber || inv.invoiceNo || inv.invoice,
              paymentDate: receipt.paymentDate,
              deduction: receiptDeduction,
              deductionRemark: receipt.deductionRemark || '',
            });
          }
        }
      });

      summaryMap[key].closingRows.push({
        plant,
        inventoryType,
        chargeType,
        invoiceNumber: inv.invoiceNumber || inv.invoiceNo || inv.invoice,
        invoiceDate: inv.invoiceDate,
        openingBalance,
        periodGross,
        periodReceiptAmount,
        periodTds,
        periodDeduction,
        closingBalance,
      });
    });

    return Object.values(summaryMap);
  }, [filterChargeType, filterFromDate, filterInventoryType, filterToDate, invoices, receipts]);

  const sortedData = useMemo(() => {
    if (!sortConfig) return processedData;
    return [...processedData].sort((a, b) => {
      const aVal = a[sortConfig.key as keyof SummaryData];
      const bVal = b[sortConfig.key as keyof SummaryData];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortConfig.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return 0;
    });
  }, [processedData, sortConfig]);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig?.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortConfig?.key !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-20" />;
    return sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3 ml-1 text-blue-600" /> : <ChevronDown className="h-3 w-3 ml-1 text-blue-600" />;
  };

  const handleDrilldown = (row: SummaryData, type: PopupType) => {
    setPopupType(type);
    let data: any[] = [];

    switch (type) {
      case 'opening':
        setPopupTitle('Opening Amount Details');
        data = row.openingInvoiceRows;
        break;
      case 'invoice':
        setPopupTitle('Invoice Gross Amount Details');
        data = row.periodInvoiceRows;
        break;
      case 'receipt':
        setPopupTitle('Receipt Amount Details');
        data = row.receiptRows;
        break;
      case 'tds':
        setPopupTitle('TDS Details');
        data = row.tdsRows;
        break;
      case 'deduction':
        setPopupTitle('Deduction Details');
        data = row.deductionRows;
        break;
      case 'closing':
        setPopupTitle('Closing Balance Details');
        data = row.closingRows;
        break;
      default:
        data = [];
    }

    setPopupData(data);
  };

  const handleExport = (data: any[], title: string) => {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => `"${row[header] || ''}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${title.replace(/\s/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderPopup = () => {
    if (!popupType) return null;

    const headers = popupData.length > 0 ? Object.keys(popupData[0]) : [];

    return (
      <Dialog open={!!popupType} onOpenChange={(isOpen) => !isOpen && setPopupType(null)}>
        <DialogContent className="max-w-7xl h-[80vh] flex flex-col">
          <DialogHeader className="flex-row items-center justify-between">
            <DialogTitle>{popupTitle}</DialogTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => handleExport(popupData, popupTitle)}>
                <Download className="h-4 w-4 mr-2" />Export CSV
              </Button>
              <DialogClose asChild>
                <Button variant="ghost" size="icon"><X className="h-4 w-4" /></Button>
              </DialogClose>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {headers.map(h => <TableHead key={h}>{h.replace(/([A-Z])/g, ' $1').trim()}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {popupData.length === 0 ? (
                  <TableRow><TableCell colSpan={headers.length} className="text-center">No records found.</TableCell></TableRow>
                ) : popupData.map((row, idx) => (
                  <TableRow key={idx}>
                    {headers.map(h => <TableCell key={h}>{typeof row[h] === 'number' ? row[h].toFixed(2) : row[h]}</TableCell>)}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  if (!showReport) {
    return (
      <div className="w-full flex flex-col bg-white min-h-full select-text">
        <div className="sap-header-title">MB5B – Outstanding Ledger Report</div>
        <div className="bg-[#e7ebf1] border-b border-[#b5c7de] p-4 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 items-end">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase">Plant</label>
            <PlantMultiSelect plants={plants} selected={filterPlants} onChange={setFilterPlants} placeholder="Select Plants" />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase">Inventory Type</label>
            <Select value={filterInventoryType} onValueChange={setFilterInventoryType}>
              <SelectTrigger className="h-8 rounded-none border-gray-400 bg-white text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                <SelectItem value="Service Invoice">Service Invoice</SelectItem>
                <SelectItem value="Supply Invoice">Supply Invoice</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase">Charge Type</label>
            <Input value={filterChargeType} onChange={e => setFilterChargeType(e.target.value)} placeholder="e.g. Warehouse Rent" className="h-8 rounded-none border-gray-400 bg-white text-xs" />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase">Consignor Name</label>
            <Select value={filterConsignor} onValueChange={setFilterConsignor}>
              <SelectTrigger className="h-8 rounded-none border-gray-400 bg-white text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                {firms?.map(f => (
                  <SelectItem key={f.id} value={(f.firmId || f.consignorCode || f.id || '').toString()}>
                    {(f.consignorCode || f.firmId || f.id || '').toString()} - {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase">Bill to Party</label>
            <Select value={filterBillTo} onValueChange={setFilterBillTo}>
              <SelectTrigger className="h-8 rounded-none border-gray-400 bg-white text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                {customers?.map(c => (
                  <SelectItem key={c.id || c.customerId} value={c.customerId || c.id}>
                    {(c.customerId || c.id)} - {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase">From Date</label>
            <Input type="date" value={filterFromDate} onChange={e => setFilterFromDate(e.target.value)} className="h-8 rounded-none border-gray-400 bg-white text-xs" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase">To Date</label>
            <Input type="date" value={filterToDate} onChange={e => setFilterToDate(e.target.value)} className="h-8 rounded-none border-gray-400 bg-white text-xs" />
          </div>

          <div className="col-span-full flex justify-end">
            <Button onClick={handleExecute} className="h-8 rounded-none bg-blue-700 hover:bg-blue-800 text-sm font-bold gap-2 shadow-sm">
              <Search className="h-4 w-4" /> Execute
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col bg-white min-h-full select-text">
      <div className="sap-header-title flex justify-between items-center">
        <span>MB5B – Outstanding Ledger Report</span>
        <Button onClick={() => setShowReport(false)} variant="outline" size="sm">
          <Filter className="h-4 w-4 mr-2" /> Change Filters
        </Button>
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="text-center py-20 text-sm uppercase tracking-widest animate-pulse">Loading Report Data...</div>
        ) : sortedData.length === 0 ? (
          <div className="text-center py-20 text-sm font-bold text-gray-500 uppercase">No records found for the selected criteria.</div>
        ) : (
          <Table className="sap-alv-grid">
            <TableHeader className="sap-alv-header">
              <TableRow>
                <TableHead onClick={() => handleSort('plant')} className="cursor-pointer"><div className="flex items-center">Plant <SortIcon col="plant" /></div></TableHead>
                <TableHead onClick={() => handleSort('inventoryType')} className="cursor-pointer"><div className="flex items-center">Inventory Type <SortIcon col="inventoryType" /></div></TableHead>
                <TableHead onClick={() => handleSort('chargeType')} className="cursor-pointer"><div className="flex items-center">Charge Type <SortIcon col="chargeType" /></div></TableHead>
                <TableHead onClick={() => handleSort('openingAmount')} className="cursor-pointer text-right"><div className="flex items-center justify-end">Opening Amount <SortIcon col="openingAmount" /></div></TableHead>
                <TableHead onClick={() => handleSort('grossAmount')} className="cursor-pointer text-right"><div className="flex items-center justify-end">Invoice Gross Amount <SortIcon col="grossAmount" /></div></TableHead>
                <TableHead onClick={() => handleSort('receiptsTotal')} className="cursor-pointer text-right"><div className="flex items-center justify-end">Receipt Amount <SortIcon col="receiptsTotal" /></div></TableHead>
                <TableHead onClick={() => handleSort('tds')} className="cursor-pointer text-right"><div className="flex items-center justify-end">TDS <SortIcon col="tds" /></div></TableHead>
                <TableHead onClick={() => handleSort('deduction')} className="cursor-pointer text-right"><div className="flex items-center justify-end">Deduction <SortIcon col="deduction" /></div></TableHead>
                <TableHead onClick={() => handleSort('balanceAmount')} className="cursor-pointer text-right"><div className="flex items-center justify-end">Closing Balance <SortIcon col="balanceAmount" /></div></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.map((row, idx) => (
                <TableRow key={idx}>
                  <TableCell>{row.plant}</TableCell>
                  <TableCell>{row.inventoryType}</TableCell>
                  <TableCell>{row.chargeType}</TableCell>
                  <TableCell className="text-right font-mono">
                    <span className="cursor-pointer text-blue-600 hover:underline" onClick={() => handleDrilldown(row, 'opening')}>{row.openingAmount.toFixed(2)}</span>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    <span className="cursor-pointer text-blue-600 hover:underline" onClick={() => handleDrilldown(row, 'invoice')}>{row.grossAmount.toFixed(2)}</span>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    <span className="cursor-pointer text-blue-600 hover:underline" onClick={() => handleDrilldown(row, 'receipt')}>{row.receiptsTotal.toFixed(2)}</span>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    <span className="cursor-pointer text-blue-600 hover:underline" onClick={() => handleDrilldown(row, 'tds')}>{row.tds.toFixed(2)}</span>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    <span className="cursor-pointer text-blue-600 hover:underline" onClick={() => handleDrilldown(row, 'deduction')}>{row.deduction.toFixed(2)}</span>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    <span className="cursor-pointer text-blue-600 hover:underline" onClick={() => handleDrilldown(row, 'closing')}>{row.balanceAmount.toFixed(2)}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow className="bg-gray-100 font-bold">
                <TableCell colSpan={3}>Grand Total</TableCell>
                <TableCell className="text-right">{sortedData.reduce((sum, row) => sum + row.openingAmount, 0).toFixed(2)}</TableCell>
                <TableCell className="text-right">{sortedData.reduce((sum, row) => sum + row.grossAmount, 0).toFixed(2)}</TableCell>
                <TableCell className="text-right">{sortedData.reduce((sum, row) => sum + row.receiptsTotal, 0).toFixed(2)}</TableCell>
                <TableCell className="text-right">{sortedData.reduce((sum, row) => sum + row.tds, 0).toFixed(2)}</TableCell>
                <TableCell className="text-right">{sortedData.reduce((sum, row) => sum + row.deduction, 0).toFixed(2)}</TableCell>
                <TableCell className="text-right">{sortedData.reduce((sum, row) => sum + row.balanceAmount, 0).toFixed(2)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </div>
      {renderPopup()}
    </div>
  );
}