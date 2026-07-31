"use client";

import { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDatabase, useCollection, useMemoDatabase } from "@/database";
import { collection, query, orderBy } from "@/database/mongo";
import { Search, Filter, Download, Printer, ArrowUpDown, ChevronUp, ChevronDown } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function MM03() {
  const db = useDatabase();
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const materialsQuery = useMemoDatabase(() => query(collection(db, "materials"), orderBy("createdAt", "desc")), [db]);
  const { data: materials, isLoading } = useCollection(materialsQuery);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedData = useMemo(() => {
    if (!materials) return [];
    const filtered = materials.filter(m => 
      m.productName?.toLowerCase().includes(search.toLowerCase()) ||
      m.hsnSac?.toLowerCase().includes(search.toLowerCase()) ||
      m.documentCategory?.toLowerCase().includes(search.toLowerCase()) ||
      m.plantId?.toLowerCase().includes(search.toLowerCase())
    );

    if (!sortConfig) return filtered;

    return [...filtered].sort((a, b) => {
      const aVal = String(a[sortConfig.key] || "").toLowerCase();
      const bVal = String(b[sortConfig.key] || "").toLowerCase();
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [materials, search, sortConfig]);

  const SortIcon = ({ column }: { column: string }) => {
    if (sortConfig?.key !== column) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
    return sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3 ml-1 text-blue-600" /> : <ChevronDown className="h-3 w-3 ml-1 text-blue-600" />;
  };

  return (
    <div className="w-full flex flex-col bg-white min-h-full">
      <div className="sap-header-title">Material List: ALV Grid</div>

      <div className="sap-selection-area">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="relative flex items-center bg-white border border-gray-400 h-6 w-80 px-1 group focus-within:border-blue-500">
             <Search className="h-3.5 w-3.5 text-gray-400 mr-1" />
             <input value={search} onChange={(e) => setSearch(e.target.value)} className="w-full h-full text-xs outline-none" placeholder="Search Materials..." />
          </div>
          <div className="text-[11px] font-bold text-gray-600 uppercase">Total Materials: {sortedData.length}</div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <Table className="sap-alv-grid">
          <TableHeader className="sap-alv-header">
            <TableRow className="h-8 border-b-[#b5c7de]">
              <TableHead className="text-[11px] font-bold text-gray-700 border-r w-10 text-center">#</TableHead>
              <TableHead onClick={() => handleSort('productName')} className="text-[11px] font-bold text-gray-700 border-r w-64 cursor-pointer hover:bg-gray-200">
                <div className="flex items-center">MATERIAL <SortIcon column="productName" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('documentCategory')} className="text-[11px] font-bold text-gray-700 border-r w-48 cursor-pointer hover:bg-gray-200">
                <div className="flex items-center">CHARGE TYPE <SortIcon column="documentCategory" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('hsnSac')} className="text-[11px] font-bold text-gray-700 border-r w-32 cursor-pointer hover:bg-gray-200">
                <div className="flex items-center">HSN/SAC <SortIcon column="hsnSac" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('uom')} className="text-[11px] font-bold text-gray-700 border-r w-24 cursor-pointer hover:bg-gray-200">
                <div className="flex items-center">UOM <SortIcon column="uom" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('inventoryType')} className="text-[11px] font-bold text-gray-700 border-r w-32 cursor-pointer hover:bg-gray-200">
                <div className="flex items-center">Inv. Type <SortIcon column="inventoryType" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('plantId')} className="text-[11px] font-bold text-gray-700 w-24 cursor-pointer hover:bg-gray-200">
                <div className="flex items-center">Plant <SortIcon column="plantId" /></div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-10 text-xs">RETRIVING DATA...</TableCell></TableRow>
            ) : sortedData.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-10 text-xs text-red-500 font-bold uppercase">No records found matching criteria</TableCell></TableRow>
            ) : sortedData.map((m, i) => (
              <TableRow key={m.id} className="h-8 hover:bg-blue-50/20 transition-colors border-b border-gray-100 group">
                <TableCell className="p-0 text-center text-[10px] border-r text-gray-400 group-hover:text-blue-600">{i + 1}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r font-bold text-blue-700">{m.productName}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r text-gray-600">{m.documentCategory || "-"}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r text-center">{m.hsnSac}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r text-center">{m.uom}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r text-center">{m.inventoryType || "-"}</TableCell>
                <TableCell className="p-0 px-2 text-[10px]">{m.plantId}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="bg-[#333e4f] h-6 flex items-center px-4 text-white text-[10px] uppercase">
        MARA_TABLE_VIEW • SYSTEM_REPO: MATERIALS
      </div>
    </div>
  );
}
