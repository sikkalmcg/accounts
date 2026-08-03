"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useDatabase, useCollection, useMemoDatabase, updateDocumentNonBlocking, addDocumentNonBlocking } from "@/database";
import { collection, query, orderBy, where, getDocs, serverTimestamp, doc } from "@/database/mongo";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Loader2, Upload, CheckCircle2, X, FileText, Save, Eye, Download, ExternalLink, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type RateRow = {
  id: string;
  docId?: string;
  materialCode: string;
  materialName: string;
  hsnSac: string;
  uom: string;
  price: string;
};

const newRow = (): RateRow => ({
  id: Math.random().toString(36).substr(2, 9),
  materialCode: "",
  materialName: "",
  hsnSac: "",
  uom: "",
  price: "",
});

const normalize = (v: string) => (v || "").trim().toUpperCase();

export default function VK12() {
  const db = useDatabase();
  const [selectedId, setSelectedId] = useState("");
  const [header, setHeader] = useState<any>(null);
  const [rows, setRows] = useState<RateRow[]>([]);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pdfBlobUrl = useMemo(() => {
    if (header?.approvalFile?.startsWith('data:application/pdf')) {
      try {
        const parts = header.approvalFile.split(',');
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
  }, [header?.approvalFile]);

  useEffect(() => {
    return () => {
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
    };
  }, [pdfBlobUrl]);

  const pricingQuery = useMemoDatabase(() => query(collection(db, "pricing"), orderBy("createdAt", "desc")), [db]);
  const { data: pricingRecords, isLoading: isPricingLoading } = useCollection(pricingQuery);

  const materialsQuery = useMemoDatabase(() => collection(db, "materials"), [db]);
  const { data: materials } = useCollection(materialsQuery);

  const handleSelect = (id: string) => {
    const record = pricingRecords?.find(r => r.id === id);
    if (!record) return;
    setSelectedId(id);
    setHeader({
      plantId: record.plantId || "",
      customerCode: record.customerCode || "",
      documentType: record.documentType || "",
      documentCategory: record.documentCategory || "",
      inventoryType: record.inventoryType || "",
      validFrom: record.validFrom || "",
      validTo: record.validTo || "9999-12-31",
      approvalFile: record.approvalFile || "",
      approvalFileName: record.approvalFileName || "",
    });
    setRows([{
      id: Math.random().toString(36).substr(2, 9),
      docId: record.id,
      materialCode: record.materialCode || "",
      materialName: record.materialName || "",
      hsnSac: record.hsnSac || "",
      uom: record.uom || "",
      price: record.price !== undefined ? String(record.price) : "",
    }]);
    setErrors({});
  };

  const updateRow = (id: string, field: keyof RateRow, value: string) => {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, [field]: value };
      if (field === "materialCode") {
        const mat = materials?.find(m =>
          (m.materialCode || "").toUpperCase() === value.toUpperCase() ||
          (m.productName || "").toUpperCase() === value.toUpperCase()
        );
        updated.materialName = mat?.productName || "";
        updated.hsnSac = mat?.hsnSac || "";
        updated.uom = mat?.uom || "";
      }
      return updated;
    }));
  };

  const addRow = () => {
    if (!header) return;
    setRows(prev => [...prev, newRow()]);
  };

  const deleteRow = (id: string) => {
    setRows(prev => (prev.length > 1 ? prev.filter(r => r.id !== id) : prev));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 750 * 1024) {
      window.dispatchEvent(new CustomEvent('sap-status', {
        detail: { text: "Error: Attachment exceeds 750KB maximum allowed size", isError: true }
      }));
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      setHeader((prev: any) => ({
        ...prev,
        approvalFile: ev.target?.result as string,
        approvalFileName: file.name
      }));
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Attachment replaced and ready to save", isError: false } }));
    };
    reader.readAsDataURL(file);
  };

  const validateRows = useCallback(async () => {
    if (!header) return {};
    const newErrors: Record<string, string[]> = {};
    const seenCodes: Record<string, number> = {};

    for (let idx = 0; idx < rows.length; idx++) {
      const row = rows[idx];
      const rowErrors: string[] = [];
      const code = row.materialCode.trim();
      const price = row.price.trim();

      if (!code) {
        rowErrors.push("Material is mandatory");
      } else {
        const normalized = normalize(code);
        if (seenCodes[normalized] !== undefined) {
          rowErrors.push(`Duplicate Material within document (duplicate of row ${seenCodes[normalized]})`);
        } else {
          seenCodes[normalized] = idx + 1;
        }
        try {
          const q = query(
            collection(db, "pricing"),
            where("customerCode", "==", header.customerCode),
            where("materialCode", "==", code),
            where("plantId", "==", header.plantId),
            where("inventoryType", "==", header.inventoryType),
            where("documentType", "==", header.documentType),
            where("documentCategory", "==", header.documentCategory)
          );
          const snap = await getDocs(q);
          const isSelf = row.docId && snap.docs.some(d => d.id === row.docId);
          if (!snap.empty && !isSelf) {
            rowErrors.push("Pricing record already exists for this combination");
          }
        } catch (e) {
          // Skip DB check on error
        }
      }

      if (!price) {
        rowErrors.push("Basic Rate (PMT) is mandatory");
      } else if (isNaN(Number(price))) {
        rowErrors.push("Basic Rate (PMT) must be numeric");
      } else if (Number(price) <= 0) {
        rowErrors.push("Basic Rate (PMT) must be greater than zero");
      }

      if (rowErrors.length) newErrors[row.id] = rowErrors;
    }

    return newErrors;
  }, [rows, header, db]);

  const handleExecute = useCallback(async () => {
    if (!header || !selectedId) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Error: Selection required for modification", isError: true } }));
      return;
    }

    const validationErrors = await validateRows();
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
          materialName: row.materialName,
          hsnSac: row.hsnSac,
          uom: row.uom,
          price: parseFloat(row.price),
          plantId: header.plantId,
          customerCode: header.customerCode,
          documentType: header.documentType,
          documentCategory: header.documentCategory,
          inventoryType: header.inventoryType,
          validFrom: header.validFrom,
          validTo: header.validTo,
          approvalFile: header.approvalFile,
          approvalFileName: header.approvalFileName,
          updatedAt: new Date().toISOString(),
        };
        if (row.docId) {
          updateDocumentNonBlocking(doc(db, "pricing", row.docId), payload);
        } else {
          addDocumentNonBlocking(collection(db, "pricing"), {
            ...payload,
            conditionType: "PR00",
            keyCombination: "Customer/Material",
            currency: "INR",
            gstRate: Number(materials?.find(m => (m.materialCode || "").toUpperCase() === row.materialCode.trim().toUpperCase() || (m.productName || "").toUpperCase() === row.materialCode.trim().toUpperCase())?.gstRate) || 0,
            createdAt: serverTimestamp(),
          });
        }
      }

      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: `${rows.length} condition record(s) updated`, isError: false } }));
    } catch (error) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Update failed: Authorization or connection error", isError: true } }));
    } finally {
      setLoading(false);
    }
  }, [header, selectedId, rows, validateRows, db, materials]);

  useEffect(() => {
    const onExecute = () => handleExecute();
    window.addEventListener('sap-execute', onExecute);
    return () => window.removeEventListener('sap-execute', onExecute);
  }, [handleExecute]);

  const openPdfInNewTab = () => {
    if (pdfBlobUrl) window.open(pdfBlobUrl, '_blank');
  };

  const totalInvalidRows = Object.keys(errors).length;

  return (
    <div className="w-full flex flex-col bg-white min-h-full">
      <div className="bg-[#dae8f5] px-4 py-1 border-b border-gray-300">
        <h2 className="text-[13px] font-bold text-gray-800 uppercase italic tracking-wider">
          Change Condition Record (VK12)
        </h2>
      </div>

      <div className="p-4 space-y-4">
        <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
          <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700">Record Selection</div>
          <div className="p-2">
            <div className="sap-selection-row">
              <label className="sap-label">Retrieve ID</label>
              <div className="sap-input-wrapper max-md">
                <Select onValueChange={handleSelect} value={selectedId}>
                  <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]">
                    <SelectValue placeholder="Select existing record..." />
                  </SelectTrigger>
                  <SelectContent>
                    {pricingRecords?.map(r => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.plantId} | {r.customerCode} | {r.materialCode} | {r.documentCategory || 'N/A'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isPricingLoading && <Loader2 className="h-4 w-4 animate-spin text-blue-600 ml-2" />}
              </div>
            </div>
          </div>
        </div>

        {header && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
              <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700">Condition Maintenance</div>
              <div className="p-2 grid grid-cols-2 gap-x-8 gap-y-1">
                <div className="sap-selection-row"><label className="sap-label">Plant</label><Input value={header.plantId} readOnly className="bg-gray-100 font-mono max-w-[200px]" /></div>
                <div className="sap-selection-row"><label className="sap-label">Customer</label><Input value={header.customerCode} readOnly className="bg-gray-100 font-mono max-w-[200px]" /></div>
                <div className="sap-selection-row"><label className="sap-label">Category</label><Input value={header.documentCategory || "GENERAL"} readOnly className="bg-gray-100 max-w-[200px]" /></div>
                <div className="sap-selection-row"><label className="sap-label">Inventory Type</label><Input value={header.inventoryType || "-"} readOnly className="bg-gray-100 max-w-[200px]" /></div>
                <div className="sap-selection-row"><label className="sap-label">Valid From/To</label>
                  <div className="sap-input-wrapper gap-2 max-w-md">
                    <Input type="date" value={header.validFrom} onChange={e => setHeader({ ...header, validFrom: e.target.value })} />
                    <span className="text-gray-400">to</span>
                    <Input type="date" value={header.validTo} onChange={e => setHeader({ ...header, validTo: e.target.value })} />
                  </div>
                </div>
              </div>
            </div>

            <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-white">
              <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] flex items-center justify-between">
                <span className="text-[12px] font-semibold text-gray-700">Material & Basic Rate (PMT)</span>
                <Button size="sm" variant="ghost" className="h-5 text-[10px] font-bold text-blue-700 hover:bg-blue-50 gap-1" onClick={addRow}>
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
                      <TableHead className="text-[11px] font-bold border-r">Material Name (auto)</TableHead>
                      <TableHead className="text-[11px] font-bold border-r w-28 text-right">Basic Rate (PMT) <span className="text-red-500">*</span></TableHead>
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
                            <Select value={row.materialCode} onValueChange={v => updateRow(row.id, "materialCode", v)}>
                              <SelectTrigger className={`h-7 border-none bg-transparent text-xs rounded-none px-2 shadow-none focus:bg-[#fff9c4] ${isInvalid ? "ring-1 ring-inset ring-red-400 bg-red-50" : ""}`}>
                                <SelectValue placeholder="" />
                              </SelectTrigger>
                              <SelectContent>{materials?.map(m => <SelectItem key={m.id} value={m.materialCode || m.productName}>{m.materialCode || m.productName}</SelectItem>)}</SelectContent>
                            </Select>
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
                              type="number"
                              className={`h-full border-none shadow-none rounded-none text-right font-bold text-emerald-700 focus:bg-[#fff9c4] ${isInvalid ? "ring-1 ring-inset ring-red-400 bg-red-50" : ""}`}
                              value={row.price}
                              onChange={e => updateRow(row.id, "price", e.target.value)}
                            />
                          </TableCell>
                          <TableCell className="p-0 text-center">
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:bg-red-50" onClick={() => deleteRow(row.id)} disabled={rows.length <= 1} title="Delete Row">
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

            <div className="sap-selection-row pt-4 items-center">
              <label className="sap-label font-bold text-blue-800">Maintain Attachment</label>
              <div className="sap-input-wrapper gap-3">
                <Button variant="outline" size="sm" className="h-8 rounded-none border-gray-400 bg-gray-50 hover:bg-white gap-2" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4" /> Replace Document
                </Button>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*,.pdf" onChange={handleFileUpload} />

                {header.approvalFile && (
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase bg-emerald-50 px-2 py-0.5 border border-emerald-100 rounded-sm">Verified: {header.approvalFileName || "DOC"}</span>
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
                            <img src={header.approvalFile} alt="Approval" className="max-w-full max-h-[70vh] object-contain shadow-2xl border-4 border-white" />
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => setHeader({ ...header, approvalFile: "", approvalFileName: "" })}><X className="h-4 w-4" /></Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      {loading && <div className="fixed bottom-10 right-10 bg-[#333e4f] text-white px-4 py-2 text-xs border border-white/20 animate-pulse z-50 shadow-2xl flex items-center gap-2 font-bold"><Save className="h-4 w-4" /> COMMITING CHANGES...</div>}
    </div>
  );
}

