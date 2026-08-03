"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useDatabase, useCollection, useMemoDatabase, updateDocumentNonBlocking, deleteDocumentNonBlocking, addDocumentNonBlocking } from "@/database";
import { collection, doc, serverTimestamp } from "@/database/mongo";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Loader2, AlertCircle } from "lucide-react";

const UOM_OPTIONS = ["SQFT", "MT", "KG", "BAG", "BOX", "PCS", "OTHERS"];

type MaterialRow = {
  id: string;
  docId?: string;
  materialCode: string;
  materialName: string;
  uom: string;
  hsnSac: string;
  gstRate: string;
  status: string;
  plantId: string;
  documentType: string;
  documentCategory: string;
  inventoryType: string;
};

const newRow = (): MaterialRow => ({
  id: Math.random().toString(36).substr(2, 9),
  materialCode: "",
  materialName: "",
  uom: "",
  hsnSac: "",
  gstRate: "",
  status: "Active",
  plantId: "",
  documentType: "Tax Invoice",
  documentCategory: "",
  inventoryType: "",
});

const normalize = (v: string) => (v || "").trim().toUpperCase();

export default function MM02() {
  const db = useDatabase();
  const [selectedId, setSelectedId] = useState("");
  const [rows, setRows] = useState<MaterialRow[]>([]);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);

  const materialsQuery = useMemoDatabase(() => collection(db, "materials"), [db]);
  const { data: materials, isLoading: isMaterialsLoading } = useCollection(materialsQuery);

  const plantsQuery = useMemoDatabase(() => collection(db, "plants"), [db]);
  const { data: plants, isLoading: isPlantsLoading } = useCollection(plantsQuery);

  const billingQuery = useMemoDatabase(() => collection(db, "billing_types"), [db]);
  const { data: billingTypes } = useCollection(billingQuery);

  const availableCategories = useMemo(() => {
    if (!billingTypes) return [];
    const categories = billingTypes.filter(bt => bt.documentCategory).map(bt => bt.documentCategory as string);
    return Array.from(new Set(categories));
  }, [billingTypes]);

  const handleSelect = (id: string) => {
    const material = materials?.find(m => m.id === id);
    if (!material) return;
    setSelectedId(id);
    setRows([{
      id: Math.random().toString(36).substr(2, 9),
      docId: material.id,
      materialCode: material.materialCode || "",
      materialName: material.productName || "",
      uom: material.uom || "",
      hsnSac: material.hsnSac || "",
      gstRate: material.gstRate !== undefined ? String(material.gstRate) : "",
      status: material.status || "Active",
      plantId: material.plantId || "",
      documentType: material.documentType || "Tax Invoice",
      documentCategory: material.documentCategory || "",
      inventoryType: material.inventoryType || "",
    }]);
    setErrors({});
  };

  const updateRow = (id: string, field: keyof MaterialRow, value: string) => {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const addRow = () => {
    const base = rows[0] || newRow();
    setRows(prev => [...prev, {
      ...newRow(),
      plantId: base.plantId,
      documentType: base.documentType,
      documentCategory: base.documentCategory,
      inventoryType: base.inventoryType,
    }]);
  };

  const deleteRow = (id: string) => {
    setRows(prev => (prev.length > 1 ? prev.filter(r => r.id !== id) : prev));
  };

  const validateRows = useCallback(() => {
    const newErrors: Record<string, string[]> = {};
    const seenCodes: Record<string, number> = {};

    rows.forEach((row, idx) => {
      const rowErrors: string[] = [];
      const code = row.materialCode.trim();
      const name = row.materialName.trim();

      if (!code) rowErrors.push("Material Code is mandatory");
      if (!name) rowErrors.push("Material Name is mandatory");
      if (!row.uom) rowErrors.push("UOM is mandatory");
      if (!row.hsnSac.trim()) rowErrors.push("HSN Code is mandatory");
      if (row.gstRate === "" || row.gstRate === null || row.gstRate === undefined) {
        rowErrors.push("GST Rate is mandatory");
      } else if (isNaN(Number(row.gstRate))) {
        rowErrors.push("GST Rate must be numeric");
      }

      if (code) {
        const normalized = normalize(code);
        if (seenCodes[normalized] !== undefined) {
          rowErrors.push(`Duplicate Material Code within document (duplicate of row ${seenCodes[normalized]})`);
        } else {
          seenCodes[normalized] = idx + 1;
        }
        // Check duplicates against DB, excluding the current record if editing
        const existing = (materials || []).find(m => {
          const isSelf = row.docId && m.id === row.docId;
          if (isSelf) return false;
          return normalize(m.materialCode) === normalized || normalize(m.productName) === normalized;
        });
        if (existing) rowErrors.push("Material Code already exists in repository");
      }

      if (rowErrors.length) newErrors[row.id] = rowErrors;
    });

    return newErrors;
  }, [rows, materials]);

  const handleExecute = useCallback(async () => {
    if (!selectedId) {
      window.dispatchEvent(new CustomEvent('sap-status', {
        detail: { text: "Error: Select a material to modify", isError: true }
      }));
      return;
    }

    const validationErrors = validateRows();
    setErrors(validationErrors);

    const invalidCount = Object.keys(validationErrors).length;
    if (invalidCount > 0) {
      window.dispatchEvent(new CustomEvent('sap-status', {
        detail: { text: `Validation Error: ${invalidCount} row(s) contain errors. Correct highlighted rows.`, isError: true }
      }));
      return;
    }

    setLoading(true);
    try {
      for (const row of rows) {
        const payload = {
          materialCode: row.materialCode.trim(),
          productName: row.materialName.trim(),
          uom: row.uom,
          hsnSac: row.hsnSac.trim(),
          gstRate: Number(row.gstRate),
          status: row.status,
          plantId: row.plantId,
          documentType: row.documentType,
          documentCategory: row.documentCategory,
          inventoryType: row.inventoryType,
          updatedAt: new Date().toISOString(),
        };
        if (row.docId) {
          updateDocumentNonBlocking(doc(db, "materials", row.docId), payload);
        } else {
          addDocumentNonBlocking(collection(db, "materials"), { ...payload, createdAt: serverTimestamp() });
        }
      }

      window.dispatchEvent(new CustomEvent('sap-status', {
        detail: { text: `${rows.length} material record(s) updated successfully`, isError: false }
      }));
    } catch (error) {
      window.dispatchEvent(new CustomEvent('sap-status', {
        detail: { text: "Update failed: Database synchronization error", isError: true }
      }));
    } finally {
      setLoading(false);
    }
  }, [selectedId, rows, validateRows, db]);

  const handleDelete = async () => {
    if (!selectedId) return;
    if (!confirm("Are you sure you want to delete this material? Historical invoices will not be affected.")) return;

    setLoading(true);
    try {
      deleteDocumentNonBlocking(doc(db, "materials", selectedId));
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Material deleted successfully", isError: false } }));
      setSelectedId("");
      setRows([]);
      setErrors({});
    } catch (e) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Deletion failed", isError: true } }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const onExecute = () => handleExecute();
    window.addEventListener('sap-execute', onExecute);
    return () => window.removeEventListener('sap-execute', onExecute);
  }, [handleExecute]);

  const totalInvalidRows = Object.keys(errors).length;

  return (
    <div className="w-full flex flex-col bg-white min-h-full">
      <div className="bg-[#dae8f5] px-4 py-1 border-b border-gray-300">
        <h2 className="text-[13px] font-bold text-gray-800 uppercase italic tracking-wider">
          Change Material
        </h2>
      </div>

      <div className="p-4 space-y-4">
        <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
          <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700">Selection</div>
          <div className="p-2">
            <div className="sap-selection-row">
              <label className="sap-label">Material</label>
              <div className="sap-input-wrapper max-md">
                <Select onValueChange={handleSelect} value={selectedId}>
                  <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]">
                    <SelectValue placeholder="Select a material to change..." />
                  </SelectTrigger>
                  <SelectContent>
                    {materials?.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.materialCode || m.productName} - {m.productName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isMaterialsLoading && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
              </div>
            </div>
          </div>
        </div>

        {selectedId && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-white">
              <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] flex items-center justify-between">
                <span className="text-[12px] font-semibold text-gray-700">General Data</span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-5 text-[10px] font-bold text-blue-700 hover:bg-blue-50 gap-1"
                    onClick={addRow}
                  >
                    <Plus className="h-3 w-3" /> Add Row
                  </Button>
                  <Button
                    onClick={handleDelete}
                    variant="destructive"
                    size="sm"
                    className="h-5 rounded-none gap-2 uppercase font-bold text-[10px]"
                  >
                    <Trash2 className="h-3 w-3" /> Delete Material
                  </Button>
                </div>
              </div>

              {totalInvalidRows > 0 && (
                <div className="px-3 py-2 bg-red-50 border-b border-red-200 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                  <span className="text-[11px] font-bold text-red-700">
                    {totalInvalidRows} row(s) contain validation errors. Correct highlighted rows before saving.
                  </span>
                </div>
              )}

              <div className="overflow-x-auto no-scrollbar">
                <Table>
                  <TableHeader className="bg-[#e7ebf1]">
                    <TableRow className="h-8">
                      <TableHead className="text-[11px] font-bold border-r w-10 text-center">#</TableHead>
                      <TableHead className="text-[11px] font-bold border-r w-40">Plant ID</TableHead>
                      <TableHead className="text-[11px] font-bold border-r w-44">Material Code <span className="text-red-500">*</span></TableHead>
                      <TableHead className="text-[11px] font-bold border-r">Material Name <span className="text-red-500">*</span></TableHead>
                      <TableHead className="text-[11px] font-bold border-r w-32">UOM <span className="text-red-500">*</span></TableHead>
                      <TableHead className="text-[11px] font-bold border-r w-32">HSN Code <span className="text-red-500">*</span></TableHead>
                      <TableHead className="text-[11px] font-bold border-r w-28">GST Rate (%) <span className="text-red-500">*</span></TableHead>
                      <TableHead className="text-[11px] font-bold border-r w-28">Status</TableHead>
                      <TableHead className="text-[11px] font-bold border-r w-32">Charge Type</TableHead>
                      <TableHead className="text-[11px] font-bold border-r w-36">Inventory Type</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row, idx) => {
                      const rowErrors = errors[row.id] || [];
                      const isInvalid = rowErrors.length > 0;
                      return (
                        <TableRow key={row.id} className={`h-8 hover:bg-blue-50/30 border-b border-gray-100 ${isInvalid ? "bg-red-50" : ""}`}>
                          <TableCell className={`p-0 text-center text-[10px] border-r ${isInvalid ? "text-red-500 font-black" : "text-gray-400"}`}>{idx + 1}</TableCell>
                          <TableCell className={`p-0 border-r ${isInvalid ? "bg-red-50" : ""}`}>
                            <Select value={row.plantId} onValueChange={v => updateRow(row.id, "plantId", v)}>
                              <SelectTrigger className={`h-7 border-none bg-transparent text-xs rounded-none px-2 shadow-none focus:bg-[#fff9c4] ${isInvalid ? "ring-1 ring-inset ring-red-400 bg-red-50" : ""}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {plants?.map(p => <SelectItem key={p.id} value={p.plantId}>{p.plantId}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            {isPlantsLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                          </TableCell>
                          <TableCell className={`p-0 border-r ${isInvalid ? "bg-red-50" : ""}`}>
                            <Input
                              className={`h-full border-none shadow-none rounded-none focus:bg-[#fff9c4] ${isInvalid ? "ring-1 ring-inset ring-red-400 bg-red-50" : ""}`}
                              value={row.materialCode}
                              onChange={e => updateRow(row.id, "materialCode", e.target.value.toUpperCase())}
                            />
                          </TableCell>
                          <TableCell className={`p-0 border-r ${isInvalid ? "bg-red-50" : ""}`}>
                            <Input
                              className={`h-full border-none shadow-none rounded-none focus:bg-[#fff9c4] ${isInvalid ? "ring-1 ring-inset ring-red-400 bg-red-50" : ""}`}
                              value={row.materialName}
                              onChange={e => updateRow(row.id, "materialName", e.target.value)}
                            />
                          </TableCell>
                          <TableCell className={`p-0 border-r ${isInvalid ? "bg-red-50" : ""}`}>
                            <Select value={row.uom} onValueChange={v => updateRow(row.id, "uom", v)}>
                              <SelectTrigger className={`h-7 border-none bg-transparent text-xs rounded-none px-2 shadow-none focus:bg-[#fff9c4] ${isInvalid ? "ring-1 ring-inset ring-red-400 bg-red-50" : ""}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {UOM_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className={`p-0 border-r ${isInvalid ? "bg-red-50" : ""}`}>
                            <Input
                              className={`h-full border-none shadow-none rounded-none focus:bg-[#fff9c4] ${isInvalid ? "ring-1 ring-inset ring-red-400 bg-red-50" : ""}`}
                              value={row.hsnSac}
                              onChange={e => updateRow(row.id, "hsnSac", e.target.value)}
                            />
                          </TableCell>
                          <TableCell className={`p-0 border-r ${isInvalid ? "bg-red-50" : ""}`}>
                            <Input
                              type="number"
                              className={`h-full border-none shadow-none rounded-none text-center focus:bg-[#fff9c4] ${isInvalid ? "ring-1 ring-inset ring-red-400 bg-red-50" : ""}`}
                              value={row.gstRate}
                              onChange={e => updateRow(row.id, "gstRate", e.target.value)}
                            />
                          </TableCell>
                          <TableCell className={`p-0 border-r ${isInvalid ? "bg-red-50" : ""}`}>
                            <Select value={row.status} onValueChange={v => updateRow(row.id, "status", v)}>
                              <SelectTrigger className={`h-7 border-none bg-transparent text-xs rounded-none px-2 shadow-none focus:bg-[#fff9c4] ${isInvalid ? "ring-1 ring-inset ring-red-400 bg-red-50" : ""}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Active">Active</SelectItem>
                                <SelectItem value="Inactive">Inactive</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className={`p-0 border-r ${isInvalid ? "bg-red-50" : ""}`}>
                            <Select value={row.documentCategory} onValueChange={v => updateRow(row.id, "documentCategory", v)}>
                              <SelectTrigger className={`h-7 border-none bg-transparent text-xs rounded-none px-2 shadow-none focus:bg-[#fff9c4] ${isInvalid ? "ring-1 ring-inset ring-red-400 bg-red-50" : ""}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {availableCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className={`p-0 border-r ${isInvalid ? "bg-red-50" : ""}`}>
                            <Select value={row.inventoryType} onValueChange={v => updateRow(row.id, "inventoryType", v)}>
                              <SelectTrigger className={`h-7 border-none bg-transparent text-xs rounded-none px-2 shadow-none focus:bg-[#fff9c4] ${isInvalid ? "ring-1 ring-inset ring-red-400 bg-red-50" : ""}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Service Invoice">Service Invoice</SelectItem>
                                <SelectItem value="Supply Invoice">Supply Invoice</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="p-0 text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-red-500 hover:bg-red-50"
                              onClick={() => deleteRow(row.id)}
                              disabled={rows.length <= 1}
                              title="Delete Row"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="bg-[#e7ebf1] p-1 flex justify-between items-center px-4 border-t border-[#b5c7de] text-[11px] font-bold text-gray-600 uppercase">
                <span>Total Rows: {rows.length}</span>
                <span>Valid: {rows.length - totalInvalidRows} | Invalid: {totalInvalidRows}</span>
              </div>
            </div>

            {totalInvalidRows > 0 && (
              <div className="border border-red-300 bg-red-50 rounded-sm p-2 space-y-1">
                {rows.map((row, idx) => {
                  const rowErrors = errors[row.id];
                  if (!rowErrors) return null;
                  return (
                    <div key={row.id} className="text-[11px] font-bold text-red-700">
                      Row {idx + 1}: {rowErrors.join("; ")}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
      {loading && <div className="fixed bottom-10 right-10 bg-[#333e4f] text-white px-4 py-2 text-xs">UPDATING MASTER...</div>}
    </div>
  );
}

