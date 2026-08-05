"use client";

import { useState, useMemo, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDatabase, useCollection, useMemoDatabase } from "@/database";
import { collection, query, orderBy } from "@/database/mongo";
import { Search, ArrowUpDown, ChevronUp, ChevronDown } from "lucide-react";
import { parseGSTIN } from "@/lib/gst-utils";
import PlantMultiSelect from "./PlantMultiSelect";
import { getRecordPlantIds, getCurrentUser, NO_MASTER_RECORDS_MESSAGE } from "@/lib/plant-master";

export default function XK03() {
  const db = useDatabase();
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [selectedPlants, setSelectedPlants] = useState<string[]>([]);
  const [authorizedPlantIds, setAuthorizedPlantIds] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const { assignedPlantIds, isAdmin } = getCurrentUser();
    setAuthorizedPlantIds(assignedPlantIds);
    setIsAdmin(isAdmin);
  }, []);

  const plantsQuery = useMemoDatabase(() => collection(db, "plants"), [db]);
  const { data: plants, isLoading: isPlantsLoading } = useCollection(plantsQuery);

  const allowedPlantIds = isAdmin ? undefined : (authorizedPlantIds.length ? authorizedPlantIds : undefined);

  const vendorsQuery = useMemoDatabase(() => query(collection(db, "vendors"), orderBy("createdAt", "desc")), [db]);
  const { data: vendors, isLoading } = useCollection(vendorsQuery);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Helper to get all plant codes for a vendor (handles multi-plant assignment)
  const getVendorPlantIds = (v: any): string[] => {
    if (Array.isArray(v.assignedPlantIds) && v.assignedPlantIds.length > 0) {
      return v.assignedPlantIds;
    }
    return v.plantId ? [v.plantId] : [];
  };

  const getVendorState = (v: any): { state: string; stateCode: string } => {
    const storedState = v.stateName || "";
    const storedCode = v.stateCode || "";
    if (storedState || storedCode) return { state: storedState || "-", stateCode: storedCode || "-" };
    if (v.gstin && v.gstin.length >= 15) {
      const parsed = parseGSTIN(v.gstin);
      if (parsed) return { state: parsed.state, stateCode: parsed.stateCode };
    }
    return { state: "-", stateCode: "-" };
  };

const sortedData = useMemo(() => {
    if (!vendors) return [];

    // Plant-wise filtering: only show vendors assigned to the selected plant(s)
    let baseData = vendors;
    if (selectedPlants.length > 0) {
      baseData = vendors.filter(v => {
        const vp = getVendorPlantIds(v);
        return vp.some(p => selectedPlants.includes(p));
      });
    }

    const filtered = baseData.filter(v => {
      const plantCodes = getVendorPlantIds(v).join(", ");
      const vs = getVendorState(v);
      return v.vendorName?.toLowerCase().includes(search.toLowerCase()) || 
        (v.vendorId || "").toLowerCase().includes(search.toLowerCase()) ||
        (v.vendorCode || "").toLowerCase().includes(search.toLowerCase()) ||
        (v.gstin || "").toLowerCase().includes(search.toLowerCase()) ||
        plantCodes.toLowerCase().includes(search.toLowerCase()) ||
        vs.state.toLowerCase().includes(search.toLowerCase()) ||
        vs.stateCode.toLowerCase().includes(search.toLowerCase());
    });

    if (!sortConfig) return filtered;

    return [...filtered].sort((a, b) => {
      let aVal = "";
      let bVal = "";
      if (sortConfig.key === "plant") {
        aVal = getVendorPlantIds(a).join(", ");
        bVal = getVendorPlantIds(b).join(", ");
      } else if (sortConfig.key === "state") {
        aVal = getVendorState(a).state;
        bVal = getVendorState(b).state;
      } else if (sortConfig.key === "stateCode") {
        aVal = getVendorState(a).stateCode;
        bVal = getVendorState(b).stateCode;
      } else {
        aVal = String(a[sortConfig.key] || "");
        bVal = String(b[sortConfig.key] || "");
      }
      const aStr = aVal.toLowerCase();
      const bStr = bVal.toLowerCase();
      if (aStr < bStr) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aStr > bStr) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [vendors, search, sortConfig, selectedPlants]);

  const SortIcon = ({ column }: { column: string }) => {
    if (sortConfig?.key !== column) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
    return sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3 ml-1 text-blue-600" /> : <ChevronDown className="h-3 w-3 ml-1 text-blue-600" />;
  };

  return (
    <div className="w-full flex flex-col bg-white min-h-full">
      <div className="sap-header-title">Vendor List: ALV Grid</div>

<div className="sap-selection-area">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
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
              <input value={search} onChange={(e) => setSearch(e.target.value)} className="w-full h-full text-xs outline-none" placeholder="Search Vendors..." />
            </div>
          </div>
          <div className="text-[11px] font-bold text-gray-600 uppercase">Records: {sortedData.length}</div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <Table className="sap-alv-grid">
          <TableHeader className="sap-alv-header">
            <TableRow className="h-8 border-b-[#b5c7de]">
              <TableHead className="text-[11px] font-bold border-r w-12 text-center">#</TableHead>
              <TableHead className="text-[11px] font-bold border-r w-36">
                <div className="flex items-center">Plant</div>
              </TableHead>
              <TableHead onClick={() => handleSort('vendorCode')} className="text-[11px] font-bold border-r w-32 cursor-pointer hover:bg-gray-200">
                <div className="flex items-center">Vendor Code <SortIcon column="vendorCode" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('vendorName')} className="text-[11px] font-bold border-r cursor-pointer hover:bg-gray-200">
                <div className="flex items-center">Vendor Name <SortIcon column="vendorName" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('gstin')} className="text-[11px] font-bold border-r w-40 cursor-pointer hover:bg-gray-200">
                <div className="flex items-center">GSTIN <SortIcon column="gstin" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('state')} className="text-[11px] font-bold border-r w-40 cursor-pointer hover:bg-gray-200">
                <div className="flex items-center">State <SortIcon column="state" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('stateCode')} className="text-[11px] font-bold text-gray-700 w-24 cursor-pointer hover:bg-gray-200">
                <div className="flex items-center">State Code <SortIcon column="stateCode" /></div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-10 text-xs">LOADING...</TableCell></TableRow>
) : sortedData.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-10 text-xs text-red-500 font-bold uppercase">{selectedPlants.length > 0 ? NO_MASTER_RECORDS_MESSAGE : "No records found matching Selection"}</TableCell></TableRow>
            ) : sortedData.map((v, i) => {
              const vs = getVendorState(v);
              return (
                <TableRow key={v.id} className="h-8 hover:bg-blue-50/20 transition-colors border-b border-gray-100 group">
                  <TableCell className="p-0 text-center text-[11px] border-r text-gray-400 group-hover:text-blue-600">{i + 1}</TableCell>
                  <TableCell className="p-0 px-2 text-[11px] border-r font-mono font-bold text-gray-700">{getVendorPlantIds(v).join(", ") || "N/A"}</TableCell>
                  <TableCell className="p-0 px-2 text-[11px] border-r font-mono font-bold text-blue-700">{v.vendorCode || v.vendorId || "-"}</TableCell>
                  <TableCell className="p-0 px-2 text-[11px] border-r font-medium">{v.vendorName}</TableCell>
                  <TableCell className="p-0 px-2 text-[11px] border-r font-mono">{v.gstin}</TableCell>
                  <TableCell className="p-0 px-2 text-[11px] border-r">{vs.state}</TableCell>
                  <TableCell className="p-0 px-2 text-[11px] font-mono text-center">{vs.stateCode}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <div className="bg-[#333e4f] h-6 flex items-center px-4 text-white text-[10px] uppercase">
        ALV_GRID_MODE • SYSTEM_REPO: VENDORS
      </div>
    </div>
  );
}

