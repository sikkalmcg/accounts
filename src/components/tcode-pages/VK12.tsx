"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useDatabase, useCollection, useMemoDatabase, updateDocumentNonBlocking } from "@/database";
import { collection, doc, query, orderBy } from "@/database/mongo";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload, CheckCircle2, X, FileText, Save, Eye, Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import Image from "next/image";

export default function VK12() {
  const db = useDatabase();
  const [selectedId, setSelectedId] = useState("");
  const [formData, setFormData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pdfBlobUrl = useMemo(() => {
    if (formData?.approvalFile?.startsWith('data:application/pdf')) {
      try {
        const parts = formData.approvalFile.split(',');
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
  }, [formData?.approvalFile]);

  useEffect(() => {
    return () => {
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
    };
  }, [pdfBlobUrl]);

  const pricingQuery = useMemoDatabase(() => query(collection(db, "pricing"), orderBy("createdAt", "desc")), [db]);
  const { data: pricingRecords, isLoading: isPricingLoading } = useCollection(pricingQuery);

  const handleSelect = (id: string) => {
    const record = pricingRecords?.find(r => r.id === id);
    if (record) {
      setFormData({
        ...record,
        approvalFile: record.approvalFile || "",
        approvalFileName: record.approvalFileName || "",
        validFrom: record.validFrom || "",
        validTo: record.validTo || "9999-12-31",
      });
      setSelectedId(id);
    }
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
      setFormData((prev: any) => ({ 
        ...prev, 
        approvalFile: ev.target?.result as string,
        approvalFileName: file.name
      }));
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Attachment replaced and ready to save", isError: false } }));
    };
    reader.readAsDataURL(file);
  };

  const handleExecute = useCallback(async () => {
    if (!formData || !selectedId) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Error: Selection required for modification", isError: true } }));
      return;
    }

    setLoading(true);
    try {
      const { id, ...dataToUpdate } = formData;
      updateDocumentNonBlocking(doc(db, "pricing", selectedId), {
        ...dataToUpdate,
        price: parseFloat(dataToUpdate.price),
        gstRate: parseFloat(dataToUpdate.gstRate),
        updatedAt: new Date().toISOString(),
      });
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: `Condition record for ${formData.materialCode} updated`, isError: false } }));
    } catch (error) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Update failed: Authorization or connection error", isError: true } }));
    } finally {
      setLoading(false);
    }
  }, [formData, selectedId, db]);

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

        {formData && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
              <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700">Condition Maintenance</div>
              <div className="p-2 space-y-1">
                <div className="sap-selection-row"><label className="sap-label">Plant / Category</label><div className="flex gap-2 w-full"><Input value={formData.plantId} readOnly className="bg-gray-100 font-mono w-24" /><Input value={formData.documentCategory || "GENERAL"} readOnly className="bg-gray-100" /></div></div>
                <div className="sap-selection-row"><label className="sap-label">Customer / Material</label><div className="flex gap-2 w-full"><Input value={formData.customerCode} readOnly className="bg-gray-100 w-32" /><Input value={formData.materialCode} readOnly className="bg-gray-100" /></div></div>
                <div className="sap-selection-row"><label className="sap-label">Basic Rate</label>
                  <div className="sap-input-wrapper max-w-[200px] gap-2">
                    <Input type="number" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} className="font-bold text-blue-700" />
                    <span className="text-[10px] font-bold text-gray-400">INR</span>
                  </div>
                </div>
                <div className="sap-selection-row"><label className="sap-label">GST %</label><Input type="number" value={formData.gstRate} onChange={(e) => setFormData({...formData, gstRate: e.target.value})} className="max-w-[100px]" /></div>
                <div className="sap-selection-row"><label className="sap-label">Valid From/To</label>
                  <div className="sap-input-wrapper gap-2 max-w-md">
                    <Input type="date" value={formData.validFrom} onChange={(e) => setFormData({...formData, validFrom: e.target.value})} />
                    <span className="text-gray-400">to</span>
                    <Input type="date" value={formData.validTo} onChange={(e) => setFormData({...formData, validTo: e.target.value})} />
                  </div>
                </div>
                
                <div className="sap-selection-row pt-4 items-center">
                  <label className="sap-label font-bold text-blue-800">Maintain Attachment</label>
                  <div className="sap-input-wrapper gap-3">
                    <Button variant="outline" size="sm" className="h-8 rounded-none border-gray-400 bg-gray-50 hover:bg-white gap-2" onClick={() => fileInputRef.current?.click()}>
                      <Upload className="h-4 w-4" /> Replace Document
                    </Button>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*,.pdf" onChange={handleFileUpload} />
                    
                    {formData.approvalFile && (
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-emerald-700 uppercase bg-emerald-50 px-2 py-0.5 border border-emerald-100 rounded-sm">Verified: {formData.approvalFileName || "DOC"}</span>
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
                                <img src={formData.approvalFile} alt="Approval" className="max-w-full max-h-[70vh] object-contain shadow-2xl border-4 border-white" />
                              )}
                            </div>
                          </DialogContent>
                        </Dialog>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => setFormData({...formData, approvalFile: "", approvalFileName: ""})}><X className="h-4 w-4" /></Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      {loading && <div className="fixed bottom-10 right-10 bg-[#333e4f] text-white px-4 py-2 text-xs border border-white/20 animate-pulse z-50 shadow-2xl flex items-center gap-2 font-bold"><Save className="h-4 w-4" /> COMMITING CHANGES...</div>}
    </div>
  );
}

