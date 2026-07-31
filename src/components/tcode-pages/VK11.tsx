"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useDatabase, addDocumentNonBlocking, useCollection, useMemoDatabase } from "@/database";
import { collection, serverTimestamp, query, where, getDocs } from "@/database/mongo";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Upload, CheckCircle2, FileText, Eye, X, Download, ExternalLink, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import Image from "next/image";

const initialData = {
  conditionType: "PR00",
  keyCombination: "Customer/Material",
  plantId: "",
  customerCode: "",
  materialCode: "",
  documentType: "",
  documentCategory: "",
  inventoryType: "",
  price: "",
  gstRate: "",
  currency: "INR",
  validFrom: "",
  validTo: "9999-12-31",
  approvalFile: "",
  approvalFileName: "",
};

export default function VK11() {
  const db = useDatabase();
  const [formData, setFormData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);

  const pdfBlobUrl = useMemo(() => {
    if (formData.approvalFile?.startsWith('data:application/pdf')) {
      try {
        const parts = formData.approvalFile.split(',');
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
  }, [formData.approvalFile]);

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

  // First assigned plant used for UI data filtering

  useEffect(() => {
    setFormData(prev => ({ ...prev, validFrom: new Date().toISOString().split('T')[0] }));
  }, []);

  const filteredBillingTypes = useMemo(() => {
    if (!billingTypes || !formData.plantId) return [];
    return billingTypes.filter(bt => bt.plantId === formData.plantId);
  }, [billingTypes, formData.plantId]);

  const filteredMaterials = useMemo(() => {
    const primaryPlantId = formData.plantId;
    return (materials ?? []).filter(m => 
      m.plantId === primaryPlantId && 
      m.documentCategory === formData.documentCategory
    );
  }, [materials, formData.plantId, formData.documentCategory]);

  const filteredCustomers = useMemo(() => {
    if (!customers || !formData.plantId) return [];
    return customers.filter(c => c.assignedPlantIds?.includes(formData.plantId) || c.plantId === formData.plantId);
  }, [customers, formData.plantId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // MongoDB document size limit is 1MB per document. Base64 adds ~33% overhead.
    // 750KB is a safe limit for the raw file.
    if (file.size > 750 * 1024) {
      window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: "Error: File exceeds 750KB limit (Required for system sync)", isError: true } 
      }));
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      setFormData(prev => ({ 
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

  const handleExecute = useCallback(async (dataToSave: any = formData) => {
    const payload = dataToSave;
    if (!payload.plantId || !payload.customerCode || !payload.materialCode || !payload.inventoryType || !payload.price || !payload.gstRate || !payload.validFrom) {
      window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: "Error: Required fields missing in Condition Data", isError: true } 
      }));
      return false;
    }

    setLoading(true);
    try {
      const q = query(
        collection(db, "pricing"), 
        where("customerCode", "==", payload.customerCode),
        where("materialCode", "==", payload.materialCode),
        where("plantId", "==", payload.plantId),
        where("documentType", "==", payload.documentType),
        where("documentCategory", "==", payload.documentCategory)
      );
      
      const snap = await getDocs(q);
      if (!snap.empty) {
        window.dispatchEvent(new CustomEvent('sap-status', { 
          detail: { text: `Error: Duplicate pricing record found in repository`, isError: true } 
        }));
        return false;
      }

      await addDocumentNonBlocking(collection(db, "pricing"), {
        ...payload,
        price: parseFloat(payload.price),
        gstRate: parseFloat(payload.gstRate),
        createdAt: serverTimestamp(),
      });
      
      window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: `Condition record committed successfully`, isError: false } 
      }));
      if (dataToSave === formData) {
        setFormData({ ...initialData, validFrom: new Date().toISOString().split('T')[0] });
      }
      return true;
    } catch (error) {
      window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: "System Error: Failed to reach backend repository", isError: true } 
      }));
      return false;
    } finally {
      setLoading(false);
    }
  }, [formData, db]);

  const downloadTemplate = () => {
    const headers = [
      "Plant ID", "Document Type", "Charge Type", "Inventory Type", 
      "Customer Code", "Material Name", "Basic Rate", "GST Rate (%)", 
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

    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const rows = text.split('\n').map(line => line.trim()).filter(line => line);
      const dataRows = rows.slice(1);

      let successCount = 0;
      let errorCount = 0;
      let totalCreated = 0;
      let errors: string[] = [];

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const [plantIdStr, docType, docCategory, invType, customer, material, rate, gst, validFrom, validTo] = row.split(',').map(v => v.trim());

        // Basic mandatory field validation
        if (!plantIdStr || !customer || !material || !invType || !rate || !gst || !validFrom || !validTo) {
          errors.push(`Row ${i + 2}: Mandatory fields are missing.`);
          errorCount++;
          continue;
        }

        // Date and numeric validation
        if (new Date(validFrom) > new Date(validTo)) {
          errors.push(`Row ${i + 2}: Validity From Date cannot be after Validity To Date.`);
          errorCount++;
          continue;
        }
        if (isNaN(parseFloat(rate)) || isNaN(parseFloat(gst))) {
          errors.push(`Row ${i + 2}: Basic Rate and GST Rate must be numeric.`);
          errorCount++;
          continue;
        }

        const plantIds = Array.from(new Set(plantIdStr.split(',').map(p => p.trim())));
        const invalidPlants = plantIds.filter(pId => !plants?.some(p => p.plantId === pId));

        if (invalidPlants.length > 0) {
          errors.push(`Row ${i + 2}: Invalid Plant ID(s) found: ${invalidPlants.join(', ')}.`);
          errorCount++;
          continue;
        }

        let rowSuccess = true;
        for (const plantId of plantIds) {
          const recordData = {
            plantId, customerCode: customer, materialCode: material, documentType: docType, documentCategory: docCategory,
            inventoryType: invType, price: parseFloat(rate), gstRate: parseFloat(gst), validFrom, validTo,
            conditionType: "PR00", keyCombination: "Customer/Material", currency: "INR", approvalFile: "", approvalFileName: "",
          };

          const success = await handleExecute(recordData);
          if (success) {
            totalCreated++;
          } else {
            rowSuccess = false;
            errors.push(`Row ${i + 2} (Plant: ${plantId}): Failed to create record. It might be a duplicate.`);
          }
        }

        if (rowSuccess) successCount++;
        else errorCount++;
      }

      const summary = `Bulk Upload Finished. Total Rows: ${dataRows.length}, Successful Rows: ${successCount}, Failed Rows: ${errorCount}, Total VK11 Records Created: ${totalCreated}.`;
      const errorDetails = errors.length > 0 ? `\n\nErrors:\n${errors.join('\n')}` : "";
      
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: summary + errorDetails, isError: errorCount > 0 } }));
      if (bulkFileInputRef.current) bulkFileInputRef.current.value = "";
      setLoading(false);
    };
    reader.readAsText(file);
  };

  useEffect(() => {
    const onExecute = () => handleExecute();
    window.addEventListener('sap-execute', onExecute);
    return () => window.removeEventListener('sap-execute', onExecute);
  }, [handleExecute]);

  const openPdfInNewTab = () => {
    if (pdfBlobUrl) window.open(pdfBlobUrl, '_blank');
  };

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
          <div className="p-2 space-y-1">
            <div className="sap-selection-row">
              <label className="sap-label">Plant ID *</label>
              <div className="sap-input-wrapper max-w-[200px]">
                <Select value={formData.plantId} onValueChange={(val) => setFormData({...formData, plantId: val, documentType: "", documentCategory: "", materialCode: "", customerCode: ""})}>
                  <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]"><SelectValue /></SelectTrigger>
                  <SelectContent>{plants?.map(p => <SelectItem key={p.id} value={p.plantId}>{p.plantId} - {p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="sap-selection-row">
              <label className="sap-label">Doc. Type</label>
              <div className="sap-input-wrapper max-w-[200px]">
                <Select value={formData.documentType} onValueChange={(val) => setFormData({...formData, documentType: val})} disabled={!formData.plantId}>
                  <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]"><SelectValue /></SelectTrigger>
                  <SelectContent>{Array.from(new Set(filteredBillingTypes.filter(b => b.documentType).map(b => b.documentType))).map(type => (<SelectItem key={type} value={type!}>{type}</SelectItem>))}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="sap-selection-row">
              <label className="sap-label">Charge Type</label>
              <div className="sap-input-wrapper max-w-[200px]">
                <Select value={formData.documentCategory} onValueChange={(val) => setFormData({...formData, documentCategory: val, materialCode: ""})} disabled={!formData.plantId}>
                  <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]"><SelectValue /></SelectTrigger>
                  <SelectContent>{Array.from(new Set(filteredBillingTypes.filter(b => b.documentCategory).map(b => b.documentCategory))).map(cat => (<SelectItem key={cat} value={cat!}>{cat}</SelectItem>))}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
          <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700">
            Price & Validity Data
          </div>
          <div className="p-2 space-y-1">
            <div className="sap-selection-row">
              <label className="sap-label">Inventory Type *</label>
              <div className="sap-input-wrapper max-w-[200px]">
                <Select value={formData.inventoryType} onValueChange={(val) => setFormData({...formData, inventoryType: val})} disabled={!formData.plantId}>
                  <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Service Invoice">Service Invoice</SelectItem>
                    <SelectItem value="Supply Invoice">Supply Invoice</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="sap-selection-row">
              <label className="sap-label">Customer *</label>
              <div className="sap-input-wrapper max-w-[200px]">
                <Select value={formData.customerCode} onValueChange={(val) => setFormData({...formData, customerCode: val})} disabled={!formData.plantId}>
                  <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]"><SelectValue /></SelectTrigger>
                  <SelectContent>{customers?.filter(c => !formData.plantId || c.plantId === formData.plantId).map(c => <SelectItem key={c.id} value={c.customerId}>{c.customerId} - {c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="sap-selection-row">
              <label className="sap-label">MATERIAL *</label>
              <div className="sap-input-wrapper max-w-[200px]">
                <Select value={formData.materialCode} onValueChange={(val) => setFormData({...formData, materialCode: val})} disabled={!formData.plantId || !formData.documentCategory}>
                  <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]"><SelectValue /></SelectTrigger>
                  <SelectContent>{filteredMaterials.map(m => <SelectItem key={m.id} value={m.productName}>{m.productName}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="sap-selection-row">
              <label className="sap-label">Basic Rate *</label>
              <div className="sap-input-wrapper max-w-[200px] gap-2">
                <Input type="number" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} />
                <span className="text-[10px] font-bold text-gray-400">{formData.currency}</span>
              </div>
            </div>
            <div className="sap-selection-row">
              <label className="sap-label">GST Rate (%) *</label>
              <div className="sap-input-wrapper max-w-[150px]">
                <Input type="number" value={formData.gstRate} onChange={(e) => setFormData({...formData, gstRate: e.target.value})} />
              </div>
            </div>
            <div className="sap-selection-row">
              <label className="sap-label">Validity *</label>
              <div className="sap-input-wrapper gap-2 max-w-md">
                <Input type="date" value={formData.validFrom} onChange={(e) => setFormData({...formData, validFrom: e.target.value})} />
                <span className="text-gray-400">to</span>
                <Input type="date" value={formData.validTo} onChange={(e) => setFormData({...formData, validTo: e.target.value})} />
              </div>
            </div>
          </div>
        </div>

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
              
              {formData.approvalFile && (
                <div className="flex items-center gap-3 animate-in slide-in-from-left-2 duration-300">
                  <div className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded border border-emerald-100 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" /> {formData.approvalFileName} ready
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
                          <img src={formData.approvalFile} alt="Approval" className="max-w-full max-h-[70vh] object-contain shadow-2xl border-4 border-white" />
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Button variant="ghost" size="icon" onClick={() => setFormData({...formData, approvalFile: "", approvalFileName: ""})} className="h-8 w-8 text-red-500"><X className="h-4 w-4" /></Button>
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
