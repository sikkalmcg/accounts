"use client";

import { useState, useMemo, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDatabase, useCollection, useMemoDatabase } from "@/database";
import { collection, query, orderBy } from "@/database/mongo";
import { Search, Filter, Download, Printer, ArrowUpDown, ChevronUp, ChevronDown, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import PlantMultiSelect from "./PlantMultiSelect";

export default function XD03() {
  const db = useDatabase();
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [authorizedPlantIds, setAuthorizedPlantIds] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedPlants, setSelectedPlants] = useState<string[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem("sikka_user");
    if (stored) {
      const parsed = JSON.parse(stored);
      setIsAdmin(parsed.username === "ajaysomra" || parsed.role === 'admin');
      setAuthorizedPlantIds(parsed.assignedPlantIds || []);
    }
  }, []);

  const plantsQuery = useMemoDatabase(() => collection(db, "plants"), [db]);
  const { data: plants, isLoading: isPlantsLoading } = useCollection(plantsQuery);

  const allowedPlantIds = isAdmin ? undefined : (authorizedPlantIds.length ? authorizedPlantIds : undefined);

  const customersQuery = useMemoDatabase(() => {
    return query(collection(db, "customers"), orderBy("createdAt", "desc"));
  }, [db]);

  const { data: customers, isLoading } = useCollection(customersQuery);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

// Helper to get all plant codes for a customer (handles multi-plant assignment)
  const getCustomerPlantIds = (c: any): string[] => {
    if (Array.isArray(c.assignedPlantIds) && c.assignedPlantIds.length > 0) {
      return c.assignedPlantIds;
    }
    return c.plantId ? [c.plantId] : [];
  };

  const sortedData = useMemo(() => {
    if (!customers) return [];
    
    // Plant-Based CRUD Restriction
    let baseData = isAdmin ? customers : customers.filter(c => {
      const plantIds = getCustomerPlantIds(c);
      return plantIds.some(p => authorizedPlantIds.includes(p));
    });

    // Apply the selected plants filter (multi-select) - if any selected, show only those
    if (selectedPlants.length > 0) {
      baseData = baseData.filter(c => {
        const plantIds = getCustomerPlantIds(c);
        return plantIds.some(p => selectedPlants.includes(p));
      });
    }

    const filtered = baseData.filter(c => {
      const plantCodes = getCustomerPlantIds(c).join(", ");
      return c.name?.toLowerCase().includes(search.toLowerCase()) || 
      c.customerId?.toLowerCase().includes(search.toLowerCase()) ||
      plantCodes.toLowerCase().includes(search.toLowerCase()) ||
      c.gstin?.toLowerCase().includes(search.toLowerCase()) ||
      c.mobile?.includes(search)
    });

    if (!sortConfig) return filtered;

    return [...filtered].sort((a, b) => {
      const aValue = a[sortConfig.key] || "";
      const bValue = b[sortConfig.key] || "";
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      
      if (aStr < bStr) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aStr > bStr) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [customers, search, sortConfig, isAdmin, authorizedPlantIds, selectedPlants]);

  const SortIcon = ({ column }: { column: string }) => {
    if (sortConfig?.key !== column) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
    return sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3 ml-1 text-blue-600" /> : <ChevronDown className="h-3 w-3 ml-1 text-blue-600" />;
  };

  return (
    <div className="w-full flex flex-col bg-white min-h-full">
      <div className="sap-header-title">CUSTOMER LIST: DISPLAY ALV GRID</div>

<div className="sap-selection-area">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
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
            <div className="relative flex items-center bg-white border border-gray-400 h-7 w-80 px-1 group focus-within:border-blue-500">
               <Search className="h-3.5 w-3.5 text-gray-400 mr-1" />
               <input 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-full text-xs outline-none"
                placeholder="Search Customers..."
               />
               {search && <button onClick={() => setSearch("")} className="text-gray-400 hover:text-gray-600"><X className="h-3 w-3" /></button>}
            </div>
          </div>
          <div className="text-[11px] font-bold text-gray-600">
            Records Found: {sortedData.length}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <Table className="sap-alv-grid">
          <TableHeader className="sap-alv-header">
            <TableRow className="h-8 hover:bg-transparent">
              <TableHead className="text-[11px] font-bold text-gray-700 border-r border-[#b5c7de] w-12 text-center">#</TableHead>
              <TableHead onClick={() => handleSort('customerId')} className="text-[11px] font-bold text-gray-700 border-r border-[#b5c7de] w-32 cursor-pointer hover:bg-gray-200 transition-colors">
                <div className="flex items-center">Customer Code <SortIcon column="customerId" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('plantId')} className="text-[11px] font-bold text-gray-700 border-r border-[#b5c7de] w-24 cursor-pointer hover:bg-gray-200 transition-colors">
                <div className="flex items-center">Plant ID <SortIcon column="plantId" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('name')} className="text-[11px] font-bold text-gray-700 border-r border-[#b5c7de] w-64 cursor-pointer hover:bg-gray-200 transition-colors">
                <div className="flex items-center">Full Name <SortIcon column="name" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('mobile')} className="text-[11px] font-bold text-gray-700 border-r border-[#b5c7de] w-40 cursor-pointer hover:bg-gray-200 transition-colors">
                <div className="flex items-center">Mobile <SortIcon column="mobile" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('email')} className="text-[11px] font-bold text-gray-700 border-r border-[#b5c7de] w-64 cursor-pointer hover:bg-gray-200 transition-colors">
                <div className="flex items-center">Email <SortIcon column="email" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('gstin')} className="text-[11px] font-bold text-gray-700 border-r border-[#b5c7de] w-40 cursor-pointer hover:bg-gray-200 transition-colors">
                <div className="flex items-center">GSTIN <SortIcon column="gstin" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('creditLimit')} className="text-[11px] font-bold text-gray-700 text-right pr-4 cursor-pointer hover:bg-gray-200 transition-colors">
                <div className="flex items-center justify-end">Credit Limit (₹) <SortIcon column="creditLimit" /></div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-10 text-xs text-gray-400 animate-pulse">FETCHING DATA FROM SERVER...</TableCell></TableRow>
            ) : sortedData.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-10 text-xs text-red-500 font-bold uppercase">No records found matching Selection</TableCell></TableRow>
            ) : (
              sortedData.map((row, idx) => (
                <TableRow key={row.id} className="h-8 hover:bg-blue-50/20 group border-b border-gray-100 transition-colors">
                  <TableCell className="p-0 text-center text-[11px] border-r border-gray-100 text-gray-400 group-hover:text-blue-600">{idx + 1}</TableCell>
                  <TableCell className="p-0 px-2 text-[11px] font-mono font-bold text-blue-700 border-r border-gray-100">{row.customerId}</TableCell>
<TableCell className="p-0 px-2 text-[11px] border-r border-gray-100 font-mono text-center">{getCustomerPlantIds(row).join(", ") || "-"}</TableCell>
                  <TableCell className="p-0 px-2 text-[11px] border-r border-gray-100 font-medium">{row.name}</TableCell>
                  <TableCell className="p-0 px-2 text-[11px] border-r border-gray-100">{row.mobile}</TableCell>
                  <TableCell className="p-0 px-2 text-[11px] border-r border-gray-100 truncate max-w-[200px]">{row.email}</TableCell>
                  <TableCell className="p-0 px-2 text-[11px] border-r border-gray-100 font-mono">{row.gstin}</TableCell>
                  <TableCell className="p-0 px-2 text-[11px] text-right pr-4 font-bold text-emerald-700">
                    {parseFloat(row.creditLimit || 0).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="bg-[#333e4f] h-6 flex items-center px-4 text-white text-[10px] uppercase">
        ALV GRID VIEW • TOTAL VALUE: ₹ {sortedData.reduce((acc, c) => acc + parseFloat(c.creditLimit || 0), 0).toLocaleString()}
      </div>
    </div>
  );
}


