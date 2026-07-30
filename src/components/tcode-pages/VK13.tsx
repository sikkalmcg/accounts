"use client";

import { useState, useMemo, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDatabase, useCollection, useMemoDatabase } from "@/database";
import { collection, query, orderBy } from "@/database/mongo";
import { Search, Filter, Download, Printer, ArrowUpDown, ChevronUp, ChevronDown, FileText, Eye, X, ExternalLink } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function VK13() {
  const db = useDatabase();
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const pdfBlobUrl = useMemo(() => {
    if (selectedRecord?.approvalFile?.startsWith('data:application/pdf')) {
      try {
        const parts = selectedRecord.approvalFile.split(',');
        const base64 = parts[1];
        const binary = atob(base64);
        const array = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
        const blob = new Blob([array], { type: 'application/pdf' });
        return URL.createObjectURL(blob);
      } catch (e) {
        console.error("PDF Blob generation failed", e);
        return null;
      }
    }
    return null;
  }, [selectedRecord]);

  useEffect(() => {
    return () => {
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
    };
  }, [pdfBlobUrl]);

  const pricingQuery = useMemoDatabase(() => query(collection(db, "pricing"), orderBy("createdAt", "desc")), [db]);
  const { data: records, isLoading } = useCollection(pricingQuery);

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
      r.customerCode?.toLowerCase().includes(search.toLowerCase()) || 
      r.materialCode?.toLowerCase().includes(search.toLowerCase()) ||
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
  }, [records, search, sortConfig]);

  const SortIcon = ({ column }: { column: string }) => {
    if (sortConfig?.key !== column) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
    return sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3 ml-1 text-blue-600" /> : <ChevronDown className="h-3 w-3 ml-1 text-blue-600" />;
  };

  const openPdfInNewTab = () => {
    if (pdfBlobUrl) window.open(pdfBlobUrl, '_blank');
  };

  const handleOpenPreview = (record: any) => {
    setSelectedRecord(record);
    setIsPreviewOpen(true);
  };

  return (
    <div className="w-full flex flex-col bg-white min-h-full">
      <div className="bg-[#dae8f5] px-4 py-1 border-b border-gray-300">
        <h2 className="text-[13px] font-bold text-gray-800 uppercase italic tracking-wider">
          Condition Records Registry (VK13)
        </h2>
      </div>

      <div className="bg-[#e7ebf1] border-b border-[#b5c7de] px-4 py-1 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative flex items-center bg-white border border-gray-400 h-6 w-64 px-1 group focus-within:border-blue-500">
             <Search className="h-3.5 w-3.5 text-gray-400 mr-1" />
             <input value={search} onChange={(e) => setSearch(e.target.value)} className="w-full h-full text-xs outline-none" placeholder="Filter registry data..." />
          </div>
          <div className="flex items-center gap-1 opacity-60">
            <button className="p-1 hover:bg-gray-300 rounded text-gray-600"><Filter className="h-4 w-4" /></button>
            <button className="p-1 hover:bg-gray-300 rounded text-gray-600"><Printer className="h-4 w-4" /></button>
            <button className="p-1 hover:bg-gray-300 rounded text-gray-600"><Download className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="text-[10px] font-black text-gray-500 uppercase tracking-tighter">System Data • {sortedData.length} Entry(s)</div>
      </div>

      <div className="flex-1 overflow-auto no-scrollbar">
        <Table className="min-w-[1900px]">
          <TableHeader className="bg-[#e7ebf1] sticky top-0 z-10 shadow-sm">
            <TableRow className="h-8 border-b-[#b5c7de]">
              <TableHead className="text-[11px] font-bold border-r w-10 text-center">#</TableHead>
              <TableHead className="text-[11px] font-bold border-r w-24 text-center bg-[#e1e1e1]">Attachment</TableHead>
              <TableHead onClick={() => handleSort('plantId')} className="text-[11px] font-bold border-r w-20 cursor-pointer hover:bg-gray-200">Plant <SortIcon column="plantId" /></TableHead>
              <TableHead onClick={() => handleSort('documentType')} className="text-[11px] font-bold border-r w-32 cursor-pointer hover:bg-gray-200">Doc. Type <SortIcon column="documentType" /></TableHead>
              <TableHead onClick={() => handleSort('documentCategory')} className="text-[11px] font-bold border-r w-32 cursor-pointer hover:bg-gray-200">Category <SortIcon column="documentCategory" /></TableHead>
              <TableHead onClick={() => handleSort('customerCode')} className="text-[11px] font-bold border-r w-32 cursor-pointer hover:bg-gray-200">Customer <SortIcon column="customerCode" /></TableHead>
              <TableHead onClick={() => handleSort('inventoryType')} className="text-[11px] font-bold border-r w-32 cursor-pointer hover:bg-gray-200">Inventory Type <SortIcon column="inventoryType" /></TableHead>
              <TableHead onClick={() => handleSort('materialCode')} className="text-[11px] font-bold border-r w-32 cursor-pointer hover:bg-gray-200">Material <SortIcon column="materialCode" /></TableHead>
              <TableHead onClick={() => handleSort('price')} className="text-[11px] font-bold border-r w-28 text-right cursor-pointer hover:bg-gray-200">Basic Price <SortIcon column="price" /></TableHead>
              <TableHead className="text-[11px] font-bold border-r w-16 text-center">GST %</TableHead>
              <TableHead onClick={() => handleSort('validFrom')} className="text-[11px] font-bold border-r w-28 cursor-pointer hover:bg-gray-200">Valid From <SortIcon column="validFrom" /></TableHead>
              <TableHead onClick={() => handleSort('validTo')} className="text-[11px] font-bold w-28 text-center cursor-pointer hover:bg-gray-200">Valid To <SortIcon column="validTo" /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={11} className="text-center py-20 text-[10px] font-bold uppercase tracking-widest animate-pulse">Syncing System Repository...</TableCell></TableRow>
            ) : sortedData.length === 0 ? (
               <TableRow><TableCell colSpan={11} className="text-center py-20 text-xs text-red-500 font-bold uppercase">No condition records found matching selection</TableCell></TableRow>
            ) : sortedData.map((r, i) => (
              <TableRow key={r.id} className="h-8 hover:bg-blue-50/30 transition-colors border-b border-gray-100 group">
                <TableCell className="p-0 text-center text-[10px] border-r text-gray-400 group-hover:text-blue-600">{i + 1}</TableCell>
                <TableCell className="p-0 border-r text-center px-1">
                  {r.approvalFile ? (
                    <Button variant="ghost" onClick={() => handleOpenPreview(r)} className="h-6 w-16 gap-1 text-[9px] font-black uppercase text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-none"><Eye className="h-3 w-3" /> View</Button>
                  ) : <span className="text-[9px] text-gray-300 font-bold uppercase italic">N/A</span>}
                </TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r font-mono font-bold text-gray-600 text-center">{r.plantId}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r text-center uppercase">{r.documentType || "-"}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r text-center uppercase">{r.documentCategory || "-"}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r font-mono text-center">{r.customerCode}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r font-mono text-center">{r.inventoryType || "-"}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r font-mono font-black text-blue-900">{r.materialCode}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r text-right font-bold text-emerald-800">INR {Number(r.price).toLocaleString()}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r text-center font-bold text-gray-500">{r.gstRate}%</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r text-center font-mono text-gray-500">{r.validFrom}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] text-center font-mono text-gray-500">{r.validTo}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl p-0 rounded-none border-gray-400 overflow-hidden shadow-2xl">
          <div className="bg-[#333e4f] text-white p-2 flex justify-between items-center">
            <DialogTitle className="text-[11px] font-black uppercase tracking-widest pl-2 flex items-center gap-2"><FileText className="h-4 w-4 text-emerald-400" /> Verification Attachment: {selectedRecord?.approvalFileName || 'PRICING_DOC'}</DialogTitle>
            <DialogTrigger asChild><button className="hover:bg-white/10 p-1"><X className="h-4 w-4" /></button></DialogTrigger>
          </div>
          <div className="p-8 bg-gray-50 flex items-center justify-center min-h-[450px]">
            {pdfBlobUrl ? (
              <div className="text-center space-y-6 animate-in zoom-in-95 duration-300">
                 <div className="bg-white p-10 border-2 border-dashed border-gray-300 rounded-2xl shadow-sm">
                    <FileText className="h-32 w-32 text-red-500 mx-auto mb-4 stroke-1" />
                    <h3 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Secure PDF Attachment</h3>
                    <p className="text-sm text-gray-500 mt-2 max-w-[320px]">This document is stored in the system repository. Please use the secure viewer for full clarity.</p>
                 </div>
                 <Button onClick={openPdfInNewTab} className="bg-blue-700 hover:bg-blue-800 rounded-none h-12 px-10 font-black uppercase tracking-widest shadow-xl gap-3">
                    <ExternalLink className="h-5 w-5" /> Launch PDF Viewer
                 </Button>
              </div>
            ) : selectedRecord?.approvalFile ? (
              <img src={selectedRecord.approvalFile} alt="Approval" className="max-w-full max-h-[75vh] object-contain shadow-2xl border-8 border-white animate-in fade-in duration-500" />
            ) : (
              <div className="text-gray-400 font-bold uppercase text-[10px]">No Verification Document Found</div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <div className="bg-[#333e4f] h-6 flex items-center px-4 text-white text-[9px] uppercase tracking-widest shadow-inner border-t border-black/20 font-black italic">
        System Repository • ALV Grid Condition List • PRICING_MASTER_REGISTRY
      </div>
    </div>
  );
}

