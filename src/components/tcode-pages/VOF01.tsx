
"use client";

import { useState, useEffect, useCallback } from "react";
import { useDatabase, addDocumentNonBlocking, useCollection, useMemoDatabase } from "@/database";
import { collection, serverTimestamp, query, where, getDocs, writeBatch, doc } from "@/database/mongo";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

const initialData = {
  plantIds: [] as string[],
  documentType: "",
  documentCategories: [""],
  inventoryType: "",
};

export default function VOF01() {
  const db = useDatabase();
  const [formData, setFormData] = useState(initialData);
  const [loading, setLoading] = useState(false);

  const plantsQuery = useMemoDatabase(() => collection(db, "plants"), [db]);
  const { data: plants, isLoading: isPlantsLoading } = useCollection(plantsQuery);

  const togglePlant = (plantId: string) => {
    setFormData(prev => ({
      ...prev,
      plantIds: prev.plantIds.includes(plantId)
        ? prev.plantIds.filter(id => id !== plantId)
        : [...prev.plantIds, plantId]
    }));
  };

  const updateChargeType = (index: number, value: string) => {
    const newCategories = [...formData.documentCategories];
    newCategories[index] = value.toUpperCase();
    setFormData({ ...formData, documentCategories: newCategories });
  };

  const addChargeType = () => {
    setFormData(prev => ({ ...prev, documentCategories: [...prev.documentCategories, ""] }));
  };

  const removeChargeType = (index: number) => {
    if (formData.documentCategories.length > 1) {
      setFormData(prev => ({ ...prev, documentCategories: prev.documentCategories.filter((_, i) => i !== index) }));
    }
  };

  const handleExecute = useCallback(async () => {
    if (formData.plantIds.length === 0 || !formData.inventoryType) {
      window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: "Error: At least one Plant ID and an Inventory Type are mandatory", isError: true } 
      }));
      return;
    }

    const chargeTypes = formData.documentCategories.map(c => c.trim()).filter(Boolean);

    if (!formData.documentType && chargeTypes.length === 0) {
      window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: "Error: Provide either Document Type or Charge Type", isError: true } 
      }));
      return;
    }

    setLoading(true);
    try {
      const billingTypesCollection = collection(db, "billing_types");
      let successCount = 0;

      for (const plantId of formData.plantIds) {
        // Validate Document Type
        if (formData.documentType) {
          const docTypeQuery = query(billingTypesCollection, where("plantId", "==", plantId), where("documentType", "==", formData.documentType.toUpperCase()));
          const docTypeSnap = await getDocs(docTypeQuery);
          if (!docTypeSnap.empty) {
            window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: `Error: Document Type '${formData.documentType}' already exists for Plant ${plantId}.`, isError: true } }));
            setLoading(false);
            return;
          }
        }

        // Validate Charge Types
        for (const category of chargeTypes) {
          const chargeTypeQuery = query(billingTypesCollection, where("plantId", "==", plantId), where("documentCategory", "==", category));
          const chargeTypeSnap = await getDocs(chargeTypeQuery);
          if (!chargeTypeSnap.empty) {
            window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: `Error: Charge Type '${category}' already exists for Plant ${plantId}.`, isError: true } }));
            setLoading(false);
            return;
          }
        }

        // Batch write for the current plant
        const batch = writeBatch(db);
        const recordsToCreate = chargeTypes.length > 0 ? chargeTypes : [null]; // Handle case where only doc type is provided

        for (const category of recordsToCreate) {
          const newRecordRef = doc(billingTypesCollection);
          batch.set(newRecordRef, {
            plantId,
            inventoryType: formData.inventoryType,
            documentType: formData.documentType.toUpperCase(),
            documentCategory: category, // Already uppercased
            createdAt: serverTimestamp(),
          });
          successCount++;
        }
        await batch.commit();
      }
      
      window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: `Billing types defined successfully. ${successCount} record(s) created.`, isError: false } 
      }));
      setFormData(initialData);
    } catch (error) {
      window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: "System Error: Transaction failed", isError: true } 
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
              <div className="sap-input-wrapper">
                <div className="border border-gray-300 bg-white p-2 grid grid-cols-2 gap-x-4 gap-y-1 max-h-[160px] overflow-y-auto">
                  {isPlantsLoading ? (
                    <div className="text-xs text-gray-400 flex items-center gap-2 col-span-2"><Loader2 className="h-3 w-3 animate-spin" /> Loading Plants...</div>
                  ) : plants?.length === 0 ? (
                    <div className="text-xs text-red-500 col-span-2">No plants found. Create a plant first (OP01).</div>
                  ) : (
                    plants?.map(p => (
                      <div key={p.id} className="flex items-center space-x-2 p-1 hover:bg-blue-50 rounded">
                        <Checkbox id={`p-${p.plantId}`} checked={formData.plantIds.includes(p.plantId)} onCheckedChange={() => togglePlant(p.plantId)} />
                        <label htmlFor={`p-${p.plantId}`} className="text-[11px] font-bold cursor-pointer">{p.plantId} - {p.name}</label>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="sap-selection-row">
              <label className="sap-label">Inventory Type</label>
              <div className="sap-input-wrapper max-w-[200px]">
                <Select value={formData.inventoryType} onValueChange={(val) => setFormData({...formData, inventoryType: val})}>
                  <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Service Invoice">Service Invoice</SelectItem>
                    <SelectItem value="Supply Invoice">Supply Invoice</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="sap-selection-row">
              <label className="sap-label">Document Type</label>
              <div className="sap-input-wrapper max-w-[200px]">
                <Input
                  value={formData.documentType}
                  onChange={(e) => setFormData({...formData, documentType: e.target.value.toUpperCase()})}
                />
              </div>
            </div>

            <div className="sap-selection-row items-start">
              <label className="sap-label mt-1">Charge Type(s)</label>
              <div className="sap-input-wrapper max-w-md space-y-2">
                {formData.documentCategories.map((category, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={category}
                      onChange={(e) => updateChargeType(index, e.target.value)}
                      placeholder={`Charge Type ${index + 1}`}
                    />
                    {formData.documentCategories.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => removeChargeType(index)}><Trash2 className="h-3 w-3" /></Button>
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" className="h-6 text-xs gap-1 rounded-none" onClick={addChargeType}>
                  <Plus className="h-3 w-3" /> Add Charge Type
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
      {loading && <div className="fixed bottom-10 right-10 bg-[#333e4f] text-white px-4 py-2 text-xs">PROCESSING...</div>}
    </div>
  );
}
