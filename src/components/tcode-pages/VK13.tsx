"use client";

import { useState, useMemo, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDatabase, useCollection, useMemoDatabase } from "@/database";
import { collection, query, orderBy } from "@/database/mongo";
import { Search, Filter, Download, Printer, ArrowUpDown, ChevronUp, ChevronDown, FileText, Eye, X, ExternalLink, FileDown } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import PlantMultiSelect from "./PlantMultiSelect";
import { toSAPDate } from "@/lib/date-utils";
import { getCurrentUser, NO_MASTER_RECORDS_MESSAGE } from "@/lib/plant-master";
import { downloadCsv } from "@/lib/csv-export";

export default function VK13() {
  const db = useDatabase();
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [selectedPlants, setSelectedPlants] = useState<string[]>([]);
  const [authorizedPlantIds, setAuthorizedPlantIds] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const { assignedPlantIds, isAdmin } = getCurrentUser();
    setAuthorizedPlantIds(assignedPlantIds);
    setIsAdmin(isAdmin);
  }, []);

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

  const plantsQuery = useMemoDatabase(() => collection(db, "plants"), [db]);
  const { data: plants, isLoading: isPlantsLoading } = useCollection(plantsQuery);

  const customersQuery = useMemoDatabase(() => collection(db, "customers"), [db]);
  const { data: customers } = useCollection(customersQuery);

  const materialsQuery = useMemoDatabase(() => collection(db, "materials"), [db]);
  const { data: materials } = useCollection(materialsQuery);

  const allowedPlantIds = isAdmin ? undefined : (authorizedPlantIds.length ? authorizedPlantIds : undefined);

  const customerMap = useMemo(() => {
    const map: Record<string, any> = {};
    customers?.forEach(c => { map[c.customerId] = c; });
    return map;
  }, [customers]);

  const materialMap = useMemo(() => {
    const map: Record<string, any> = {};
    materials?.forEach(m => {
      if (m.materialCode) map[m.materialCode?.toUpperCase()] = m;
      if (m.productName) map[m.productName?.toUpperCase()] = m;
    });
    return map;
  }, [materials]);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedData = useMemo(() => {
    if (!records) return [];

    // Plant authorization filter
    let baseData = records;
    if (!isAdmin && authorizedPlantIds.length > 0) {
      baseData = records.filter(r => r.plantId && authorizedPlantIds.includes(r.plantId));
    }
    // Plant-wise filtering
    if (selectedPlants.length > 0) {
      baseData = baseData.filter(r => r.plantId && selectedPlants.includes(r.plantId));
    }

    const q = search.trim().toLowerCase();
    const filtered = baseData.filter(r => {
      const customerName = customerMap[r.customerCode]?.name || "";
      const materialName = r.materialName || materialMap[r.materialCode?.toUpperCase()]?.productName || "";
      return [
        r.plantId, r.inventoryType, r.documentType, r.documentCategory,
        r.customerCode, customerName, r.materialCode, materialName,
        r.hsnSac, r.gstRate, r.price, r.validFrom, r.validTo, r.status
      ].some(v => String(v ?? "").toLowerCase().includes(q));
    });

    if (!sortConfig) return filtered;

    return [...filtered].sort((a, b) => {
      const getVal = (r: any) => {
        if (sortConfig.key === 'customerName') return customerMap[r.customerCode]?.name || "";
        if (sortConfig.key === 'materialName') return r.materialName || materialMap[r.materialCode?.toUpperCase()]?.productName || "";
        return r[sortConfig.key];
      };
      const aVal = String(getVal(a) ?? "").toLowerCase();
      const bVal = String(getVal(b) ?? "").toLowerCase();
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [records, search, sortConfig, selectedPlants, isAdmin, authorizedPlantIds, customerMap, materialMap]);

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

  const downloadApprovalDoc = () => {
    if (!selectedRecord) return;
    const file = selectedRecord.approvalFile;
    if (!file) {
      window.dispatchEvent(new CustomEvent('sap-status', {
        detail: { text: "No approval document available", isError: true }
      }));
      return;
    }
    const isPdf = file.startsWith('data:application/pdf');
    const a = document.createElement('a');
    a.href = file;
    a.download = `${selectedRecord.approvalFileName || `Approval_${selectedRecord.materialCode || 'DOC'}_${selectedRecord.customerCode || ''}`}.${isPdf ? 'pdf' : 'png'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.dispatchEvent(new CustomEvent('sap-status', {
      detail: { text: "Approval document downloaded", isError: false }
    }));
  };

  const handleCsvExport = () => {
    if (sortedData.length === 0) {
      window.dispatchEvent(new CustomEvent('sap-status', {
        detail: { text: "No records to export", isError: true }
      }));
      return;
    }
    const headers = [
      "Plant",
      "Inventory Type",
      "Document Type",
      "Charge Type",
      "Customer Code",
      "Customer Name",
      "Material Code",
      "Material Name",
      "HSN/SAC",
      "GST Rate (%)",
      "Basic Rate",
      "Validity From",
      "Validity To",
      "Status",
    ];
    const rows = sortedData.map(r => [
      r.plantId || "",
      r.inventoryType || "",
      r.documentType || "",
      r.documentCategory || "",
      r.customerCode || "",
      customerMap[r.customerCode]?.name || r.customerName || "",
      r.materialCode || "",
      r.materialName || materialMap[r.materialCode?.toUpperCase()]?.productName || "",
      r.hsnSac || materialMap[r.materialCode?.toUpperCase()]?.hsnSac || "",
      r.gstRate !== undefined ? r.gstRate : (materialMap[r.materialCode?.toUpperCase()]?.gstRate ?? ""),
      r.price !== undefined ? r.price : "",
      toSAPDate(r.validFrom),
      toSAPDate(r.validTo),
      r.status || "Active",
    ]);
    downloadCsv("VK13", headers, rows);
  };

  return (
    <div className="w-full flex flex-col bg-white min-h-full">
      <div className="bg-[#dae8f5] px-4 py-1 border-b border-gray-300">
        <h2 className="text-[13px] font-bold text-gray-800 uppercase italic tracking-wider">
          Condition Records Registry (VK13)
        </h2>
      </div>

<div className="bg-[#e7ebf1] border-b border-[#b5c7de] px-4 py-1 flex flex-wrap items-center justify-between gap-2">
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
          <div className="relative flex items-center bg-white border border-gray-400 h-6 w-64 px-1 group focus-within:border-blue-500">
             <Search className="h-3.5 w-3.5 text-gray-400 mr-1" />
             <input value={search} onChange={(e) => setSearch(e.target.value)} className="w-full h-full text-xs outline-none" placeholder="Filter registry data..." />
          </div>
          <div className="flex items-center gap-1 opacity-60">
            <button className="p-1 hover:bg-gray-300 rounded text-gray-600"><Filter className="h-4 w-4" /></button>
            <button className="p-1 hover:bg-gray-300 rounded text-gray-600"><Printer className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-[10px] font-black text-gray-500 uppercase tracking-tighter">System Data • {sortedData.length} Entry(s)</div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={handleCsvExport} className="p-1 hover:bg-blue-100 rounded text-blue-700 transition-colors" title="Download CSV">
                  <FileDown className="h-5 w-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Download CSV</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <div className="flex-1 overflow-auto no-scrollbar">
        <Table className="min-w-[2200px]">
          <TableHeader className="bg-[#e7ebf1] sticky top-0 z-10 shadow-sm">
            <TableRow className="h-8 border-b-[#b5c7de]">
              <TableHead className="text-[11px] font-bold border-r w-10 text-center">#</TableHead>
              <TableHead onClick={() => handleSort('plantId')} className="text-[11px] font-bold border-r w-20 cursor-pointer hover:bg-gray-200">Plant <SortIcon column="plantId" /></TableHead>
              <TableHead onClick={() => handleSort('inventoryType')} className="text-[11px] font-bold border-r cursor-pointer hover:bg-gray-200">Inventory Type <SortIcon column="inventoryType" /></TableHead>
              <TableHead onClick={() => handleSort('documentType')} className="text-[11px] font-bold border-r cursor-pointer hover:bg-gray-200">Document Type <SortIcon column="documentType" /></TableHead>
              <TableHead onClick={() => handleSort('documentCategory')} className="text-[11px] font-bold border-r cursor-pointer hover:bg-gray-200">Charge Type <SortIcon column="documentCategory" /></TableHead>
              <TableHead onClick={() => handleSort('customerCode')} className="text-[11px] font-bold border-r w-28 cursor-pointer hover:bg-gray-200">Customer Code <SortIcon column="customerCode" /></TableHead>
              <TableHead onClick={() => handleSort('customerName')} className="text-[11px] font-bold border-r cursor-pointer hover:bg-gray-200">Customer Name <SortIcon column="customerName" /></TableHead>
              <TableHead onClick={() => handleSort('materialCode')} className="text-[11px] font-bold border-r cursor-pointer hover:bg-gray-200">Material Code <SortIcon column="materialCode" /></TableHead>
              <TableHead onClick={() => handleSort('materialName')} className="text-[11px] font-bold border-r cursor-pointer hover:bg-gray-200">Material Name <SortIcon column="materialName" /></TableHead>
              <TableHead onClick={() => handleSort('hsnSac')} className="text-[11px] font-bold border-r w-24 cursor-pointer hover:bg-gray-200">HSN/SAC <SortIcon column="hsnSac" /></TableHead>
              <TableHead onClick={() => handleSort('gstRate')} className="text-[11px] font-bold border-r w-16 text-center cursor-pointer hover:bg-gray-200">GST Rate (%) <SortIcon column="gstRate" /></TableHead>
              <TableHead onClick={() => handleSort('price')} className="text-[11px] font-bold border-r w-28 text-right cursor-pointer hover:bg-gray-200">Basic Rate <SortIcon column="price" /></TableHead>
              <TableHead onClick={() => handleSort('validFrom')} className="text-[11px] font-bold border-r w-28 cursor-pointer hover:bg-gray-200">Validity From <SortIcon column="validFrom" /></TableHead>
              <TableHead onClick={() => handleSort('validTo')} className="text-[11px] font-bold border-r w-28 cursor-pointer hover:bg-gray-200">Validity To <SortIcon column="validTo" /></TableHead>
              <TableHead onClick={() => handleSort('status')} className="text-[11px] font-bold border-r w-24 cursor-pointer hover:bg-gray-200">Status <SortIcon column="status" /></TableHead>
              <TableHead className="text-[11px] font-bold w-24 text-center">Approval</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={16} className="text-center py-20 text-[10px] font-bold uppercase tracking-widest animate-pulse">Syncing System Repository...</TableCell></TableRow>
) : sortedData.length === 0 ? (
               <TableRow><TableCell colSpan={16} className="text-center py-20 text-xs text-red-500 font-bold uppercase">{selectedPlants.length > 0 ? NO_MASTER_RECORDS_MESSAGE : "No condition records found matching selection"}</TableCell></TableRow>
            ) : sortedData.map((r, i) => {
              const customerName = customerMap[r.customerCode]?.name || r.customerName || "-";
              const materialName = r.materialName || materialMap[r.materialCode?.toUpperCase()]?.productName || "-";
              const hsn = r.hsnSac || materialMap[r.materialCode?.toUpperCase()]?.hsnSac || "-";
              const gst = r.gstRate !== undefined ? r.gstRate : (materialMap[r.materialCode?.toUpperCase()]?.gstRate ?? "-");
              return (
              <TableRow key={r.id} className="h-8 hover:bg-blue-50/30 transition-colors border-b border-gray-100 group">
                <TableCell className="p-0 text-center text-[10px] border-r text-gray-400 group-hover:text-blue-600">{i + 1}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r font-mono font-bold text-gray-600 text-center">{r.plantId}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r text-center uppercase">{r.inventoryType || "-"}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r text-center uppercase">{r.documentType || "-"}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r text-center uppercase">{r.documentCategory || "-"}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r font-mono text-center">{r.customerCode}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r text-gray-700 truncate max-w-[160px]">{customerName}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r font-mono font-black text-blue-900">{r.materialCode}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r text-gray-700 truncate max-w-[160px]">{materialName}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r font-mono text-center">{hsn}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r text-center font-bold text-gray-500">{gst}%</TableCell>
<TableCell className="p-0 px-2 text-[10px] border-r text-right font-bold text-emerald-800">
                  {String(r.price).trim().toUpperCase() === 'FIX' ? <span className="text-amber-700">FIX</span> : `INR ${Number(r.price).toLocaleString()}`}
                </TableCell>
<TableCell className="p-0 px-2 text-[10px] border-r text-center font-mono text-gray-500">{toSAPDate(r.validFrom)}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r text-center font-mono text-gray-500">{toSAPDate(r.validTo)}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r text-center">
                  <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[9px] border ${String(r.status).toLowerCase() === 'active' || String(r.status).toLowerCase() === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>{r.status || "Active"}</span>
                </TableCell>
                <TableCell className="p-0 border-r text-center px-1">
                  <Button variant="ghost" onClick={() => handleOpenPreview(r)} className="h-6 w-16 gap-1 text-[9px] font-black uppercase text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-none"><Eye className="h-3 w-3" /> View</Button>
                </TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl p-0 rounded-none border-gray-400 overflow-hidden shadow-2xl">
          <div className="bg-[#333e4f] text-white p-2 flex justify-between items-center">
            <DialogTitle className="text-[11px] font-black uppercase tracking-widest pl-2 flex items-center gap-2"><FileText className="h-4 w-4 text-emerald-400" /> Verification Attachment: {selectedRecord?.approvalFileName || 'PRICING_DOC'}</DialogTitle>
            <div className="flex items-center gap-2">
              <button onClick={downloadApprovalDoc} className="hover:bg-white/10 p-1" title="Download"><Download className="h-4 w-4" /></button>
              <DialogTrigger asChild><button className="hover:bg-white/10 p-1"><X className="h-4 w-4" /></button></DialogTrigger>
            </div>
          </div>

          {/* Document metadata */}
          <div className="bg-[#f4f6f9] border-b border-gray-300 px-5 py-2 grid grid-cols-2 gap-2 text-[11px]">
            <div><label className="text-gray-400 block uppercase font-bold text-[8px]">Document Name</label><span className="font-bold">{selectedRecord?.approvalFileName || "N/A"}</span></div>
            <div><label className="text-gray-400 block uppercase font-bold text-[8px]">Uploaded By</label><span className="font-bold">{selectedRecord?.createdBy || selectedRecord?.approvedBy || "SYSTEM"}</span></div>
            <div><label className="text-gray-400 block uppercase font-bold text-[8px]">Uploaded Date & Time</label><span className="font-mono">{selectedRecord?.createdAt ? new Date(selectedRecord.createdAt).toLocaleString() : "N/A"}</span></div>
            <div><label className="text-gray-400 block uppercase font-bold text-[8px]">Material</label><span className="font-mono font-bold">{selectedRecord?.materialCode || "-"}</span></div>
          </div>

          <div className="p-8 bg-gray-50 flex items-center justify-center min-h-[400px]">
            {selectedRecord?.approvalFile ? (
              <>
              {pdfBlobUrl ? (
                <div className="text-center space-y-6 animate-in zoom-in-95 duration-300">
                   <div className="bg-white p-10 border-2 border-dashed border-gray-300 rounded-2xl shadow-sm">
                      <FileText className="h-32 w-32 text-red-500 mx-auto mb-4 stroke-1" />
                      <h3 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Secure PDF Attachment</h3>
                      <p className="text-sm text-gray-500 mt-2 max-w-[320px]">This document is stored in the system repository. Please use the secure viewer for full clarity.</p>
                   </div>
                   <div className="flex justify-center gap-4">
                     <Button onClick={openPdfInNewTab} className="bg-blue-700 hover:bg-blue-800 rounded-none h-12 px-10 font-black uppercase tracking-widest shadow-xl gap-3">
                       <ExternalLink className="h-5 w-5" /> Launch PDF Viewer
                     </Button>
                     <Button onClick={downloadApprovalDoc} className="bg-emerald-700 hover:bg-emerald-800 rounded-none h-12 px-10 font-black uppercase tracking-widest shadow-xl gap-3">
                       <Download className="h-5 w-5" /> Download PDF
                     </Button>
                   </div>
                </div>
              ) : (
                <div className="text-center">
                  <img src={selectedRecord.approvalFile} alt="Approval" className="max-w-full max-h-[55vh] object-contain shadow-2xl border-8 border-white animate-in fade-in duration-500" />
                  <div className="mt-4 flex justify-center gap-4">
                    <Button onClick={downloadApprovalDoc} className="bg-emerald-700 hover:bg-emerald-800 rounded-none h-10 px-8 font-black uppercase tracking-widest shadow-lg gap-2">
                      <Download className="h-4 w-4" /> Download
                    </Button>
                  </div>
                </div>
              )}
              </>
            ) : (
              <div className="text-gray-400 font-bold uppercase text-[10px]">No approval document available.</div>
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
