"use client";

import { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDatabase, useCollection, useMemoDatabase } from "@/database";
import { collection, query, orderBy } from "@/database/mongo";
import { Search, Building2, ArrowUpDown, ChevronUp, ChevronDown, Filter, Printer, Download } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import Image from "next/image";

export default function FM03() {
  const db = useDatabase();
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  // Real-time firms
  const firmsQuery = useMemoDatabase(() => query(collection(db, "firms"), orderBy("createdAt", "desc")), [db]);
  const { data: firms, isLoading: isFirmsLoading } = useCollection(firmsQuery);

  // Real-time plants for joining
  const plantsQuery = useMemoDatabase(() => collection(db, "plants"), [db]);
  const { data: plants } = useCollection(plantsQuery);

  const plantMap = useMemo(() => {
    const map: Record<string, string> = {};
    plants?.forEach(p => { map[p.id] = p.name; });
    return map;
  }, [plants]);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedData = useMemo(() => {
    if (!firms) return [];
    const filtered = firms.filter(f => 
      f.name?.toLowerCase().includes(search.toLowerCase()) || 
      f.gstin?.toUpperCase().includes(search.toUpperCase()) ||
      (f.consignorCode || f.firmId || "").toLowerCase().includes(search.toLowerCase())
    );

    if (!sortConfig) return filtered;

    return [...filtered].sort((a, b) => {
      let aVal = a[sortConfig.key] || "";
      let bVal = b[sortConfig.key] || "";

      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      
      if (aStr < bStr) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aStr > bStr) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [firms, search, sortConfig]);

  const SortIcon = ({ column }: { column: string }) => {
    if (sortConfig?.key !== column) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
    return sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3 ml-1 text-blue-600" /> : <ChevronDown className="h-3 w-3 ml-1 text-blue-600" />;
  };

  return (
    <div className="w-full flex flex-col bg-white min-h-full">
      <div className="bg-[#dae8f5] px-4 py-1 border-b border-gray-300">
        <h2 className="text-[13px] font-bold text-gray-800 uppercase italic tracking-wider">
          Firm / Consignor List: ALV Grid
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
                <TooltipContent>Set Filter</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="p-1 hover:bg-gray-300 rounded text-gray-600 transition-colors"><Printer className="h-4 w-4" /></button>
                </TooltipTrigger>
                <TooltipContent>Print List</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="p-1 hover:bg-gray-300 rounded text-gray-600 transition-colors"><Download className="h-4 w-4" /></button>
                </TooltipTrigger>
                <TooltipContent>Excel Export</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>
        <div className="text-[11px] font-bold text-gray-600">Records: {sortedData.length}</div>
      </div>

      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader className="bg-[#e7ebf1] sticky top-0 z-10">
            <TableRow className="h-8">
              <TableHead className="text-[11px] border-r w-12 text-center">#</TableHead>
              <TableHead className="text-[11px] border-r w-12 text-center">Logo</TableHead>
              <TableHead onClick={() => handleSort('gstin')} className="text-[11px] border-r w-32 cursor-pointer hover:bg-gray-200 transition-colors">
                <div className="flex items-center">GSTIN <SortIcon column="gstin" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('consignorCode')} className="text-[11px] border-r w-32 cursor-pointer hover:bg-gray-200 transition-colors">
                <div className="flex items-center">Consignor Code <SortIcon column="consignorCode" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('name')} className="text-[11px] border-r cursor-pointer hover:bg-gray-200 transition-colors">
                <div className="flex items-center">Consignor Name <SortIcon column="name" /></div>
              </TableHead>
              <TableHead className="text-[11px] border-r">
                <div className="flex items-center">Plant</div>
              </TableHead>
              <TableHead onClick={() => handleSort('pan')} className="text-[11px] border-r w-32 cursor-pointer hover:bg-gray-200 transition-colors">
                <div className="flex items-center">PAN <SortIcon column="pan" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('state')} className="text-[11px] cursor-pointer hover:bg-gray-200 transition-colors">
                <div className="flex items-center">State <SortIcon column="state" /></div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isFirmsLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-4 text-xs">FETCHING FIRMS...</TableCell></TableRow>
            ) : sortedData.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-10 text-xs text-red-500 font-bold">NO MATCHING FIRMS FOUND</TableCell></TableRow>
            ) : sortedData.map((f, i) => (
              <TableRow key={f.id} className="h-10 hover:bg-blue-50/50 transition-colors">
                <TableCell className="p-0 text-center text-[10px] border-r text-gray-400">{i + 1}</TableCell>
                <TableCell className="p-0 border-r flex items-center justify-center">
                  {f.logoData ? (
                    <div className="w-8 h-8 relative"><Image src={f.logoData} alt="Logo" fill className="object-contain" /></div>
                  ) : <Building2 className="h-4 w-4 text-gray-300" />}
                </TableCell>
                <TableCell className="p-0 px-2 text-[11px] border-r font-mono">{f.gstin}</TableCell>
                <TableCell className="p-0 px-2 text-[11px] border-r font-mono font-bold text-blue-700">{f.consignorCode || f.firmId || "-"}</TableCell>
                <TableCell className="p-0 px-2 text-[11px] border-r font-bold">{f.name}</TableCell>
<TableCell className="p-0 px-2 text-[11px] border-r text-gray-600">
                  {Array.isArray(f.assignedPlantIds) && f.assignedPlantIds.length > 0
                    ? f.assignedPlantIds.join(", ")
                    : (f.plantId || "N/A")}
                </TableCell>
                <TableCell className="p-0 px-2 text-[11px] border-r font-mono">{f.pan}</TableCell>
                <TableCell className="p-0 px-2 text-[11px]">{f.state} ({f.stateCode})</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}


