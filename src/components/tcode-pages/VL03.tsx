"use client";

import { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDatabase, useCollection, useMemoDatabase } from "@/database";
import { collection, query, orderBy } from "@/database/mongo";
import { Search, Filter, Download, Printer, ArrowUpDown, ChevronUp, ChevronDown } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function VL03() {
  const db = useDatabase();
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const conditionsQuery = useMemoDatabase(() => query(collection(db, "price_conditions"), orderBy("createdAt", "desc")), [db]);
  const { data: records, isLoading } = useCollection(conditionsQuery);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedData = useMemo(() => {
    if (!records) return [];
    const filtered = records.filter(r => 
      r.plantId?.toLowerCase().includes(search.toLowerCase()) || 
      r.customerId?.toLowerCase().includes(search.toLowerCase()) ||
      r.materialCode?.toLowerCase().includes(search.toLowerCase())
    );

    if (!sortConfig) return filtered;

    return [...filtered].sort((a, b) => {
      const aVal = String(a[sortConfig.key] || "").toLowerCase();
      const bVal = String(b[sortConfig.key] || "").toLowerCase();
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [records, search, sortConfig]);

  const SortIcon = ({ column }: { column: string }) => {
    if (sortConfig?.key !== column) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
    return sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3 ml-1 text-blue-600" /> : <ChevronDown className="h-3 w-3 ml-1 text-blue-600" />;
  };

  return (
    <div className="w-full flex flex-col bg-white min-h-full">
      <div className="bg-[#dae8f5] px-4 py-1 border-b border-gray-300">
        <h2 className="text-[13px] font-bold text-gray-800 uppercase italic tracking-wider">
          Price Condition List: ALV Grid
        </h2>
      </div>

      <div className="bg-[#e7ebf1] border-b border-[#b5c7de] px-4 py-1 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative flex items-center bg-white border border-gray-400 h-6 w-64 px-1 group focus-within:border-blue-500">
             <Search className="h-3.5 w-3.5 text-gray-400 mr-1" />
             <input value={search} onChange={(e) => setSearch(e.target.value)} className="w-full h-full text-xs outline-none" />
          </div>
          <TooltipProvider>
            <div className="flex items-center gap-1">
              <Tooltip><TooltipTrigger asChild><button className="p-1 hover:bg-gray-300 rounded text-gray-600"><Filter className="h-4 w-4" /></button></TooltipTrigger><TooltipContent>Filter</TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild><button className="p-1 hover:bg-gray-300 rounded text-gray-600"><Printer className="h-4 w-4" /></button></TooltipTrigger><TooltipContent>Print</TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild><button className="p-1 hover:bg-gray-300 rounded text-gray-600"><Download className="h-4 w-4" /></button></TooltipTrigger><TooltipContent>Export</TooltipContent></Tooltip>
            </div>
          </TooltipProvider>
        </div>
        <div className="text-[11px] font-bold text-gray-600">Total Records: {sortedData.length}</div>
      </div>

      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader className="bg-[#e7ebf1] sticky top-0 z-10">
            <TableRow className="h-8 border-b-[#b5c7de]">
              <TableHead className="text-[11px] font-bold text-gray-700 border-r w-10 text-center">#</TableHead>
              <TableHead onClick={() => handleSort('plantId')} className="text-[11px] font-bold text-gray-700 border-r w-24 cursor-pointer hover:bg-gray-200">
                <div className="flex items-center">Plant <SortIcon column="plantId" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('customerId')} className="text-[11px] font-bold text-gray-700 border-r w-32 cursor-pointer hover:bg-gray-200">
                <div className="flex items-center">Customer <SortIcon column="customerId" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('materialCode')} className="text-[11px] font-bold text-gray-700 border-r w-32 cursor-pointer hover:bg-gray-200">
                <div className="flex items-center">Material <SortIcon column="materialCode" /></div>
              </TableHead>
              <TableHead className="text-[11px] font-bold text-gray-700 border-r w-28">Basic Price</TableHead>
              <TableHead className="text-[11px] font-bold text-gray-700">Special Disc.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-10 text-xs">RETRIVING RECORDS...</TableCell></TableRow>
            ) : sortedData.map((r, i) => (
              <TableRow key={r.id} className="h-8 hover:bg-blue-50/50 transition-colors border-b border-gray-100">
                <TableCell className="p-0 text-center text-[10px] border-r text-gray-400">{i + 1}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r font-mono">{r.plantId}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r font-mono">{r.customerId}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r font-mono">{r.materialCode}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r text-blue-700 font-bold">{r.basicPriceCode} ({r.basicPriceDesc})</TableCell>
                <TableCell className="p-0 px-2 text-[10px]">{r.specialDiscountCode}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}


