"use client";

import { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDatabase, useCollection, useMemoDatabase } from "@/database";
import { collection, query, orderBy } from "@/database/mongo";
import { Search, Filter, Download, Printer, ArrowUpDown, ChevronUp, ChevronDown } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function XK03() {
  const db = useDatabase();
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const vendorsQuery = useMemoDatabase(() => query(collection(db, "vendors"), orderBy("createdAt", "desc")), [db]);
  const { data: vendors, isLoading } = useCollection(vendorsQuery);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedData = useMemo(() => {
    if (!vendors) return [];
    const filtered = vendors.filter(v => 
      v.vendorName?.toLowerCase().includes(search.toLowerCase()) || 
      v.vendorId?.toLowerCase().includes(search.toLowerCase()) ||
      v.vendorCode?.toLowerCase().includes(search.toLowerCase()) ||
      v.gstin?.toLowerCase().includes(search.toLowerCase())
    );

    if (!sortConfig) return filtered;

    return [...filtered].sort((a, b) => {
      const aVal = String(a[sortConfig.key] || "").toLowerCase();
      const bVal = String(b[sortConfig.key] || "").toLowerCase();
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [vendors, search, sortConfig]);

  const SortIcon = ({ column }: { column: string }) => {
    if (sortConfig?.key !== column) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
    return sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3 ml-1 text-blue-600" /> : <ChevronDown className="h-3 w-3 ml-1 text-blue-600" />;
  };

  return (
    <div className="w-full flex flex-col bg-white min-h-full">
      <div className="sap-header-title">Vendor List: ALV Grid</div>

      <div className="sap-selection-area">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="relative flex items-center bg-white border border-gray-400 h-6 w-80 px-1 group focus-within:border-blue-500">
             <Search className="h-3.5 w-3.5 text-gray-400 mr-1" />
             <input value={search} onChange={(e) => setSearch(e.target.value)} className="w-full h-full text-xs outline-none" placeholder="Search Vendors..." />
          </div>
          <div className="text-[11px] font-bold text-gray-600 uppercase">Records: {sortedData.length}</div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <Table className="sap-alv-grid">
          <TableHeader className="sap-alv-header">
            <TableRow className="h-8 border-b-[#b5c7de]">
              <TableHead className="text-[11px] font-bold border-r w-12 text-center">#</TableHead>
              <TableHead onClick={() => handleSort('vendorCode')} className="text-[11px] font-bold border-r w-32 cursor-pointer hover:bg-gray-200">
                <div className="flex items-center">Vendor Code <SortIcon column="vendorCode" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('vendorName')} className="text-[11px] font-bold border-r cursor-pointer hover:bg-gray-200">
                <div className="flex items-center">Vendor Name <SortIcon column="vendorName" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('contact')} className="text-[11px] font-bold border-r w-48 cursor-pointer hover:bg-gray-200">
                <div className="flex items-center">Contact <SortIcon column="contact" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('gstin')} className="text-[11px] font-bold text-gray-700 w-48 cursor-pointer hover:bg-gray-200">
                <div className="flex items-center">GSTIN <SortIcon column="gstin" /></div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-10 text-xs">LOADING...</TableCell></TableRow>
            ) : sortedData.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-10 text-xs text-red-500 font-bold uppercase">No records found matching Selection</TableCell></TableRow>
            ) : sortedData.map((v, i) => (
              <TableRow key={v.id} className="h-8 hover:bg-blue-50/20 transition-colors border-b border-gray-100 group">
                <TableCell className="p-0 text-center text-[11px] border-r text-gray-400 group-hover:text-blue-600">{i + 1}</TableCell>
                <TableCell className="p-0 px-2 text-[11px] border-r font-mono font-bold text-blue-700">{v.vendorCode || v.vendorId || "-"}</TableCell>
                <TableCell className="p-0 px-2 text-[11px] border-r font-medium">{v.vendorName}</TableCell>
                <TableCell className="p-0 px-2 text-[11px] border-r">{v.contact}</TableCell>
                <TableCell className="p-0 px-2 text-[11px] font-mono">{v.gstin}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="bg-[#333e4f] h-6 flex items-center px-4 text-white text-[10px] uppercase">
        ALV_GRID_MODE • SYSTEM_REPO: VENDORS
      </div>
    </div>
  );
}


