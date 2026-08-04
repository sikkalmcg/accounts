
"use client";

import { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDatabase, useCollection, useMemoDatabase } from "@/database";
import { collection, query, orderBy } from "@/database/mongo";
import { Search, Filter, Download, Printer, ArrowUpDown, ChevronUp, ChevronDown } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function SU03() {
  const db = useDatabase();
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const usersQuery = useMemoDatabase(() => query(collection(db, "users"), orderBy("createdAt", "desc")), [db]);
  const { data: users, isLoading } = useCollection(usersQuery);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedData = useMemo(() => {
    if (!users) return [];
    const filtered = users.filter(u => {
      const plantList = u.assignedPlantIds?.join(", ") || u.assignedPlantId || "";
      return (
        u.username?.toLowerCase().includes(search.toLowerCase()) || 
        u.name?.toLowerCase().includes(search.toLowerCase()) ||
        plantList.toLowerCase().includes(search.toLowerCase()) ||
        u.role?.toLowerCase().includes(search.toLowerCase())
      );
    });

    if (!sortConfig) return filtered;

    return [...filtered].sort((a, b) => {
      const aVal = String(a[sortConfig.key] || "").toLowerCase();
      const bVal = String(b[sortConfig.key] || "").toLowerCase();
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [users, search, sortConfig]);

  const SortIcon = ({ column }: { column: string }) => {
    if (sortConfig?.key !== column) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
    return sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3 ml-1 text-blue-600" /> : <ChevronDown className="h-3 w-3 ml-1 text-blue-600" />;
  };

  return (
    <div className="w-full flex flex-col bg-white min-h-full">
      <div className="bg-[#dae8f5] px-4 py-1 border-b border-gray-300">
        <h2 className="text-[13px] font-bold text-gray-800 uppercase italic tracking-wider">
          User List: Display ALV Grid
        </h2>
      </div>

      <div className="bg-[#e7ebf1] border-b border-[#b5c7de] px-4 py-1 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative flex items-center bg-white border border-gray-400 h-6 w-64 px-1 group focus-within:border-blue-500">
             <Search className="h-3.5 w-3.5 text-gray-400 mr-1" />
             <input value={search} onChange={(e) => setSearch(e.target.value)} className="w-full h-full text-xs outline-none" placeholder="Search Users / Plants..." />
          </div>
          <TooltipProvider>
            <div className="flex items-center gap-1">
              <Tooltip><TooltipTrigger asChild><button className="p-1 hover:bg-gray-300 rounded text-gray-600"><Filter className="h-4 w-4" /></button></TooltipTrigger><TooltipContent>Filter</TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild><button className="p-1 hover:bg-gray-300 rounded text-gray-600"><Printer className="h-4 w-4" /></button></TooltipTrigger><TooltipContent>Print</TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild><button className="p-1 hover:bg-gray-300 rounded text-gray-600"><Download className="h-4 w-4" /></button></TooltipTrigger><TooltipContent>Export</TooltipContent></Tooltip>
            </div>
          </TooltipProvider>
        </div>
        <div className="text-[11px] font-bold text-gray-600 uppercase">Records: {sortedData.length}</div>
      </div>

      <div className="flex-1 overflow-auto no-scrollbar">
        <Table className="min-w-[1000px]">
          <TableHeader className="bg-[#e7ebf1] sticky top-0 z-10">
            <TableRow className="h-8 border-b-[#b5c7de]">
              <TableHead className="text-[11px] font-bold border-r w-10 text-center">#</TableHead>
              <TableHead onClick={() => handleSort('username')} className="text-[11px] font-bold border-r w-40 cursor-pointer hover:bg-gray-200">
                <div className="flex items-center">Username <SortIcon column="username" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('name')} className="text-[11px] font-bold border-r cursor-pointer hover:bg-gray-200">
                <div className="flex items-center">Full Name <SortIcon column="name" /></div>
              </TableHead>
              <TableHead className="text-[11px] font-bold border-r w-48 text-center bg-[#e1e1e1]">Plant Access</TableHead>
              <TableHead onClick={() => handleSort('role')} className="text-[11px] font-bold border-r w-32 cursor-pointer hover:bg-gray-200">
                <div className="flex items-center">Role <SortIcon column="role" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('updatedAt')} className="text-[11px] font-bold border-r w-32 cursor-pointer hover:bg-gray-200">
                <div className="flex items-center justify-center">Last Updated <SortIcon column="updatedAt" /></div>
              </TableHead>
              <TableHead className="text-[11px] font-bold text-center w-24">Audit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-10 text-xs">LOADING SYSTEM REPOSITORY...</TableCell></TableRow>
            ) : sortedData.map((u, i) => (
              <TableRow key={u.id} className="h-8 hover:bg-blue-50/50 transition-colors border-b border-gray-100 group">
                <TableCell className="p-0 text-center text-[10px] border-r text-gray-400 group-hover:text-blue-600">{i + 1}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r font-mono font-bold text-blue-700">{u.username}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r font-medium text-gray-700">{u.name}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r text-center font-bold text-emerald-800 bg-emerald-50/20">
                  {u.assignedPlantIds?.length > 0 ? u.assignedPlantIds.join(", ") : (u.assignedPlantId || "-")}
                </TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r uppercase italic text-gray-600">{u.role}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r text-center">{u.updatedAt ? new Date(u.updatedAt).toLocaleDateString() : '-'}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] text-center font-mono font-black text-gray-400">{(u.editHistory?.length || 0) > 0 ? u.editHistory.length : '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="bg-[#333e4f] h-6 flex items-center px-4 text-white text-[10px] uppercase tracking-widest font-black italic">
        Authorized User Registry • Kernel 7.70 • ALV_GRID_MODE
      </div>
    </div>
  );
}


