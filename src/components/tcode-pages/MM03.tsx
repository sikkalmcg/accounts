"use client";

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDatabase, useCollection, useMemoDatabase } from "@/database";
import { collection, query, orderBy } from "@/database/mongo";
import { Search, ArrowUpDown, ChevronUp, ChevronDown, Download } from "lucide-react";
import PlantMultiSelect from "./PlantMultiSelect";
import { getCurrentUser, NO_MASTER_RECORDS_MESSAGE } from "@/lib/plant-master";
import { downloadCsv } from "@/lib/csv-export";

export default function MM03() {
  const db = useDatabase();
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [selectedPlants, setSelectedPlants] = useState<string[]>([]);
  const [authorizedPlantIds, setAuthorizedPlantIds] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const { assignedPlantIds, isAdmin: admin } = getCurrentUser();
    setAuthorizedPlantIds(assignedPlantIds);
    setIsAdmin(admin);
  }, []);

  const materialsQuery = useMemoDatabase(() => query(collection(db, "materials"), orderBy("createdAt", "desc")), [db]);
  const { data: materials, isLoading } = useCollection(materialsQuery);

  const plantsQuery = useMemoDatabase(() => collection(db, "plants"), [db]);
  const { data: plants, isLoading: isPlantsLoading } = useCollection(plantsQuery);

  const allowedPlantIds = isAdmin ? undefined : (authorizedPlantIds.length ? authorizedPlantIds : undefined);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

const sortedData = useMemo(() => {
    if (!materials) return [];

    // Plant authorization filter
    let baseData = materials;
    if (!isAdmin && authorizedPlantIds.length > 0) {
      baseData = materials.filter(m => m.plantId && authorizedPlantIds.includes(m.plantId));
    }
    // Selected plants filter
    if (selectedPlants.length > 0) {
      baseData = baseData.filter(m => m.plantId && selectedPlants.includes(m.plantId));
    }

    const filtered = baseData.filter(m => 
      m.materialCode?.toLowerCase().includes(search.toLowerCase()) ||
      m.productName?.toLowerCase().includes(search.toLowerCase()) ||
      m.hsnSac?.toLowerCase().includes(search.toLowerCase()) ||
      m.documentCategory?.toLowerCase().includes(search.toLowerCase()) ||
      m.plantId?.toLowerCase().includes(search.toLowerCase()) ||
      m.status?.toLowerCase().includes(search.toLowerCase())
    );

    if (!sortConfig) return filtered;

    return [...filtered].sort((a, b) => {
      const aVal = String(a[sortConfig.key] || "").toLowerCase();
      const bVal = String(b[sortConfig.key] || "").toLowerCase();
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [materials, search, sortConfig, selectedPlants, isAdmin, authorizedPlantIds]);

  const SortIcon = ({ column }: { column: string }) => {
    if (sortConfig?.key !== column) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
    return sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3 ml-1 text-blue-600" /> : <ChevronDown className="h-3 w-3 ml-1 text-blue-600" />;
  };

  const handleCsvExport = () => {
    if (sortedData.length === 0) {
      window.dispatchEvent(new CustomEvent('sap-status', {
        detail: { text: "No records to export", isError: true }
      }));
      return;
    }
    const headers = [
      "Plant ID",
      "Material Code",
      "Material Name",
      "UOM",
      "HSN Code",
      "GST Rate (%)",
      "Status",
      "Charge Type",
      "Inventory Type",
    ];
    const rows = sortedData.map(m => [
      m.plantId || "", m.materialCode || "", m.productName || "", m.uom || "", m.hsnSac || "",
      m.gstRate !== undefined ? m.gstRate : "", m.status || "", m.documentCategory || "", m.inventoryType || ""
    ]);
    downloadCsv("MM03_Material_List", headers, rows);
  };

  return (
    <div className="w-full flex flex-col bg-white min-h-full">
      <div className="sap-header-title">Material List: ALV Grid</div>

      <div className="bg-[#e7ebf1] border-b border-[#b5c7de] px-4 py-1.5 flex flex-wrap items-center justify-between gap-2">
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
          <div className="relative flex items-center bg-white border border-gray-400 h-6 w-80 px-1 group focus-within:border-blue-500">
             <Search className="h-3.5 w-3.5 text-gray-400 mr-1" />
             <input value={search} onChange={(e) => setSearch(e.target.value)} className="w-full h-full text-xs outline-none" placeholder="Search Materials..." />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-[11px] font-bold text-gray-600 uppercase">Total Materials: {sortedData.length}</div>
          <Button onClick={handleCsvExport} variant="outline" className="h-6 rounded-none bg-white border-gray-400 text-emerald-700 text-[10px] font-bold uppercase gap-1.5 shadow-sm hover:bg-emerald-50">
            <Download className="h-3.5 w-3.5" /> Export Excel
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <Table className="sap-alv-grid">
          <TableHeader className="sap-alv-header">
            <TableRow className="h-8 border-b-[#b5c7de]">
              <TableHead className="text-[11px] font-bold text-gray-700 border-r w-10 text-center">#</TableHead>
              <TableHead onClick={() => handleSort('plantId')} className="text-[11px] font-bold text-gray-700 border-r w-24 cursor-pointer hover:bg-gray-200">
                <div className="flex items-center">PLANT ID <SortIcon column="plantId" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('materialCode')} className="text-[11px] font-bold text-gray-700 border-r w-32 cursor-pointer hover:bg-gray-200">
                <div className="flex items-center">MATERIAL CODE <SortIcon column="materialCode" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('productName')} className="text-[11px] font-bold text-gray-700 border-r w-64 cursor-pointer hover:bg-gray-200">
                <div className="flex items-center">MATERIAL NAME <SortIcon column="productName" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('uom')} className="text-[11px] font-bold text-gray-700 border-r w-24 cursor-pointer hover:bg-gray-200">
                <div className="flex items-center">UOM <SortIcon column="uom" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('hsnSac')} className="text-[11px] font-bold text-gray-700 border-r w-32 cursor-pointer hover:bg-gray-200">
                <div className="flex items-center">HSN CODE <SortIcon column="hsnSac" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('gstRate')} className="text-[11px] font-bold text-gray-700 border-r w-28 cursor-pointer hover:bg-gray-200">
                <div className="flex items-center">GST RATE <SortIcon column="gstRate" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('status')} className="text-[11px] font-bold text-gray-700 border-r w-28 cursor-pointer hover:bg-gray-200">
                <div className="flex items-center">STATUS <SortIcon column="status" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('documentCategory')} className="text-[11px] font-bold text-gray-700 border-r w-48 cursor-pointer hover:bg-gray-200">
                <div className="flex items-center">CHARGE TYPE <SortIcon column="documentCategory" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('inventoryType')} className="text-[11px] font-bold text-gray-700 w-32 cursor-pointer hover:bg-gray-200">
                <div className="flex items-center">Inv. Type <SortIcon column="inventoryType" /></div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={10} className="text-center py-10 text-xs">RETRIVING DATA...</TableCell></TableRow>
            ) : sortedData.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="text-center py-10 text-xs text-red-500 font-bold uppercase">{selectedPlants.length > 0 ? NO_MASTER_RECORDS_MESSAGE : "No records found matching criteria"}</TableCell></TableRow>
            ) : sortedData.map((m, i) => (
              <TableRow key={m.id} className="h-8 hover:bg-blue-50/20 transition-colors border-b border-gray-100 group">
                <TableCell className="p-0 text-center text-[10px] border-r text-gray-400 group-hover:text-blue-600">{i + 1}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r font-mono font-bold text-gray-600 text-center">{m.plantId || "-"}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r font-mono font-bold text-blue-700">{m.materialCode || "-"}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r font-bold text-blue-700">{m.productName}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r text-center">{m.uom || "-"}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r text-center">{m.hsnSac || "-"}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r text-center font-bold text-gray-600">
                  {m.gstRate !== undefined && m.gstRate !== null ? `${m.gstRate}%` : "-"}
                </TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r text-center">
                  {m.status ? (
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm font-black uppercase text-[9px] ${m.status === "Active" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-600 border border-red-200"}`}>
                      {m.status}
                    </span>
                  ) : "-"}
                </TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r text-gray-600">{m.documentCategory || "-"}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] text-center">{m.inventoryType || "-"}</TableCell>
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
