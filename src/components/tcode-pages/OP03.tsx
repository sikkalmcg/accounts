
"use client";

import { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDatabase, useCollection, useMemoDatabase } from "@/database";
import { collection, query, orderBy } from "@/database/mongo";
import { Search, ArrowUpDown, ChevronUp, ChevronDown, Filter, Printer, Download } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function OP03() {
  const database = useDatabase();
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const plantsQuery = useMemoDatabase(() => {
    return query(collection(database, "plants"), orderBy("plantId", "asc"));
  }, [database]);

  const { data: plants, isLoading } = useCollection(plantsQuery);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedData = useMemo(() => {
    if (!plants) return [];
    const filtered = plants.filter(p => 
      p.name?.toLowerCase().includes(search.toLowerCase()) || 
      p.plantId?.toUpperCase().includes(search.toUpperCase())
    );
    
    if (!sortConfig) return filtered;

    return [...filtered].sort((a, b) => {
      const aVal = String(a[sortConfig.key as keyof typeof a] || "").toLowerCase();
      const bVal = String(b[sortConfig.key as keyof typeof b] || "").toLowerCase();
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [plants, search, sortConfig]);

  const SortIcon = ({ column }: { column: string }) => {
    if (sortConfig?.key !== column) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
    return sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3 ml-1 text-blue-600" /> : <ChevronDown className="h-3 w-3 ml-1 text-blue-600" />;
  };

  return (
    <div className="w-full flex flex-col bg-white min-h-full">
      <div className="bg-[#dae8f5] px-4 py-1 border-b border-gray-300">
        <h2 className="text-[13px] font-bold text-gray-800 uppercase italic tracking-wider">
          Plant List: Display ALV Grid
        </h2>
      </div>

      <div className="bg-[#e7ebf1] border-b border-[#b5c7de] px-4 py-1 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative flex items-center bg-white border border-gray-400 h-6 w-64 px-1 group focus-within:border-blue-500">
            <Search className="h-3.5 w-3.5 text-gray-400 mr-1" />
            <input 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              className="w-full text-xs outline-none" 
            />
          </div>
          <TooltipProvider>
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="p-1 hover:bg-gray-300 rounded text-gray-600 transition-colors"><Filter className="h-4 w-4" /></button>
                </TooltipTrigger>
                <TooltipContent>Filter</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="p-1 hover:bg-gray-300 rounded text-gray-600 transition-colors"><Printer className="h-4 w-4" /></button>
                </TooltipTrigger>
                <TooltipContent>Print</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="p-1 hover:bg-gray-300 rounded text-gray-600 transition-colors"><Download className="h-4 w-4" /></button>
                </TooltipTrigger>
                <TooltipContent>Export</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>
        <div className="text-[11px] font-bold text-gray-600">Count: {sortedData.length}</div>
      </div>

      <div className="flex-1 w-full overflow-auto">
        <Table className="w-full border-collapse">
          <TableHeader className="bg-[#e7ebf1] sticky top-0 z-10">
            <TableRow className="h-8 border-b-[#b5c7de]">
              <TableHead className="text-[11px] font-bold text-gray-700 border-r border-[#b5c7de] w-12 text-center">#</TableHead>
              <TableHead onClick={() => handleSort('plantId')} className="text-[11px] font-bold text-gray-700 border-r border-[#b5c7de] w-48 cursor-pointer hover:bg-gray-200">
                <div className="flex items-center">Plant ID <SortIcon column="plantId" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('name')} className="text-[11px] font-bold text-gray-700 border-r border-[#b5c7de] cursor-pointer hover:bg-gray-200">
                <div className="flex items-center">Plant Name <SortIcon column="name" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('location')} className="text-[11px] font-bold text-gray-700 cursor-pointer hover:bg-gray-200">
                <div className="flex items-center">Location <SortIcon column="location" /></div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-4 text-xs">LOADING MASTER DATA...</TableCell></TableRow>
            ) : sortedData.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-10 text-xs text-red-500 font-bold uppercase tracking-widest">NO RECORDS MATCHING SELECTION CRITERIA</TableCell></TableRow>
            ) : sortedData.map((p, i) => (
              <TableRow key={p.id} className="h-8 hover:bg-blue-50/50 border-b border-gray-100 transition-colors">
                <TableCell className="p-0 text-center text-[11px] border-r border-gray-100 text-gray-400">{i + 1}</TableCell>
                <TableCell className="p-0 px-2 text-[11px] border-r border-gray-100 font-bold text-blue-700">{p.plantId}</TableCell>
                <TableCell className="p-0 px-2 text-[11px] border-r border-gray-100">{p.name}</TableCell>
                <TableCell className="p-0 px-2 text-[11px]">{p.location}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}


