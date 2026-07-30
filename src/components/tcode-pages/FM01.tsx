
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useDatabase, useCollection, useMemoDatabase, addDocumentNonBlocking } from "@/database";
import { collection, serverTimestamp, query, orderBy, limit, getDocs, where } from "@/database/mongo";
import { parseGSTIN } from "@/lib/gst-utils";
import { Upload, X, Loader2, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const initialData = {
  plantId: "",
  consignorCode: "",
  logoData: "",
  name: "",
  address: "",
  gstin: "",
  pan: "",
  state: "",
  stateCode: "",
  email: "",
  mobile: "",
  bankName: "",
  accountHolderName: "",
  accountNumber: "",
  ifscCode: "",
  terms: [""],
};

export default function FM01() {
  const db = useDatabase();
  const [formData, setFormData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Real-time plants for validation
  const plantsQuery = useMemoDatabase(() => collection(db, "plants"), [db]);
  const { data: plants, isLoading: isPlantsLoading } = useCollection(plantsQuery);

  const handleGSTINChange = (val: string) => {
    const gstin = val.toUpperCase().substring(0, 15);
    const parsed = parseGSTIN(gstin);
    
    setFormData(prev => ({
      ...prev,
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
    }));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500 * 1024) {
      window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: "Error: Logo file size exceeds 500 KB limit", isError: true } 
      }));
      return;
    }

    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      setFormData(prev => ({ ...prev, logoData: readerEvent.target?.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleExecute = useCallback(async () => {
    if (!formData.plantId || !formData.consignorCode || !formData.name || !formData.gstin) {
      window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: "Validation Error: Plant, Consignor Code, Name, and GSTIN are required", isError: true } 
      }));
      return;
    }

    const normalizedCode = formData.consignorCode.trim().toUpperCase();
    setLoading(true);
    try {
      const dupQuery = query(collection(db, "firms"), where("firmId", "==", normalizedCode));
      const dupSnap = await getDocs(dupQuery);
      if (!dupSnap.empty) {
        window.dispatchEvent(new CustomEvent('sap-status', { 
          detail: { text: "Consignor Code already exists. Please enter a unique code.", isError: true } 
        }));
        setLoading(false);
        return;
      }

      const validPlant = plants?.find(p => p.plantId === formData.plantId);

      addDocumentNonBlocking(collection(db, "firms"), {
        ...formData,
        firmId: normalizedCode,
        consignorCode: normalizedCode,
        plantDocId: validPlant?.id || "",
        createdAt: serverTimestamp(),
      });
      window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: `Firm ${normalizedCode} created successfully`, isError: false } 
      }));
      setFormData(initialData);
    } catch (error) {
      window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: "System Error: Failed to save firm profile", isError: true } 
      }));
    } finally {
      setLoading(false);
    }
  }, [formData, db, plants]);

  useEffect(() => {
    const onExecute = () => handleExecute();
    window.addEventListener('sap-execute', onExecute);
    return () => window.removeEventListener('sap-execute', onExecute);
  }, [handleExecute]);

  const addTermRow = () => {
    setFormData(prev => ({ ...prev, terms: [...prev.terms, ""] }));
  };

  const removeTermRow = (idx: number) => {
    if (formData.terms.length > 1) {
      setFormData(prev => ({ ...prev, terms: prev.terms.filter((_, i) => i !== idx) }));
    }
  };

  const updateTermValue = (idx: number, val: string) => {
    const updated = [...formData.terms];
    updated[idx] = val;
    setFormData(prev => ({ ...prev, terms: updated }));
  };

  return (
    <div className="w-full flex flex-col bg-white min-h-full">
      <div className="bg-[#dae8f5] px-4 py-1 border-b border-gray-300">
        <h2 className="text-[13px] font-bold text-gray-800 uppercase italic tracking-wider">
          Create Firm
        </h2>
      </div>

      <div className="p-4 space-y-4">
        <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
          <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700">
            Basic Details & Logo
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
                    <SelectValue placeholder="" />
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
                <Input
                  value={formData.consignorCode}
                  onChange={(e) => setFormData({...formData, consignorCode: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "")})}
                />
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

        <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
          <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700">
            Banking and Payment Information
          </div>
          <div className="p-2 space-y-1">
            <div className="sap-selection-row">
              <label className="sap-label">Bank Name</label>
              <div className="sap-input-wrapper max-w-md">
                <Input value={formData.bankName} onChange={(e) => setFormData({...formData, bankName: e.target.value})} />
              </div>
            </div>
            <div className="sap-selection-row">
              <label className="sap-label">Account Holder Name</label>
              <div className="sap-input-wrapper max-w-md">
                <Input value={formData.accountHolderName} onChange={(e) => setFormData({...formData, accountHolderName: e.target.value})} />
              </div>
            </div>
            <div className="sap-selection-row">
              <label className="sap-label">Account Number</label>
              <div className="sap-input-wrapper max-w-md">
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
            {formData.terms.map((term, idx) => (
              <div key={idx} className="sap-selection-row group">
                <label className="sap-label">Term Row {idx + 1}</label>
                <div className="sap-input-wrapper w-full gap-2">
                  <Input 
                    value={term} 
                    onChange={(e) => updateTermValue(idx, e.target.value)} 
                    placeholder={`Enter term or condition #${idx + 1}`}
                  />
                  {formData.terms.length > 1 && (
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
      {loading && <div className="fixed bottom-10 right-10 bg-[#333e4f] text-white px-4 py-2 text-xs">SAVING FIRM...</div>}
    </div>
  );
}


