
"use client";

import { useState, useEffect, useCallback } from "react";
import { useDatabase, addDocumentNonBlocking, useCollection, useMemoDatabase } from "@/database";
import { collection, serverTimestamp, query, orderBy, limit, getDocs, where } from "@/database/mongo";
import { Save, Loader2 } from "lucide-react";
import { parseGSTIN } from "@/lib/gst-utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const initialData = {
  assignedPlantIds: [] as string[],
  customerId: "",
  name: "",
  mobile: "",
  email: "",
  address: "",
  gstin: "",
  pan: "",
  stateName: "",
  stateCode: "",
  creditLimit: "",
};

export default function XD01() {
  const db = useDatabase();
  const [formData, setFormData] = useState(initialData);
  const [loading, setLoading] = useState(false);

  // Fetch plants for the multi-select
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

  const handleGSTINChange = (val: string) => {
    const gstin = val.toUpperCase().substring(0, 15);
    const parsed = parseGSTIN(gstin);
    
    setFormData(prev => ({
      ...prev,
      gstin,
      ...(parsed ? {
        pan: parsed.pan,
        stateName: parsed.state,
        stateCode: parsed.stateCode,
      } : {
        pan: "",
        stateName: "",
        stateCode: "",
      })
    }));
  };

  const handleExecute = useCallback(async () => {
    if (!formData.name || !formData.mobile || !formData.customerId || formData.assignedPlantIds.length === 0) {
      window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: "Validation Error: Customer Name, Mobile, Customer Code, and at least one Plant are required", isError: true } 
      }));
      return;
    }

    const normalizedCode = formData.customerId.trim().toUpperCase();
    const duplicateQuery = query(collection(db, "customers"), where("customerId", "==", normalizedCode));
    const duplicateSnap = await getDocs(duplicateQuery);
    if (!duplicateSnap.empty) {
      window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: "Customer Code already exists. Please enter a unique code.", isError: true } 
      }));
      return;
    }

    setLoading(true);
    try {
      addDocumentNonBlocking(collection(db, "customers"), {
        ...formData,
        customerId: normalizedCode,
        plantId: formData.assignedPlantIds[0], // backward compatibility with single-plant queries
        createdAt: serverTimestamp(),
      });
      
      window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: `Customer ${normalizedCode} created successfully`, isError: false } 
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
    const onCancel = () => {
      setFormData(initialData);
      window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: "Transaction reset by user", isError: false } 
      }));
    };

    window.addEventListener('sap-execute', onExecute);
    window.addEventListener('sap-cancel', onCancel);

    return () => {
      window.removeEventListener('sap-execute', onExecute);
      window.removeEventListener('sap-cancel', onCancel);
    };
  }, [handleExecute]);

  return (
    <div className="w-full flex flex-col bg-white min-h-full">
      <div className="bg-[#dae8f5] px-4 py-1 border-b border-gray-300 flex items-center justify-between">
        <h2 className="text-[13px] font-bold text-gray-800 uppercase italic tracking-wider">
          Create customer
        </h2>
      </div>

      <div className="p-4 space-y-4">
        <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
          <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700">
            Customer Data
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
                <span className="text-[10px] text-gray-400 italic mt-1 block">Select at least one plant. Customer will be accessible only for selected plants.</span>
              </div>
            </div>

            <div className="sap-selection-row">
              <label className="sap-label">Customer Code</label>
              <div className="sap-input-wrapper max-w-[200px]">
                <Input
                  value={formData.customerId}
                  onChange={(e) => setFormData({...formData, customerId: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "")})}
                />
              </div>
            </div>

            <div className="sap-selection-row">
              <label className="sap-label">Full Name</label>
              <div className="sap-input-wrapper max-w-md">
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>
            </div>

            <div className="sap-selection-row">
              <label className="sap-label">Mobile Number</label>
              <div className="sap-input-wrapper max-w-[200px]">
                <Input
                  value={formData.mobile}
                  onChange={(e) => setFormData({...formData, mobile: e.target.value})}
                />
              </div>
            </div>

            <div className="sap-selection-row">
              <label className="sap-label">Email Address</label>
              <div className="sap-input-wrapper max-w-md">
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
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
                  className="rounded-none border-gray-400 focus:bg-[#fff9c4]"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
          <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700">
            Tax & Financial Details
          </div>
          
          <div className="p-2 space-y-1">
            <div className="sap-selection-row">
              <label className="sap-label">GSTIN</label>
              <div className="sap-input-wrapper max-w-[200px]">
                <Input
                  value={formData.gstin}
                  onChange={(e) => handleGSTINChange(e.target.value)}
                />
              </div>
            </div>

            <div className="sap-selection-row">
              <label className="sap-label">PAN</label>
              <div className="sap-input-wrapper max-w-[150px]">
                <Input
                  value={formData.pan}
                  readOnly
                  className="bg-gray-100 font-mono"
                />
              </div>
            </div>

            <div className="sap-selection-row">
              <label className="sap-label">State Name</label>
              <div className="sap-input-wrapper max-w-md">
                <Input
                  value={formData.stateName}
                  readOnly
                  className="bg-gray-100"
                />
              </div>
            </div>

            <div className="sap-selection-row">
              <label className="sap-label">State code</label>
              <div className="sap-input-wrapper max-w-[100px]">
                <Input
                  value={formData.stateCode}
                  readOnly
                  className="bg-gray-100 text-center"
                />
              </div>
            </div>

            <div className="sap-selection-row">
              <label className="sap-label">Credit Limit (₹)</label>
              <div className="sap-input-wrapper max-w-[150px]">
                <Input
                  type="number"
                  value={formData.creditLimit}
                  onChange={(e) => setFormData({...formData, creditLimit: e.target.value})}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading && (
        <div className="fixed bottom-10 right-10 bg-[#333e4f] text-white px-4 py-2 text-xs animate-pulse border border-white/20">
          SYSTEM: Processing Transaction...
        </div>
      )}
    </div>
  );
}

