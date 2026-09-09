"use client";

import { useState, useMemo } from "react";
import { useDatabase, useCollection, useMemoDatabase, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/database";
import { collection, doc } from "@/database/mongo";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Search, Trash2, Loader2, Pencil, AlertCircle, X } from "lucide-react";

import PlantMultiSelect from "./PlantMultiSelect";

const UOM_OPTIONS = ["SQFT", "MT", "KG", "BAG", "BOX", "PCS", "OTHERS"];

type EditForm = {
  id: string;
  materialCode: string;
  materialName: string;
  uom: string;
  hsnSac: string;
  gstRate: string;
  status: string;
  plantId: string;
  plantIds: string[];
  documentType: string;
  documentCategory: string;
  inventoryType: string;
};

// Helper to safely extract array of plant IDs from a record (VOF03 compatibility)
const getRecordPlants = (record: any): string[] => {
  if (Array.isArray(record.plantIds) && record.plantIds.length > 0) {
    return record.plantIds;
  }
  return record.plantId ? [record.plantId] : [];
};

export default function MM02() {
  const db = useDatabase();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<EditForm | null>(null);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const materialsQuery = useMemoDatabase(() => collection(db, "materials"), [db]);
  const { data: materials, isLoading: isMaterialsLoading } = useCollection(materialsQuery);

  const plantsQuery = useMemoDatabase(() => collection(db, "plants"), [db]);
  const { data: plants, isLoading: isPlantsLoading } = useCollection(plantsQuery);

  const billingQuery = useMemoDatabase(() => collection(db, "billing_types"), [db]);
  const { data: billingTypes } = useCollection(billingQuery);

  const editingPlantIds = useMemo(() => {
    if (editing?.plantIds && editing.plantIds.length > 0) return editing.plantIds;
    if (editing?.plantId) return [editing.plantId];
    return [];
  }, [editing?.plantIds, editing?.plantId]);

  // Document Types sourced from VOF03 saved records (billing_types)
  // Preserves existing saved documentType and adds valid types for selected Plants + Inventory Type
  const availableDocumentTypes = useMemo(() => {
    const types = new Set<string>();
    if (editing?.documentType) {
      types.add(editing.documentType);
    }
    if (billingTypes) {
      billingTypes.forEach(bt => {
        if (bt.status && bt.status !== "Active") return;
        
        if (editingPlantIds.length > 0) {
          const recPlants = getRecordPlants(bt);
          if (!editingPlantIds.some(pid => recPlants.includes(pid))) return;
        }

        if (editing?.inventoryType && bt.inventoryType !== editing.inventoryType) {
          return;
        }

        if (bt.documentType) {
          types.add(bt.documentType);
        }
      });
    }

    return Array.from(types);
  }, [billingTypes, editingPlantIds, editing?.inventoryType, editing?.documentType]);

  // Charge Types (documentCategory) sourced from VOF03 saved records
  // Preserves existing saved documentCategory and adds valid categories for selected Plants + Inventory Type + Document Type
  const availableCategories = useMemo(() => {
    const categories = new Set<string>();
    if (editing?.documentCategory) {
      categories.add(editing.documentCategory);
    }
    if (billingTypes) {
      billingTypes.forEach(bt => {
        if (bt.status && bt.status !== "Active") return;

        if (editingPlantIds.length > 0) {
          const recPlants = getRecordPlants(bt);
          if (!editingPlantIds.some(pid => recPlants.includes(pid))) return;
        }

        if (editing?.inventoryType && bt.inventoryType !== editing.inventoryType) {
          return;
        }

        if (editing?.documentType && bt.documentType !== editing.documentType) {
          return;
        }

        if (bt.documentCategory) {
          categories.add(bt.documentCategory);
        }
      });
    }

    return Array.from(categories);
  }, [billingTypes, editingPlantIds, editing?.inventoryType, editing?.documentType, editing?.documentCategory]);

  const filteredMaterials = useMemo(() => {
    if (!materials) return [];
    const q = search.trim().toLowerCase();
    if (!q) return materials;
    return materials.filter(m =>
      m.materialCode?.toLowerCase().includes(q) ||
      m.productName?.toLowerCase().includes(q) ||
      m.hsnSac?.toLowerCase().includes(q) ||
      m.plantId?.toLowerCase().includes(q) ||
      getRecordPlants(m).join(" ").toLowerCase().includes(q) ||
      m.documentCategory?.toLowerCase().includes(q) ||
      m.inventoryType?.toLowerCase().includes(q) ||
      m.status?.toLowerCase().includes(q)
    );
  }, [materials, search]);

  const openEdit = (material: any) => {
    const recPlants = getRecordPlants(material);
    setEditing({
      id: material.id,
      materialCode: material.materialCode || "",
      materialName: material.productName || "",
      uom: material.uom || "",
      hsnSac: material.hsnSac || "",
      gstRate: material.gstRate !== undefined && material.gstRate !== null ? String(material.gstRate) : "",
      status: material.status || "Active",
      plantId: material.plantId || (recPlants[0] || ""),
      plantIds: recPlants.length > 0 ? recPlants : (material.plantId ? [material.plantId] : []),
      documentType: material.documentType || "",
      documentCategory: material.documentCategory || "",
      inventoryType: material.inventoryType || "",
    });
    setFormErrors([]);
  };

  const updatePlantIds = (plantIds: string[]) => {
    setEditing(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        plantIds,
        plantId: plantIds[0] || "",
      };
    });
  };

  const updateField = (field: keyof EditForm, value: string) => {
    setEditing(prev => {
      if (!prev) return prev;
      return { ...prev, [field]: value };
    });
  };

  const validateForm = (): string[] => {
    if (!editing) return [];
    const errs: string[] = [];
    const code = editing.materialCode.trim();
    if (!code) errs.push("Material Code is mandatory");
    if (!editing.materialName.trim()) errs.push("Material Name is mandatory");
    if (!editing.uom) errs.push("UOM is mandatory");
    if (!editing.hsnSac.trim()) errs.push("HSN Code is mandatory");
    if (editing.gstRate === "" || editing.gstRate === null || editing.gstRate === undefined) {
      errs.push("GST Rate is mandatory");
    } else if (isNaN(Number(editing.gstRate))) {
      errs.push("GST Rate must be numeric");
    }

    const selectedPlantIds = editing.plantIds && editing.plantIds.length > 0 ? editing.plantIds : (editing.plantId ? [editing.plantId] : []);
    if (code && selectedPlantIds.length > 0) {
      for (const pId of selectedPlantIds) {
        const existing = (materials || []).find(
          m =>
            m.id !== editing.id &&
            (m.plantId === pId || (Array.isArray(m.plantIds) && m.plantIds.includes(pId))) &&
            (String(m.materialCode || "").trim().toUpperCase() === code.toUpperCase() ||
             String(m.productName || "").trim().toUpperCase() === code.toUpperCase())
        );
        if (existing) {
          errs.push(`Material Code "${code}" already exists in Plant ${pId}`);
        }
      }
    }
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
      const selectedPlantIds = editing.plantIds && editing.plantIds.length > 0 ? editing.plantIds : (editing.plantId ? [editing.plantId] : []);
      const primaryPlant = selectedPlantIds[0] || "";

      const payload = {
        materialCode: editing.materialCode.trim(),
        productName: editing.materialName.trim(),
        uom: editing.uom,
        hsnSac: editing.hsnSac.trim(),
        gstRate: Number(editing.gstRate),
        status: editing.status,
        plantId: primaryPlant,
        plantIds: selectedPlantIds,
        documentType: editing.documentType,
        documentCategory: editing.documentCategory,
        inventoryType: editing.inventoryType,
        updatedAt: new Date().toISOString(),
      };
      updateDocumentNonBlocking(doc(db, "materials", editing.id), payload);
      window.dispatchEvent(new CustomEvent('sap-status', {
        detail: { text: `Material ${editing.materialCode} updated successfully`, isError: false }
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

  const handleDelete = async (id: string, code: string) => {
    if (!confirm(`Are you sure you want to delete material "${code}"? Historical invoices will not be affected.`)) return;
    setDeletingId(id);
    try {
      deleteDocumentNonBlocking(doc(db, "materials", id));
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: `Material ${code} deleted successfully`, isError: false } }));
    } catch (e) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Deletion failed", isError: true } }));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="w-full flex flex-col bg-white min-h-full">
      <div className="bg-[#dae8f5] px-4 py-1 border-b border-gray-300">
        <h2 className="text-[13px] font-bold text-gray-800 uppercase italic tracking-wider">
          Change Material
        </h2>
      </div>

      <div className="p-4 space-y-4">
        <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
          <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700">
            Material List
          </div>
          <div className="p-2 flex items-center justify-between gap-4">
            <div className="relative flex items-center bg-white border border-gray-400 h-7 w-80 px-2 group focus-within:border-blue-500">
              <Search className="h-3.5 w-3.5 text-gray-400 mr-1" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-full text-xs outline-none"
                placeholder="Search materials..."
              />
              {search && (
                <button onClick={() => setSearch("")} className="text-gray-400 hover:text-gray-600"><X className="h-3 w-3" /></button>
              )}
            </div>
            <div className="text-[11px] font-bold text-gray-600 uppercase">
              Total Materials: {filteredMaterials.length}
            </div>
          </div>
        </div>

        <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-white">
          <div className="overflow-x-auto no-scrollbar">
            <Table>
              <TableHeader className="bg-[#e7ebf1]">
                <TableRow className="h-8">
                  <TableHead className="text-[11px] font-bold border-r w-10 text-center">#</TableHead>
                  <TableHead className="text-[11px] font-bold border-r w-40">Plant ID</TableHead>
                  <TableHead className="text-[11px] font-bold border-r w-44">Material Code</TableHead>
                  <TableHead className="text-[11px] font-bold border-r">Material Name</TableHead>
                  <TableHead className="text-[11px] font-bold border-r w-28">UOM</TableHead>
                  <TableHead className="text-[11px] font-bold border-r w-32">HSN Code</TableHead>
                  <TableHead className="text-[11px] font-bold border-r w-28">GST Rate (%)</TableHead>
                  <TableHead className="text-[11px] font-bold border-r w-28">Status</TableHead>
                  <TableHead className="text-[11px] font-bold border-r w-32">Charge Type</TableHead>
                  <TableHead className="text-[11px] font-bold border-r w-36">Inventory Type</TableHead>
                  <TableHead className="w-24 text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isMaterialsLoading ? (
                  <TableRow><TableCell colSpan={11} className="text-center py-10 text-xs flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" /> RETRIEVING DATA...
                  </TableCell></TableRow>
                ) : filteredMaterials.length === 0 ? (
                  <TableRow><TableCell colSpan={11} className="text-center py-10 text-xs text-red-500 font-bold uppercase">No materials found</TableCell></TableRow>
                ) : filteredMaterials.map((m, idx) => (
                  <TableRow key={m.id} className="h-8 hover:bg-blue-50/30 border-b border-gray-100">
                    <TableCell className="p-0 text-center text-[10px] border-r text-gray-400">{idx + 1}</TableCell>
                    <TableCell className="p-0 px-2 text-[10px] border-r">{getRecordPlants(m).join(', ') || m.plantId || "-"}</TableCell>
                    <TableCell className="p-0 px-2 text-[10px] border-r font-mono font-bold text-blue-700">{m.materialCode || "-"}</TableCell>
                    <TableCell className="p-0 px-2 text-[10px] border-r font-bold text-blue-700">{m.productName || "-"}</TableCell>
                    <TableCell className="p-0 px-2 text-[10px] border-r text-center">{m.uom || "-"}</TableCell>
                    <TableCell className="p-0 px-2 text-[10px] border-r text-center">{m.hsnSac || "-"}</TableCell>
                    <TableCell className="p-0 px-2 text-[10px] border-r text-center font-bold text-gray-600">
                      {m.gstRate !== undefined && m.gstRate !== null ? `${m.gstRate}%` : "-"}
                    </TableCell>
                    <TableCell className="p-0 px-2 text-[10px] border-r text-center">
                      {m.status ? (
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-sm font-black uppercase text-[9px] ${m.status === "Active" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-600 border border-red-200"}`}>
                          {m.status}
                        </span>
                      ) : "-"}
                    </TableCell>
                    <TableCell className="p-0 px-2 text-[10px] border-r text-gray-600">{m.documentCategory || "-"}</TableCell>
                    <TableCell className="p-0 px-2 text-[10px] border-r text-center">{m.inventoryType || "-"}</TableCell>
                    <TableCell className="p-0 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-blue-600 hover:bg-blue-50"
                          onClick={() => openEdit(m)}
                          title="Edit Material"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-red-500 hover:bg-red-50"
                          onClick={() => handleDelete(m.id, m.materialCode || m.productName || "")}
                          disabled={deletingId === m.id}
                          title="Delete Material"
                        >
                          {deletingId === m.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="bg-[#e7ebf1] p-1 flex justify-between items-center px-4 border-t border-[#b5c7de] text-[11px] font-bold text-gray-600 uppercase">
            <span>Total Rows: {filteredMaterials.length}</span>
            <span>Showing {filteredMaterials.length} of {materials?.length || 0}</span>
          </div>
        </div>
      </div>

      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) setEditing(null); }} modal={false}>
        <DialogContent 
          className="max-w-3xl w-[95vw] max-h-[90vh] overflow-y-auto rounded-none border-gray-400 p-0 shadow-2xl z-50"
          onInteractOutside={(e) => {
            const target = e.target as HTMLElement | null;
            if (target?.closest("[data-plant-dropdown]")) {
              e.preventDefault();
            }
          }}
        >
          <DialogHeader className="bg-[#dae8f5] px-4 py-2 border-b border-[#b5c7de]">
            <DialogTitle className="text-[13px] font-bold text-gray-800 uppercase italic tracking-wider">
              Edit Material
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

            <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9] p-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2.5">
                <div className="flex items-center">
                  <label className="w-32 text-xs font-semibold text-gray-700 shrink-0">Material Code <span className="text-red-500">*</span></label>
                  <div className="flex-1 min-w-0">
                    <Input className="h-7 rounded-none border-gray-400 text-xs w-full font-mono font-bold" value={editing?.materialCode || ""} onChange={e => updateField("materialCode", e.target.value.toUpperCase())} />
                  </div>
                </div>

                <div className="flex items-center">
                  <label className="w-32 text-xs font-semibold text-gray-700 shrink-0">Material Name <span className="text-red-500">*</span></label>
                  <div className="flex-1 min-w-0">
                    <Input className="h-7 rounded-none border-gray-400 text-xs w-full" value={editing?.materialName || ""} onChange={e => updateField("materialName", e.target.value)} />
                  </div>
                </div>

                <div className="flex items-center">
                  <label className="w-32 text-xs font-semibold text-gray-700 shrink-0">Plant ID(s) <span className="text-red-500">*</span></label>
                  <div className="flex-1 min-w-0">
                    <PlantMultiSelect
                      plants={plants}
                      selected={editing?.plantIds || []}
                      onChange={updatePlantIds}
                      isLoading={isPlantsLoading}
                      placeholder="Select Plant(s)..."
                    />
                  </div>
                </div>

                <div className="flex items-center">
                  <label className="w-32 text-xs font-semibold text-gray-700 shrink-0">Inventory Type</label>
                  <div className="flex-1 min-w-0">
                    <Select value={editing?.inventoryType || ""} onValueChange={v => updateField("inventoryType", v)}>
                      <SelectTrigger className="h-7 rounded-none border-gray-400 text-xs w-full"><SelectValue placeholder="Select Inventory Type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Service Invoice">Service Invoice</SelectItem>
                        <SelectItem value="Supply Invoice">Supply Invoice</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center">
                  <label className="w-32 text-xs font-semibold text-gray-700 shrink-0">Document Type</label>
                  <div className="flex-1 min-w-0">
                    <Select value={editing?.documentType || ""} onValueChange={v => updateField("documentType", v)}>
                      <SelectTrigger className="h-7 rounded-none border-gray-400 text-xs w-full"><SelectValue placeholder="Select Document Type" /></SelectTrigger>
                      <SelectContent>
                        {availableDocumentTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                        {availableDocumentTypes.length === 0 && (
                          <div className="px-2 py-3 text-center text-[10px] font-bold text-red-500">No Document Type configured.</div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center">
                  <label className="w-32 text-xs font-semibold text-gray-700 shrink-0">Charge Type</label>
                  <div className="flex-1 min-w-0">
                    <Select value={editing?.documentCategory || ""} onValueChange={v => updateField("documentCategory", v)}>
                      <SelectTrigger className="h-7 rounded-none border-gray-400 text-xs w-full"><SelectValue placeholder="Select Charge Type" /></SelectTrigger>
                      <SelectContent>
                        {availableCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                        {availableCategories.length === 0 && (
                          <div className="px-2 py-3 text-center text-[10px] font-bold text-red-500">No Charge Type configured.</div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center">
                  <label className="w-32 text-xs font-semibold text-gray-700 shrink-0">UOM <span className="text-red-500">*</span></label>
                  <div className="flex-1 min-w-0">
                    <Select value={editing?.uom || ""} onValueChange={v => updateField("uom", v)}>
                      <SelectTrigger className="h-7 rounded-none border-gray-400 text-xs w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>{UOM_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center">
                  <label className="w-32 text-xs font-semibold text-gray-700 shrink-0">HSN Code <span className="text-red-500">*</span></label>
                  <div className="flex-1 min-w-0">
                    <Input className="h-7 rounded-none border-gray-400 text-xs w-full font-mono" value={editing?.hsnSac || ""} onChange={e => updateField("hsnSac", e.target.value)} />
                  </div>
                </div>

                <div className="flex items-center">
                  <label className="w-32 text-xs font-semibold text-gray-700 shrink-0">GST Rate (%) <span className="text-red-500">*</span></label>
                  <div className="flex-1 min-w-0">
                    <Input type="number" className="h-7 rounded-none border-gray-400 text-xs w-full font-mono" value={editing?.gstRate || ""} onChange={e => updateField("gstRate", e.target.value)} />
                  </div>
                </div>

                <div className="flex items-center">
                  <label className="w-32 text-xs font-semibold text-gray-700 shrink-0">Status</label>
                  <div className="flex-1 min-w-0">
                    <Select value={editing?.status || "Active"} onValueChange={v => updateField("status", v)}>
                      <SelectTrigger className="h-7 rounded-none border-gray-400 text-xs w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="bg-[#e7ebf1] px-4 py-2 border-t border-[#b5c7de] flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="outline" size="sm" className="h-7 rounded-none border-gray-400 text-xs font-bold uppercase">Cancel</Button>
            </DialogClose>
            <Button
              onClick={handleSave}
              disabled={saving}
              size="sm"
              className="h-7 rounded-none bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold uppercase gap-2"
            >
              {saving && <Loader2 className="h-3 w-3 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}