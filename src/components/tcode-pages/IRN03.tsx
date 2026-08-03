"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useDatabase, useCollection, useMemoDatabase } from "@/database";
import { collection, query, where, getDocs } from "@/database/mongo";
import { Search, Loader2, RotateCcw, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { matchesDateRange, IRNResultGrid } from "./IRNShared";

export default function IRN03() {
  const db = useDatabase();

  // 1. User Context
  const [isAdmin, setIsAdmin] = useState(false);
  const [assignedPlantId, setAssignedPlantId] = useState("");

  // 2. Filter State
  const [filterPlant, setFilterPlant] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
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
      setAssignedPlantId(parsed.assignedPlantId || "");
      if (!sysAdmin && parsed.assignedPlantId) setFilterPlant(parsed.assignedPlantId);
    }
  }, []);

  const filteredPlants = useMemo(() => {
    if (isAdmin) return plants || [];
    return plants?.filter((p) => p.plantId === assignedPlantId) || [];
  }, [plants, isAdmin, assignedPlantId]);

  // 5. Execute / Search Handler
  const handleExecute = useCallback(async () => {
    if (!filterPlant) {
      window.dispatchEvent(new CustomEvent("sap-status", { detail: { text: "Error: Plant is mandatory", isError: true } }));
      return;
    }

    setIsLoading(true);
    setIsExecuted(true);
    try {
      const q = query(collection(db, "sales_invoices"), where("plantId", "==", filterPlant));
      const snap = await getDocs(q);
      const data = snap.docs
        .map((d) => ({ ...d.data(), id: d.id }))
        .filter((inv: any) => inv.irnNumber && inv.irnNumber.trim() !== "")
        .filter((inv: any) => matchesDateRange(inv.invoiceDate, fromDate, toDate))
        .sort((a: any, b: any) => {
          const at = new Date(a.invoiceDate || 0).getTime();
          const bt = new Date(b.invoiceDate || 0).getTime();
          return bt - at; // Newest first
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
  }, [db, filterPlant, fromDate, toDate]);

  useEffect(() => {
    const onExec = () => handleExecute();
    window.addEventListener("sap-execute", onExec);
    return () => window.removeEventListener("sap-execute", onExec);
  }, [handleExecute]);

  // 6. Reset Filters
  const handleReset = useCallback(() => {
    setFilterPlant("");
    setToDate("");
    setFromDate("");
    setIsExecuted(false);
    setResults([]);
  }, []);

  useEffect(() => {
    const onCancel = () => handleReset();
    window.addEventListener("sap-cancel", onCancel);
    return () => window.removeEventListener("sap-cancel", onCancel);
  }, [handleReset]);

  // 7. Render
  return (
    <div className="w-full flex flex-col bg-white min-h-full select-text">
      <div className="sap-header-title">IRN03 - Display E-Invoicing Data</div>

      <div className="sap-selection-area">
        <div className="max-w-5xl mx-auto grid grid-cols-3 gap-x-10 gap-y-6">
          <div className="sap-selection-row">
            <label className="sap-label">Plant *</label>
            <div className="sap-input-wrapper max-w-[280px]">
              <Select value={filterPlant} onValueChange={setFilterPlant} disabled={!isAdmin}>
                <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]">
                  <SelectValue placeholder="Select Plant" />
                </SelectTrigger>
                <SelectContent>
                  {filteredPlants.map((p) => (
                    <SelectItem key={p.id} value={p.plantId}>
                      {p.plantId} - {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="sap-selection-row">
            <label className="sap-label">From Date</label>
            <div className="sap-input-wrapper max-w-[280px]">
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
          </div>
          <div className="sap-selection-row">
            <label className="sap-label">To Date</label>
            <div className="sap-input-wrapper max-w-[280px]">
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="max-w-5xl mx-auto flex gap-3 mt-2">
          <Button
            onClick={handleExecute}
            disabled={isLoading}
            className="h-7 rounded-none bg-blue-700 hover:bg-blue-800 text-[11px] font-bold uppercase gap-1.5 shadow-sm"
          >
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />} Execute (F8)
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

      <div className="flex-1 overflow-auto no-scrollbar relative bg-[#f8f9fa]">
        {!isExecuted ? (
          <div className="flex flex-col items-center justify-center py-40 text-gray-400 opacity-40 select-none">
            <Search className="h-20 w-20 stroke-1 mb-4" />
            <p className="text-sm font-black uppercase tracking-[0.3em]">Enter plant and date criteria, then execute (F8)</p>
          </div>
        ) : (
          <IRNResultGrid invoices={results} firms={firms} customerMap={customerMap} isLoading={isLoading} showGeneratedBy />
        )}
      </div>

      <div className="bg-[#333e4f] p-1 px-4 flex justify-between items-center text-white text-[10px] font-bold uppercase shadow-inner shadow-black/40">
        <div className="flex gap-10 items-center">
          <span>IRN03 - Display E-Invoicing Data</span>
          <span className="opacity-50">|</span>
          <span>Records: {results.length}</span>
          <span className="opacity-50">|</span>
          <span>Plant: {filterPlant || "NONE"}</span>
        </div>
      </div>
    </div>
  );
}

