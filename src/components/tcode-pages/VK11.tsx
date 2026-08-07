"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useDatabase, addDocumentNonBlocking, useCollection, useMemoDatabase } from "@/database";
import { collection, serverTimestamp } from "@/database/mongo";
import { Input } from "@/components/ui/input";
import { SapDateInput } from "@/components/ui/sap-date-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Upload, CheckCircle2, FileText, Eye, X, ExternalLink, FileSpreadsheet, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import PlantMultiSelect from "./PlantMultiSelect";
import { getRecordPlantIds, NO_MASTER_RECORDS_MESSAGE } from "@/lib/plant-master";

type RateRow = {
  id: string;
  materialCode: string;
  materialName: string;
  hsnSac: string;
  uom: string;
  gstRate: string;
  status: string;
  price: string;
  validFrom: string;
  validTo: string;
};

const getDefaultValidFrom = () => {
  const today = new Date();
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const day = String(today.getDate()).padStart(2, "0");
  const month = months[today.getMonth()];
  const year = today.getFullYear();
  return `${day}-${month}-${year}`;
};

const newRow = (validFrom = getDefaultValidFrom(), validTo = "31-DEC-9999"): RateRow => ({
  id: Math.random().toString(36).substr(2, 9),
  materialCode: "",
  materialName: "",
  hsnSac: "",
  uom: "",
  gstRate: "",
  status: "Active",
  price: "",
  validFrom,
  validTo,
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

const getRecordPlants = (record: any): string[] => {
  if (Array.isArray(record.plantIds) && record.plantIds.length > 0) {
    return record.plantIds;
  }
  return record.plantId ? [record.plantId] : [];
};

export default function VK11() {
  const db = useDatabase();
  const [header, setHeader] = useState({
    plantIds: [] as string[],
    inventoryType: "",
    documentType: "",
    documentCategory: "",
    customerCode: "",
    approvalFile: "",
    approvalFileName: "",
    validFrom: getDefaultValidFrom(),
    validTo: "31-DEC-9999",
  });
  const [rows, setRows] = useState<RateRow[]>([newRow(getDefaultValidFrom(), "31-DEC-9999")]);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);

  const pdfBlobUrl = useMemo(() => {
    if (header.approvalFile?.startsWith('data:application/pdf')) {
      try {
        const parts = header.approvalFile.split(',');
        const base64 = parts[1];
        const binary = atob(base64);
        const array = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
        const blob = new Blob([array], { type: 'application/pdf' });
        return URL.createObjectURL(blob);
      } catch (e) {
        console.error("PDF Blob conversion failed", e);
        return null;
      }
    }
    return null;
  }, [header.approvalFile]);

  useEffect(() => {
    return () => {
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
    };
  }, [pdfBlobUrl]);

  const plantsQuery = useMemoDatabase(() => collection(db, "plants"), [db]);
  const { data: plants } = useCollection(plantsQuery);
  const customersQuery = useMemoDatabase(() => collection(db, "customers"), [db]);
  const { data: customers } = useCollection(customersQuery);
  const materialsQuery = useMemoDatabase(() => collection(db, "materials"), [db]);
  const { data: materials } = useCollection(materialsQuery);
  const billingTypesQuery = useMemoDatabase(() => collection(db, "billing_types"), [db]);
  const { data: billingTypes } = useCollection(billingTypesQuery);

  const filteredBillingTypes = useMemo(() => {
    if (!billingTypes || header.plantIds.length === 0) return [];
    return billingTypes.filter(bt => {
      const recPlants = getRecordPlants(bt);
      const matchesPlant = recPlants.some(p => header.plantIds.includes(p));
      const matchesInventory = !header.inventoryType || normalize(bt.inventoryType) === normalize(header.inventoryType);
      const isActive = !bt.status || normalize(bt.status) === "ACTIVE";

      return matchesPlant && matchesInventory && isActive;
    });
  }, [billingTypes, header.plantIds, header.inventoryType]);

  const availableDocumentTypes = useMemo(
    () => dedupeIgnoreCase(filteredBillingTypes.map(b => b.documentType)),
    [filteredBillingTypes]
  );

  const availableCategories = useMemo(() => {
    const records = header.documentType
      ? filteredBillingTypes.filter(bt => normalize(bt.documentType) === normalize(header.documentType))
      : filteredBillingTypes;
    return dedupeIgnoreCase(records.map(b => b.documentCategory));
  }, [filteredBillingTypes, header.documentType]);

  useEffect(() => {
    if (header.documentType && !availableDocumentTypes.includes(header.documentType)) {
      setHeader(prev => ({ ...prev, documentType: "", documentCategory: "" }));
    }
  }, [availableDocumentTypes, header.documentType]);

  useEffect(() => {
    if (!header.documentType && availableDocumentTypes.length === 1) {
      setHeader(prev => ({ ...prev, documentType: availableDocumentTypes[0] }));
    }
  }, [availableDocumentTypes, header.documentType]);

  useEffect(() => {
    if (header.documentType && !header.documentCategory && availableCategories.length === 1) {
      setHeader(prev => ({ ...prev, documentCategory: availableCategories[0] }));
    }
  }, [availableCategories, header.documentType, header.documentCategory]);

  const filteredMaterials = useMemo(() => {
    if (header.plantIds.length === 0) return [];
    return (materials ?? []).filter(m => {
      const recPlants = getRecordPlants(m);
      const matchesPlant = recPlants.some(p => header.plantIds.includes(p));
      const matchesCategory = !header.documentCategory || normalize(m.documentCategory) === normalize(header.documentCategory);
      const matchesInventory = !header.inventoryType || normalize(m.inventoryType) === normalize(header.inventoryType);

      return matchesPlant && matchesCategory && matchesInventory;
    });
  }, [materials, header.plantIds, header.documentCategory, header.inventoryType]);

  const filteredCustomers = useMemo(() => {
    if (header.plantIds.length === 0) return customers;
    return customers?.filter(c => getRecordPlantIds(c).some(p => header.plantIds.includes(p))) || [];
  }, [customers, header.plantIds]);

  const updateHeaderValidFrom = (val: string) => {
    setHeader(prev => ({ ...prev, validFrom: val }));
    setRows(prev => prev.map(r => ({ ...r, validFrom: val })));
  };

  const updateHeaderValidTo = (val: string) => {
    setHeader(prev => ({ ...prev, validTo: val }));
    setRows(prev => prev.map(r => ({ ...r, validTo: val })));
  };

  const updateRow = (id: string, field: keyof RateRow, value: string) => {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, [field]: value };
      if (field === "materialCode") {
        const matches = (materials ?? []).filter(m =>
          (m.materialCode || "").toUpperCase() === value.toUpperCase() ||
          (m.productName || "").toUpperCase() === value.toUpperCase()
          && getRecordPlants(m).some(p => header.plantIds.includes(p))
        );
        const mat = matches.find(m => getRecordPlants(m).some(p => header.plantIds.includes(p)))
          || matches.find(m => !header.plantIds.length)
          || matches[0];
        updated.materialName = mat?.productName || "";
        updated.hsnSac = mat?.hsnSac || "";
        updated.uom = mat?.uom || "";
      }
      return updated;
    }));
  };

  const addRow = () => setRows(prev => [...prev, newRow(header.validFrom, header.validTo)]);

  const deleteRow = (id: string) => {
    setRows(prev => (prev.length > 1 ? prev.filter(r => r.id !== id) : prev));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 750 * 1024) {
      window.dispatchEvent(new CustomEvent('sap-status', {
        detail: { text: "Error: File exceeds 750KB limit (Required for system sync)", isError: true }
      }));
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      setHeader(prev => ({
        ...prev,
        approvalFile: ev.target?.result as string,
        approvalFileName: file.name
      }));
      window.dispatchEvent(new CustomEvent('sap-status', {
        detail: { text: "Document ready for upload", isError: false }
      }));
    };
    reader.readAsDataURL(file);
  };

  const validateRows = useCallback(async () => {
    const newErrors: Record<string, string[]> = {};
    const seenCombos: Record<string, number> = {};
    const seenMaterialCodes: Record<string, number> = {};

    for (let idx = 0; idx < rows.length; idx++) {
      const row = rows[idx];
      const rowErrors: string[] = [];
      const code = row.materialCode.trim();
      const price = row.price.trim();
      const uom = row.uom.trim().toUpperCase();

      if (!code) {
        rowErrors.push("Material is mandatory");
      } else {
        const comboKey = `${normalize(code)}|${uom}|${price}`;
        const materialCodeKey = normalize(code);
        if (seenCombos[comboKey] !== undefined) {
          rowErrors.push(`Duplicate within document (duplicate of row ${seenCombos[comboKey]}): same Material Code, UOM and Basic Rate`);
        } else {
          seenCombos[comboKey] = idx + 1;
        }
        if (seenMaterialCodes[materialCodeKey] !== undefined) {
          rowErrors.push(`Duplicate Material Code within document (duplicate of row ${seenMaterialCodes[materialCodeKey]})`);
        } else {
          seenMaterialCodes[materialCodeKey] = idx + 1;
        }
      }

      if (price && isNaN(Number(price)) && price.trim().toUpperCase() !== 'FIX') {
        rowErrors.push("Basic Rate must be a number or 'FIX'");
      }

      if (rowErrors.length) newErrors[row.id] = rowErrors;
    }

    return newErrors;
  }, [rows]);

  const handleExecute = useCallback(async () => {
    if (header.plantIds.length === 0 || !header.inventoryType || !header.customerCode) {
      window.dispatchEvent(new CustomEvent('sap-status', {
        detail: { text: "Validation Error: At least one Plant, Inventory Type and Customer are mandatory", isError: true }
      }));
      return false;
    }

    if (!header.documentType || !header.documentCategory) {
      window.dispatchEvent(new CustomEvent('sap-status', {
        detail: { text: "Validation Error: Document Type and Charge Type are required from VOF03", isError: true }
      }));
      return false;
    }

    const validationErrors = await validateRows();
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
            conditionType: "PR00",
            keyCombination: "Customer/Material",
            plantId,
            customerCode: header.customerCode,
            materialCode: row.materialCode.trim(),
            materialName: row.materialName,
            hsnSac: row.hsnSac,
            uom: row.uom,
            status: row.status || "Active",
            documentType: header.documentType,
            documentCategory: header.documentCategory,
            inventoryType: header.inventoryType,
            price: row.price.trim().toUpperCase() === 'FIX' || !row.price.trim() ? 'FIX' : (Number(row.price) || 0),
            gstRate: row.gstRate !== "" ? Number(row.gstRate) : Number((materials?.find(m => (m.materialCode || "").toUpperCase() === row.materialCode.trim().toUpperCase() || (m.productName || "").toUpperCase() === row.materialCode.trim().toUpperCase()))?.gstRate) || 0,
            currency: "INR",
            validFrom: row.validFrom || header.validFrom,
            validTo: row.validTo || header.validTo,
            approvalFile: header.approvalFile,
            approvalFileName: header.approvalFileName,
            createdAt: serverTimestamp(),
          });
        }
      }

      await Promise.all(docs.map(docData => addDocumentNonBlocking(collection(db, "pricing"), docData)));

      window.dispatchEvent(new CustomEvent('sap-status', {
        detail: { text: `${docs.length} condition record(s) committed successfully across ${header.plantIds.length} plant(s)`, isError: false }
      }));
      setRows([newRow(header.validFrom, header.validTo)]);
      setErrors({});
      setHeader(prev => ({
        ...prev,
        approvalFile: "",
        approvalFileName: "",
      }));
      return true;
    } catch (error) {
      window.dispatchEvent(new CustomEvent('sap-status', {
        detail: { text: "System Error: Failed to reach backend repository", isError: true }
      }));
      return false;
    } finally {
      setLoading(false);
    }
  }, [header, rows, validateRows, db, materials]);

  useEffect(() => {
    const onExecute = () => {
      handleExecute();
    };

    const onCancel = () => {
      setHeader(currentHeader => {
        setRows([newRow(currentHeader.validFrom, currentHeader.validTo)]);
        return currentHeader;
      });
      setErrors({});
    };

    window.addEventListener("sap-execute", onExecute);
    window.addEventListener("sap-cancel", onCancel);

    return () => {
      window.removeEventListener("sap-execute", onExecute);
      window.removeEventListener("sap-cancel", onCancel);
    };
  }, [handleExecute]);

  const downloadTemplate = () => {
    const headers = [
      "Plant ID", "Document Type", "Charge Type", "Inventory Type",
      "Customer Code", "Material Code", "Material Name", "HSN/SAC Code", "Basic Rate", "GST Rate (%)", "Status",
      "Validity From Date", "Validity To Date"
    ];
    const csvContent = headers.join(",");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "VK11_Pricing_Template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const rowsFromCsv = text.split('\n').map(line => line.trim()).filter(line => line);
      const dataRows = rowsFromCsv.slice(1);

      const parsed: RateRow[] = dataRows.map(line => {
        const [plantId, docType, docCat, invType, customer, materialCode, materialName, hsnSac, rate, gst, status, validFrom, validTo] = line.split(',').map(v => v.trim());
        return {
          id: Math.random().toString(36).substr(2, 9),
          materialCode: materialCode || "",
          materialName: materialName || "",
          hsnSac: hsnSac || "",
          uom: "",
          gstRate: gst || "",
          status: status || "Active",
          price: rate || "",
          validFrom: validFrom || header.validFrom,
          validTo: validTo || header.validTo || "31-DEC-9999",
        };
      }).filter(r => r.materialCode || r.price);

      if (parsed.length) {
        const first = dataRows[0]?.split(',').map(v => v.trim()) || [];
        setHeader(prev => ({
          ...prev,
          plantIds: first[0] ? [first[0]] : prev.plantIds,
          documentType: prev.documentType || first[1] || "",
          documentCategory: prev.documentCategory || first[2] || "",
          inventoryType: prev.inventoryType || first[3] || "",
          customerCode: prev.customerCode || first[4] || "",
          validFrom: first[11] || prev.validFrom || getDefaultValidFrom(),
          validTo: first[12] || prev.validTo || "31-DEC-9999",
        }));
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
      if (bulkFileInputRef.current) bulkFileInputRef.current.value = "";
    };
    reader.readAsText(file);
  };

  const openPdfInNewTab = () => {
    if (pdfBlobUrl) window.open(pdfBlobUrl, '_blank');
  };

  const totalInvalidRows = Object.keys(errors).length;

  return (
    <div className="w-full flex flex-col bg-white min-h-full">
      <div className="bg-[#dae8f5] px-4 py-1 border-b border-gray-300">
        <div className="flex justify-between items-center">
          <h2 className="text-[13px] font-bold text-gray-800 uppercase italic tracking-wider">
            Create Condition Record (VK11)
          </h2>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={downloadTemplate} className="h-6 text-[11px] font-bold text-blue-700 hover:bg-blue-50 border border-blue-200 rounded-none gap-1">
              <FileSpreadsheet className="h-3 w-3" /> Download Template
            </Button>
            <Button variant="ghost" size="sm" onClick={() => bulkFileInputRef.current?.click()} className="h-6 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50 border border-emerald-200 rounded-none gap-1">
              <Upload className="h-3 w-3" /> Bulk Upload
            </Button>
            <input
              type="file"
              ref={bulkFileInputRef}
              onChange={handleBulkUpload}
              accept=".csv"
              className="hidden"
            />
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
          <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700">
            Selection & Organizational Data
          </div>
          <div className="p-2 grid grid-cols-2 gap-x-8 gap-y-1">
            <div className="sap-selection-row">
              <label className="sap-label">Plant ID(s) *</label>
              <div className="sap-input-wrapper max-w-[280px]">
                <PlantMultiSelect
                  plants={plants}
                  selected={header.plantIds}
                  onChange={(ids) => setHeader({ ...header, plantIds: ids, documentType: "", documentCategory: "", customerCode: "" })}
                  isLoading={!plants}
                  placeholder="Select Plant(s)..."
                />
              </div>
            </div>
            <div className="sap-selection-row">
              <label className="sap-label">Inventory Type *</label>
              <div className="sap-input-wrapper max-w-[200px]">
                <Select value={header.inventoryType} onValueChange={(val) => setHeader({ ...header, inventoryType: val, documentType: "", documentCategory: "" })} disabled={header.plantIds.length === 0}>
                  <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Service Invoice">Service Invoice</SelectItem>
                    <SelectItem value="Supply Invoice">Supply Invoice</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="sap-selection-row">
              <label className="sap-label">Doc. Type</label>
              <div className="sap-input-wrapper max-w-[200px]">
                <Select value={header.documentType} onValueChange={(val) => setHeader({ ...header, documentType: val })} disabled={header.plantIds.length === 0}>
                  <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]"><SelectValue placeholder="Select Document Type" /></SelectTrigger>
                  <SelectContent>
                    {dedupeIgnoreCase(filteredBillingTypes.map(b => b.documentType)).map(type => (
                      <SelectItem key={type} value={type}>{titleCase(type)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="sap-selection-row">
              <label className="sap-label">Charge Type</label>
              <div className="sap-input-wrapper max-w-[200px]">
                <Select value={header.documentCategory} onValueChange={(val) => setHeader({ ...header, documentCategory: val })} disabled={header.plantIds.length === 0}>
                  <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]"><SelectValue placeholder="Select Charge Type" /></SelectTrigger>
                  <SelectContent>
                    {dedupeIgnoreCase(filteredBillingTypes.map(b => b.documentCategory)).map(cat => (
                      <SelectItem key={cat} value={cat}>{titleCase(cat)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="sap-selection-row">
              <label className="sap-label">Customer *</label>
              <div className="sap-input-wrapper max-w-[200px]">
                <Select value={header.customerCode} onValueChange={(val) => setHeader({ ...header, customerCode: val })} disabled={header.plantIds.length === 0}>
                  <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]"><SelectValue placeholder="Select Customer" /></SelectTrigger>
                  <SelectContent>
                    {filteredCustomers?.map(c => <SelectItem key={c.id} value={c.customerId}>{c.customerId} - {c.name}</SelectItem>)}
                    {header.plantIds.length > 0 && (filteredCustomers?.length || 0) === 0 && (
                      <div className="px-2 py-3 text-center text-[10px] font-bold text-red-500">{NO_MASTER_RECORDS_MESSAGE}</div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="sap-selection-row">
              <label className="sap-label">Validity From</label>
              <div className="sap-input-wrapper max-w-[200px]">
                <SapDateInput
                  value={header.validFrom}
                  onChange={updateHeaderValidFrom}
                  placeholder="Valid From"
                />
              </div>
            </div>
            <div className="sap-selection-row">
              <label className="sap-label">Validity To</label>
              <div className="sap-input-wrapper max-w-[200px]">
                <SapDateInput
                  value={header.validTo}
                  onChange={updateHeaderValidTo}
                  placeholder="Valid To"
                />
              </div>
            </div>

          </div>
        </div>

        <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-white">
          <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] flex items-center justify-between">
            <span className="text-[12px] font-semibold text-gray-700">Material & Basic Price Condition</span>
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
                  <TableHead className="text-[11px] font-bold border-r w-56">Material Code <span className="text-red-500">*</span></TableHead>
                  <TableHead className="text-[11px] font-bold border-r w-20 text-center">UOM</TableHead>
                  <TableHead className="text-[11px] font-bold border-r">Material Name (auto)</TableHead>
                  <TableHead className="text-[11px] font-bold border-r w-20 text-center">HSN/SAC Code</TableHead>
                  <TableHead className="text-[11px] font-bold border-r w-28">GST Rate (%)</TableHead>
                  <TableHead className="text-[11px] font-bold border-r w-24 text-center">Status</TableHead>
                  <TableHead className="text-[11px] font-bold border-r w-28 text-right">Basic Rate / FIX</TableHead>
                  <TableHead className="text-[11px] font-bold border-r w-32">Validity From</TableHead>
                  <TableHead className="text-[11px] font-bold border-r w-32">Validity To</TableHead>
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
                        <Select value={row.materialCode} onValueChange={v => updateRow(row.id, "materialCode", v)} disabled={header.plantIds.length === 0 || !header.inventoryType}>
                          <SelectTrigger className={`h-7 border-none bg-transparent text-xs rounded-none px-2 shadow-none focus:bg-[#fff9c4] ${isInvalid ? "ring-1 ring-inset ring-red-400 bg-red-50" : ""}`}>
                            <SelectValue placeholder="" />
                          </SelectTrigger>
                          <SelectContent>{filteredMaterials.map(m => <SelectItem key={m.id} value={m.materialCode || m.productName}>{m.materialCode || m.productName}</SelectItem>)}</SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className={`p-0 border-r ${isInvalid ? "bg-red-50" : ""}`}>
                        <Input
                          className={`h-full border-none shadow-none rounded-none bg-gray-50 font-mono text-center text-xs ${isInvalid ? "ring-1 ring-inset ring-red-400 bg-red-50" : ""}`}
                          value={row.uom}
                          readOnly
                          placeholder="Auto"
                        />
                      </TableCell>
                      <TableCell className={`p-0 border-r ${isInvalid ? "bg-red-50" : ""}`}>
                        <Input
                          className={`h-full border-none shadow-none rounded-none bg-gray-50 font-medium focus:bg-[#fff9c4] ${isInvalid ? "ring-1 ring-inset ring-red-400 bg-red-50" : ""}`}
                          value={row.materialName}
                          readOnly
                          placeholder="Auto-filled from material"
                        />
                      </TableCell>
                      <TableCell className={`p-0 border-r ${isInvalid ? "bg-red-50" : ""}`}>
                        <Input
                          className={`h-full border-none shadow-none rounded-none bg-gray-50 font-mono text-center text-xs focus:bg-[#fff9c4] ${isInvalid ? "ring-1 ring-inset ring-red-400 bg-red-50" : ""}`}
                          value={row.hsnSac}
                          readOnly
                          placeholder="Auto"
                        />
                      </TableCell>
                      <TableCell className={`p-0 border-r ${isInvalid ? "bg-red-50" : ""}`}>
                        <Input
                          type="number"
                          className={`h-full border-none shadow-none rounded-none text-center font-bold text-gray-700 focus:bg-[#fff9c4] ${isInvalid ? "ring-1 ring-inset ring-red-400 bg-red-50" : ""}`}
                          value={row.gstRate}
                          onChange={e => updateRow(row.id, "gstRate", e.target.value)}
                          placeholder="0"
                        />
                      </TableCell>
                      <TableCell className={`p-0 border-r ${isInvalid ? "bg-red-50" : ""}`}>
                        <Select value={row.status || "Active"} onValueChange={v => updateRow(row.id, "status", v)}>
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
                        <Input
                          type="text"
                          className={`h-full border-none shadow-none rounded-none text-right font-bold text-emerald-700 focus:bg-[#fff9c4] ${isInvalid ? "ring-1 ring-inset ring-red-400 bg-red-50" : ""}`}
                          value={row.price}
                          onChange={e => updateRow(row.id, "price", e.target.value)}
                          placeholder="0.00 or FIX"
                        />
                      </TableCell>
                      <TableCell className={`p-0 border-r ${isInvalid ? "bg-red-50" : ""}`}>
                        <SapDateInput
                          className={`h-full border-r-0 focus-within:bg-[#fff9c4] ${isInvalid ? "ring-1 ring-inset ring-red-400 bg-red-50" : ""}`}
                          value={row.validFrom || ""}
                          onChange={v => updateRow(row.id, "validFrom", v)}
                          placeholder="From"
                        />
                      </TableCell>
                      <TableCell className={`p-0 border-r ${isInvalid ? "bg-red-50" : ""}`}>
                        <SapDateInput
                          className={`h-full border-r-0 focus-within:bg-[#fff9c4] ${isInvalid ? "ring-1 ring-inset ring-red-400 bg-red-50" : ""}`}
                          value={row.validTo || ""}
                          onChange={v => updateRow(row.id, "validTo", v)}
                          placeholder="To"
                        />
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

        <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
          <div className="bg-[#dae8f5] px-3 py-1 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700">
            Approval Attachment (Required for Verification)
          </div>
          <div className="p-4">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" className="h-8 rounded-none border-gray-400 bg-gray-50 hover:bg-white gap-2" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4" /> Select Approval (Max 750KB)
              </Button>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*,.pdf" onChange={handleFileUpload} />

              {header.approvalFile && (
                <div className="flex items-center gap-3 animate-in slide-in-from-left-2 duration-300">
                  <div className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded border border-emerald-100 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" /> {header.approvalFileName} ready
                  </div>
                  <Dialog>
                    <DialogTrigger asChild><Button variant="ghost" size="sm" className="h-8 rounded-none text-blue-700 hover:bg-blue-50 font-bold uppercase text-[10px] gap-1.5"><Eye className="h-3.5 w-3.5" /> Preview</Button></DialogTrigger>
                    <DialogContent className="max-w-4xl p-0 rounded-none border-gray-400 overflow-hidden">
                      <div className="bg-[#333e4f] text-white p-2 flex justify-between items-center">
                        <DialogTitle className="text-[11px] font-black uppercase tracking-widest pl-2 flex items-center gap-2"><FileText className="h-4 w-4 text-emerald-400" /> Approval Preview</DialogTitle>
                        <DialogTrigger asChild><button className="hover:bg-white/10 p-1"><X className="h-4 w-4" /></button></DialogTrigger>
                      </div>
                      <div className="p-10 bg-gray-100 min-h-[400px] flex items-center justify-center">
                        {pdfBlobUrl ? (
                          <div className="text-center space-y-4">
                            <FileText className="h-20 w-20 text-red-500 mx-auto opacity-40" />
                            <p className="text-xs font-bold text-gray-500">PDF Document Ready for Verification</p>
                            <Button onClick={openPdfInNewTab} className="bg-blue-700 hover:bg-blue-800 rounded-none h-10 px-8 font-bold uppercase gap-2"><ExternalLink className="h-4 w-4" /> Open in Secure Viewer</Button>
                          </div>
                        ) : (
                          <img src={header.approvalFile} alt="Approval" className="max-w-full max-h-[70vh] object-contain shadow-2xl border-4 border-white" />
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Button variant="ghost" size="icon" onClick={() => setHeader({ ...header, approvalFile: "", approvalFileName: "" })} className="h-8 w-8 text-red-500"><X className="h-4 w-4" /></Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {loading && <div className="fixed bottom-10 right-10 bg-[#333e4f] text-white px-4 py-2 text-xs border border-white/20 animate-pulse z-50">SYNCING REPOSITORY...</div>}
    </div>
  );
}