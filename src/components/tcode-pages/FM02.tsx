
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useDatabase, useCollection, useMemoDatabase, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/database";
import { collection, doc } from "@/database/mongo";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { parseGSTIN } from "@/lib/gst-utils";
import { Upload, X, Loader2, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";

export default function FM02() {
  const db = useDatabase();
  const [selectedId, setSelectedId] = useState("");
  const [formData, setFormData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Real-time firms
  const firmsQuery = useMemoDatabase(() => collection(db, "firms"), [db]);
  const { data: firms } = useCollection(firmsQuery);

  // Real-time plants for validation
  const plantsQuery = useMemoDatabase(() => collection(db, "plants"), [db]);
  const { data: plants, isLoading: isPlantsLoading } = useCollection(plantsQuery);

  const handleSelect = (id: string) => {
    const firm = firms?.find(f => f.id === id);
    if (firm) {
      setFormData({
        ...firm,
        consignorCode: firm.consignorCode || firm.firmId || "",
        plantId: firm.plantId || "",
        logoData: firm.logoData || "",
        name: firm.name || "",
        address: firm.address || "",
        gstin: firm.gstin || "",
        pan: firm.pan || "",
        state: firm.state || "",
        stateCode: firm.stateCode || "",
        email: firm.email || "",
        mobile: firm.mobile || "",
        bankName: firm.bankName || "",
        accountHolderName: firm.accountHolderName || "",
        accountNumber: firm.accountNumber || "",
        ifscCode: firm.ifscCode || "",
        terms: firm.terms || [""],
      });
      setSelectedId(id);
    }
  };

  const handleGSTINChange = (val: string) => {
    const gstin = val.toUpperCase().substring(0, 15);
    const parsed = parseGSTIN(gstin);
    setFormData({
      ...formData,
      gstin,
      ...(parsed ? { 
        pan: parsed.pan, 
        state: parsed.state, 
        stateCode: parsed.stateCode 
      } : {
        pan: "",
        state: "",
        stateCode: ""
      })
    });
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.size <= 500 * 1024) {
      const reader = new FileReader();
      reader.onload = (ev) => setFormData({...formData, logoData: ev.target?.result});
      reader.readAsDataURL(file);
    } else if (file) {
      window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: "Error: Logo must be under 500 KB", isError: true } 
      }));
    }
  };

  const handleExecute = useCallback(async () => {
    if (!formData || !selectedId) {
      window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: "Please select a firm to update", isError: true } 
      }));
      return;
    }

    if (!formData.plantId || !formData.consignorCode || !formData.name || !formData.gstin) {
      window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: "Validation Error: Plant, Consignor Code, Name, and GSTIN are required", isError: true } 
      }));
      return;
    }

    const normalizedCode = String(formData.consignorCode || "").trim().toUpperCase();
    const validPlant = plants?.find(p => p.plantId === formData.plantId);
    
    setLoading(true);
    try {
      const { id, ...dataToSave } = formData;
      updateDocumentNonBlocking(doc(db, "firms", selectedId), {
        ...dataToSave,
        firmId: normalizedCode,
        consignorCode: normalizedCode,
        plantDocId: validPlant?.id || "",
        updatedAt: new Date().toISOString()
      });

      window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: `Firm ${formData.name} updated successfully`, isError: false } 
      }));
    } catch (error) {
      window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: "Update failed: Check database connection", isError: true } 
      }));
    } finally {
      setLoading(false);
    }
  }, [formData, selectedId, plants, db]);

  const handleDelete = async () => {
    if (!selectedId) return;
    if (!confirm("Confirm Firm Deletion: This operation will remove the firm master record. Already generated invoices will remain frozen with current data.")) return;
    
    setLoading(true);
    try {
      deleteDocumentNonBlocking(doc(db, "firms", selectedId));
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Firm record removed successfully", isError: false } }));
      setSelectedId("");
      setFormData(null);
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

  const addTermRow = () => {
    setFormData((prev: any) => ({ ...prev, terms: [...(prev.terms || []), ""] }));
  };

  const removeTermRow = (idx: number) => {
    if (formData.terms.length > 1) {
      setFormData((prev: any) => ({ ...prev, terms: prev.terms.filter((_: any, i: number) => i !== idx) }));
    }
  };

  const updateTermValue = (idx: number, val: string) => {
    const updated = [...formData.terms];
    updated[idx] = val;
    setFormData((prev: any) => ({ ...prev, terms: updated }));
  };

  return (
    <div className="w-full flex flex-col bg-white min-h-full">
      <div className="bg-[#dae8f5] px-4 py-1 border-b border-gray-300">
        <h2 className="text-[13px] font-bold text-gray-800 uppercase italic tracking-wider">
          Edit Firm Profile
        </h2>
      </div>

      <div className="p-4 space-y-4">
        {/* Selection Area */}
        <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
          <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700">Selection</div>
          <div className="p-2">
            <div className="sap-selection-row">
              <label className="sap-label">Select Firm</label>
              <div className="sap-input-wrapper max-w-xl">
                <Select onValueChange={handleSelect} value={selectedId}>
                  <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]">
                    <SelectValue placeholder="Choose firm to edit" />
                  </SelectTrigger>
                  <SelectContent>
                    {firms?.map(f => <SelectItem key={f.id} value={f.id}>{f.name} - {f.gstin}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {formData && (
          <div className="space-y-4 animate-in fade-in duration-300">
            {/* Basic Details */}
            <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
              <div className="bg-[#dae8f5] px-3 py-1 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700 flex justify-between items-center">
                <span>Basic Details & Logo</span>
                <Button onClick={handleDelete} variant="destructive" size="sm" className="h-6 rounded-none gap-2 uppercase font-bold text-[10px]">
                  <Trash2 className="h-3.5 w-3.5" /> Delete Firm
                </Button>
              </div>
              <div className="p-2 space-y-2">
                <div className="sap-selection-row">
                  <label className="sap-label">Plant ID</label>
                  <div className="sap-input-wrapper max-w-[200px]">
                    <Select 
                      value={formData.plantId} 
                      onValueChange={(val) => setFormData({...formData, plantId: val})}
                    >
                      <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {plants?.map(p => (
                          <SelectItem key={p.id} value={p.plantId}>
                            {p.plantId} - {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {isPlantsLoading && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
                  </div>
                </div>

                <div className="sap-selection-row items-start">
                  <label className="sap-label mt-1">Consignor Logo</label>
                  <div className="sap-input-wrapper gap-4">
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-24 h-24 border-2 border-dashed border-gray-300 rounded flex items-center justify-center cursor-pointer hover:bg-blue-50 transition-colors relative"
                    >
                      {formData.logoData ? (
                        <>
                          <Image src={formData.logoData} alt="Logo" fill className="object-contain p-1" />
                          <button 
                            onClick={(e) => { e.stopPropagation(); setFormData({...formData, logoData: ""}); }}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </>
                      ) : (
                        <div className="flex flex-col items-center text-gray-400">
                          <Upload className="h-6 w-6" />
                          <span className="text-[10px]">Max 500KB</span>
                        </div>
                      )}
                    </div>
                    <input type="file" ref={fileInputRef} onChange={handleLogoUpload} accept="image/*" className="hidden" />
                  </div>
                </div>

                <div className="sap-selection-row">
                  <label className="sap-label">Consignor Code</label>
                  <div className="sap-input-wrapper max-w-[200px]">
                    <Input value={formData.consignorCode} onChange={(e) => setFormData({...formData, consignorCode: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "")})} />
                  </div>
                </div>

                <div className="sap-selection-row">
                  <label className="sap-label">Consignor Name</label>
                  <div className="sap-input-wrapper max-w-xl">
                    <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                  </div>
                </div>
              </div>
            </div>

            {/* GST Info */}
            <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
              <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700">
                GST & Tax Info
              </div>
              <div className="p-2 space-y-1">
                <div className="sap-selection-row">
                  <label className="sap-label">GSTIN</label>
                  <div className="sap-input-wrapper max-w-[200px]">
                    <Input value={formData.gstin} onChange={(e) => handleGSTINChange(e.target.value)} />
                  </div>
                </div>
                <div className="sap-selection-row">
                  <label className="sap-label">PAN</label>
                  <div className="sap-input-wrapper max-w-[150px]">
                    <Input value={formData.pan} readOnly className="bg-gray-100 font-mono" />
                  </div>
                </div>
                <div className="sap-selection-row">
                  <label className="sap-label">State / State Code</label>
                  <div className="sap-input-wrapper max-w-xl gap-1">
                    <Input value={formData.stateCode} readOnly className="w-12 bg-gray-100 text-center" />
                    <Input value={formData.state} readOnly className="bg-gray-100" />
                  </div>
                </div>
              </div>
            </div>

            {/* Banking Info */}
            <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
              <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700">
                Banking and Payment Information
              </div>
              <div className="p-2 space-y-1">
                <div className="sap-selection-row">
                  <label className="sap-label">Bank Name</label>
                  <div className="sap-input-wrapper max-md">
                    <Input value={formData.bankName} onChange={(e) => setFormData({...formData, bankName: e.target.value})} />
                  </div>
                </div>
                <div className="sap-selection-row">
                  <label className="sap-label">Account Holder Name</label>
                  <div className="sap-input-wrapper max-md">
                    <Input value={formData.accountHolderName} onChange={(e) => setFormData({...formData, accountHolderName: e.target.value})} />
                  </div>
                </div>
                <div className="sap-selection-row">
                  <label className="sap-label">Account Number</label>
                  <div className="sap-input-wrapper max-md">
                    <Input value={formData.accountNumber} onChange={(e) => setFormData({...formData, accountNumber: e.target.value})} />
                  </div>
                </div>
                <div className="sap-selection-row">
                  <label className="sap-label">IFSC code</label>
                  <div className="sap-input-wrapper max-w-[200px]">
                    <Input value={formData.ifscCode} onChange={(e) => setFormData({...formData, ifscCode: e.target.value.toUpperCase()})} />
                  </div>
                </div>
              </div>
            </div>

            {/* Contact & Address */}
            <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
              <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700">
                Contact & Address
              </div>
              <div className="p-2 space-y-1">
                <div className="sap-selection-row">
                  <label className="sap-label">Email</label>
                  <div className="sap-input-wrapper max-w-xl">
                    <Input value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
                  </div>
                </div>
                <div className="sap-selection-row">
                  <label className="sap-label">Mobile</label>
                  <div className="sap-input-wrapper max-w-[200px]">
                    <Input value={formData.mobile} onChange={(e) => setFormData({...formData, mobile: e.target.value})} />
                  </div>
                </div>
                <div className="sap-selection-row items-start">
                  <label className="sap-label mt-1">Address</label>
                  <div className="sap-input-wrapper max-w-full">
                    <Textarea value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} rows={2} className="rounded-none border-gray-400 focus:bg-[#fff9c4]" />
                  </div>
                </div>
              </div>
            </div>

            {/* Terms & Conditions */}
            <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
              <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700 flex justify-between items-center">
                <span>Terms & Conditions</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={addTermRow}
                  className="h-5 text-[10px] hover:bg-white/50 border border-transparent hover:border-blue-300 rounded-none gap-1"
                >
                  <Plus className="h-3 w-3" /> Add Row
                </Button>
              </div>
              <div className="p-2 space-y-1">
                {(formData.terms || [""]).map((term: string, idx: number) => (
                  <div key={idx} className="sap-selection-row group">
                    <label className="sap-label">Term Row {idx + 1}</label>
                    <div className="sap-input-wrapper w-full gap-2">
                      <Input 
                        value={term} 
                        onChange={(e) => updateTermValue(idx, e.target.value)} 
                        placeholder={`Enter term or condition #${idx + 1}`}
                      />
                      {(formData.terms || []).length > 1 && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => removeTermRow(idx)}
                          className="h-6 w-6 text-red-500 hover:bg-red-50"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      {loading && <div className="fixed bottom-10 right-10 bg-[#333e4f] text-white px-4 py-2 text-xs border border-white/20 animate-pulse">UPDATING FIRM PROFILE...</div>}
    </div>
  );
}


