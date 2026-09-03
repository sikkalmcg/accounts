"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useDatabase, useCollection, useMemoDatabase } from "@/database";
import { collection, query, where, getDocs } from "@/database/mongo";
import { Search, Loader2, RotateCcw, FileText, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PlantMultiSelect from "./PlantMultiSelect";
import { downloadCsv } from "@/lib/csv-export";
import { getRecordPlantIds } from "@/lib/plant-master";
import { matchesDateRange, sapDateToTime, IRNResultGrid } from "./IRNShared";

export default function IRN03() {
  const db = useDatabase();

  // 1. User Context
  const [isAdmin, setIsAdmin] = useState(false);
  const [assignedPlantIds, setAssignedPlantIds] = useState<string[]>([]);

  // 2. Filter State
  const [filterPlants, setFilterPlants] = useState<string[]>([]);
  const [filterInvoiceNumber, setFilterInvoiceNumber] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [globalSearch, setGlobalSearch] = useState("");
  const [isExecuted, setIsExecuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // 3. Result Data
  const [results, setResults] = useState<any[]>([]);

  // 4. Master Data
  const plantsQuery = useMemoDatabase(() => collection(db, "plants"), [db]);
  const { data: plants } = useCollection(plantsQuery);
  const customersQuery = useMemoDatabase(() => collection(db, "customers"), [db]);
  const { data: customers } = useCollection(customersQuery);
  const firmsQuery = useMemoDatabase(() => collection(db, "firms"), [db]);
  const { data: firms } = useCollection(firmsQuery);

  const customerMap = useMemo(() => {
    const map: Record<string, any> = {};
    customers?.forEach((c) => {
      map[c.customerId] = c;
    });
    return map;
  }, [customers]);

  useEffect(() => {
    const stored = localStorage.getItem("sikka_user");
    if (stored) {
      const parsed = JSON.parse(stored);
      const sysAdmin = parsed.username === "ajaysomra" || parsed.role === "admin";
      setIsAdmin(sysAdmin);
      const plantIds = Array.isArray(parsed.assignedPlantIds) ? parsed.assignedPlantIds : [];
      setAssignedPlantIds(plantIds);
      if (!sysAdmin && plantIds.length > 0) setFilterPlants([...plantIds]);
    }
  }, []);

  const allowedPlantIds = useMemo(() => {
    if (isAdmin) return undefined;
    return assignedPlantIds;
  }, [isAdmin, assignedPlantIds]);

  // 5. Execute / Search Handler
  const handleExecute = useCallback(async () => {
    const invNo = filterInvoiceNumber.trim();
    if (filterPlants.length === 0 && !invNo) {
      window.dispatchEvent(
        new CustomEvent("sap-status", {
          detail: { text: "Error: Please enter an Invoice Number or select at least one Plant", isError: true },
        })
      );
      return;
    }

    setIsLoading(true);
    setIsExecuted(true);
    try {
      let q;
      if (filterPlants.length === 1) {
        q = query(collection(db, "sales_invoices"), where("plantId", "==", filterPlants[0]));
      } else if (filterPlants.length > 1) {
        q = query(collection(db, "sales_invoices"), where("plantId", "in", filterPlants));
      } else if (!isAdmin && assignedPlantIds.length > 0) {
        q = query(collection(db, "sales_invoices"), where("plantId", "in", assignedPlantIds));
      } else {
        q = collection(db, "sales_invoices");
      }

      const snap = await getDocs(q);
      const invNoLower = invNo.toLowerCase();
      const data = snap.docs
        .map((d) => ({ ...d.data(), id: d.id }))
        .filter((inv: any) => inv.irnNumber && inv.irnNumber.trim() !== "")
        .filter((inv: any) => matchesDateRange(inv.invoiceDate, fromDate, toDate))
        .filter((inv: any) => !invNoLower || inv.invoiceNumber?.toLowerCase().includes(invNoLower))
        .sort((a: any, b: any) => {
          return sapDateToTime(b.invoiceDate) - sapDateToTime(a.invoiceDate); // Latest date on top
        });
      setResults(data);
      window.dispatchEvent(
        new CustomEvent("sap-status", { detail: { text: `IRN records found: ${data.length}`, isError: false } })
      );
    } catch (e) {
      window.dispatchEvent(new CustomEvent("sap-status", { detail: { text: "System Error: IRN search failed", isError: true } }));
    } finally {
      setIsLoading(false);
    }
  }, [db, filterPlants, filterInvoiceNumber, fromDate, toDate, isAdmin, assignedPlantIds]);

  useEffect(() => {
    const onExec = () => handleExecute();
    window.addEventListener("sap-execute", onExec);
    return () => window.removeEventListener("sap-execute", onExec);
  }, [handleExecute]);

  // 6. Reset Filters
  const handleReset = useCallback(() => {
    setFilterPlants([]);
    setFilterInvoiceNumber("");
    setToDate("");
    setFromDate("");
    setGlobalSearch("");
    setIsExecuted(false);
    setResults([]);
  }, []);

  useEffect(() => {
    const onCancel = () => handleReset();
    window.addEventListener("sap-cancel", onCancel);
    return () => window.removeEventListener("sap-cancel", onCancel);
  }, [handleReset]);

  // 7. Global Search Filter across all grid fields
  const searchedResults = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    if (!q) return results;
    return results.filter((inv: any) => {
      const firm = inv.snapshotFirm || firms?.find((f) => getRecordPlantIds(f).includes(inv.plantId)) || {};
      const billToCust = inv.snapshotBillTo || customerMap[inv.billTo] || {};
      const haystack = [
        inv.plantId,
        inv.invoiceNumber,
        inv.invoiceDate,
        inv.irnNumber,
        inv.ackNo,
        inv.ackDate,
        inv.docType,
        inv.inventoryType,
        inv.docCategory,
        inv.billMonth,
        inv.irnGeneratedBy,
        inv.irnModifiedBy,
        inv.consignorName,
        firm?.name,
        firm?.gstin,
        firm?.stateName,
        billToCust?.name,
        billToCust?.gstin,
        billToCust?.stateName,
        inv.totals?.taxableAmount?.toString(),
        inv.totals?.grossAmount?.toString(),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [results, globalSearch, firms, customerMap]);

  // 8. CSV Export (Exports filtered records)
  const handleCsvExport = useCallback(() => {
    const exportList = searchedResults.length > 0 ? searchedResults : results;
    if (exportList.length === 0) {
      window.dispatchEvent(new CustomEvent("sap-status", { detail: { text: "No records to export", isError: true } }));
      return;
    }

    const headers = [
      "#",
      "Plant",
      "Invoice No.",
      "Invoice Date",
      "Consignor Name",
      "Consignor State",
      "Bill To Party",
      "Bill To Party State",
      "Document Type",
      "Invoice Type",
      "Charge Type",
      "Taxable Amount",
      "CGST Amount",
      "SGST Amount",
      "IGST Amount",
      "Gross Amount",
      "IRN No.",
      "ACK No.",
      "ACK Date",
      "IRN Generated by",
    ];

    const rows = exportList.map((inv, idx) => {
      const billToCust = inv.snapshotBillTo || customerMap[inv.billTo] || {};
      const firm = inv.snapshotFirm || firms?.find((f) => getRecordPlantIds(f).includes(inv.plantId)) || {};
      return [
        idx + 1,
        inv.plantId,
        inv.invoiceNumber,
        inv.invoiceDate,
        firm?.name || inv.consignorName || "-",
        firm?.stateName || firm?.state || "-",
        billToCust?.name || inv.billTo || "-",
        billToCust?.stateName || "-",
        inv.docType || "-",
        inv.inventoryType || "-",
        inv.docCategory ? (inv.billMonth ? `${inv.docCategory} - ${inv.billMonth}` : inv.docCategory) : (inv.billMonth || "-"),
        inv.totals?.taxableAmount ?? 0,
        inv.totals?.cgst ?? 0,
        inv.totals?.sgst ?? 0,
        inv.totals?.igst ?? 0,
        inv.totals?.grossAmount ?? 0,
        inv.irnNumber || "-",
        inv.ackNo || "-",
        inv.ackDate || "-",
        inv.irnGeneratedBy || inv.irnModifiedBy || "-",
      ];
    });

    downloadCsv("IRN03", headers, rows);
  }, [searchedResults, results, customerMap, firms]);

  // 9. Render
  return (
    <div className="w-full flex flex-col bg-white min-h-full select-text">
      <div className="sap-header-title">IRN03 - Display E-Invoicing Data</div>

      {/* Selection / Filter Bar */}
      <div className="bg-[#e7ebf1] border-b border-[#b5c7de] px-4 py-1.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Invoice No. Search */}
          <div className="flex items-center gap-1.5">
            <label className="text-[11px] font-bold text-gray-700 uppercase whitespace-nowrap">Invoice No:</label>
            <Input
              value={filterInvoiceNumber}
              onChange={(e) => setFilterInvoiceNumber(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleExecute()}
              placeholder="Search Invoice No..."
              className="h-7 w-36 text-xs bg-white border-gray-400 rounded-none px-2 shadow-inner focus:bg-[#fff9c4] font-mono uppercase"
            />
          </div>

          {/* Plant MultiSelect */}
          <div className="flex items-center gap-1.5">
            <label className="text-[11px] font-bold text-gray-700 uppercase whitespace-nowrap">Plant:</label>
            <div className="w-52">
              <PlantMultiSelect
                plants={plants || []}
                selected={filterPlants}
                onChange={setFilterPlants}
                placeholder="Select Plant(s)..."
                allowedPlantIds={allowedPlantIds}
              />
            </div>
          </div>

          {/* From Date */}
          <div className="flex items-center gap-1.5">
            <label className="text-[11px] font-bold text-gray-700 uppercase whitespace-nowrap">From:</label>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-7 w-36 text-xs bg-white border-gray-400 rounded-none px-2 shadow-inner focus:bg-[#fff9c4]"
            />
          </div>

          {/* To Date */}
          <div className="flex items-center gap-1.5">
            <label className="text-[11px] font-bold text-gray-700 uppercase whitespace-nowrap">To:</label>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-7 w-36 text-xs bg-white border-gray-400 rounded-none px-2 shadow-inner focus:bg-[#fff9c4]"
            />
          </div>

          {/* Action Buttons: Execute & Reset */}
          <div className="flex items-center gap-1.5">
            <Button
              onClick={handleExecute}
              disabled={isLoading}
              className="h-7 rounded-none bg-blue-700 hover:bg-blue-800 text-white text-[10px] font-bold uppercase gap-1 px-3 shadow-sm"
            >
              {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />} Execute (F8)
            </Button>
            <Button
              onClick={handleReset}
              variant="outline"
              className="h-7 rounded-none bg-white border-gray-400 text-gray-700 text-[10px] font-bold uppercase gap-1 px-2.5 shadow-sm hover:bg-gray-100"
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </Button>
          </div>
        </div>

        {/* Global Filter & Export & Record Count */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center bg-white border border-gray-400 h-7 w-64 px-1 group focus-within:border-blue-500 shadow-inner">
            <Search className="h-3.5 w-3.5 text-gray-400 mr-1 shrink-0" />
            <input
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className="w-full h-full text-xs outline-none bg-transparent"
              placeholder="Search across records (invoice, IRN, ACK, partner)..."
            />
            {globalSearch && (
              <button
                onClick={() => setGlobalSearch("")}
                className="text-gray-400 hover:text-red-600 text-xs px-1"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          <Button
            onClick={handleCsvExport}
            disabled={searchedResults.length === 0}
            variant="outline"
            className="h-7 rounded-none bg-white border-gray-400 text-emerald-700 text-[10px] font-bold uppercase gap-1 px-2.5 shadow-sm hover:bg-emerald-50 disabled:opacity-40"
            title="Export to CSV / Excel"
          >
            <FileDown className="h-3.5 w-3.5" /> Export Excel
          </Button>

          <div className="text-[11px] font-bold text-blue-700 uppercase tracking-tight bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-sm shadow-sm whitespace-nowrap flex items-center gap-1">
            <span>Records:</span>
            <span className="text-blue-900 font-black text-xs">{isExecuted ? searchedResults.length : 0}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto no-scrollbar relative bg-[#f8f9fa]">
        {!isExecuted ? (
          <div className="flex flex-col items-center justify-center py-40 text-gray-400 opacity-40 select-none">
            <Search className="h-20 w-20 stroke-1 mb-4" />
            <p className="text-sm font-black uppercase tracking-[0.3em]">Enter invoice no, plant, or date criteria, then execute (F8)</p>
          </div>
        ) : (
          <IRNResultGrid invoices={searchedResults} firms={firms} customerMap={customerMap} isLoading={isLoading} showGeneratedBy />
        )}
      </div>

      <div className="bg-[#333e4f] p-1 px-4 flex justify-between items-center text-white text-[10px] font-bold uppercase shadow-inner shadow-black/40">
        <div className="flex gap-10 items-center">
          <span>IRN03 - Display E-Invoicing Data</span>
          <span className="opacity-50">|</span>
          <span>Records: {searchedResults.length}</span>
          <span className="opacity-50">|</span>
          <span>Plant: {filterPlants.length > 0 ? filterPlants.join(", ") : "ALL"}</span>
        </div>
      </div>
    </div>
  );
}
