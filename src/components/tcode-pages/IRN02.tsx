"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useDatabase, useCollection, useMemoDatabase, updateDocumentNonBlocking } from "@/database";
import { collection, query, where, getDocs, doc } from "@/database/mongo";
import { Search, Loader2, QrCode, FileEdit, Trash2, AlertTriangle, Lock, Save, RotateCcw, ArrowLeft, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Image from "next/image";
import { toSAPDate, toInputDate } from "@/lib/date-utils";
import { SapDateInput } from "@/components/ui/sap-date-input";
import { cn } from "@/lib/utils";
import { validateDuplicateWithExclusion } from "@/lib/duplicate-validator";
import { matchesDateRange, IRNResultGrid } from "./IRNShared";
import { getRecordPlantIds } from "@/lib/plant-master";
import { formatAmount } from "@/lib/number-utils";
import PlantMultiSelect from "./PlantMultiSelect";

export default function IRN02() {
  const db = useDatabase();

  // 1. User Context
  const [isAdmin, setIsAdmin] = useState(false);
  const [assignedPlantId, setAssignedPlantId] = useState("");
  const [userName, setUserName] = useState("USER");

  // 2. Filter State
  const [filterPlants, setFilterPlants] = useState<string[]>([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [isExecuted, setIsExecuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Top global search bar (digits & text) across the results grid
  const [globalSearch, setGlobalSearch] = useState("");

  // 3. Result Data
  const [results, setResults] = useState<any[]>([]);

  // 4. Edit Mode State
  const [editingInvoice, setEditingInvoice] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [irnData, setIrnData] = useState({
    irnNumber: "",
    ackNo: "",
    ackDate: "",
    qrData: "",
  });

  // 5. Master Data
  const plantsQuery = useMemoDatabase(() => collection(db, "plants"), [db]);
  const { data: plants } = useCollection(plantsQuery);
  const customersQuery = useMemoDatabase(() => collection(db, "customers"), [db]);
  const { data: customers } = useCollection(customersQuery);
  const firmsQuery = useMemoDatabase(() => collection(db, "firms"), [db]);
  const { data: firms } = useCollection(firmsQuery);

  const customerMap = useMemo(() => {
    const map: Record<string, any> = {};
    customers?.forEach((c) => {
      map[c.customerId] = c;
    });
    return map;
  }, [customers]);

  useEffect(() => {
    const stored = localStorage.getItem("sikka_user");
    if (stored) {
      const parsed = JSON.parse(stored);
      const sysAdmin = parsed.username === "ajaysomra" || parsed.role === "admin";
      setIsAdmin(sysAdmin);
      setUserName(parsed.name || parsed.username || "USER");
      const assignedIds =
        parsed.assignedPlantIds ||
        (parsed.assignedPlantId ? [parsed.assignedPlantId] : []);
      setAssignedPlantId(parsed.assignedPlantId || "");
      if (!sysAdmin && assignedIds.length > 0) setFilterPlants([...assignedIds]);
    }
  }, []);

  const isLockedByTime = useMemo(() => {
    if (!editingInvoice?.irnUpdatedAt) return false;
    if (isAdmin) return false;
    const genTime = new Date(editingInvoice.irnUpdatedAt).getTime();
    const now = new Date().getTime();
    const diffHours = (now - genTime) / (1000 * 60 * 60);
    return diffHours > 24;
  }, [editingInvoice, isAdmin]);

  const filteredPlants = useMemo(() => {
    if (isAdmin) return plants || [];
    return plants?.filter((p) => p.plantId === assignedPlantId) || [];
  }, [plants, isAdmin, assignedPlantId]);

// 6. Execute / Search Handler
  const handleExecute = useCallback(async () => {
    if (filterPlants.length === 0) {
      window.dispatchEvent(new CustomEvent("sap-status", { detail: { text: "Error: At least one Plant is mandatory", isError: true } }));
      return;
    }

    setIsLoading(true);
    setIsExecuted(true);
    try {
      const q =
        filterPlants.length === 1
          ? query(collection(db, "sales_invoices"), where("plantId", "==", filterPlants[0]))
          : query(collection(db, "sales_invoices"), where("plantId", "in", filterPlants));
      const snap = await getDocs(q);
      const data = snap.docs
        .map((d) => ({ ...d.data(), id: d.id }))
        .filter((inv: any) => inv.irnNumber && inv.irnNumber.trim() !== "")
        .filter((inv: any) => matchesDateRange(inv.invoiceDate, fromDate, toDate))
        .sort((a: any, b: any) => {
          const at = new Date(a.invoiceDate || 0).getTime();
          const bt = new Date(b.invoiceDate || 0).getTime();
          return bt - at; // Newest first
        });
      setResults(data);
      window.dispatchEvent(
        new CustomEvent("sap-status", { detail: { text: `IRN records found: ${data.length}`, isError: false } })
      );
    } catch (e) {
      window.dispatchEvent(new CustomEvent("sap-status", { detail: { text: "System Error: IRN search failed", isError: true } }));
    } finally {
      setIsLoading(false);
    }
  }, [db, filterPlants, fromDate, toDate]);

  // 7. Modify Entry
  const openEdit = (inv: any) => {
    setEditingInvoice(inv);
    setIrnData({
      irnNumber: inv.irnNumber || "",
      ackNo: inv.ackNo || "",
      ackDate: toInputDate(inv.ackDate) || new Date().toISOString().split("T")[0],
      qrData: inv.qrData || "",
    });
  };

  const cancelEdit = () => {
    setEditingInvoice(null);
    setIrnData({ irnNumber: "", ackNo: "", ackDate: "", qrData: "" });
  };

// 8. Save Modified IRN
const handleSave = useCallback(async () => {
    if (!editingInvoice || isLockedByTime) return;

    // Mandatory fields: IRN Number, ACK Number, ACK Date, QR Code
    const missing: string[] = [];
    if (!irnData.irnNumber?.trim()) missing.push("IRN Number");
    if (!irnData.ackNo?.trim()) missing.push("ACK Number");
    if (!irnData.ackDate?.trim()) missing.push("ACK Date");
    if (!irnData.qrData?.trim()) missing.push("QR Code");
    if (missing.length > 0) {
      window.dispatchEvent(new CustomEvent("sap-status", {
        detail: { text: `Validation Error: Missing mandatory field(s): ${missing.join(", ")}`, isError: true },
      }));
      return;
    }

    setIsSaving(true);
    try {
      // Duplicate validation across all plants, excluding the current record
      const irnError = await validateDuplicateWithExclusion(db, "sales_invoices", "irnNumber", irnData.irnNumber, editingInvoice.id);
      if (irnError) {
        window.dispatchEvent(new CustomEvent("sap-status", { detail: { text: irnError, isError: true } }));
        setIsSaving(false);
        return;
      }
      const ackError = await validateDuplicateWithExclusion(db, "sales_invoices", "ackNo", irnData.ackNo, editingInvoice.id);
      if (ackError) {
        window.dispatchEvent(new CustomEvent("sap-status", { detail: { text: ackError, isError: true } }));
        setIsSaving(false);
        return;
      }

      // Sync Invoice Date with ACK Date as per requirement (IRN Date and Invoice Date always identical)
      const syncedDate = toSAPDate(irnData.ackDate);

      updateDocumentNonBlocking(doc(db, "sales_invoices", editingInvoice.id), {
        irnNumber: irnData.irnNumber.trim().toUpperCase(),
        ackNo: irnData.ackNo.trim().toUpperCase(),
        ackDate: syncedDate,
        invoiceDate: syncedDate, // Ensure Invoice Date is updated to match ACK Date
        qrData: irnData.qrData,
        irnStatus: "Modified",
        irnUpdatedAt: new Date().toISOString(),
        irnModifiedBy: userName,
      });

      // Refresh grid row
      setResults((prev) =>
        prev.map((inv) =>
          inv.id === editingInvoice.id
            ? {
                ...inv,
                irnNumber: irnData.irnNumber.trim().toUpperCase(),
                ackNo: irnData.ackNo.trim().toUpperCase(),
                ackDate: syncedDate,
                invoiceDate: syncedDate, // Ensure Invoice Date is updated to match ACK Date
                qrData: irnData.qrData,
                irnStatus: "Modified",
                irnUpdatedAt: new Date().toISOString(),
                irnModifiedBy: userName,
              }
            : inv
        )
      );

      window.dispatchEvent(
        new CustomEvent("sap-status", {
          detail: { text: `IRN for invoice ${editingInvoice.invoiceNumber} updated successfully`, isError: false },
        })
      );
      setEditingInvoice(null);
    } catch (e) {
      window.dispatchEvent(new CustomEvent("sap-status", { detail: { text: "System Error: IRN modification failed", isError: true } }));
    } finally {
      setIsSaving(false);
    }
  }, [db, editingInvoice, irnData, isLockedByTime, userName]);

  useEffect(() => {
    const onExec = () => {
      if (editingInvoice) {
        handleSave();
      } else {
        handleExecute();
      }
    };
    window.addEventListener("sap-execute", onExec);
    return () => window.removeEventListener("sap-execute", onExec);
  }, [editingInvoice, handleSave, handleExecute]);

// 9. Reset Filters
  const handleReset = useCallback(() => {
    setFilterPlants([]);
    setToDate("");
    setFromDate("");
    setGlobalSearch("");
    setIsExecuted(false);
    setResults([]);
    cancelEdit();
  }, []);

useEffect(() => {
    const onCancel = () => handleReset();
    window.addEventListener("sap-cancel", onCancel);
    return () => window.removeEventListener("sap-cancel", onCancel);
  }, [handleReset]);

  // Global search across all grid fields (digits & text)
  const searchedResults = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    if (!q) return results;
    return results.filter((inv: any) => {
      const firm = inv.snapshotFirm || firms?.find((f) => getRecordPlantIds(f).includes(inv.plantId)) || {};
      const billToCust = inv.snapshotBillTo || customerMap[inv.billTo] || {};
      const haystack = [
        inv.plantId,
        inv.invoiceNumber,
        inv.invoiceDate,
        inv.irnNumber,
        inv.ackNo,
        inv.ackDate,
        inv.docType,
        inv.inventoryType,
        inv.docCategory,
        inv.irnGeneratedBy,
        inv.irnModifiedBy,
        inv.consignorName,
        firm?.name,
        firm?.gstin,
        firm?.stateName,
        firm?.state,
        billToCust?.name,
        billToCust?.gstin,
        billToCust?.stateName,
        inv.totals?.taxableAmount,
        inv.totals?.cgst,
        inv.totals?.sgst,
        inv.totals?.igst,
        inv.totals?.grossAmount,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [results, globalSearch, firms, customerMap]);

  // 10. Render Edit Mode
  if (editingInvoice) {
    const consignee = customerMap[editingInvoice.billTo];
const firm = firms?.find((f) => getRecordPlantIds(f).includes(editingInvoice.plantId)) || editingInvoice.snapshotFirm;
    const totals = editingInvoice.totals || {};

    return (
      <div className="w-full flex flex-col bg-white min-h-full select-text">
        <div className="bg-[#dae8f5] px-4 py-1 border-b border-gray-300 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={cancelEdit} className="p-1 hover:bg-black/5 rounded text-blue-800">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h2 className="text-[13px] font-bold text-gray-800 uppercase italic tracking-wider">
              IRN02 - Edit IRN: Invoice {editingInvoice.invoiceNumber}
            </h2>
          </div>
        </div>
        <div className="p-4 space-y-4">
          {isLockedByTime && (
            <Alert variant="destructive" className="rounded-none border-red-200 bg-red-50 py-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle className="text-xs font-black uppercase">Modification Restriction</AlertTitle>
              <AlertDescription className="text-[11px] font-bold">
                IRN cannot be modified after 24 hours from generation time. Current record is locked.
              </AlertDescription>
            </Alert>
          )}

          <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
            <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[11px] font-semibold text-gray-700 flex items-center gap-2">
              <FileText className="h-3.5 w-3.5" /> Invoice Information (Read-Only)
            </div>
            <div className="p-3 grid grid-cols-5 gap-x-6 gap-y-3 text-[11px]">
              <div>
                <label className="text-gray-500 block uppercase font-bold text-[9px]">Invoice No</label>
                <span className="font-bold text-blue-700">{editingInvoice.invoiceNumber}</span>
              </div>
              <div>
                <label className="text-gray-500 block uppercase font-bold text-[9px]">Invoice Date</label>
                <span className="font-bold">{editingInvoice.invoiceDate}</span>
              </div>
              <div>
                <label className="text-gray-500 block uppercase font-bold text-[9px]">Plant</label>
                <span className="font-bold">{editingInvoice.plantId}</span>
              </div>
              <div>
                <label className="text-gray-500 block uppercase font-bold text-[9px]">Bill to Party</label>
                <span className="font-bold truncate">{consignee?.name || editingInvoice.snapshotBillTo?.name || editingInvoice.billTo}</span>
              </div>
              <div>
                <label className="text-gray-500 block uppercase font-bold text-[9px]">Consignor</label>
                <span className="font-bold truncate">{firm?.name || editingInvoice.consignorName || "N/A"}</span>
              </div>
              <div>
                <label className="text-gray-500 block uppercase font-bold text-[9px]">Document Type</label>
                <span className="font-bold uppercase">{editingInvoice.docType || "N/A"}</span>
              </div>
              <div>
                <label className="text-gray-500 block uppercase font-bold text-[9px]">Invoice Type</label>
                <span className="font-bold uppercase">{editingInvoice.inventoryType || "N/A"}</span>
              </div>
              <div>
                <label className="text-gray-500 block uppercase font-bold text-[9px]">Charge Type</label>
                <span className="font-bold uppercase">{editingInvoice.docCategory || "N/A"}</span>
              </div>
              <div>
                <label className="text-gray-500 block uppercase font-bold text-[9px]">Taxable Amount</label>
                <span className="font-bold">₹ {formatAmount(totals.taxableAmount)}</span>
              </div>
              <div className="bg-emerald-700 p-1.5 rounded-sm text-white flex justify-between items-center">
                <span className="uppercase font-bold text-[9px]">Gross Payable</span>
                <span className="font-black text-[12px]">₹ {formatAmount(totals.grossAmount)}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2 border border-[#b5c7de] rounded-sm overflow-hidden bg-white">
              <div className="bg-[#dae8f5] px-3 py-1 border-b border-[#b5c7de] text-[12px] font-bold text-blue-900 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <QrCode className="h-4 w-4" /> Maintain IRN Details
                </div>
                {isLockedByTime && (
                  <span className="text-[10px] text-red-600 font-black uppercase flex items-center gap-1">
                    <Lock className="h-3 w-3" /> System Locked
                  </span>
                )}
              </div>
              <div className="p-4 space-y-4">
                <div className="sap-selection-row">
                  <label className="sap-label w-40">IRN Number</label>
                  <Input
                    value={irnData.irnNumber}
                    onChange={(e) => setIrnData({ ...irnData, irnNumber: e.target.value })}
                    disabled={isLockedByTime}
                    className={cn("font-mono text-[11px] tracking-widest uppercase", isLockedByTime && "bg-gray-50")}
                  />
                </div>
                <div className="sap-selection-row">
                  <label className="sap-label w-40">ACK Number</label>
                  <Input
                    value={irnData.ackNo}
                    onChange={(e) => setIrnData({ ...irnData, ackNo: e.target.value })}
                    disabled={isLockedByTime}
                    className={cn("font-mono w-64", isLockedByTime && "bg-gray-50")}
                  />
                </div>
                <div className="sap-selection-row">
                  <label className="sap-label w-40">ACK Date</label>
                  <SapDateInput
                    value={irnData.ackDate}
                    onChange={(val) => setIrnData({ ...irnData, ackDate: val })}
                    disabled={isLockedByTime}
                    className={cn("w-48", isLockedByTime && "bg-gray-50")}
                  />
                </div>
              </div>
            </div>
            <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-white">
              <div className="bg-[#dae8f5] px-3 py-1 border-b border-[#b5c7de] text-[12px] font-bold text-gray-700">QR Image Control</div>
              <div
                onPaste={(e) => {
                  if (isLockedByTime) return;
                  const items = e.clipboardData.items;
                  for (const item of Array.from(items)) {
                    if (item.type.indexOf("image") !== -1) {
                      const reader = new FileReader();
                      reader.onload = (ev) => setIrnData((prev) => ({ ...prev, qrData: ev.target?.result as string }));
                      reader.readAsDataURL(item.getAsFile()!);
                    }
                  }
                }}
                className={cn(
                  "h-48 m-4 border-2 border-dashed border-gray-300 flex flex-col items-center justify-center relative group",
                  isLockedByTime ? "bg-gray-100 cursor-not-allowed" : "bg-gray-50"
                )}
              >
                {irnData.qrData ? (
                  <>
                    <Image src={irnData.qrData} alt="QR" fill className="object-contain p-2" />
                    {!isLockedByTime && (
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Button
                          onClick={() => setIrnData({ ...irnData, qrData: "" })}
                          size="sm"
                          variant="destructive"
                          className="h-7 rounded-none gap-2"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Remove QR
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-gray-400 text-center">
                    <QrCode className="h-10 w-10 mx-auto opacity-20" />
                    <p className="text-[10px] uppercase font-bold">{isLockedByTime ? "Record Locked" : "Ctrl+V to update QR"}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="mt-auto border-t bg-[#e1e1e1] p-3 flex justify-end gap-3 shadow-inner">
          <Button onClick={cancelEdit} variant="outline" className="rounded-none h-8 uppercase text-xs font-bold">
            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || isLockedByTime}
            className="rounded-none bg-emerald-700 hover:bg-emerald-800 text-white h-8 gap-2 uppercase text-xs font-bold"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Modification
          </Button>
        </div>
      </div>
    );
  }

  // 11. Render Filter + Grid
  return (
    <div className="w-full flex flex-col bg-white min-h-full select-text">
      <div className="sap-header-title">IRN02 - Change E-Invoicing Data</div>

      {/* Top Search Bar — searches across all digits & text in the results grid */}
      <div className="bg-[#e7ebf1] border-b border-[#b5c7de] px-4 py-1 flex items-center justify-between gap-4">
        <div className="relative flex items-center bg-white border border-gray-400 h-6 w-[420px] px-1 group focus-within:border-blue-500">
          <Search className="h-3.5 w-3.5 text-gray-400 mr-1 shrink-0" />
          <input
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            className="w-full h-full text-xs outline-none"
            placeholder="Search across all records (invoice no, plant, IRN, ACK, customer, firm, amounts)..."
          />
          {globalSearch && (
            <button
              onClick={() => setGlobalSearch("")}
              className="text-gray-400 hover:text-red-600 ml-1 shrink-0"
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>
        <div className="text-[11px] font-bold text-blue-700 uppercase tracking-tighter">
          {isExecuted ? (globalSearch ? `Filtered: ${searchedResults.length} of ${results.length}` : `Records: ${results.length}`) : "Enter criteria & execute"}
        </div>
      </div>

      <div className="sap-selection-area">
        <div className="max-w-5xl mx-auto grid grid-cols-3 gap-x-10 gap-y-6">
<div className="sap-selection-row">
            <label className="sap-label">Plant(s) *</label>
            <div className="sap-input-wrapper max-w-[280px]">
              <PlantMultiSelect
                plants={filteredPlants}
                selected={filterPlants}
                onChange={setFilterPlants}
                placeholder="Select Plant(s)"
                disabled={!isAdmin}
              />
            </div>
          </div>
          <div className="sap-selection-row">
            <label className="sap-label">From Date</label>
            <div className="sap-input-wrapper max-w-[280px]">
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
          </div>
          <div className="sap-selection-row">
            <label className="sap-label">To Date</label>
            <div className="sap-input-wrapper max-w-[280px]">
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="max-w-5xl mx-auto flex gap-3 mt-2">
          <Button
            onClick={handleExecute}
            disabled={isLoading}
            className="h-7 rounded-none bg-blue-700 hover:bg-blue-800 text-[11px] font-bold uppercase gap-1.5 shadow-sm"
          >
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileEdit className="h-3.5 w-3.5" />} Execute (F8)
          </Button>
          <Button
            onClick={handleReset}
            variant="outline"
            className="h-7 rounded-none bg-white border-gray-400 text-gray-700 text-[11px] font-bold uppercase gap-1.5 shadow-sm hover:bg-gray-100"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto no-scrollbar relative bg-[#f8f9fa]">
        {!isExecuted ? (
          <div className="flex flex-col items-center justify-center py-40 text-gray-400 opacity-40 select-none">
            <Search className="h-20 w-20 stroke-1 mb-4" />
            <p className="text-sm font-black uppercase tracking-[0.3em]">Enter plant and date criteria, then execute (F8)</p>
          </div>
        ) : (
          <IRNResultGrid
            invoices={searchedResults}
            firms={firms}
            customerMap={customerMap}
            isLoading={isLoading}
            renderAction={(inv) => (
              <Button
                onClick={() => openEdit(inv)}
                variant="ghost"
                size="sm"
                className="h-6 w-full text-[9px] font-black uppercase text-emerald-700 hover:bg-emerald-100 rounded-none border border-emerald-200"
              >
                Modify
              </Button>
            )}
          />
        )}
      </div>

      <div className="bg-[#333e4f] p-1 px-4 flex justify-between items-center text-white text-[10px] font-bold uppercase shadow-inner shadow-black/40">
        <div className="flex gap-10 items-center">
          <span>IRN02 - Change E-Invoicing Data</span>
          <span className="opacity-50">|</span>
          <span>Records: {results.length}</span>
          <span className="opacity-50">|</span>
<span>Plants: {filterPlants.length > 0 ? filterPlants.join(", ") : "NONE"}</span>
        </div>
      </div>
    </div>
  );
}

