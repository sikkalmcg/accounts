"use client";

import { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Filter, Download, Printer, ArrowUpDown, ChevronUp, ChevronDown } from "lucide-react";
import { TCODE_MAP } from "@/lib/tcode-registry";

export default function ZCODE() {
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const tcodes = useMemo(() => {
    return Object.entries(TCODE_MAP).map(([code, info]) => ({
      code,
      title: info.title,
    }));
  }, []);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedData = useMemo(() => {
    const filtered = tcodes.filter(t => 
      t.code.toLowerCase().includes(search.toLowerCase()) || 
      t.title.toLowerCase().includes(search.toLowerCase())
    );

    if (!sortConfig) return filtered;

    return [...filtered].sort((a, b) => {
      const aVal = String(a[sortConfig.key as keyof typeof a] || "").toLowerCase();
      const bVal = String(b[sortConfig.key as keyof typeof b] || "").toLowerCase();
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [tcodes, search, sortConfig]);

  const SortIcon = ({ column }: { column: string }) => {
    if (sortConfig?.key !== column) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
    return sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3 ml-1 text-blue-600" /> : <ChevronDown className="h-3 w-3 ml-1 text-blue-600" />;
  };

  return (
    <div className="w-full flex flex-col bg-white min-h-full">
      <div className="bg-[#dae8f5] px-4 py-1 border-b border-gray-300">
        <h2 className="text-[13px] font-bold text-gray-800 uppercase italic tracking-wider">
          SYSTEM: DISPLAY ACTIVE TRANSACTION CODES (ALV GRID)
        </h2>
      </div>

      <div className="bg-[#e7ebf1] border-b border-[#b5c7de] px-4 py-1 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative flex items-center bg-white border border-gray-400 h-6 w-64 px-1 group focus-within:border-blue-500">
             <Search className="h-3.5 w-3.5 text-gray-400 mr-1" />
             <input 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-full text-xs outline-none"
             />
          </div>
          <div className="flex items-center gap-1">
            <button className="p-1 hover:bg-gray-300 rounded text-gray-600" title="Filter"><Filter className="h-4 w-4" /></button>
            <button className="p-1 hover:bg-gray-300 rounded text-gray-600" title="Print"><Printer className="h-4 w-4" /></button>
            <button className="p-1 hover:bg-gray-300 rounded text-gray-600" title="Export"><Download className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="text-[11px] font-bold text-gray-600">
          Active Transactions: {sortedData.length}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <Table className="border-collapse">
          <TableHeader className="bg-[#e7ebf1] sticky top-0 z-10">
            <TableRow className="h-8 border-b-[#b5c7de] hover:bg-transparent">
              <TableHead className="text-[11px] font-bold text-gray-700 border-r border-[#b5c7de] w-12 text-center">#</TableHead>
              <TableHead onClick={() => handleSort('code')} className="text-[11px] font-bold text-gray-700 border-r border-[#b5c7de] w-48 cursor-pointer hover:bg-gray-200">
                <div className="flex items-center">Transaction Code <SortIcon column="code" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('title')} className="text-[11px] font-bold text-gray-700 border-r border-[#b5c7de] cursor-pointer hover:bg-gray-200">
                <div className="flex items-center">Description / Title <SortIcon column="title" /></div>
              </TableHead>
              <TableHead className="text-[11px] font-bold text-gray-700 w-32 text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-10 text-xs text-red-500 font-bold">
                  NO TRANSACTION CODES MATCHING CRITERIA
                </TableCell>
              </TableRow>
            ) : (
              sortedData.map((row, idx) => {
                const isUnderDev = typeof TCODE_MAP[row.code].component !== 'object' || (TCODE_MAP[row.code].component as any)?.props?.children?.toString().includes('Under Development');
                
                return (
                  <TableRow key={row.code} className="h-8 hover:bg-blue-50/50 group border-b border-gray-100">
                    <TableCell className="p-0 text-center text-[11px] border-r border-gray-100 text-gray-400">{idx + 1}</TableCell>
                    <TableCell className="p-0 px-2 text-[11px] font-mono font-bold text-blue-700 border-r border-gray-100">
                      {row.code}
                    </TableCell>
                    <TableCell className="p-0 px-2 text-[11px] border-r border-gray-100 font-medium">
                      {row.title}
                    </TableCell>
                    <TableCell className="p-0 px-2 text-[10px] text-center">
                      <span className={`px-2 py-0.5 rounded-sm font-bold uppercase ${isUnderDev ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {isUnderDev ? 'Pending' : 'Active'}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="bg-[#333e4f] h-6 flex items-center px-4 text-white text-[10px] uppercase tracking-wider">
        System Repository View • Repository: TSTC
      </div>
    </div>
  );
}


