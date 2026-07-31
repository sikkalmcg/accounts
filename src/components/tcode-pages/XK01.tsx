"use client";

import { useState, useEffect, useCallback } from "react";
import { useDatabase, addDocumentNonBlocking, useCollection, useMemoDatabase } from "@/database";
import { collection, serverTimestamp, query, orderBy, limit, getDocs, where } from "@/database/mongo";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";

const initialData = {
  assignedPlantIds: [] as string[],
  vendorCode: "",
  vendorName: "",
  contact: "",
  address: "",
  gstin: "",
  pan: "",
  bankName: "",
  accountNumber: "",
  ifscCode: "",
};

export default function XK01() {
  const db = useDatabase();
  const [formData, setFormData] = useState(initialData);
  const [loading, setLoading] = useState(false);

  // Fetch plants for multi-select
  const plantsQuery = useMemoDatabase(() => collection(db, "plants"), [db]);
  const { data: plants, isLoading: isPlantsLoading } = useCollection(plantsQuery);

  const togglePlant = (plantId: string) => {
    setFormData(prev => ({
      ...prev,
      assignedPlantIds: prev.assignedPlantIds.includes(plantId)
        ? prev.assignedPlantIds.filter(id => id !== plantId)
        : [...prev.assignedPlantIds, plantId]
    }));
  };

  const handleExecute = useCallback(async () => {
    if (!formData.vendorCode || !formData.vendorName || !formData.contact || formData.assignedPlantIds.length === 0) {
      window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: "Validation Error: Vendor Code, Vendor Name, Contact, and at least one Plant are required", isError: true } 
      }));
      return;
    }

    const normalizedCode = formData.vendorCode.trim().toUpperCase();
    setLoading(true);
    try {
      const dupQuery = query(collection(db, "vendors"), where("vendorCode", "==", normalizedCode));
      const dupSnap = await getDocs(dupQuery);
      if (!dupSnap.empty) {
        window.dispatchEvent(new CustomEvent('sap-status', { 
          detail: { text: "Vendor Code already exists. Please enter a unique code.", isError: true } 
        }));
        setLoading(false);
        return;
      }

      addDocumentNonBlocking(collection(db, "vendors"), {
        ...formData,
        vendorId: normalizedCode,
        vendorCode: normalizedCode,
        plantId: formData.assignedPlantIds[0], // backward compatibility
        createdAt: serverTimestamp(),
      });
      
      window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: `Vendor ${normalizedCode} created successfully`, isError: false } 
      }));
      setFormData(initialData);
    } catch (error) {
       window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: "System Error: Transaction failed to commit", isError: true } 
      }));
    } finally {
      setLoading(false);
    }
  }, [formData, db]);

  useEffect(() => {
    const onExecute = () => handleExecute();
    const onCancel = () => setFormData(initialData);

    window.addEventListener('sap-execute', onExecute);
    window.addEventListener('sap-cancel', onCancel);

    return () => {
      window.removeEventListener('sap-execute', onExecute);
      window.removeEventListener('sap-cancel', onCancel);
    };
  }, [handleExecute]);

  return (
    <div className="w-full flex flex-col bg-white min-h-full">
      <div className="bg-[#dae8f5] px-4 py-1 border-b border-gray-300">
        <h2 className="text-[13px] font-bold text-gray-800 uppercase italic tracking-wider">
          Create Vendor
        </h2>
      </div>

      <div className="p-4 space-y-4">
        <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
          <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700">
            Vendor General Data
          </div>
          
          <div className="p-2 space-y-1">
            <div className="sap-selection-row items-start">
              <label className="sap-label mt-1">Plant Access <span className="text-red-500">*</span></label>
              <div className="sap-input-wrapper">
                <div className="border border-gray-300 bg-white p-2 grid grid-cols-2 gap-x-4 gap-y-1 max-h-[160px] overflow-y-auto">
                  {isPlantsLoading ? (
                    <div className="text-xs text-gray-400 flex items-center gap-2 col-span-2"><Loader2 className="h-3 w-3 animate-spin" /> Loading Plants...</div>
                  ) : plants?.length === 0 ? (
                    <div className="text-xs text-red-500 col-span-2">No plants found. Create a plant first (OP01).</div>
                  ) : (
                    plants?.map(p => (
                      <div key={p.id} className="flex items-center space-x-2 p-1 hover:bg-blue-50 rounded">
                        <Checkbox id={`p-${p.plantId}`} checked={formData.assignedPlantIds.includes(p.plantId)} onCheckedChange={() => togglePlant(p.plantId)} />
                        <label htmlFor={`p-${p.plantId}`} className="text-[11px] font-bold cursor-pointer">{p.plantId} - {p.name}</label>
                      </div>
                    ))
                  )}
                </div>
                <span className="text-[10px] text-gray-400 italic mt-1 block">Select at least one plant. Vendor will be available only for selected plants.</span>
              </div>
            </div>

            <div className="sap-selection-row">
              <label className="sap-label">Vendor Code</label>
              <div className="sap-input-wrapper max-w-[200px]">
                <Input
                  value={formData.vendorCode}
                  onChange={(e) => setFormData({...formData, vendorCode: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "")})}
                />
              </div>
            </div>

            <div className="sap-selection-row">
              <label className="sap-label">Vendor Name</label>
              <div className="sap-input-wrapper max-w-md">
                <Input
                  value={formData.vendorName}
                  onChange={(e) => setFormData({...formData, vendorName: e.target.value})}
                />
              </div>
            </div>

            <div className="sap-selection-row">
              <label className="sap-label">Contact Details</label>
              <div className="sap-input-wrapper max-w-[200px]">
                <Input
                  value={formData.contact}
                  onChange={(e) => setFormData({...formData, contact: e.target.value})}
                />
              </div>
            </div>

            <div className="sap-selection-row">
              <label className="sap-label">GSTIN</label>
              <div className="sap-input-wrapper max-w-[200px]">
                <Input
                  value={formData.gstin}
                  onChange={(e) => setFormData({...formData, gstin: e.target.value.toUpperCase()})}
                />
              </div>
            </div>

            <div className="sap-selection-row">
              <label className="sap-label">PAN Number</label>
              <div className="sap-input-wrapper max-w-[200px]">
                <Input
                  value={formData.pan}
                  onChange={(e) => setFormData({...formData, pan: e.target.value.toUpperCase()})}
                />
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
                <Input
                  value={formData.bankName}
                  onChange={(e) => setFormData({...formData, bankName: e.target.value})}
                />
              </div>
            </div>
            <div className="sap-selection-row">
              <label className="sap-label">Account Number</label>
              <div className="sap-input-wrapper max-w-md">
                <Input
                  value={formData.accountNumber}
                  onChange={(e) => setFormData({...formData, accountNumber: e.target.value})}
                />
              </div>
            </div>
            <div className="sap-selection-row">
              <label className="sap-label">IFSC code</label>
              <div className="sap-input-wrapper max-w-[200px]">
                <Input
                  value={formData.ifscCode}
                  onChange={(e) => setFormData({...formData, ifscCode: e.target.value.toUpperCase()})}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
          <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700">
            Address
          </div>
          <div className="p-2 space-y-1">
            <div className="sap-selection-row items-start">
              <label className="sap-label mt-1">Postal Address</label>
              <div className="sap-input-wrapper max-w-xl">
                <Textarea 
                  rows={3}
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading && (
        <div className="fixed bottom-10 right-10 bg-[#333e4f] text-white px-4 py-2 text-xs">
          PROCESSING VENDOR...
        </div>
      )}
    </div>
  );
}


