"use client";

import { useState, useMemo } from "react";
import { useDatabase, useCollection, useMemoDatabase, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/database";
import { collection, doc } from "@/database/mongo";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Search, Trash2, Loader2, Pencil, AlertCircle, X } from "lucide-react";
import PlantMultiSelect from "./PlantMultiSelect";

type EditForm = {
  id: string;
  plantIds: string[];
  inventoryType: string;
  documentType: string;
  documentCategory: string;
};

export default function VOF02() {
  const db = useDatabase();
  const [search, setSearch] = useState("");
  const [selectedPlants, setSelectedPlants] = useState<string[]>([]);
  const [editing, setEditing] = useState<EditForm | null>(null);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const billingQuery = useMemoDatabase(() => collection(db, "billing_types"), [db]);
  const { data: billingTypes, isLoading: isBillingLoading } = useCollection(billingQuery);

  const plantsQuery = useMemoDatabase(() => collection(db, "plants"), [db]);
  const { data: plants, isLoading: isPlantsLoading } = useCollection(plantsQuery);

  const filteredRecords = useMemo(() => {
    if (!billingTypes) return [];
    let filtered = billingTypes;
    if (selectedPlants.length > 0) {
      filtered = filtered.filter(r => selectedPlants.includes(r.plantId));
    }
    const q = search.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter(r =>
        r.plantId?.toLowerCase().includes(q) ||
        r.documentType?.toLowerCase().includes(q) ||
        r.documentCategory?.toLowerCase().includes(q) ||
        r.inventoryType?.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [billingTypes, search, selectedPlants]);

  const openEdit = (record: any) => {
    setEditing({
      id: record.id,
      plantIds: record.plantId ? [record.plantId] : [],
      inventoryType: record.inventoryType || "",
      documentType: record.documentType || "",
      documentCategory: record.documentCategory || "",
    });
    setFormErrors([]);
  };

  const updateField = (field: keyof EditForm, value: string) => {
    setEditing(prev => (prev ? { ...prev, [field]: value } : prev));
  };

  const updatePlantIds = (plantIds: string[]) => {
    setEditing(prev => (prev ? { ...prev, plantIds } : prev));
  };

  const validateForm = (): string[] => {
    if (!editing) return [];
    const errs: string[] = [];
    if (editing.plantIds.length === 0) errs.push("At least one Plant ID is mandatory");
    if (!editing.documentType.trim() && !editing.documentCategory.trim()) {
      errs.push("Provide either Document Type or Charge Type");
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
      const docType = editing.documentType.trim().toUpperCase();
      const docCat = editing.documentCategory.trim().toUpperCase();
      const invType = editing.inventoryType;

      for (const plantId of editing.plantIds) {
        const payload = {
          plantId,
          inventoryType: invType,
          documentType: docType,
          documentCategory: docCat,
          updatedAt: new Date().toISOString(),
        };
        updateDocumentNonBlocking(doc(db, "billing_types", editing.id), payload);
      }

      window.dispatchEvent(new CustomEvent('sap-status', {
        detail: { text: `Billing type updated across ${editing.plantIds.length} plant(s)`, isError: false }
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

  const handleDelete = async (id: string, plantId: string, docType: string) => {
    if (!confirm(`Are you sure you want to delete billing type "${docType || '-'}" for Plant ${plantId}?`)) return;
    setDeletingId(id);
    try {
      deleteDocumentNonBlocking(doc(db, "billing_types", id));
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: `Billing type deleted successfully`, isError: false } }));
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
          Change Billing Types
        </h2>
      </div>

      <div className="p-4 space-y-4">
        <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
          <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700">
            Billing Type List
          </div>
          <div className="p-2 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="sap-label whitespace-nowrap">Plants</label>
              <div className="w-[280px]">
                <PlantMultiSelect
                  plants={plants}
                  selected={selectedPlants}
                  onChange={setSelectedPlants}
                  isLoading={isPlantsLoading}
                  placeholder="Filter by Plant(s)..."
                />
              </div>
            </div>
            <div className="relative flex items-center bg-white border border-gray-400 h-7 w-80 px-2 group focus-within:border-blue-500">
              <Search className="h-3.5 w-3.5 text-gray-400 mr-1" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-full text-xs outline-none"
                placeholder="Search billing types..."
              />
              {search && (
                <button onClick={() => setSearch("")} className="text-gray-400 hover:text-gray-600"><X className="h-3 w-3" /></button>
              )}
            </div>
            <div className="text-[11px] font-bold text-gray-600 uppercase ml-auto">
              Total Records: {filteredRecords.length}
            </div>
          </div>
        </div>

        <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-white">
          <div className="overflow-x-auto no-scrollbar">
            <Table>
              <TableHeader className="bg-[#e7ebf1]">
                <TableRow className="h-8">
                  <TableHead className="text-[11px] font-bold border-r w-10 text-center">#</TableHead>
                  <TableHead className="text-[11px] font-bold border-r w-48">Plant ID</TableHead>
                  <TableHead className="text-[11px] font-bold border-r w-36">Inventory Type</TableHead>
                  <TableHead className="text-[11px] font-bold border-r">Document Type</TableHead>
                  <TableHead className="text-[11px] font-bold border-r">Charge Type</TableHead>
                  <TableHead className="w-24 text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isBillingLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-10 text-xs flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" /> RETRIVING DATA...
                  </TableCell></TableRow>
                ) : filteredRecords.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-10 text-xs text-red-500 font-bold uppercase">No records found</TableCell></TableRow>
                ) : filteredRecords.map((r, idx) => (
                  <TableRow key={r.id} className="h-8 hover:bg-blue-50/30 border-b border-gray-100">
                    <TableCell className="p-0 text-center text-[10px] border-r text-gray-400">{idx + 1}</TableCell>
                    <TableCell className="p-0 px-2 text-[10px] border-r font-mono font-bold text-blue-700">{r.plantId || "-"}</TableCell>
                    <TableCell className="p-0 px-2 text-[10px] border-r text-center">{r.inventoryType || "-"}</TableCell>
                    <TableCell className="p-0 px-2 text-[10px] border-r">{r.documentType || "-"}</TableCell>
                    <TableCell className="p-0 px-2 text-[10px] border-r">{r.documentCategory || "-"}</TableCell>
                    <TableCell className="p-0 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-blue-600 hover:bg-blue-50"
                          onClick={() => openEdit(r)}
                          title="Edit Billing Type"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-red-500 hover:bg-red-50"
                          onClick={() => handleDelete(r.id, r.plantId || "", r.documentType || "")}
                          disabled={deletingId === r.id}
                          title="Delete Billing Type"
                        >
                          {deletingId === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="bg-[#e7ebf1] p-1 flex justify-between items-center px-4 border-t border-[#b5c7de] text-[11px] font-bold text-gray-600 uppercase">
            <span>Total Rows: {filteredRecords.length}</span>
            <span>Showing {filteredRecords.length} of {billingTypes?.length || 0}</span>
          </div>
        </div>
      </div>

<Dialog open={!!editing} onOpenChange={(open) => { if (!open) setEditing(null); }} modal={false}>
        <DialogContent className="max-w-xl rounded-none border-gray-400 p-0 overflow-hidden">
          <DialogHeader className="bg-[#333e4f] px-4 py-2.5 border-b border-gray-300">
            <DialogTitle className="text-[13px] font-black uppercase tracking-wider text-white">
              Edit Billing Type
            </DialogTitle>
          </DialogHeader>

          <div className="p-5 space-y-4">
            {formErrors.length > 0 && (
              <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-sm flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <div className="text-[11px] font-bold text-red-700 space-y-0.5">
                  {formErrors.map((e, i) => <div key={i}>• {e}</div>)}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="sap-selection-row">
                <label className="sap-label">Plant ID(s) <span className="text-red-500">*</span></label>
                <div className="sap-input-wrapper w-full max-w-full">
                  <PlantMultiSelect
                    plants={plants}
                    selected={editing?.plantIds || []}
                    onChange={updatePlantIds}
                    isLoading={isPlantsLoading}
                    placeholder="Select Plant(s)..."
                  />
                </div>
              </div>

              <div className="sap-selection-row">
                <label className="sap-label">Inventory Type</label>
                <div className="sap-input-wrapper w-full max-w-full">
                  <Select value={editing?.inventoryType || ""} onValueChange={v => updateField("inventoryType", v)}>
                    <SelectTrigger className="h-7 rounded-none border-gray-400 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Service Invoice">Service Invoice</SelectItem>
                      <SelectItem value="Supply Invoice">Supply Invoice</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="sap-selection-row">
                <label className="sap-label">Document Type</label>
                <div className="sap-input-wrapper w-full max-w-full">
                  <Input
                    className="h-7 rounded-none border-gray-400 text-xs"
                    value={editing?.documentType || ""}
                    onChange={e => updateField("documentType", e.target.value.toUpperCase())}
                    placeholder="e.g. TAX INVOICE"
                  />
                </div>
              </div>

              <div className="sap-selection-row">
                <label className="sap-label">Charge Type</label>
                <div className="sap-input-wrapper w-full max-w-full">
                  <Input
                    className="h-7 rounded-none border-gray-400 text-xs"
                    value={editing?.documentCategory || ""}
                    onChange={e => updateField("documentCategory", e.target.value.toUpperCase())}
                    placeholder="e.g. FREIGHT"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-gray-200 px-5 py-3 gap-2 bg-[#f7f7f7]">
            <DialogClose asChild>
              <Button variant="outline" size="sm" className="h-8 rounded-none border-gray-400 text-xs font-bold uppercase">Cancel</Button>
            </DialogClose>
            <Button
              onClick={handleSave}
              disabled={saving}
              size="sm"
              className="h-8 rounded-none bg-blue-700 hover:bg-blue-800 text-xs font-bold uppercase gap-2"
            >
              {saving && <Loader2 className="h-3 w-3 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
