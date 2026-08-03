"use client";

import { useState, useMemo, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDatabase, useCollection, useMemoDatabase } from "@/database";
import { collection, query, orderBy } from "@/database/mongo";
import { Search, Filter, Download, Printer, ArrowUpDown, ChevronUp, ChevronDown, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import PlantMultiSelect from "./PlantMultiSelect";

export default function VOF03() {
  const db = useDatabase();
  const [search, setSearch] = useState("");
  const [selectedPlants, setSelectedPlants] = useState<string[]>([]);
  const [authorizedPlantIds, setAuthorizedPlantIds] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("sikka_user");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setIsAdmin(parsed.username === "ajaysomra" || parsed.role === 'admin');
        setAuthorizedPlantIds(parsed.assignedPlantIds || []);
      } catch (e) { /* ignore */ }
    }
  }, []);

  const billingQuery = useMemoDatabase(() => query(collection(db, "billing_types"), orderBy("createdAt", "desc")), [db]);
  const { data: records, isLoading } = useCollection(billingQuery);

  const plantsQuery = useMemoDatabase(() => collection(db, "plants"), [db]);
  const { data: plants, isLoading: isPlantsLoading } = useCollection(plantsQuery);

  const allowedPlantIds = isAdmin ? undefined : (authorizedPlantIds.length ? authorizedPlantIds : undefined);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedData = useMemo(() => {
    if (!records) return [];

    // Start with plant-based authorization restriction
    let baseData = isAdmin ? records : records.filter(r => authorizedPlantIds.includes(r.plantId));

    // Apply the selected plants filter (multi-select) - if any selected, show only those
    if (selectedPlants.length > 0) {
      baseData = baseData.filter(r => selectedPlants.includes(r.plantId));
    }

    const filtered = baseData.filter(r => 
      r.plantId?.toLowerCase().includes(search.toLowerCase()) || 
      r.documentType?.toLowerCase().includes(search.toLowerCase()) ||
      r.documentCategory?.toLowerCase().includes(search.toLowerCase()) ||
      r.inventoryType?.toLowerCase().includes(search.toLowerCase())
    );

    if (!sortConfig) return filtered;

    return [...filtered].sort((a, b) => {
      const aVal = String(a[sortConfig.key] || "").toLowerCase();
      const bVal = String(b[sortConfig.key] || "").toLowerCase();
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [records, search, sortConfig, selectedPlants, isAdmin, authorizedPlantIds]);

  const SortIcon = ({ column }: { column: string }) => {
    if (sortConfig?.key !== column) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
    return sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3 ml-1 text-blue-600" /> : <ChevronDown className="h-3 w-3 ml-1 text-blue-600" />;
  };

  return (
    <div className="w-full flex flex-col bg-white min-h-full">
      <div className="bg-[#dae8f5] px-4 py-1 border-b border-gray-300">
        <h2 className="text-[13px] font-bold text-gray-800 uppercase italic tracking-wider">
          Billing Types: ALV Grid
        </h2>
      </div>

<div className="bg-[#e7ebf1] border-b border-[#b5c7de] px-4 py-1.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-bold text-gray-600 whitespace-nowrap">Plants</label>
            <div className="w-[240px]">
              <PlantMultiSelect
                plants={plants}
                selected={selectedPlants}
                onChange={setSelectedPlants}
                isLoading={isPlantsLoading}
                allowedPlantIds={allowedPlantIds}
                placeholder="All Plants..."
              />
            </div>
          </div>
          <div className="relative flex items-center bg-white border border-gray-400 h-7 w-64 px-1 group focus-within:border-blue-500">
             <Search className="h-3.5 w-3.5 text-gray-400 mr-1" />
             <input value={search} onChange={(e) => setSearch(e.target.value)} className="w-full h-full text-xs outline-none" />
             {search && <button onClick={() => setSearch("")} className="text-gray-400 hover:text-gray-600"><X className="h-3 w-3" /></button>}
          </div>
          <TooltipProvider>
            <div className="flex items-center gap-1">
              <Tooltip><TooltipTrigger asChild><button className="p-1 hover:bg-gray-300 rounded text-gray-600"><Filter className="h-4 w-4" /></button></TooltipTrigger><TooltipContent>Filter</TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild><button className="p-1 hover:bg-gray-300 rounded text-gray-600"><Printer className="h-4 w-4" /></button></TooltipTrigger><TooltipContent>Print</TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild><button className="p-1 hover:bg-gray-300 rounded text-gray-600"><Download className="h-4 w-4" /></button></TooltipTrigger><TooltipContent>Export</TooltipContent></Tooltip>
            </div>
          </TooltipProvider>
        </div>
        <div className="text-[11px] font-bold text-gray-600">Count: {sortedData.length}</div>
      </div>

      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader className="bg-[#e7ebf1] sticky top-0 z-10">
            <TableRow className="h-8 border-b-[#b5c7de]">
              <TableHead className="text-[11px] font-bold border-r w-12 text-center">#</TableHead>
              <TableHead onClick={() => handleSort('plantId')} className="text-[11px] font-bold border-r w-48 cursor-pointer hover:bg-gray-200">
                <div className="flex items-center">Plant ID <SortIcon column="plantId" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('documentType')} className="text-[11px] font-bold border-r cursor-pointer hover:bg-gray-200">
                <div className="flex items-center">Document Type <SortIcon column="documentType" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('inventoryType')} className="text-[11px] font-bold border-r w-36 cursor-pointer hover:bg-gray-200">
                <div className="flex items-center">Inventory Type <SortIcon column="inventoryType" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('documentCategory')} className="text-[11px] font-bold cursor-pointer hover:bg-gray-200">
                <div className="flex items-center">Charge Type <SortIcon column="documentCategory" /></div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-10 text-xs">LOADING...</TableCell></TableRow>
            ) : sortedData.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-10 text-xs text-red-500 font-bold uppercase">No records found</TableCell></TableRow>
            ) : sortedData.map((r, i) => (
              <TableRow key={r.id} className="h-8 hover:bg-blue-50/50 transition-colors border-b border-gray-100">
                <TableCell className="p-0 text-center text-[10px] border-r text-gray-400">{i + 1}</TableCell>
                <TableCell className="p-0 px-2 text-[11px] border-r font-mono font-bold text-blue-700">{r.plantId}</TableCell>
                <TableCell className="p-0 px-2 text-[11px] border-r">{r.documentType || "-"}</TableCell>
                <TableCell className="p-0 px-2 text-[11px] border-r">{r.inventoryType || "-"}</TableCell>
                <TableCell className="p-0 px-2 text-[11px]">{r.documentCategory || "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

