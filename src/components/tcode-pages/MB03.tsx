"use client";

import { useState, useMemo, useEffect, lazy, Suspense } from "react";
import { format, startOfQuarter, parse, isValid } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCollection, useMemoDatabase } from "@/database";
import { collection } from "@/database/mongo";
import { ArrowUpDown, ChevronUp, ChevronDown, Download, Receipt, Wallet, ArrowRight, MinusCircle, PlusCircle, Eye, X, Calendar as CalendarIcon, Printer } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import Image from "next/image";
import PlantMultiSelect from "./PlantMultiSelect"; // Import PlantMultiSelect
import { getRecordPlantIds, NO_MASTER_RECORDS_MESSAGE } from "@/lib/plant-master";
import { formatAmount } from "@/lib/number-utils";
import { InvoicePreview } from "./VF03";

// Dynamically import PaymentProofViewer with SSR disabled
const PaymentProofViewer = lazy(() => import("./PaymentProofViewer"));

// Helper function to safely parse dates (DD-MMM-YYYY or ISO) into Date object
const parseFlexibleDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;

  // Try standard DD-MMM-YYYY (e.g. 10-Jun-2026)
  let parsed = parse(dateStr, "dd-MMM-yyyy", new Date());
  if (isValid(parsed)) return parsed;

  // Try lowercase/uppercase month variation
  const formattedStr = dateStr.replace(/-([a-zA-Z]{3})-/, (match, p1) => {
    return `-${p1.charAt(0).toUpperCase()}${p1.slice(1).toLowerCase()}-`;
  });
  parsed = parse(formattedStr, "dd-MMM-yyyy", new Date());
  if (isValid(parsed)) return parsed;

  // Try YYYY-MM-DD
  parsed = parse(dateStr, "yyyy-MM-dd", new Date());
  if (isValid(parsed)) return parsed;

  return null;
};

// Formats Date object or string into system standard DD-MMM-YYYY
const formatSystemDate = (dateVal: Date | string | null): string => {
  if (!dateVal) return "";
  if (typeof dateVal === "string") {
    const d = parseFlexibleDate(dateVal);
    return d ? format(d, "dd-MMM-yyyy") : dateVal;
  }
  return isValid(dateVal) ? format(dateVal, "dd-MMM-yyyy") : "";
};

// Helper function to safely normalize invoice dates into YYYY-MM-DD for comparison
const parseInvoiceDateToISO = (dateStr: string): string | null => {
  if (!dateStr) return null;
  const parsed = parseFlexibleDate(dateStr);
  return parsed ? format(parsed, "yyyy-MM-dd") : null;
};

// Helper function to get the start of the current financial year (April 1st)
const getFinancialYearStartDate = (date: Date): Date => {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed (April is 3)

  // If month is April (3) or later, FY started this year.
  // If month is Jan-Mar (0-2), FY started last year.
  const financialYearStartYear = month >= 3 ? year : year - 1;
  
  return new Date(financialYearStartYear, 3, 1); // April 1st
};

const normalizeKey = (value: unknown): string => (value ?? "").toString().trim().toUpperCase();

export default function MB03() {
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);

  // 1. User Context & Permissions
  const [assignedPlantId, setAssignedPlantId] = useState("");
  const [assignedPlantIds, setAssignedPlantIds] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("sikka_user");
    if (stored) {
      const parsed = JSON.parse(stored);
      setIsAdmin(parsed.username === "ajaysomra" || parsed.role === 'admin');
      setAssignedPlantId(parsed.assignedPlantId || "");
      setAssignedPlantIds(Array.isArray(parsed.assignedPlantIds) ? parsed.assignedPlantIds : []);
    }
  }, []);

  // 2. Filter State
  const [filterPlant, setFilterPlant] = useState<string[]>([]); // Initialize as empty array for multi-select
  const [filterBillTo, setFilterBillTo] = useState("ALL");
  const [filterConsignor, setFilterConsignor] = useState("ALL");

  // Date states formatted as DD-MMM-YYYY
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState(format(new Date(), "dd-MMM-yyyy"));
  
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

    const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    const content = document.getElementById('invoice-print-area')?.innerHTML;
    if (printWindow && content) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Print Invoice - SIKKA LMC</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
              @page { size: A4 portrait; margin: 0; }
              @media print {
                body { padding: 0; margin: 0; background: white; -webkit-print-color-adjust: exact; }
                .no-print { display: none; }
                .page-break { page-break-after: always; }
                #invoice-print-area { width: 100% !important; max-width: none !important; margin: 0 !important; padding: 0 !important; }
                .invoice-container { margin: 0 !important; border-top: none !important; border-left: none !important; border-right: none !important; border-bottom: none !important; }
                .watermark-text { opacity: 0.1 !important; color: #dc2626 !important; }
              }
              body { font-family: 'Inter', sans-serif; }
              table { width: 100%; border-collapse: collapse; }
              th, td { border: 1px solid #000; padding: 4px 6px; }
            </style>
          </head>
          <body onload="window.print(); window.close();">
            <div id="invoice-print-area">${content}</div>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  // 3. Default Date Range: First day of current financial year -> Today
  useEffect(() => {
    const now = new Date();
    const finYearStart = getFinancialYearStartDate(now);
    setFromDate(format(finYearStart, "dd-MMM-yyyy"));
  }, []);

  // 4. Master Data Queries
  const plantsQuery = useMemoDatabase(() => collection(null as any, "plants"), []);
  const { data: plants } = useCollection(plantsQuery);

  const customersQuery = useMemoDatabase(() => collection(null as any, "customers"), []);
  const { data: customers } = useCollection(customersQuery);

  const firmsQuery = useMemoDatabase(() => collection(null as any, "firms"), []);
  const { data: firms } = useCollection(firmsQuery);

  const [allInvoices, setAllInvoices] = useState<any[]>([]);
  const [isInvoicesLoading, setIsInvoicesLoading] = useState(false);

  // 5. Derived Logic
  const filteredPlants = useMemo(() => {
    if (isAdmin) return plants || []; // If admin, all plants are available for selection
    return plants?.filter(p => assignedPlantIds.includes(p.plantId)) || [];
  }, [plants, isAdmin, assignedPlantIds]);

  // Customers assigned to the currently selected Plant
  const filteredCustomers = useMemo(() => {
    if (!customers) return [];
    if (filterPlant.includes("ALL")) return customers;
    return customers.filter(c => filterPlant.some(p => getRecordPlantIds(c).includes(p)));
  }, [customers, filterPlant]);

  // Firms/Consignors assigned to the currently selected Plant
  const filteredFirms = useMemo(() => {
    if (!firms) return [];
    if (filterPlant.includes("ALL")) return firms;
    return firms.filter(f => filterPlant.some(p => getRecordPlantIds(f).includes(p)));
  }, [firms, filterPlant]);

  const customerMap = useMemo(() => {
    const map: Record<string, any> = {};
    customers?.forEach(c => {
      const aliases = [c.customerId, c.code, c.id, c.customerCode].filter(Boolean);
      aliases.forEach(alias => {
        const key = normalizeKey(alias);
        if (key) map[key] = c;
      });
    });
    return map;
  }, [customers]);

  const firmMap = useMemo(() => {
    const map: Record<string, any> = {};
    firms?.forEach(f => {
      const ids = Array.isArray(f.assignedPlantIds) && f.assignedPlantIds.length > 0
        ? f.assignedPlantIds
        : (f.plantId ? [f.plantId] : []);
      ids.forEach((id: string) => { map[id] = f; });
    });
    return map;
  }, [firms]);

  const consignorPlantMap = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    firms?.forEach(f => {
      const firmKey = f.firmId || f.consignorCode || f.id;
      const ids = Array.isArray(f.assignedPlantIds) && f.assignedPlantIds.length > 0
        ? f.assignedPlantIds
        : (f.plantId ? [f.plantId] : []);
      if (!map[firmKey]) map[firmKey] = new Set();
      ids.forEach((id: string) => map[firmKey].add(id));
    });
    return map;
  }, [firms]);

  useEffect(() => {
    const loadCompletedPayments = async () => {
      setIsInvoicesLoading(true);
      try {
        // Validate Mandatory Filters before making API call
        if (filterPlant.length === 0) {
          window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Error: At least one Plant must be selected", isError: true } }));
          setIsInvoicesLoading(false);
          return;
        }
        const params = new URLSearchParams();
        if (filterPlant.length > 0) params.set('plantIds', filterPlant.join(','));
        
        const fromISO = parseInvoiceDateToISO(fromDate);
        const toISO = parseInvoiceDateToISO(toDate);

        if (fromISO) params.set('fromDate', fromISO);
        if (toISO) params.set('toDate', toISO);
        if (filterBillTo !== 'ALL') params.set('billTo', filterBillTo);
        if (filterConsignor !== 'ALL') params.set('consignor', filterConsignor);

        const response = await fetch(`/api/payment-complete?${params.toString()}`);
        if (!response.ok) throw new Error('Unable to load completed-payment data');
        const data = await response.json();
        setAllInvoices(Array.isArray(data?.rows) ? data.rows : (Array.isArray(data) ? data : []));
      } catch (error) {
        console.error('MB03 fetch failed', error);
        setAllInvoices([]);
      } finally {
        setIsInvoicesLoading(false);
      }
    };

    loadCompletedPayments();
  }, [filterPlant, filterBillTo, filterConsignor, fromDate, toDate]);

  // Main Processing Logic
  const processedData = useMemo(() => {
    if (!allInvoices) return [];

    const fromISO = parseInvoiceDateToISO(fromDate);
    const toISO = parseInvoiceDateToISO(toDate);

    let base = allInvoices.filter(inv => {
      // Plant filtering is handled by the API call based on filterPlant state.
      // No need for client-side plant filtering here if API already filters.
      if (inv.status === "Cancelled") return false; // Always filter out cancelled invoices
      
      // Bill-To Filter
      if (filterBillTo !== "ALL") {
        const billToValues = [
          inv.billTo,
          inv.customerCode,
          inv.customerId,
          inv.billToParty,
          inv.billToCode,
        ].filter(Boolean).map(value => normalizeKey(value));
        if (!billToValues.includes(normalizeKey(filterBillTo))) return false;
      }

      // Consignor Filter
      if (filterConsignor !== "ALL") {
        const plantsOfConsignor = consignorPlantMap[filterConsignor] || new Set();
        if (!plantsOfConsignor.has(inv.plantId)) return false;
      }

      // Safe Date Range Filtering
      if (fromISO || toISO) {
        const invISO = parseInvoiceDateToISO(inv.invoiceDate);
        if (invISO) {
          if (fromISO && invISO < fromISO) return false;
          if (toISO && invISO > toISO) return false;
        }
      }

      return true;
    });

    return base.map(inv => {
      const receipt = {
        receiptAmount: inv.receiptAmount || 0,
        tds: inv.tdsAmount || 0,
        deduction: inv.deductionAmount || 0,
        interest: inv.interestAmount || 0,
        deductionRemark: inv.deductionRemark || "",
        paymentDate: inv.paymentDate || "",
        paymentAdviceNo: inv.paymentAdviceNo || "",
        bankingUtr: inv.bankingUtr || "",
        proofData: inv.proofData || null,
        paymentMode: inv.paymentMode || "",
      };
      const gross = inv.totals?.grossAmount || inv.grossAmount || 0;
      const totalCollection = (receipt.receiptAmount || 0) + (receipt.tds || 0) + (receipt.deduction || 0);
      const firm = firmMap[inv.plantId];
      
      const billToCandidates = [
        inv.billTo,
        inv.customerCode,
        inv.customerId,
        inv.billToParty,
        inv.billToCode,
      ].filter(Boolean);
      const billToKey = billToCandidates.map(value => normalizeKey(value)).find(Boolean) || "";
      const consignee = customerMap[billToKey] || customerMap[normalizeKey(inv.customerId)] || customerMap[normalizeKey(inv.customerCode)] || customerMap[normalizeKey(inv.billTo)] || customerMap[normalizeKey(inv.billToParty)];

      return {
        ...inv,
        invoiceNumber: inv.invoiceNumber || inv.invoiceNo,
        invoiceDate: formatSystemDate(inv.invoiceDate),
        receiptAmount: receipt.receiptAmount,
        tdsAmount: receipt.tds,
        deductionAmount: receipt.deduction,
        interestAmount: receipt.interest,
        deductionRemark: receipt.deductionRemark,
        paymentDate: formatSystemDate(receipt.paymentDate),
        paymentAdviceNo: receipt.paymentAdviceNo,
        bankingUtr: receipt.bankingUtr,
        proofData: receipt.proofData,
        paymentMode: receipt.paymentMode,
        balanceAmount: gross - totalCollection,
        consignorName: firm?.name || "N/A",
        consignorGstin: firm?.gstin || "N/A",
        billToCode: consignee?.customerId || consignee?.code || consignee?.id || billToCandidates[0] || "N/A",
        billToName: consignee?.name || inv.billToName || inv.customerName || billToCandidates[0] || "N/A",
        billToGstin: consignee?.gstin || "N/A",
      };
    });
  }, [allInvoices, isAdmin, assignedPlantIds, filterPlant, filterBillTo, filterConsignor, fromDate, toDate, consignorPlantMap, firmMap, customerMap]);

  // Summary Calculation
  const summary = useMemo(() => {
    return processedData.reduce(
      (acc, curr) => ({
        total: acc.total + (curr.totals?.grossAmount || curr.grossAmount || 0),
        receipt: acc.receipt + (curr.receiptAmount || 0),
        tds: acc.tds + (curr.tdsAmount || 0),
        deduction: acc.deduction + (curr.deductionAmount || 0),
        interest: acc.interest + (curr.interestAmount || 0),
        collected:
          acc.collected +
          (curr.receiptAmount || 0) +
          (curr.tdsAmount || 0) +
          (curr.deductionAmount || 0),
        balance: acc.balance + (curr.balanceAmount || 0),
      }),
      { total: 0, receipt: 0, tds: 0, deduction: 0, interest: 0, collected: 0, balance: 0 }
    );
  }, [processedData]);

  // Sorting Logic
  const sortedData = useMemo(() => {
    if (!sortConfig) return processedData;
    return [...processedData].sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];
      if (sortConfig.key.includes("totals.")) {
        const key = sortConfig.key.split(".")[1];
        aVal = a.totals?.[key] || 0;
        bVal = b.totals?.[key] || 0;
      }
      if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [processedData, sortConfig]);

  const SortIcon = ({ col }: { col: string }) => {
    if (sortConfig?.key !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-20" />;
    return sortConfig.direction === "asc" ? (
      <ChevronUp className="h-3 w-3 ml-1 text-blue-600" />
    ) : (
      <ChevronDown className="h-3 w-3 ml-1 text-blue-600" />
    );
  };

  const handleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig?.key === key && sortConfig.direction === "asc") direction = "desc";
    setSortConfig({ key, direction });
  };

  const handleExport = () => {
    if (sortedData.length === 0) return;
    const csvContent = [
      [
        "#", "Plant", "Invoice No", "Consignor", "Bill-to Party Name", "Invoice Date", "Working Month", "Doc Type", "Charge Type",
        "Taxable Amt", "CGST", "SGST", "IGST",
        "Gross Amount", "Receipt Amt", "TDS Amt", "Interest Amt", "Deduction Amt",
        "Deduction Remark", "Payment Date", "Bank UTR", "Payment Advice", "Balance",
      ].join(","),
      ...sortedData.map((row, idx) =>
        [
          idx + 1,
          row.plantId,
          row.invoiceNumber,
          `"${row.consignorName}"`,
          `"${row.billToName}"`,
          row.invoiceDate,
          row.billMonth || "",
          row.docType || "",
          row.docCategory || "",
          row.totals?.taxableAmount || 0,
          row.totals?.cgst || 0,
          row.totals?.sgst || 0,
          row.totals?.igst || 0,
          row.totals?.grossAmount || row.grossAmount || 0,
          row.receiptAmount || 0,
          row.tdsAmount || 0,
          row.interestAmount || 0,
          row.deductionAmount || 0,
          `"${row.deductionRemark || ""}"`,
          row.paymentDate || "",
          row.bankingUtr || "",
          row.paymentAdviceNo || "",
          row.balanceAmount || 0,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `MB03_Payment_Record_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full flex flex-col bg-white min-h-full select-text">
      <div className="sap-header-title">MB03 - Payment Record Display</div>

      {/* Filter Section (Re-ordered: Plant -> Consignor -> Bill-to Party Name -> From Date -> To Date) */}
      <div className="bg-[#e7ebf1] border-b border-[#b5c7de] p-3 grid grid-cols-5 gap-4 items-end">
        
        {/* 1. Plant */}
        <div className="space-y-1 col-span-1">
          <label className="text-[10px] font-bold text-gray-500 uppercase">Plant</label>
          <PlantMultiSelect
            plants={filteredPlants} // Use filteredPlants (authorized plants) as options
            selected={filterPlant}
            onChange={setFilterPlant}
            placeholder="Select Plant(s)..."
          />
        </div>

        {/* 2. Consignor (Moved immediately to the left of Bill-to Party Name) */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-gray-500 uppercase">Consignor</label>
          <Select value={filterConsignor} onValueChange={setFilterConsignor}>
            <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Consignors</SelectItem>
              {filteredFirms.map(f => (
                <SelectItem key={f.id} value={f.firmId || f.consignorCode || f.id}>
                  {f.name}
                </SelectItem>
              ))}
              {filteredFirms.length === 0 && (
                <div className="px-2 py-3 text-center text-[10px] font-bold text-red-500">{NO_MASTER_RECORDS_MESSAGE}</div>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* 3. Bill-to Party Name */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-gray-500 uppercase">Bill-to Party Name</label>
          <Select value={filterBillTo} onValueChange={setFilterBillTo}>
            <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Parties</SelectItem>
              {filteredCustomers.map(c => {
                const code = c.customerId || c.code || c.id;
                return (
                  <SelectItem key={c.id || code} value={code}>
                    {code} - {c.name}
                  </SelectItem>
                );
              })}
              {filteredCustomers.length === 0 && (
                <div className="px-2 py-3 text-center text-[10px] font-bold text-red-500">{NO_MASTER_RECORDS_MESSAGE}</div>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* 4. From Date (Manual Entry + Calendar Picker in DD-MMM-YYYY format) */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-gray-500 uppercase">From Date</label>
          <div className="relative flex items-center">
            <Input
              type="text"
              placeholder="DD-MMM-YYYY"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 pr-7 focus:bg-[#fff9c4] font-mono"
            />
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" className="h-5 w-5 p-0 absolute right-0.5 hover:bg-transparent text-gray-500">
                  <CalendarIcon className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 rounded-none border-gray-400" align="end">
                <Calendar
                  mode="single"
                  selected={parseFlexibleDate(fromDate) || undefined}
                  onSelect={(date) => {
                    if (date) setFromDate(format(date, "dd-MMM-yyyy"));
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* 5. To Date (Manual Entry + Calendar Picker in DD-MMM-YYYY format) */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-gray-500 uppercase">To Date</label>
          <div className="relative flex items-center">
            <Input
              type="text"
              placeholder="DD-MMM-YYYY"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 pr-7 focus:bg-[#fff9c4] font-mono"
            />
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" className="h-5 w-5 p-0 absolute right-0.5 hover:bg-transparent text-gray-500">
                  <CalendarIcon className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 rounded-none border-gray-400" align="end">
                <Calendar
                  mode="single"
                  selected={parseFlexibleDate(toDate) || undefined}
                  onSelect={(date) => {
                    if (date) setToDate(format(date, "dd-MMM-yyyy"));
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

      </div>

      {/* Summary Cards */}
      <div className="p-4 grid grid-cols-6 gap-4">
        <div className="bg-white border border-gray-200 rounded-sm shadow-sm p-4 flex items-center gap-4 group hover:border-blue-300 transition-colors">
          <div className="bg-blue-50 p-3 rounded-full group-hover:bg-blue-100 transition-colors">
            <Receipt className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Total Invoice Amount</p>
            <p className="text-xl font-black text-gray-800 font-mono">₹ {formatAmount(summary.total)}</p>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-sm shadow-sm p-4 flex items-center gap-4 group hover:border-emerald-300 transition-colors">
          <div className="bg-emerald-50 p-3 rounded-full group-hover:bg-emerald-100 transition-colors">
            <Wallet className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Total Receipt Amount</p>
            <p className="text-xl font-black text-emerald-700 font-mono">₹ {formatAmount(summary.receipt)}</p>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-sm shadow-sm p-4 flex items-center gap-4 group hover:border-orange-300 transition-colors">
          <div className="bg-orange-50 p-3 rounded-full group-hover:bg-orange-100 transition-colors">
            <MinusCircle className="h-6 w-6 text-orange-600" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Total TDS Amount</p>
            <p className="text-xl font-black text-orange-700 font-mono">₹ {formatAmount(summary.tds)}</p>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-sm shadow-sm p-4 flex items-center gap-4 group hover:border-purple-300 transition-colors">
          <div className="bg-purple-50 p-3 rounded-full group-hover:bg-purple-100 transition-colors">
            <PlusCircle className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Total Deduction Amount</p>
            <p className="text-xl font-black text-purple-700 font-mono">₹ {formatAmount(summary.deduction)}</p>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-sm shadow-sm p-4 flex items-center gap-4 group hover:border-amber-300 transition-colors">
          <div className="bg-amber-50 p-3 rounded-full group-hover:bg-amber-100 transition-colors">
            <PlusCircle className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Total Interest Amount</p>
            <p className="text-xl font-black text-amber-700 font-mono">₹ {formatAmount(summary.interest)}</p>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-sm shadow-sm p-4 flex items-center gap-4 group hover:border-red-300 transition-colors">
          <div className="bg-red-50 p-3 rounded-full group-hover:bg-red-100 transition-colors">
            <ArrowRight className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Total Balance Amount</p>
            <p className="text-xl font-black text-red-700 font-mono">₹ {formatAmount(summary.balance)}</p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-[#dae8f5] px-4 py-1.5 border-y border-gray-300 flex items-center justify-between shadow-sm">
        <h3 className="text-[11px] font-black text-blue-900 uppercase tracking-widest">
          Payment Records (ALV Grid)
        </h3>
        <div className="flex gap-2">
          <Button
            onClick={handleExport}
            variant="outline"
            className="h-6 rounded-none bg-white border-gray-400 text-emerald-700 text-[10px] font-bold uppercase gap-1.5 shadow-sm hover:bg-emerald-50"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
        </div>
      </div>

      {/* ALV Grid */}
      <div className="flex-1 overflow-auto bg-white no-scrollbar">
        <Table className="min-w-[3000px] sap-alv-grid">
          <TableHeader className="sap-alv-header">
            <TableRow className="h-8 border-b-[#b5c7de]">
              <TableHead className="w-10 text-center text-[10px] font-bold border-r border-[#b5c7de]">#</TableHead>
              <TableHead
                onClick={() => handleSort("plantId")}
                className="w-24 text-[10px] font-bold border-r border-[#b5c7de] cursor-pointer hover:bg-gray-200"
              >
                <div className="flex items-center">
                  Plant <SortIcon col="plantId" />
                </div>
              </TableHead>
              <TableHead
                onClick={() => handleSort("invoiceNumber")}
                className="w-40 text-[10px] font-bold border-r border-[#b5c7de] cursor-pointer hover:bg-gray-200"
              >
                <div className="flex items-center">
                  Invoice No <SortIcon col="invoiceNumber" />
                </div>
              </TableHead>
              <TableHead
                onClick={() => handleSort("invoiceDate")}
                className="w-32 text-[10px] font-bold border-r border-[#b5c7de] cursor-pointer hover:bg-gray-200"
              >
                <div className="flex items-center">
                  Inv. Date <SortIcon col="invoiceDate" />
                </div>
              </TableHead>
              <TableHead className="w-44 text-[10px] font-bold border-r border-[#b5c7de]">
                Consignor
              </TableHead>
              <TableHead className="w-52 text-[10px] font-bold border-r border-[#b5c7de]">
                Bill-to Party Name
              </TableHead>
              <TableHead
                onClick={() => handleSort("billMonth")}
                className="w-32 text-[10px] font-bold border-r border-[#b5c7de] cursor-pointer hover:bg-gray-200"
              >
                <div className="flex items-center">
                  Working Month <SortIcon col="billMonth" />
                </div>
              </TableHead>
              <TableHead className="w-28 text-[10px] font-bold border-r border-[#b5c7de] text-center">
                Doc Type
              </TableHead>
              <TableHead
                onClick={() => handleSort("docCategory")}
                className="w-36 text-[10px] font-bold border-r border-[#b5c7de] cursor-pointer hover:bg-gray-200"
              >
                <div className="flex items-center">
                  Charge Type <SortIcon col="docCategory" />
                </div>
              </TableHead>
              <TableHead
                onClick={() => handleSort("totals.taxableAmount")}
                className="w-28 text-right text-[10px] font-bold border-r border-[#b5c7de] cursor-pointer hover:bg-gray-200"
              >
                <div className="flex items-center justify-end">
                  Taxable Amt <SortIcon col="totals.taxableAmount" />
                </div>
              </TableHead>
              <TableHead className="w-24 text-right text-[10px] font-bold border-r border-[#b5c7de]">
                CGST
              </TableHead>
              <TableHead className="w-24 text-right text-[10px] font-bold border-r border-[#b5c7de]">
                SGST
              </TableHead>
              <TableHead className="w-24 text-right text-[10px] font-bold border-r border-[#b5c7de]">
                IGST
              </TableHead>
              <TableHead
                onClick={() => handleSort("totals.grossAmount")}
                className="w-28 text-right text-[10px] font-bold border-r border-[#b5c7de] cursor-pointer hover:bg-gray-200 bg-blue-50/50"
              >
                <div className="flex items-center justify-end">
                  Gross Amt <SortIcon col="totals.grossAmount" />
                </div>
              </TableHead>
              <TableHead
                onClick={() => handleSort("receiptAmount")}
                className="w-28 text-right text-[10px] font-bold border-r border-[#b5c7de] cursor-pointer hover:bg-gray-200 bg-emerald-50/30"
              >
                <div className="flex items-center justify-end">
                  Receipt Amt <SortIcon col="receiptAmount" />
                </div>
              </TableHead>
              <TableHead
                onClick={() => handleSort("tdsAmount")}
                className="w-24 text-right text-[10px] font-bold border-r border-[#b5c7de] cursor-pointer hover:bg-gray-200 bg-orange-50/30"
              >
                <div className="flex items-center justify-end">
                  TDS Amt <SortIcon col="tdsAmount" />
                </div>
              </TableHead>
              <TableHead
                onClick={() => handleSort("interestAmount")}
                className="w-24 text-right text-[10px] font-bold border-r border-[#b5c7de] cursor-pointer hover:bg-gray-200 bg-amber-50/30"
              >
                <div className="flex items-center justify-end">
                  Int. Amt <SortIcon col="interestAmount" />
                </div>
              </TableHead>
              <TableHead
                onClick={() => handleSort("deductionAmount")}
                className="w-24 text-right text-[10px] font-bold border-r border-[#b5c7de] cursor-pointer hover:bg-gray-200 bg-purple-50/30"
              >
                <div className="flex items-center justify-end">
                  Ded. Amt <SortIcon col="deductionAmount" />
                </div>
              </TableHead>
              <TableHead className="w-28 text-[10px] font-bold border-r border-[#b5c7de] text-center">
                Payment Date
              </TableHead>
              <TableHead className="w-28 text-[10px] font-bold border-r border-[#b5c7de] text-center">
                Bank UTR
              </TableHead>
              <TableHead className="w-28 text-[10px] font-bold border-r border-[#b5c7de] text-center">
                Adv. No.
              </TableHead>
              <TableHead className="w-16 text-center text-[10px] font-bold border-r border-[#b5c7de]">
                Proof
              </TableHead>
              <TableHead
                onClick={() => handleSort("balanceAmount")}
                className="w-28 text-right text-[10px] font-bold text-red-700 bg-red-50/30"
              >
                <div className="flex items-center justify-end">
                  Balance <SortIcon col="balanceAmount" />
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isInvoicesLoading ? (
              <TableRow>
                <TableCell
                  colSpan={26}
                  className="text-center py-20 text-[11px] uppercase tracking-widest animate-pulse"
                >
                  Loading Payment Records...
                </TableCell>
              </TableRow>
            ) : sortedData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={26}
                  className="text-center py-20 text-[11px] font-bold text-orange-600 uppercase"
                >
                  No payment records found for the selected criteria
                </TableCell>
              </TableRow>
            ) : (
              sortedData.map((row, idx) => (
                <TableRow
                  key={`${row.plantId}_${row.invoiceNumber}_${idx}`}
                  className="h-8 hover:bg-blue-50/30 transition-colors border-b border-gray-100 group"
                >
                  <TableCell className="p-0 text-center text-[10px] border-r border-gray-100 text-gray-400 group-hover:text-blue-600">
                    {idx + 1}
                  </TableCell>
                  <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 font-bold text-center">
                    {row.plantId}
                  </TableCell>
                  <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 font-mono font-black text-blue-800">
                    <button
                      className="text-left w-full h-full hover:underline"
                      onClick={() => setSelectedInvoice(row)}
                    >
                      {row.invoiceNumber}
                    </button>
                  </TableCell>
                  <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 font-mono text-center">
                    {row.invoiceDate}
                  </TableCell>
                  <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 whitespace-normal">
                    {row.consignorName}
                  </TableCell>
                  <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 font-semibold whitespace-normal">
                    {row.billToName}
                  </TableCell>
                  <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 font-mono text-center text-blue-700">
                    {row.billMonth || "-"}
                  </TableCell>
                  <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 uppercase text-center">
                    {row.docType || "-"}
                  </TableCell>
                  <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 uppercase text-center">
                    {row.docCategory || "-"}
                  </TableCell>
                  <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 text-right font-mono">
                    {formatAmount(row.totals?.taxableAmount)}
                  </TableCell>
                  <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 text-right font-mono text-gray-500">
                    {formatAmount(row.totals?.cgst)}
                  </TableCell>
                  <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 text-right font-mono text-gray-500">
                    {formatAmount(row.totals?.sgst)}
                  </TableCell>
                  <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 text-right font-mono text-gray-500">
                    {formatAmount(row.totals?.igst)}
                  </TableCell>
                  <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 text-right font-black text-blue-900 bg-blue-50/20">
                    {formatAmount(row.totals?.grossAmount || row.grossAmount)}
                  </TableCell>
                  <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 text-right font-bold text-emerald-700 bg-emerald-50/20">
                    {formatAmount(row.receiptAmount)}
                  </TableCell>
                  <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 text-right font-bold text-orange-700 bg-orange-50/20">
                    {formatAmount(row.tdsAmount)}
                  </TableCell>
                  <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 text-right font-bold text-amber-700 bg-amber-50/20">
                    {formatAmount(row.interestAmount)}
                  </TableCell>
                  <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 text-right font-bold text-purple-700 bg-purple-50/20">
                    {formatAmount(row.deductionAmount)}
                  </TableCell>
                  <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 font-mono text-center">
                    {row.paymentDate || "-"}
                  </TableCell>
                  <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 font-mono whitespace-normal">
                    {row.bankingUtr || "-"}
                  </TableCell>
                  <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 font-mono text-center">
                    {row.paymentAdviceNo || "-"}
                  </TableCell>
                  <TableCell className="p-0 px-2 text-[10px] border-r border-gray-100 text-center">
                    {row.proofData ? (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            className="h-6 w-full text-[9px] font-black text-blue-700 hover:bg-blue-100 rounded-none"
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl rounded-none border-gray-400 p-0 overflow-hidden shadow-2xl">
                          <div className="bg-[#333e4f] text-white p-3 flex justify-between items-center">
                            <DialogTitle className="text-[11px] font-black uppercase tracking-widest flex items-center gap-2">
                              <Receipt className="h-4 w-4 text-emerald-400" /> Payment Proof: {row.invoiceNumber}
                            </DialogTitle>
                            <DialogTrigger asChild>
                              <button className="hover:bg-white/10 p-1">
                                <X className="h-4 w-4" />
                              </button>
                            </DialogTrigger>
                          </div>
                          <Suspense fallback={<div className="p-8 text-center">Loading Viewer...</div>}>
                            <PaymentProofViewer
                              proofData={row.proofData}
                              invoiceNumber={row.invoiceNumber}
                              fileName={row.bankingUtr}
                            />
                          </Suspense>
                        </DialogContent>
                      </Dialog>
                    ) : (
                      <span className="text-[9px] text-gray-400">---</span>
                    )}
                  </TableCell>
                  <TableCell className="p-0 px-2 text-[10px] text-right font-black text-red-700 bg-red-50/10">
                    {formatAmount(row.balanceAmount)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Footer Status Bar */}
      <div className="bg-[#333e4f] p-2 flex justify-between items-center text-white text-[10px] font-bold uppercase tracking-widest shadow-inner">
        <div className="flex items-center gap-6">
          <span>ALV Grid: {sortedData.length} Document(s)</span>
          <span className="opacity-40">|</span>
          <span>Plant: {filterPlant.includes("ALL") ? "All" : filterPlant.join(', ')}</span>
        </div>
        <div className="flex items-center gap-8 pr-4">
          <div className="flex flex-col items-end">
            <span className="opacity-50 text-[8px]">Total Gross</span>
            <span className="text-[12px] font-black text-blue-300">
              ₹ {formatAmount(summary.total)}
            </span>
          </div>
          <div className="flex flex-col items-end border-l border-white/20 pl-6">
            <span className="opacity-50 text-[8px]">Total Receipts</span>
            <span className="text-[12px] font-black text-emerald-400">
              ₹ {formatAmount(summary.receipt)}
            </span>
          </div>
          <div className="flex flex-col items-end border-l border-white/20 pl-6">
            <span className="opacity-50 text-[8px]">TDS</span>
            <span className="text-[12px] font-black text-orange-400">
              ₹ {formatAmount(summary.tds)}
            </span>
          </div>
          <div className="flex flex-col items-end border-l border-white/20 pl-6">
            <span className="opacity-50 text-[8px]">Deductions</span>
            <span className="text-[12px] font-black text-purple-400">
              ₹ {formatAmount(summary.deduction)}
            </span>
          </div>
          <div className="flex flex-col items-end border-l border-white/20 pl-6">
            <span className="opacity-50 text-[8px]">Outstanding</span>
            <span className="text-[12px] font-black text-red-400">
              ₹ {formatAmount(summary.balance)}
            </span>
          </div>
        </div>
      </div>

      {/* Invoice Preview Dialog */}
      {selectedInvoice && (
        <Dialog open={!!selectedInvoice} onOpenChange={(open) => !open && setSelectedInvoice(null)}>
          <DialogContent className="max-w-[850px] max-h-[98vh] overflow-y-auto p-0 rounded-none border-none shadow-2xl">
            <div className="bg-[#333e4f] p-2 flex justify-between items-center text-white sticky top-0 z-50">
              <DialogTitle className="text-[11px] font-bold uppercase tracking-widest pl-2">
                Document Output: {selectedInvoice.invoiceNumber}
              </DialogTitle>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handlePrint}
                  className="h-7 rounded-none bg-emerald-600 hover:bg-emerald-700 gap-2 text-[10px] font-bold px-4"
                >
                  <Printer className="h-3.5 w-3.5" /> PRINT COPIES
                </Button>
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="h-7 w-7 text-white hover:bg-white/10 rounded-none flex items-center justify-center"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="bg-white" id="invoice-print-area">
              <InvoicePreview
                invoice={selectedInvoice}
                copyLabel="ORIGINAL: FOR RECIPIENT"
                firms={firms}
                customerMap={customerMap}
              />
              <div className="page-break"></div>
              <InvoicePreview
                invoice={selectedInvoice}
                copyLabel="DUPLICATE: FOR CONSIGNEE"
                firms={firms}
                customerMap={customerMap}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

    </div>
  );
}
