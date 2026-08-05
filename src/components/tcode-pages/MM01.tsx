"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useDatabase, addDocumentNonBlocking, useCollection, useMemoDatabase } from "@/database";
import { collection, serverTimestamp } from "@/database/mongo";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Loader2, Download, Upload, AlertCircle } from "lucide-react";
import PlantMultiSelect from "./PlantMultiSelect";

const UOM_OPTIONS = ["SQFT", "MT", "KG", "BAG", "BOX", "PCS", "OTHERS"];

type MaterialRow = {
  id: string;
  materialCode: string;
  materialName: string;
  uom: string;
  hsnSac: string;
  gstRate: string;
  status: string;
};

const newRow = (): MaterialRow => ({
  id: Math.random().toString(36).substr(2, 9),
  materialCode: "",
  materialName: "",
  uom: "",
  hsnSac: "",
  gstRate: "",
  status: "Active",
});

const normalize = (v: string) => (v || "").trim().toUpperCase();

const titleCase = (v: string) =>
  v.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");

const dedupeIgnoreCase = (values: Array<string | undefined>) => {
  const seen = new Set<string>();
  return (values.filter(Boolean) as string[]).filter(v => {
    const key = v.trim().toUpperCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

// Helper to safely extract array of plant IDs from billing record
const getRecordPlants = (record: any): string[] => {
  if (Array.isArray(record.plantIds) && record.plantIds.length > 0) {
    return record.plantIds;
  }
  return record.plantId ? [record.plantId] : [];
};

export default function MM01() {
  const db = useDatabase();
  const [header, setHeader] = useState({
    plantIds: [] as string[],
    documentType: "",
    documentCategory: "",
    inventoryType: ""
  });
  const [rows, setRows] = useState<MaterialRow[]>([newRow()]);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch Plants
  const plantsQuery = useMemoDatabase(() => collection(db, "plants"), [db]);
  const { data: plants, isLoading: isPlantsLoading } = useCollection(plantsQuery);

  // Fetch Billing Types (VOF03 master)
  const billingQuery = useMemoDatabase(() => collection(db, "billing_types"), [db]);
  const { data: billingTypes, isLoading: isBillingLoading } = useCollection(billingQuery);

  // Fetch existing materials
  const materialsQuery = useMemoDatabase(() => collection(db, "materials"), [db]);
  const { data: materials } = useCollection(materialsQuery);

  // Filter billing types based on selected Plants + Inventory Type (Handles both plantIds array & plantId string)
  const filteredBillingTypes = useMemo(() => {
    if (!billingTypes || header.plantIds.length === 0) return [];
    return billingTypes.filter(bt => {
      const recPlants = getRecordPlants(bt);
      const matchesPlant = recPlants.some(p => header.plantIds.includes(p));
      const matchesInventory = !header.inventoryType || bt.inventoryType === header.inventoryType;
      const isActive = !bt.status || bt.status === "Active";
      
      return matchesPlant && matchesInventory && isActive;
    });
  }, [billingTypes, header.plantIds, header.inventoryType]);

  // Document Types from VOF03
  const documentTypes = useMemo(
    () => dedupeIgnoreCase(filteredBillingTypes.map(bt => bt.documentType)),
    [filteredBillingTypes]
  );

  // Charge Types (Document Categories) filtered by selected Document Type (if selected) or all matching filtered items
  const availableCategories = useMemo(() => {
    const records = header.documentType
      ? filteredBillingTypes.filter(bt => bt.documentType === header.documentType)
      : filteredBillingTypes;
    return dedupeIgnoreCase(records.map(bt => bt.documentCategory));
  }, [filteredBillingTypes, header.documentType]);

  // Reset documentType and documentCategory if plantIds or inventoryType change and previous values are no longer valid
  useEffect(() => {
    if (header.documentType && !documentTypes.includes(header.documentType)) {
      setHeader(prev => ({ ...prev, documentType: "", documentCategory: "" }));
    }
  }, [documentTypes, header.documentType]);

  useEffect(() => {
    if (header.documentCategory && !availableCategories.includes(header.documentCategory)) {
      setHeader(prev => ({ ...prev, documentCategory: "" }));
    }
  }, [availableCategories, header.documentCategory]);

  const updateRow = (id: string, field: keyof MaterialRow, value: string) => {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const addRow = () => setRows(prev => [...prev, newRow()]);

  const deleteRow = (id: string) => {
    setRows(prev => (prev.length > 1 ? prev.filter(r => r.id !== id) : prev));
  };

  const validateRows = useCallback(
    (rowsToValidate: MaterialRow[]) => {
      const newErrors: Record<string, string[]> = {};
      const seenCodes: Record<string, number> = {};

      rowsToValidate.forEach((row, idx) => {
        const rowErrors: string[] = [];
        const code = row.materialCode.trim();
        const name = row.materialName.trim();

        if (!code) rowErrors.push("Material Code is mandatory");
        if (!name) rowErrors.push("Material Name is mandatory");
        if (!row.uom) rowErrors.push("UOM is mandatory");
        if (row.gstRate !== "" && row.gstRate !== null && row.gstRate !== undefined && isNaN(Number(row.gstRate))) {
          rowErrors.push("GST Rate must be numeric");
        }

        if (code) {
          const normalized = normalize(code);
          if (seenCodes[normalized] !== undefined) {
            rowErrors.push(`Duplicate Material Code within document (duplicate of row ${seenCodes[normalized]})`);
          } else {
            seenCodes[normalized] = idx + 1;
          }
          const existing = (materials || []).find(
            m => normalize(m.materialCode) === normalized || normalize(m.productName) === normalized
          );
          if (existing) rowErrors.push("Material Code already exists in repository");
        }

        if (rowErrors.length) newErrors[row.id] = rowErrors;
      });

      return newErrors;
    },
    [materials]
  );

  const handleExecute = useCallback(async () => {
    if (header.plantIds.length === 0 || !header.documentType || !header.inventoryType || !header.documentCategory) {
      window.dispatchEvent(new CustomEvent('sap-status', {
        detail: { text: "Validation Error: Plant, Inventory Type, Document Type, and Charge Type are mandatory", isError: true }
      }));
      return false;
    }

    if (!documentTypes.includes(header.documentType)) {
      window.dispatchEvent(new CustomEvent('sap-status', {
        detail: { text: "Validation Error: Selected Document Type is invalid for the chosen Plant & Inventory Type", isError: true }
      }));
      return false;
    }

    if (!availableCategories.includes(header.documentCategory)) {
      window.dispatchEvent(new CustomEvent('sap-status', {
        detail: { text: "Validation Error: Selected Charge Type is invalid for the chosen Plant & Inventory Type", isError: true }
      }));
      return false;
    }

    const validationErrors = validateRows(rows);
    setErrors(validationErrors);

    const invalidCount = Object.keys(validationErrors).length;
    if (invalidCount > 0) {
      window.dispatchEvent(new CustomEvent('sap-status', {
        detail: { text: `Validation Error: ${invalidCount} row(s) contain errors. Please correct highlighted rows.`, isError: true }
      }));
      return false;
    }

    setLoading(true);
    try {
      const docs: any[] = [];
      for (const plantId of header.plantIds) {
        for (const row of rows) {
          docs.push({
            plantId,
            materialCode: row.materialCode.trim(),
            productName: row.materialName.trim(),
            uom: row.uom,
            hsnSac: row.hsnSac.trim(),
            gstRate: Number(row.gstRate || 0),
            status: row.status,
            documentType: header.documentType,
            documentCategory: header.documentCategory,
            inventoryType: header.inventoryType,
            createdAt: serverTimestamp(),
          });
        }
      }

      await Promise.all(docs.map(docData => addDocumentNonBlocking(collection(db, "materials"), docData)));

      window.dispatchEvent(new CustomEvent('sap-status', {
        detail: { text: `${docs.length} material record(s) created successfully across ${header.plantIds.length} plant(s)`, isError: false }
      }));
      setRows([newRow()]);
      setErrors({});
      return true;
    } catch (error) {
      window.dispatchEvent(new CustomEvent('sap-status', {
        detail: { text: "System Error: Transaction failed", isError: true }
      }));
      return false;
    } finally {
      setLoading(false);
    }
  }, [header, rows, validateRows, availableCategories, documentTypes, db]);

  useEffect(() => {
    const onExecute = () => handleExecute();
    const onCancel = () => {
      setRows([newRow()]);
      setErrors({});
    };
    window.addEventListener('sap-execute', onExecute);
    window.addEventListener('sap-cancel', onCancel);
    return () => {
      window.removeEventListener('sap-execute', onExecute);
      window.removeEventListener('sap-cancel', onCancel);
    };
  }, [handleExecute]);

  const downloadTemplate = () => {
    const headers = ["MaterialCode", "MaterialName", "UOM", "HSN/SAC Code", "GST Rate (%)", "Status"];
    const csvContent = headers.join(",");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "MM01_Material_Template.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split("\n").map(line => line.trim()).filter(line => line !== "");
      const dataRows = lines.slice(1);
      const parsed: MaterialRow[] = dataRows.map(line => {
        const [materialCode, materialName, uom, hsnSac, gstRate, status] = line.split(",").map(val => val.trim());
        return {
          id: Math.random().toString(36).substr(2, 9),
          materialCode: materialCode || "",
          materialName: materialName || "",
          uom: uom || "",
          hsnSac: hsnSac || "",
          gstRate: gstRate || "",
          status: status || "Active",
        };
      }).filter(r => r.materialCode || r.materialName);

      if (parsed.length) {
        setRows(parsed);
        setErrors({});
        window.dispatchEvent(new CustomEvent('sap-status', {
          detail: { text: `Loaded ${parsed.length} row(s) from CSV. Review and Save.`, isError: false }
        }));
      } else {
        window.dispatchEvent(new CustomEvent('sap-status', {
          detail: { text: "No valid rows found in CSV file", isError: true }
        }));
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsText(file);
  };

  const totalInvalidRows = Object.keys(errors).length;

  return (
    <div className="w-full flex flex-col bg-white min-h-full">
      <div className="bg-[#dae8f5] px-4 py-1 border-b border-gray-300 flex items-center justify-between">
        <h2 className="text-[13px] font-bold text-gray-800 uppercase italic tracking-wider">
          Create Material
        </h2>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={downloadTemplate}
            className="h-6 text-[11px] font-bold text-blue-700 hover:bg-blue-50 border border-blue-200 rounded-none gap-1"
          >
            <Download className="h-3 w-3" /> Download Template
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="h-6 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50 border border-emerald-200 rounded-none gap-1"
          >
            <Upload className="h-3 w-3" /> Bulk Upload
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleBulkUpload}
            accept=".csv"
            className="hidden"
          />
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
          <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700">
            Organizational Data (applies to all material rows)
          </div>

          <div className="p-2 grid grid-cols-2 gap-x-8 gap-y-2">
            {/* Plant Selector */}
            <div className="sap-selection-row">
              <label className="sap-label">Plant ID(s) <span className="text-red-500">*</span></label>
              <div className="sap-input-wrapper max-w-[280px]">
                <PlantMultiSelect
                  plants={plants}
                  selected={header.plantIds}
                  onChange={(ids) => setHeader(prev => ({ ...prev, plantIds: ids, documentType: "", documentCategory: "" }))}
                  isLoading={isPlantsLoading}
                  placeholder="Select Plant(s)..."
                />
              </div>
            </div>

            {/* Inventory Type */}
            <div className="sap-selection-row">
              <label className="sap-label">Inventory Type <span className="text-red-500">*</span></label>
              <div className="sap-input-wrapper max-w-[200px]">
                <Select
                  value={header.inventoryType}
                  onValueChange={(val) => setHeader(prev => ({ ...prev, inventoryType: val, documentType: "", documentCategory: "" }))}
                >
                  <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Service Invoice">Service Invoice</SelectItem>
                    <SelectItem value="Supply Invoice">Supply Invoice</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Document Type Dropdown */}
            <div className="sap-selection-row">
              <label className="sap-label">Document Type <span className="text-red-500">*</span></label>
              <div className="sap-input-wrapper max-w-[200px]">
                <Select
                  value={header.documentType}
                  onValueChange={(val) => setHeader(prev => ({ ...prev, documentType: val, documentCategory: "" }))}
                  disabled={header.plantIds.length === 0 || !header.inventoryType}
                >
                  <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]">
                    <SelectValue placeholder="Select Document Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {documentTypes.map(type => (
                      <SelectItem key={type} value={type}>{titleCase(type)}</SelectItem>
                    ))}
                    {header.plantIds.length > 0 && header.inventoryType && documentTypes.length === 0 && (
                      <div className="px-2 py-3 text-center text-[10px] font-bold text-red-500">
                        No Document Types configured in VOF03 for selected Plant/Inventory Type.
                      </div>
                    )}
                  </SelectContent>
                </Select>
                {isBillingLoading && <Loader2 className="h-4 w-4 animate-spin text-blue-600 ml-1" />}
              </div>
            </div>

            {/* Charge Type Dropdown */}
            <div className="sap-selection-row">
              <label className="sap-label">Charge Type <span className="text-red-500">*</span></label>
              <div className="sap-input-wrapper max-w-[200px]">
                <Select
                  value={header.documentCategory}
                  onValueChange={(val) => setHeader(prev => ({ ...prev, documentCategory: val }))}
                  disabled={header.plantIds.length === 0 || !header.inventoryType}
                >
                  <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]">
                    <SelectValue placeholder="Select Charge Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCategories.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                    {header.plantIds.length > 0 && header.inventoryType && availableCategories.length === 0 && (
                      <div className="px-2 py-3 text-center text-[10px] font-bold text-red-500">
                        No Charge Types configured in VOF03.
                      </div>
                    )}
                  </SelectContent>
                </Select>
                {isBillingLoading && <Loader2 className="h-4 w-4 animate-spin text-blue-600 ml-1" />}
              </div>
            </div>
          </div>
        </div>

        {/* Material Master Table */}
        <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-white">
          <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] flex items-center justify-between">
            <span className="text-[12px] font-semibold text-gray-700">Material Master Data</span>
            <Button
              size="sm"
              variant="ghost"
              className="h-5 text-[10px] font-bold text-blue-700 hover:bg-blue-50 gap-1"
              onClick={addRow}
            >
              <Plus className="h-3 w-3" /> Add Row
            </Button>
          </div>

          {totalInvalidRows > 0 && (
            <div className="px-3 py-2 bg-red-50 border-b border-red-200 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
              <span className="text-[11px] font-bold text-red-700">
                {totalInvalidRows} row(s) contain validation errors. Correct the highlighted rows before saving.
              </span>
            </div>
          )}

          <div className="overflow-x-auto no-scrollbar">
            <Table>
              <TableHeader className="bg-[#e7ebf1]">
                <TableRow className="h-8">
                  <TableHead className="text-[11px] font-bold border-r w-10 text-center">#</TableHead>
                  <TableHead className="text-[11px] font-bold border-r w-44">Material Code <span className="text-red-500">*</span></TableHead>
                  <TableHead className="text-[11px] font-bold border-r">Material Name <span className="text-red-500">*</span></TableHead>
                  <TableHead className="text-[11px] font-bold border-r w-32">UOM <span className="text-red-500">*</span></TableHead>
                  <TableHead className="text-[11px] font-bold border-r w-32">HSN/SAC Code</TableHead>
                  <TableHead className="text-[11px] font-bold border-r w-28">GST Rate (%)</TableHead>
                  <TableHead className="text-[11px] font-bold border-r w-32">Status</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, idx) => {
                  const rowErrors = errors[row.id] || [];
                  const isInvalid = rowErrors.length > 0;
                  return (
                    <TableRow
                      key={row.id}
                      className={`h-8 hover:bg-blue-50/30 border-b border-gray-100 ${isInvalid ? "bg-red-50" : ""}`}
                    >
                      <TableCell className={`p-0 text-center text-[10px] border-r ${isInvalid ? "text-red-500 font-black" : "text-gray-400"}`}>
                        {idx + 1}
                      </TableCell>
                      <TableCell className={`p-0 border-r ${isInvalid ? "bg-red-50" : ""}`}>
                        <Input
                          className={`h-full border-none shadow-none rounded-none focus:bg-[#fff9c4] ${isInvalid ? "ring-1 ring-inset ring-red-400 bg-red-50" : ""}`}
                          value={row.materialCode}
                          onChange={e => updateRow(row.id, "materialCode", e.target.value.toUpperCase())}
                          placeholder="MAT-001"
                        />
                      </TableCell>
                      <TableCell className={`p-0 border-r ${isInvalid ? "bg-red-50" : ""}`}>
                        <Input
                          className={`h-full border-none shadow-none rounded-none focus:bg-[#fff9c4] ${isInvalid ? "ring-1 ring-inset ring-red-400 bg-red-50" : ""}`}
                          value={row.materialName}
                          onChange={e => updateRow(row.id, "materialName", e.target.value)}
                          placeholder="Material description..."
                        />
                      </TableCell>
                      <TableCell className={`p-0 border-r ${isInvalid ? "bg-red-50" : ""}`}>
                        <Select value={row.uom} onValueChange={v => updateRow(row.id, "uom", v)}>
                          <SelectTrigger className={`h-7 border-none bg-transparent text-xs rounded-none px-2 shadow-none focus:bg-[#fff9c4] ${isInvalid ? "ring-1 ring-inset ring-red-400 bg-red-50" : ""}`}>
                            <SelectValue placeholder="Select UOM" />
                          </SelectTrigger>
                          <SelectContent>
                            {UOM_OPTIONS.map(opt => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className={`p-0 border-r ${isInvalid ? "bg-red-50" : ""}`}>
                        <Input
                          className={`h-full border-none shadow-none rounded-none font-mono focus:bg-[#fff9c4] ${isInvalid ? "ring-1 ring-inset ring-red-400 bg-red-50" : ""}`}
                          value={row.hsnSac}
                          onChange={e => updateRow(row.id, "hsnSac", e.target.value)}
                          placeholder="HSN/SAC"
                        />
                      </TableCell>
                      <TableCell className={`p-0 border-r ${isInvalid ? "bg-red-50" : ""}`}>
                        <Input
                          type="number"
                          className={`h-full border-none shadow-none rounded-none text-center font-bold focus:bg-[#fff9c4] ${isInvalid ? "ring-1 ring-inset ring-red-400 bg-red-50" : ""}`}
                          value={row.gstRate}
                          onChange={e => updateRow(row.id, "gstRate", e.target.value)}
                          placeholder="0"
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

      {loading && (
        <div className="fixed bottom-10 right-10 bg-[#333e4f] text-white px-4 py-2 text-xs border border-white/20">
          PROCESSING TRANSACTION...
        </div>
      )}
    </div>
  );
}