"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useDatabase, addDocumentNonBlocking, useCollection, useMemoDatabase } from "@/database";
import { collection, serverTimestamp, query, where, getDocs, writeBatch, doc } from "@/database/mongo";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Trash2, SaveAll, AlertCircle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { SapCombobox } from "@/components/ui/sap-combobox";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import PlantMultiSelect from "./PlantMultiSelect";

type BillingRow = {
  id: string;
  documentType: string;
  chargeType: string;
};

const newBillingRow = (): BillingRow => ({
  id: Math.random().toString(36).substr(2, 9),
  documentType: "",
  chargeType: "",
});

export default function VOF01() {
  const db = useDatabase();
  const [plantIds, setPlantIds] = useState<string[]>([]);
  const [inventoryType, setInventoryType] = useState("");
  const [status, setStatus] = useState("Active");
  const [userName, setUserName] = useState("USER");
  const [rows, setRows] = useState<BillingRow[]>([newBillingRow()]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const stored = localStorage.getItem("sikka_user");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setUserName(parsed.name || parsed.username || "USER");
      } catch (e) { /* ignore */ }
    }
  }, []);

  const plantsQuery = useMemoDatabase(() => collection(db, "plants"), [db]);
  const { data: plants, isLoading: isPlantsLoading } = useCollection(plantsQuery);

  // Fetch existing billing types for duplicate checks
  const billingQuery = useMemoDatabase(() => collection(db, "billing_types"), [db]);
  const { data: billingTypes } = useCollection(billingQuery);

  const updateRow = (id: string, field: keyof BillingRow, value: string) => {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const addRow = () => setRows(prev => [...prev, newBillingRow()]);

  const deleteRow = (id: string) => {
    setRows(prev => (prev.length > 1 ? prev.filter(r => r.id !== id) : prev));
  };

  const validateRows = useCallback(() => {
    const newErrors: Record<string, string[]> = {};
    const seenCombos: Record<string, number> = {};

    rows.forEach((row, idx) => {
      const rowErrors: string[] = [];
      const dt = row.documentType.trim().toUpperCase();
      const ct = row.chargeType.trim().toUpperCase();

      if (!dt) rowErrors.push("Document Type is mandatory");
      if (!ct) rowErrors.push("Charge Type is mandatory");

      if (dt && ct) {
        const key = `${dt}|${ct}`;
        if (seenCombos[key] !== undefined) {
          rowErrors.push(`Duplicate combination (duplicate of row ${seenCombos[key]})`);
        } else {
          seenCombos[key] = idx + 1;
        }
      }

      if (rowErrors.length) newErrors[row.id] = rowErrors;
    });

    return newErrors;
  }, [rows]);

  const handleSaveAll = useCallback(async () => {
    if (plantIds.length === 0 || !inventoryType) {
      window.dispatchEvent(new CustomEvent('sap-status', {
        detail: { text: "Error: At least one Plant and Inventory Type are mandatory", isError: true }
      }));
      return;
    }

    const validationErrors = validateRows();
    setErrors(validationErrors);

    const invalidCount = Object.keys(validationErrors).length;
    if (invalidCount > 0) {
      window.dispatchEvent(new CustomEvent('sap-status', {
        detail: { text: `Validation Error: ${invalidCount} row(s) contain errors. Please correct highlighted rows.`, isError: true }
      }));
      return;
    }

    setLoading(true);
    try {
      const billingTypesCollection = collection(db, "billing_types");
      let successCount = 0;

      for (const plantId of plantIds) {
        const batch = writeBatch(db);

        for (const row of rows) {
          const dt = row.documentType.trim().toUpperCase();
          const ct = row.chargeType.trim().toUpperCase();

// Check for existing duplicate
          const q = query(
            billingTypesCollection,
            where("plantId", "==", plantId),
            where("inventoryType", "==", inventoryType),
            where("documentType", "==", dt),
            where("documentCategory", "==", ct)
          );
          const snap = await getDocs(q);
          if (!snap.empty) {
            window.dispatchEvent(new CustomEvent('sap-status', {
              detail: { text: `Skip: '${dt}/${ct}' already exists for Plant ${plantId} & Inventory Type ${inventoryType}`, isError: true }
            }));
            continue;
          }

          const newRecordRef = doc(billingTypesCollection);
          batch.set(newRecordRef, {
            plantId,
            inventoryType,
            documentType: dt,
            documentCategory: ct,
            status,
            createdBy: userName,
            createdAt: serverTimestamp(),
          });
          successCount++;
        }

        await batch.commit();
      }

      window.dispatchEvent(new CustomEvent('sap-status', {
        detail: { text: `Billing types saved: ${successCount} record(s) created across ${plantIds.length} plant(s)`, isError: false }
      }));
      setRows([newBillingRow()]);
      setErrors({});
    } catch (error) {
      window.dispatchEvent(new CustomEvent('sap-status', {
        detail: { text: "System Error: Transaction failed", isError: true }
      }));
    } finally {
      setLoading(false);
    }
}, [plantIds, inventoryType, status, userName, rows, validateRows, db]);

  useEffect(() => {
    const onExecute = () => handleSaveAll();
    const onCancel = () => {
      setRows([newBillingRow()]);
      setErrors({});
    };
    window.addEventListener('sap-execute', onExecute);
    window.addEventListener('sap-cancel', onCancel);
    return () => {
      window.removeEventListener('sap-execute', onExecute);
      window.removeEventListener('sap-cancel', onCancel);
    };
  }, [handleSaveAll]);

  const totalInvalidRows = Object.keys(errors).length;

  return (
    <div className="w-full flex flex-col bg-white min-h-full">
      <div className="bg-[#dae8f5] px-4 py-1 border-b border-gray-300">
        <h2 className="text-[13px] font-bold text-gray-800 uppercase italic tracking-wider">
          Define Billing Types
        </h2>
      </div>

      <div className="p-4 space-y-4">
        <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
          <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700">
            Billing Definition
          </div>

          <div className="p-2 space-y-1">
            <div className="sap-selection-row items-start">
              <label className="sap-label mt-1">Plant ID(s) <span className="text-red-500">*</span></label>
              <div className="sap-input-wrapper max-w-[280px]">
                <PlantMultiSelect
                  plants={plants}
                  selected={plantIds}
                  onChange={setPlantIds}
                  isLoading={isPlantsLoading}
                  placeholder="Select Plant(s)..."
                />
              </div>
            </div>

            <div className="sap-selection-row">
              <label className="sap-label">Inventory Type <span className="text-red-500">*</span></label>
              <div className="sap-input-wrapper max-w-[200px]">
<Select value={inventoryType} onValueChange={(val) => setInventoryType(val)}>
                  <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Service Invoice">Service Invoice</SelectItem>
                    <SelectItem value="Supply Invoice">Supply Invoice</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="sap-selection-row">
              <label className="sap-label">Status</label>
              <div className="sap-input-wrapper max-w-[160px]">
                <Select value={status} onValueChange={(val) => setStatus(val)}>
                  <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-white">
          <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] flex items-center justify-between">
            <span className="text-[12px] font-semibold text-gray-700">Document Type & Charge Type</span>
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
                  <TableHead className="text-[11px] font-bold border-r">Document Type <span className="text-red-500">*</span></TableHead>
                  <TableHead className="text-[11px] font-bold border-r">Charge Type <span className="text-red-500">*</span></TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, idx) => {
                  const rowErrors = errors[row.id] || [];
                  const isInvalid = rowErrors.length > 0;
                  return (
                    <TableRow key={row.id} className={`h-8 hover:bg-blue-50/30 border-b border-gray-100 ${isInvalid ? "bg-red-50" : ""}`}>
                      <TableCell className={`p-0 text-center text-[10px] border-r ${isInvalid ? "text-red-500 font-black" : "text-gray-400"}`}>
                        {idx + 1}
                      </TableCell>
                      <TableCell className={`p-0 border-r ${isInvalid ? "bg-red-50" : ""}`}>
                        <SapCombobox
                          options={[
                            "Tax Invoice",
                            "Non-Tax Invoice",
                            "Credit Note",
                            "Debit Note",
                            "Delivery Challan",
                          ]}
                          value={row.documentType}
                          onChange={(v) => updateRow(row.id, "documentType", v)}
                          placeholder="Select or type Document Type"
                          className={isInvalid ? "ring-1 ring-inset ring-red-400" : ""}
                          inputClassName={isInvalid ? "bg-red-50" : ""}
                        />
                      </TableCell>
                      <TableCell className={`p-0 border-r ${isInvalid ? "bg-red-50" : ""}`}>
                        <Input
                          className={`h-full border-none shadow-none rounded-none focus:bg-[#fff9c4] ${isInvalid ? "ring-1 ring-inset ring-red-400 bg-red-50" : ""}`}
                          value={row.chargeType}
                          onChange={(e) => updateRow(row.id, "chargeType", e.target.value.toUpperCase())}
                          placeholder="Enter Charge Type (e.g. FREIGHT)"
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

        <div className="flex justify-end gap-3">
          <Button
            onClick={handleSaveAll}
            disabled={loading || plantIds.length === 0}
            className="h-8 rounded-none bg-emerald-700 hover:bg-emerald-800 text-white gap-2 text-[11px] font-bold px-6 shadow-sm"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SaveAll className="h-4 w-4" />} Save All
          </Button>
        </div>
      </div>

      {loading && (
        <div className="fixed bottom-10 right-10 bg-[#333e4f] text-white px-4 py-2 text-xs border border-white/20">
          PROCESSING...
        </div>
      )}
    </div>
  );
}
