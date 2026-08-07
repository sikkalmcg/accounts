"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useDatabase, useCollection, useMemoDatabase, updateDocumentNonBlocking, deleteDocumentNonBlocking, addDocumentNonBlocking } from "@/database";
import { collection, query, where, getDocs, orderBy, doc } from "@/database/mongo";
import { Input } from "@/components/ui/input";
import { SapDateInput } from "@/components/ui/sap-date-input";
import { toSAPDate } from "@/lib/date-utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Search, Trash2, Loader2, Pencil, ArrowUpDown, ChevronUp, ChevronDown, X, Save, AlertCircle, FileText, Eye, Download, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import PlantMultiSelect from "./PlantMultiSelect";
import { getCurrentUser, NO_MASTER_RECORDS_MESSAGE } from "@/lib/plant-master";
import { format } from 'date-fns';

type EditForm = {
  id: string;
  plantId: string;
  customerCode: string;
  customerName: string;
  inventoryType: string;
  documentType: string;
  documentCategory: string;
  materialCode: string;
  materialName: string;
  hsnSac: string;
  gstRate: string;
  price: string;
  validFrom: string;
  validTo: string;
  status: string;
  approvalFile: string;
  approvalFileName: string;
  createdBy: string;
  createdAt: string;
};

const getCurrentUserInfo = () => {
  if (typeof window === "undefined") return { userId: "system", username: "SYSTEM" };
  try {
    const parsed = JSON.parse(localStorage.getItem("sikka_user") || "{}");
    return { userId: parsed.username || parsed.userId || "system", username: parsed.name || parsed.username || "SYSTEM" };
  } catch {
    return { userId: "system", username: "SYSTEM" };
  }
};

const postAuditLog = (payload: any) => {
  fetch('/api/audit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {});
};

// Helper to safely extract array of plant IDs from record
const getRecordPlants = (record: any): string[] => {
  if (Array.isArray(record.plantIds) && record.plantIds.length > 0) {
    return record.plantIds;
  }
  return record.plantId ? [record.plantId] : [];
};

export default function VK12() {
  const db = useDatabase();
  const [selectedPlants, setSelectedPlants] = useState<string[]>([]);
  const [authorizedPlantIds, setAuthorizedPlantIds] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [editing, setEditing] = useState<EditForm | null>(null);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  const [extendValidityTarget, setExtendValidityTarget] = useState<any>(null);
  const [isExtending, setIsExtending] = useState(false);
  const [extendForm, setExtendForm] = useState({ newBasicRate: "", newValidFrom: "", newValidTo: "" });
  const [extendFormErrors, setExtendFormErrors] = useState<string[]>([]);

  useEffect(() => {
    const { assignedPlantIds, isAdmin } = getCurrentUser();
    setAuthorizedPlantIds(assignedPlantIds);
    setIsAdmin(isAdmin);
  }, []);

  const pricingQuery = useMemoDatabase(() => query(collection(db, "pricing"), orderBy("createdAt", "desc")), [db]);
  const { data: pricingRecords, isLoading: isPricingLoading } = useCollection(pricingQuery);

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

  // Document Types & Charge Types sourced from MM03 saved records (materials)
  // filtered by selected Plant + Inventory Type
  const editingPlantId = editing?.plantId || "";
  const editingInventoryType = editing?.inventoryType || "";

  const availableDocumentTypes = useMemo(() => {
    if (!materials || !editingPlantId) return [];
    const types = materials
      .filter(m => {
        const recPlants = getRecordPlants(m);
        const matchesPlant = recPlants.includes(editingPlantId);
        const matchesInventory = !editingInventoryType || m.inventoryType === editingInventoryType;
        const isActive = !m.status || m.status === "Active";

        return matchesPlant && matchesInventory && isActive && Boolean(m.documentType);
      })
      .map(m => m.documentType as string);

    return Array.from(new Set(types));
  }, [materials, editingPlantId, editingInventoryType]);

  const availableCategories = useMemo(() => {
    if (!materials || !editingPlantId) return [];
    const categories = materials
      .filter(m => {
        const recPlants = getRecordPlants(m);
        const matchesPlant = recPlants.includes(editingPlantId);
        const matchesInventory = !editingInventoryType || m.inventoryType === editingInventoryType;
        const matchesDocType = !editing?.documentType || m.documentType === editing.documentType;
        const isActive = !m.status || m.status === "Active";

        return matchesPlant && matchesInventory && matchesDocType && isActive && Boolean(m.documentCategory);
      })
      .map(m => m.documentCategory as string);

    return Array.from(new Set(categories));
  }, [materials, editingPlantId, editingInventoryType, editing?.documentType]);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedData = useMemo(() => {
    if (!pricingRecords) return [];

    let baseData = pricingRecords;
    // Plant authorization filter
    if (!isAdmin && authorizedPlantIds.length > 0) {
      baseData = baseData.filter(r => r.plantId && authorizedPlantIds.includes(r.plantId));
    }
    // Selected plant filter
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
  }, [pricingRecords, isAdmin, authorizedPlantIds, selectedPlants, search, sortConfig, customerMap, materialMap]);

  const SortIcon = ({ column }: { column: string }) => {
    if (sortConfig?.key !== column) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
    return sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3 ml-1 text-blue-600" /> : <ChevronDown className="h-3 w-3 ml-1 text-blue-600" />;
  };

  const openEdit = (record: any) => {
    const mat = materialMap[(record.materialCode || "").toUpperCase()];
    setEditing({
      id: record.id,
      plantId: record.plantId || "",
      customerCode: record.customerCode || "",
      customerName: customerMap[record.customerCode]?.name || record.customerName || "",
      inventoryType: record.inventoryType || "",
      documentType: record.documentType || "",
      documentCategory: record.documentCategory || "",
      materialCode: record.materialCode || "",
      materialName: record.materialName || mat?.productName || "",
      hsnSac: record.hsnSac || mat?.hsnSac || "",
      gstRate: record.gstRate !== undefined ? String(record.gstRate) : (mat?.gstRate !== undefined ? String(mat.gstRate) : ""),
      price: record.price !== undefined ? String(record.price) : "",
      validFrom: record.validFrom || "",
      validTo: record.validTo || "9999-12-31",
      status: record.status || "Active",
      approvalFile: record.approvalFile || "",
      approvalFileName: record.approvalFileName || "",
      createdBy: record.createdBy || record.createdByName || "",
      createdAt: record.createdAt || "",
    });
    setFormErrors([]);
  };

  const updateField = (field: keyof EditForm, value: string) => {
    setEditing(prev => {
      if (!prev) return prev;
      const updated = { ...prev, [field]: value };

      // Cascade resets
      if (field === "plantId" || field === "inventoryType") {
        updated.documentType = "";
        updated.documentCategory = "";
      } else if (field === "documentType") {
        updated.documentCategory = "";
      }

      return updated;
    });
  };

  const handleMaterialChange = (code: string) => {
    if (!editing) return;
    const mat = materialMap[code?.toUpperCase()];
    setEditing({
      ...editing,
      materialCode: code,
      materialName: mat?.productName || "",
      hsnSac: mat?.hsnSac || "",
      gstRate: mat?.gstRate !== undefined ? String(mat.gstRate) : editing.gstRate,
    });
  };

  const validateForm = (): string[] => {
    if (!editing) return [];
    const errs: string[] = [];
    if (!editing.plantId) errs.push("Plant is mandatory");
    if (!editing.customerCode) errs.push("Customer Code is mandatory");
    if (!editing.materialCode) errs.push("Material Code is mandatory");
const price = editing.price.trim();
    if (price) {
      if (price.toUpperCase() !== "FIX" && (isNaN(Number(price)) || Number(price) <= 0)) {
        errs.push("Basic Rate must be a positive number or 'FIX'");
      }
    }
    if (!editing.validFrom) errs.push("Validity From is mandatory");
    return errs;
  };

  const handleSave = async () => {
    if (!editing) return;
    const errs = validateForm();
    setFormErrors(errs);
    if (errs.length > 0) {
      window.dispatchEvent(new CustomEvent('sap-status', {
        detail: { text: `Validation Error: ${errs.length} issue(s) in the edit form`, isError: true }
      }));
      return;
    }

    setSaving(true);
    try {
      const { id, createdBy, createdAt, ...dataToSave } = editing;
      const { userId, username } = getCurrentUserInfo();

      const approvalWorkflowEnabled = false;
      const targetStatus = approvalWorkflowEnabled ? "Pending Approval" : (editing.status || "Active");

      const payload = {
        ...dataToSave,
        plantId: editing.plantId,
        customerCode: editing.customerCode,
        materialCode: editing.materialCode,
        materialName: editing.materialName,
        hsnSac: editing.hsnSac,
        gstRate: Number(editing.gstRate) || 0,
price: editing.price.trim().toUpperCase() === 'FIX' || !editing.price.trim() ? 'FIX' : (parseFloat(editing.price) || 0),
        validFrom: editing.validFrom,
        validTo: editing.validTo || "9999-12-31",
        status: targetStatus,
        approvalFile: editing.approvalFile,
        approvalFileName: editing.approvalFileName,
        createdBy: editing.createdBy || username,
        createdAt: editing.createdAt || new Date().toISOString(),
        modifiedBy: username,
        modifiedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      updateDocumentNonBlocking(doc(db, "pricing", id), payload);

      postAuditLog({
        userId,
        username,
        action: 'UPDATE_PRICING_RECORD',
        settingName: `Pricing Rate ${editing.materialCode} for ${editing.customerCode}`,
        previousValue: JSON.stringify({ price: editing.price, status: editing.status }),
        newValue: JSON.stringify({ price: payload.price, status: targetStatus }),
      });

      window.dispatchEvent(new CustomEvent('sap-status', {
        detail: { text: `Rate record ${editing.materialCode} updated successfully`, isError: false }
      }));
      setEditing(null);
    } catch (error) {
      window.dispatchEvent(new CustomEvent('sap-status', {
        detail: { text: "Update failed: Database synchronization error", isError: true }
      }));
    } finally {
      setSaving(false);
    }
  };

  const handleExtendSave = async () => {
    if (!extendValidityTarget) return;

    const { plantId, customerCode, materialCode, documentCategory } = extendValidityTarget;
    const { newBasicRate, newValidFrom, newValidTo } = extendForm;

    // Validation
    const errors: string[] = [];
    const rate = newBasicRate.trim();
    if (rate.toUpperCase() !== "FIX" && (isNaN(Number(rate)) || Number(rate) <= 0)) {
        errors.push("New Basic Rate must be a positive number or 'FIX'");
    }
    if (!newValidFrom) {
        errors.push("Extend Validity From date is mandatory.");
    }
    if (newValidTo && newValidFrom > newValidTo) {
        errors.push("Extend Validity To date cannot be before From date.");
    }

    if (errors.length > 0) {
        setExtendFormErrors(errors);
        return;
    }
    setExtendFormErrors([]);
    setIsExtending(true);

    try {
        // Check for overlapping periods
        const q = query(
            collection(db, "pricing"),
            where("plantId", "==", plantId),
            where("customerCode", "==", customerCode),
            where("materialCode", "==", materialCode),
            where("documentCategory", "==", documentCategory)
        );
        const snap = await getDocs(q);
        const existingPeriods = snap.docs.map(d => d.data());

        const newFrom = new Date(newValidFrom).getTime();
        const newTo = newValidTo ? new Date(newValidTo).getTime() : new Date("9999-12-31").getTime();

        const overlaps = existingPeriods.some(p => {
            const pFrom = new Date(p.validFrom).getTime();
            const pTo = p.validTo ? new Date(p.validTo).getTime() : new Date("9999-12-31").getTime();
            if (newFrom >= pFrom && newFrom <= pTo) return true;
            if (newTo >= pFrom && newTo <= pTo) return true;
            if (newFrom <= pFrom && newTo >= pTo) return true;
            return false;
        });

        if (overlaps) {
            setExtendFormErrors(["The new validity period overlaps with an existing period for this material."]);
            setIsExtending(false);
            return;
        }

        const { userId, username } = getCurrentUserInfo();
        
        const { id, ...restOfTarget } = extendValidityTarget;

        const newRecord = {
            ...restOfTarget,
            price: rate.toUpperCase() === 'FIX' ? 'FIX' : parseFloat(rate),
            validFrom: newValidFrom,
            validTo: newValidTo || "9999-12-31",
            createdAt: new Date().toISOString(),
            createdBy: username,
            modifiedAt: null,
            modifiedBy: null,
            status: 'Active',
        };

        await addDocumentNonBlocking(collection(db, "pricing"), newRecord);

        postAuditLog({
            userId,
            username,
            action: 'EXTEND_PRICING_VALIDITY',
            settingName: `Pricing Rate ${materialCode} for ${customerCode}`,
            previousValue: `Rate: ${extendValidityTarget.price}, Valid: ${extendValidityTarget.validFrom} to ${extendValidityTarget.validTo}`,
            newValue: `Rate: ${newBasicRate}, Valid: ${newValidFrom} to ${newValidTo}`,
        });

        window.dispatchEvent(new CustomEvent('sap-status', {
            detail: { text: `Validity extended for ${materialCode}. New record created.`, isError: false }
        }));

        setExtendValidityTarget(null);
        setExtendForm({ newBasicRate: "", newValidFrom: "", newValidTo: "" });

    } catch (e) {
        console.error("Failed to extend validity", e);
        window.dispatchEvent(new CustomEvent('sap-status', {
            detail: { text: "Failed to extend validity.", isError: true }
        }));
    } finally {
        setIsExtending(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { userId, username } = getCurrentUserInfo();
      deleteDocumentNonBlocking(doc(db, "pricing", deleteTarget.id));

      postAuditLog({
        userId,
        username,
        action: 'DELETE_PRICING_RECORD',
        settingName: `Pricing Rate ${deleteTarget.materialCode || ''} for ${deleteTarget.customerCode || ''}`,
        previousValue: JSON.stringify({ id: deleteTarget.id, materialCode: deleteTarget.materialCode, customerCode: deleteTarget.customerCode }),
        newValue: null,
      });

      window.dispatchEvent(new CustomEvent('sap-status', {
        detail: { text: "Rate record deleted permanently", isError: false }
      }));
      setDeleteTarget(null);
    } catch (e) {
      window.dispatchEvent(new CustomEvent('sap-status', {
        detail: { text: "Deletion failed", isError: true }
      }));
    } finally {
      setDeleting(false);
    }
  };

  const pdfBlobUrl = useMemo(() => {
    const file = editing?.approvalFile;
    if (file?.startsWith('data:application/pdf')) {
      try {
        const parts = file.split(',');
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
  }, [editing?.approvalFile]);

  useEffect(() => {
    return () => {
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
    };
  }, [pdfBlobUrl]);

  const openPdfInNewTab = () => {
    if (pdfBlobUrl) window.open(pdfBlobUrl, '_blank');
  };

  return (
    <div className="w-full flex flex-col bg-white min-h-full">
      <div className="bg-[#dae8f5] px-4 py-1 border-b border-gray-300">
        <div className="flex justify-between items-center">
          <h2 className="text-[13px] font-bold text-gray-800 uppercase italic tracking-wider">
            Change Condition Record (VK12)
          </h2>
          <span className="text-[10px] font-black text-gray-500 uppercase tracking-tighter">Rate Master • {sortedData.length} Entry(s)</span>
        </div>
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
          <div className="relative flex items-center bg-white border border-gray-400 h-6 w-72 px-1 group focus-within:border-blue-500">
             <Search className="h-3.5 w-3.5 text-gray-400 mr-1" />
             <input value={search} onChange={(e) => setSearch(e.target.value)} className="w-full h-full text-xs outline-none" placeholder="Search rate records..." />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto no-scrollbar">
        {isPricingLoading ? (
          <div className="text-center py-20 text-[11px] font-bold uppercase tracking-widest animate-pulse text-gray-400">Syncing System Repository...</div>
        ) : sortedData.length === 0 ? (
          <div className="text-center py-20 text-[11px] font-bold uppercase text-red-500">{selectedPlants.length > 0 ? NO_MASTER_RECORDS_MESSAGE : "No rate records found"}</div>
        ) : (
        <Table className="min-w-[2000px]">
          <TableHeader className="bg-[#e7ebf1] sticky top-0 z-10 shadow-sm">
            <TableRow className="h-8 border-b-[#b5c7de]">
              <TableHead className="text-[11px] font-bold border-r w-10 text-center">#</TableHead>
              <TableHead onClick={() => handleSort('plantId')} className="text-[11px] font-bold border-r w-20 cursor-pointer hover:bg-gray-200">Plant <SortIcon column="plantId" /></TableHead>
              <TableHead onClick={() => handleSort('inventoryType')} className="text-[11px] font-bold border-r cursor-pointer hover:bg-gray-200">Inv. Type <SortIcon column="inventoryType" /></TableHead>
              <TableHead onClick={() => handleSort('documentType')} className="text-[11px] font-bold border-r cursor-pointer hover:bg-gray-200">Doc. Type <SortIcon column="documentType" /></TableHead>
              <TableHead onClick={() => handleSort('documentCategory')} className="text-[11px] font-bold border-r cursor-pointer hover:bg-gray-200">Charge Type <SortIcon column="documentCategory" /></TableHead>
              <TableHead onClick={() => handleSort('customerCode')} className="text-[11px] font-bold border-r w-28 cursor-pointer hover:bg-gray-200">Customer Code <SortIcon column="customerCode" /></TableHead>
              <TableHead onClick={() => handleSort('customerName')} className="text-[11px] font-bold border-r cursor-pointer hover:bg-gray-200">Customer Name <SortIcon column="customerName" /></TableHead>
              <TableHead onClick={() => handleSort('materialCode')} className="text-[11px] font-bold border-r cursor-pointer hover:bg-gray-200">Material Code <SortIcon column="materialCode" /></TableHead>
              <TableHead onClick={() => handleSort('materialName')} className="text-[11px] font-bold border-r cursor-pointer hover:bg-gray-200">Material Name <SortIcon column="materialName" /></TableHead>
              <TableHead onClick={() => handleSort('hsnSac')} className="text-[11px] font-bold border-r w-24 cursor-pointer hover:bg-gray-200">HSN/SAC <SortIcon column="hsnSac" /></TableHead>
              <TableHead onClick={() => handleSort('gstRate')} className="text-[11px] font-bold border-r w-16 text-center cursor-pointer hover:bg-gray-200">GST % <SortIcon column="gstRate" /></TableHead>
              <TableHead onClick={() => handleSort('price')} className="text-[11px] font-bold border-r w-24 text-right cursor-pointer hover:bg-gray-200">Basic Rate <SortIcon column="price" /></TableHead>
              <TableHead onClick={() => handleSort('validFrom')} className="text-[11px] font-bold border-r w-24 cursor-pointer hover:bg-gray-200">Valid From <SortIcon column="validFrom" /></TableHead>
              <TableHead onClick={() => handleSort('validTo')} className="text-[11px] font-bold border-r w-24 cursor-pointer hover:bg-gray-200">Valid To <SortIcon column="validTo" /></TableHead>
              <TableHead onClick={() => handleSort('status')} className="text-[11px] font-bold border-r w-24 cursor-pointer hover:bg-gray-200">Status <SortIcon column="status" /></TableHead>
              <TableHead className="text-[11px] font-bold w-40 text-center">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.map((r, i) => {
              const customerName = customerMap[r.customerCode]?.name || r.customerName || "-";
              const materialName = r.materialName || materialMap[r.materialCode?.toUpperCase()]?.productName || "-";
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
                <TableCell className="p-0 px-2 text-[10px] border-r font-mono text-center">{r.hsnSac || "-"}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r text-center font-bold text-gray-500">{r.gstRate}%</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r text-right font-bold text-emerald-800">
                  {String(r.price).trim().toUpperCase() === 'FIX' ? <span className="text-amber-700">FIX</span> : `INR ${Number(r.price).toLocaleString()}`}
                </TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r text-center font-mono text-gray-500">{toSAPDate(r.validFrom)}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r text-center font-mono text-gray-500">{toSAPDate(r.validTo)}</TableCell>
                <TableCell className="p-0 px-2 text-[10px] border-r text-center">
                  <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[9px] border ${String(r.status).toLowerCase() === 'active' || String(r.status).toLowerCase() === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>{r.status || "Active"}</span>
                </TableCell>
                <TableCell className="p-0 px-1 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Button size="sm" onClick={() => openEdit(r)} className="h-6 rounded-none px-2 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold gap-1">
                      <Pencil className="h-3 w-3" /> Edit
                    </Button>
                    <Button size="sm" onClick={() => setExtendValidityTarget(r)} className="h-6 rounded-none px-2 bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold gap-1">
                      <ExternalLink className="h-3 w-3" /> Extend
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => setDeleteTarget(r)} className="h-6 rounded-none px-2 text-[10px] font-bold gap-1">
                      <Trash2 className="h-3 w-3" /> Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-none border-gray-400 p-0 overflow-hidden shadow-2xl">
          <DialogHeader className="bg-[#dae8f5] px-4 py-2 border-b border-[#b5c7de]">
            <DialogTitle className="text-[13px] font-bold text-gray-800 uppercase italic tracking-wider">
              Edit Rate Master
            </DialogTitle>
          </DialogHeader>

          <div className="p-4 space-y-4">
            {formErrors.length > 0 && (
              <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-sm flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <div className="text-[11px] font-bold text-red-700 space-y-0.5">
                  {formErrors.map((e, i) => <div key={i}>• {e}</div>)}
                </div>
              </div>
            )}

            {editing && (
              <>
              <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
                <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700">Header Data</div>
                <div className="p-2 grid grid-cols-2 gap-x-8 gap-y-1">
                  <div className="sap-selection-row"><label className="sap-label">Plant <span className="text-red-500">*</span></label>
                    <div className="sap-input-wrapper max-w-[200px]">
                      <Select value={editing.plantId} onValueChange={v => updateField("plantId", v)}>
                        <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]"><SelectValue placeholder="Select Plant" /></SelectTrigger>
                        <SelectContent>{plants?.filter(p => isAdmin || authorizedPlantIds.includes(p.plantId)).map(p => <SelectItem key={p.id} value={p.plantId}>{p.plantId}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="sap-selection-row"><label className="sap-label">Inventory Type</label>
                    <div className="sap-input-wrapper max-w-[200px]">
                      <Select value={editing.inventoryType} onValueChange={v => updateField("inventoryType", v)}>
                        <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]"><SelectValue placeholder="Select Inventory Type" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Service Invoice">Service Invoice</SelectItem>
                          <SelectItem value="Supply Invoice">Supply Invoice</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="sap-selection-row"><label className="sap-label">Document Type</label>
                    <div className="sap-input-wrapper max-w-[200px]">
                      <Select value={editing.documentType} onValueChange={v => updateField("documentType", v)}>
                        <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]"><SelectValue placeholder="Select Document Type" /></SelectTrigger>
                        <SelectContent>
                          {availableDocumentTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                          {availableDocumentTypes.length === 0 && (
                            <div className="px-2 py-3 text-center text-[10px] font-bold text-red-500">No Document Type is configured for the selected Plant and Inventory Type in MM03.</div>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="sap-selection-row"><label className="sap-label">Charge Type</label>
                    <div className="sap-input-wrapper max-w-[200px]">
                      <Select value={editing.documentCategory} onValueChange={v => updateField("documentCategory", v)}>
                        <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]"><SelectValue placeholder="Select Charge Type" /></SelectTrigger>
                        <SelectContent>
                          {availableCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                          {availableCategories.length === 0 && (
                            <div className="px-2 py-3 text-center text-[10px] font-bold text-red-500">No Charge Type is configured for the selected Plant, Inventory Type and Document Type in MM03.</div>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="sap-selection-row"><label className="sap-label">Customer Code <span className="text-red-500">*</span></label>
                    <div className="sap-input-wrapper max-w-[200px]">
                      <Select value={editing.customerCode} onValueChange={v => updateField("customerCode", v)}>
                        <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]"><SelectValue placeholder="Select Customer" /></SelectTrigger>
                        <SelectContent>{customers?.map(c => <SelectItem key={c.id} value={c.customerId}>{c.customerId} - {c.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="sap-selection-row"><label className="sap-label">Validity From/To</label>
                    <div className="sap-input-wrapper gap-2 max-w-md">
                      <SapDateInput value={editing.validFrom} onChange={v => updateField("validFrom", v)} className="h-6 border border-gray-400 rounded-none bg-white" />
                      <span className="text-gray-400">to</span>
                      <SapDateInput value={editing.validTo} onChange={v => updateField("validTo", v)} className="h-6 border border-gray-400 rounded-none bg-white" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
                <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700">Material & Rate</div>
                <div className="p-2 grid grid-cols-2 gap-x-8 gap-y-1">
                  <div className="sap-selection-row"><label className="sap-label">Material Code <span className="text-red-500">*</span></label>
                    <div className="sap-input-wrapper max-w-[200px]">
                      <Select value={editing.materialCode} onValueChange={handleMaterialChange}>
                        <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]"><SelectValue placeholder="Select Material" /></SelectTrigger>
                        <SelectContent>{materials?.map(m => <SelectItem key={m.id} value={m.materialCode || m.productName}>{m.materialCode || m.productName}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="sap-selection-row"><label className="sap-label">Material Name</label>
                    <div className="sap-input-wrapper max-w-md">
                      <Input value={editing.materialName} readOnly className="h-6 text-xs rounded-none border-gray-400 bg-gray-100" />
                    </div>
                  </div>
                  <div className="sap-selection-row"><label className="sap-label">HSN/SAC</label>
                    <div className="sap-input-wrapper max-w-[150px]">
                      <Input value={editing.hsnSac} readOnly className="h-6 text-xs rounded-none border-gray-400 bg-gray-100 font-mono" />
                    </div>
                  </div>
                  <div className="sap-selection-row"><label className="sap-label">GST Rate (%)</label>
                    <div className="sap-input-wrapper max-w-[100px]">
                      <Input type="number" value={editing.gstRate} onChange={e => updateField("gstRate", e.target.value)} className="h-6 text-xs rounded-none border-gray-400 text-center" />
                    </div>
                  </div>
                  <div className="sap-selection-row"><label className="sap-label">Basic Rate <span className="text-red-500">*</span></label>
                    <div className="sap-input-wrapper max-w-[150px]">
                      <Input type="text" value={editing.price} onChange={e => updateField("price", e.target.value.toUpperCase())} placeholder="0.00 or FIX" className="h-6 text-xs rounded-none border-gray-400 text-right font-bold text-emerald-700" />
                    </div>
                  </div>
                  <div className="sap-selection-row"><label className="sap-label">Status</label>
                    <div className="sap-input-wrapper max-w-[150px]">
                      <Select value={editing.status} onValueChange={v => updateField("status", v)}>
                        <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Active">Active</SelectItem>
                          <SelectItem value="Inactive">Inactive</SelectItem>
                          <SelectItem value="Approved">Approved</SelectItem>
                          <SelectItem value="Pending Approval">Pending Approval</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
                <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700">Approval Attachment</div>
                <div className="p-3">
                  {editing.approvalFile ? (
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-bold text-emerald-700 uppercase bg-emerald-50 px-2 py-0.5 border border-emerald-100 rounded-sm">{editing.approvalFileName || "DOC"}</span>
                      <Dialog>
                        <DialogTrigger asChild><Button variant="ghost" size="sm" className="h-7 rounded-none text-blue-700 font-bold text-[10px] uppercase gap-1.5"><Eye className="h-3.5 w-3.5" /> View</Button></DialogTrigger>
                        <DialogContent className="max-w-4xl p-0 rounded-none border-gray-400 overflow-hidden shadow-2xl">
                          <div className="bg-[#333e4f] text-white p-2 flex justify-between items-center">
                            <DialogTitle className="text-[11px] font-black uppercase tracking-widest pl-2">Document Verification</DialogTitle>
                            <DialogTrigger asChild><button className="hover:bg-white/10 p-1"><X className="h-4 w-4" /></button></DialogTrigger>
                          </div>
                          <div className="p-10 bg-gray-100 flex items-center justify-center">
                            {pdfBlobUrl ? (
                              <div className="text-center space-y-4">
                                <FileText className="h-20 w-20 text-red-500 mx-auto opacity-30" />
                                <Button onClick={openPdfInNewTab} className="bg-blue-700 rounded-none h-10 px-8 uppercase font-bold text-[11px]">Open Secure PDF Viewer</Button>
                              </div>
                            ) : (
                              <img src={editing.approvalFile} alt="Approval" className="max-w-full max-h-[70vh] object-contain shadow-2xl border-4 border-white" />
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => { updateField("approvalFile", ""); updateField("approvalFileName", ""); }}><X className="h-3 w-3" /></Button>
                    </div>
                  ) : (
                    <span className="text-[10px] font-bold text-gray-400 uppercase">No attachment available</span>
                  )}
                </div>
              </div>
              </>
            )}
          </div>

          <DialogFooter className="px-4 py-3 border-t border-[#b5c7de] bg-[#f4f6f9]">
            <Button variant="outline" onClick={() => setEditing(null)} className="h-7 rounded-none text-[11px] font-bold">Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="h-7 rounded-none text-[11px] font-bold gap-1.5">
              {saving && <Loader2 className="h-3 w-3 animate-spin" />}
              {saving ? "SAVING..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Extend Validity Dialog */}
      <Dialog open={!!extendValidityTarget} onOpenChange={(open) => { if (!open) setExtendValidityTarget(null); }}>
        <DialogContent className="max-w-2xl rounded-none border-gray-400 p-0 overflow-hidden shadow-2xl">
          <DialogHeader className="bg-[#dae8f5] px-4 py-2 border-b border-[#b5c7de]">
            <DialogTitle className="text-[13px] font-bold text-gray-800 uppercase italic tracking-wider">
              Extend Validity
            </DialogTitle>
          </DialogHeader>

          <div className="p-4 space-y-4">
            {extendFormErrors.length > 0 && (
              <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-sm flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <div className="text-[11px] font-bold text-red-700 space-y-0.5">
                  {extendFormErrors.map((e, i) => <div key={i}>• {e}</div>)}
                </div>
              </div>
            )}

            {extendValidityTarget && (
              <>
                <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-gray-50">
                  <div className="bg-gray-200 px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700">Fixed Header Information</div>
                  <div className="p-3 grid grid-cols-2 gap-x-8 gap-y-2 text-xs">
                    <div className="flex justify-between"><span className="text-gray-500">Plant:</span> <span className="font-bold">{extendValidityTarget.plantId}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Charge Type:</span> <span className="font-bold">{extendValidityTarget.documentCategory}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Material Code:</span> <span className="font-bold">{extendValidityTarget.materialCode}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Material Name:</span> <span className="font-bold">{materialMap[extendValidityTarget.materialCode?.toUpperCase()]?.productName}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">GST Rate:</span> <span className="font-bold">{extendValidityTarget.gstRate}%</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">HSN/SAC Code:</span> <span className="font-bold">{extendValidityTarget.hsnSac}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Current Basic Rate:</span> <span className="font-bold text-emerald-700">{extendValidityTarget.price}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Previous Validity:</span> <span className="font-bold">{toSAPDate(extendValidityTarget.validFrom)} - {toSAPDate(extendValidityTarget.validTo)}</span></div>
                  </div>
                </div>

                <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
                  <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700">Manual Entry Fields</div>
                  <div className="p-3 grid grid-cols-1 gap-y-3">
                    <div className="sap-selection-row items-center"><label className="sap-label w-32">New Basic Rate <span className="text-red-500">*</span></label>
                      <div className="sap-input-wrapper max-w-[150px]">
                        <Input 
                          type="text" 
                          value={extendForm.newBasicRate}
                          onChange={e => setExtendForm({...extendForm, newBasicRate: e.target.value.toUpperCase()})}
                          placeholder="0.00 or FIX" 
                          className="h-6 text-xs rounded-none border-gray-400 text-right font-bold text-emerald-700"
                        />
                      </div>
                    </div>
                     <div className="sap-selection-row items-center"><label className="sap-label w-32">Extend Validity From <span className="text-red-500">*</span></label>
                      <div className="sap-input-wrapper max-w-[150px]">
                        <SapDateInput value={extendForm.newValidFrom} onChange={v => setExtendForm({...extendForm, newValidFrom: v})} className="h-6 border border-gray-400 rounded-none bg-white" />
                      </div>
                    </div>
                     <div className="sap-selection-row items-center"><label className="sap-label w-32">Extend Validity To</label>
                      <div className="sap-input-wrapper max-w-[150px]">
                        <SapDateInput value={extendForm.newValidTo} onChange={v => setExtendForm({...extendForm, newValidTo: v})} className="h-6 border border-gray-400 rounded-none bg-white" />
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="px-4 py-3 border-t border-[#b5c7de] bg-[#f4f6f9]">
            <Button variant="outline" onClick={() => setExtendValidityTarget(null)} className="h-7 rounded-none text-[11px] font-bold">Cancel</Button>
            <Button onClick={handleExtendSave} disabled={isExtending} className="h-7 rounded-none text-[11px] font-bold gap-1.5 bg-green-700 hover:bg-green-800">
              {isExtending && <Loader2 className="h-3 w-3 animate-spin" />}
              {isExtending ? "SAVING..." : "Save New Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Delete Warning Confirmation Popup */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="max-w-md rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="h-5 w-5" /> Confirm Rate Master Deletion
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[12px] leading-relaxed">
              Are you sure you want to delete this record?
              <br />
              <br />
              <span className="text-gray-500">Material: <b>{deleteTarget?.materialCode || "-"}</b> | Customer: <b>{deleteTarget?.customerCode || "-"}</b> | Plant: <b>{deleteTarget?.plantId || "-"}</b></span>
              <br />
              <br />
              This operation will permanently delete the record from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} className="h-8 rounded-none text-[11px] font-bold">No</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting} className="h-8 rounded-none text-[11px] font-bold bg-red-600 hover:bg-red-700">
              {deleting ? "Deleting..." : "Yes, Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {saving && <div className="fixed bottom-10 right-10 bg-[#333e4f] text-white px-4 py-2 text-xs border border-white/20 animate-pulse z-50 flex items-center gap-2 font-bold"><Save className="h-4 w-4" /> COMMITING CHANGES...</div>}
    </div>
  );
}