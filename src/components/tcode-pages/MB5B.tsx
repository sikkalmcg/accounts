"use client";

import { useState, useMemo, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDatabase, useCollection, useMemoDatabase } from "@/database"; // Assuming useDatabase returns a Firestore instance
import { collection, query, where, orderBy, getDocs } from "@/database/mongo"; // Added getDocs for fetching documents
import { Search, ArrowUpDown, ChevronUp, ChevronDown, Filter, Printer, Download, LayoutDashboard, Receipt, Wallet, ArrowRight, FileSpreadsheet, MinusCircle, PlusCircle, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Keep this for other selects
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import PlantMultiSelect from "./PlantMultiSelect";

type SummaryData = {
  inventoryType: string;
  documentType: string;
  chargeType: string;
  invoiceGrossAmount: number;
  receiptAmount: number;
  tds: number;
  deduction: number;
  balanceAmount: number;
  invoices: any[];
};

type PopupType = 'invoice' | 'receipt' | 'deduction' | null;

// Define a type for the selected plant from MultiSelect
export default function MB5B() {
  const db = useDatabase();

  const [filterPlants, setFilterPlants] = useState<string[]>([]);
  const [filterInventoryType, setFilterInventoryType] = useState("ALL");
  const [filterConsignor, setFilterConsignor] = useState("ALL");
  const [filterBillTo, setFilterBillTo] = useState("ALL");
  const [filterFromDate, setFilterFromDate] = useState("");
  const [filterToDate, setFilterToDate] = useState("");
  const [showReport, setShowReport] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  // 2. Data Fetching
  const { data: plants } = useCollection(useMemoDatabase(() => collection(db, "plants"), [db]));
  const { data: customers } = useCollection(useMemoDatabase(() => collection(db, "customers"), [db]));
  const { data: firms } = useCollection(useMemoDatabase(() => collection(db, "firms"), [db]));

  const [invoices, setInvoices] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 3. Popup State
  const [popupData, setPopupData] = useState<any[]>([]);
  const [popupType, setPopupType] = useState<PopupType>(null);
  const [popupTitle, setPopupTitle] = useState("");

  const handleExecute = async () => {
    if (filterPlants.length === 0 || !filterFromDate || !filterToDate) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Please select Plant, From Date, and To Date.", isError: true } }));
      return;
    }
    setIsLoading(true);
    setShowReport(true); // This should be set after data is fetched and processed, or conditionally rendered.

    // Corrected fetching logic using getDocs
    const plantIds = filterPlants;
    const q = query(collection(db, "sales_invoices"), where("plantId", "in", plantIds), where("invoiceDate", ">=", filterFromDate), where("invoiceDate", "<=", filterToDate));
    const invoiceSnapshot = await getDocs(q);
    const invoiceData = invoiceSnapshot.docs.map(doc => doc.data());

    let filteredInvoices = invoiceData;

    if (filterInventoryType !== "ALL") {
      filteredInvoices = filteredInvoices.filter(inv => inv.inventoryType === filterInventoryType);
    }

    if (filterConsignor !== "ALL") {
      filteredInvoices = filteredInvoices.filter(inv => {
        const invoiceConsignorKey = [inv.consignorCode, inv.firmId, inv.consignorId, inv.consignorName]
          .filter(Boolean)
          .map((v: any) => String(v).trim().toUpperCase())[0] || "";
        return invoiceConsignorKey === filterConsignor.toUpperCase();
      });
    }

    if (filterBillTo !== "ALL") {
      filteredInvoices = filteredInvoices.filter(inv => {
        const billToValues = [inv.billTo, inv.customerCode, inv.customerId, inv.billToParty, inv.billToCode]
          .filter(Boolean)
          .map((value: any) => String(value).trim().toUpperCase());
        return billToValues.includes(filterBillTo.toUpperCase());
      });
    }

    setInvoices(filteredInvoices);

    const invoiceNumbers = filteredInvoices.map(inv => inv.invoiceNumber);
    if (invoiceNumbers.length > 0) {
      const receiptQuery = query(collection(db, "payment_receipts"), where("invoiceNo", "in", invoiceNumbers));
      const receiptSnapshot = await getDocs(receiptQuery);
      const receiptData = receiptSnapshot.docs.map(doc => doc.data());
      setReceipts(receiptData || []);
    } else {
      setReceipts([]);
    }

    setIsLoading(false);
  };

  const processedData = useMemo<SummaryData[]>(() => {
    const summaryMap: Record<string, SummaryData> = {};

    invoices.forEach(inv => {
      const inventoryType = inv.inventoryType || 'N/A';
      const documentType = inv.docType || 'N/A';
      const chargeType = inv.docCategory || 'N/A';
      const key = `${inventoryType}-${documentType}-${chargeType}`;

      if (!summaryMap[key]) {
        summaryMap[key] = {
          inventoryType,
          documentType,
          chargeType,
          invoiceGrossAmount: 0,
          receiptAmount: 0,
          tds: 0,
          deduction: 0,
          balanceAmount: 0,
          invoices: [],
        };
      }

      const grossAmount = inv.totals?.grossAmount || 0;
      summaryMap[key].invoiceGrossAmount += grossAmount;
      summaryMap[key].invoices.push(inv);
    });

    receipts.forEach(r => {
      const inv = invoices.find(i => i.invoiceNumber === r.invoiceNo);
      if (inv) {
        const inventoryType = inv.inventoryType || 'N/A';
        const documentType = inv.docType || 'N/A';
        const chargeType = inv.docCategory || 'N/A';
        const key = `${inventoryType}-${documentType}-${chargeType}`;

        if (summaryMap[key]) {
            const receiptAmount = Number(r.receiptAmount) || 0;
            const tds = Number(r.tds) || 0;
            const deduction = Number(r.deduction) || 0;

            if (r.status !== "Reversed") {
                summaryMap[key].receiptAmount += receiptAmount;
                summaryMap[key].tds += tds;
                summaryMap[key].deduction += deduction;
            }
        }
      }
    });

    Object.values(summaryMap).forEach(summary => {
      summary.balanceAmount = summary.invoiceGrossAmount - summary.receiptAmount - summary.tds - summary.deduction;
    });

    return Object.values(summaryMap);
  }, [invoices, receipts]);

  const sortedData = useMemo(() => {
    if (!sortConfig) return processedData;
    return [...processedData].sort((a, b) => {
      const aVal = a[sortConfig.key as keyof SummaryData];
      const bVal = b[sortConfig.key as keyof SummaryData];
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
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
    const invoiceNumbers = row.invoices.map(i => i.invoiceNumber);
    const relatedReceipts = receipts.filter(r => invoiceNumbers.includes(r.invoiceNo) && r.status !== "Reversed");

    switch (type) {
      case 'invoice':
        setPopupTitle("Invoice Gross Amount Details");
        data = row.invoices.map(inv => ({
          plantId: inv.plantId,
          invoiceNumber: inv.invoiceNumber,
          invoiceDate: inv.invoiceDate,
          chargeType: inv.docCategory,
          taxableAmount: inv.totals?.taxableAmount || 0,
          cgst: inv.totals?.cgst || 0,
          sgst: inv.totals?.sgst || 0,
          igst: inv.totals?.igst || 0,
          grossAmount: inv.totals?.grossAmount || 0,
          createdBy: inv.createdBy, // Assuming this field exists
        }));
        break;
      case 'receipt':
        setPopupTitle("Receipt Amount Details");
        data = row.invoices.map(inv => {
            const invReceipts = relatedReceipts.filter(r => r.invoiceNo === inv.invoiceNumber);
            const receiptAmount = invReceipts.reduce((sum, r) => sum + Number(r.receiptAmount || 0), 0);
            const tds = invReceipts.reduce((sum, r) => sum + Number(r.tds || 0), 0);
            const deduction = invReceipts.reduce((sum, r) => sum + Number(r.deduction || 0), 0);
            const paymentDate = invReceipts[0]?.paymentDate || '';
            const paymentEntryBy = invReceipts[0]?.updatedBy || invReceipts[0]?.createdBy || ''; // Logic for last user
            const balanceAmount = (inv.totals?.grossAmount || 0) - receiptAmount - tds - deduction;

            return {
                plantId: inv.plantId,
                invoiceNumber: inv.invoiceNumber,
                invoiceDate: inv.invoiceDate,
                chargeType: inv.docCategory,
                grossAmount: inv.totals?.grossAmount || 0,
                receiptAmount,
                tds,
                deduction,
                paymentDate,
                balanceAmount,
                paymentEntryBy,
            };
        });
        break;
      case 'deduction':
        setPopupTitle("Deduction Details");
        data = relatedReceipts
            .filter(r => (Number(r.deduction) || 0) > 0)
            .map(r => {
                const inv = row.invoices.find(i => i.invoiceNumber === r.invoiceNo);
                return {
                    plantId: inv?.plantId,
                    invoiceNumber: r.invoiceNo,
                    invoiceDate: inv?.invoiceDate,
                    chargeType: inv?.docCategory,
                    deductionAmount: Number(r.deduction) || 0,
                    deductionRemark: r.deductionRemark || '',
                    paymentDate: r.paymentDate,
                    paymentEntryBy: r.updatedBy || r.createdBy,
                };
            });
        break;
    }
    setPopupData(data);
  };

  const handleExport = (data: any[], title: string) => {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(","),
      ...data.map(row => headers.map(header => `"${row[header] || ''}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${title.replace(/\s/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
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
                        <Button variant="outline" size="sm" onClick={() => handleExport(popupData, popupTitle)}><Download className="h-4 w-4 mr-2" />Export CSV</Button>
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
        <div className="sap-header-title">MB5B – Payment Summary Report</div>
        <div className="bg-[#e7ebf1] border-b border-[#b5c7de] p-4 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 items-end">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase">Plant</label>
            <PlantMultiSelect
              plants={plants}
              selected={filterPlants}
              onChange={setFilterPlants}
              placeholder="Select Plants"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase">Inventory Type</label>
            <Select value={filterInventoryType} onValueChange={setFilterInventoryType}>
              <SelectTrigger className="h-8 rounded-none border-gray-400 bg-white text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
            <SelectItem value="Service Invoice">Service Invoice</SelectItem>
            <SelectItem value="Supply Invoice">Supply Invoice</SelectItem>
            <SelectItem value="Credit Note">Credit Note</SelectItem>
            <SelectItem value="Debit Note">Debit Note</SelectItem>
            <SelectItem value="Delivery Challan">Delivery Challan</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <label className="text-[10px] font-bold text-gray-500 uppercase">Consignor Name</label>
        <Select value={filterConsignor} onValueChange={setFilterConsignor}>
          <SelectTrigger className="h-8 rounded-none border-gray-400 bg-white text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All</SelectItem>
            {firms?.map(f => (
              <SelectItem key={f.id} value={(f.firmId || f.consignorCode || f.id || "").toString()}>
                {f.name}
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
                {customers?.map(c => <SelectItem key={c.id} value={c.customerId}>{c.name}</SelectItem>)}
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
        <span>MB5B – Payment Summary Report</span>
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
                <TableHead onClick={() => handleSort('inventoryType')} className="cursor-pointer"><div className="flex items-center">Inventory Type <SortIcon col="inventoryType" /></div></TableHead>
                <TableHead onClick={() => handleSort('documentType')} className="cursor-pointer"><div className="flex items-center">Document Type <SortIcon col="documentType" /></div></TableHead>
                <TableHead onClick={() => handleSort('chargeType')} className="cursor-pointer"><div className="flex items-center">Charge Type <SortIcon col="chargeType" /></div></TableHead>
                <TableHead onClick={() => handleSort('invoiceGrossAmount')} className="cursor-pointer text-right"><div className="flex items-center justify-end">Invoice Gross Amount <SortIcon col="invoiceGrossAmount" /></div></TableHead>
                <TableHead onClick={() => handleSort('receiptAmount')} className="cursor-pointer text-right"><div className="flex items-center justify-end">Receipt Amount <SortIcon col="receiptAmount" /></div></TableHead>
                <TableHead onClick={() => handleSort('tds')} className="cursor-pointer text-right"><div className="flex items-center justify-end">TDS <SortIcon col="tds" /></div></TableHead>
                <TableHead onClick={() => handleSort('deduction')} className="cursor-pointer text-right"><div className="flex items-center justify-end">Deduction <SortIcon col="deduction" /></div></TableHead>
                <TableHead onClick={() => handleSort('balanceAmount')} className="cursor-pointer text-right"><div className="flex items-center justify-end">Balance Amount <SortIcon col="balanceAmount" /></div></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.map((row, idx) => (
                <TableRow key={idx}>
                  <TableCell>{row.inventoryType}</TableCell>
                  <TableCell>{row.documentType}</TableCell>
                  <TableCell>{row.chargeType}</TableCell>
                  <TableCell className="text-right font-mono">
                    <span className="cursor-pointer text-blue-600 hover:underline" onClick={() => handleDrilldown(row, 'invoice')}>
                      {row.invoiceGrossAmount.toFixed(2)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                     <span className="cursor-pointer text-blue-600 hover:underline" onClick={() => handleDrilldown(row, 'receipt')}>
                        {row.receiptAmount.toFixed(2)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono">{row.tds.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono">
                    <span className="cursor-pointer text-blue-600 hover:underline" onClick={() => handleDrilldown(row, 'deduction')}>
                        {row.deduction.toFixed(2)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono">{row.balanceAmount.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
      {renderPopup()}
    </div>
  );
}