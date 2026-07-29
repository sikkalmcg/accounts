
"use client";

import { useState, useEffect, useCallback } from "react";
import { useDatabase, addDocumentNonBlocking, useCollection, useMemoDatabase } from "@/database";
import { collection, serverTimestamp, query, where, getDocs } from "@/database/mongo";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

const initialData = {
  plantId: "",
  documentType: "",
  documentCategory: "",
};

export default function VOF01() {
  const db = useDatabase();
  const [formData, setFormData] = useState(initialData);
  const [loading, setLoading] = useState(false);

  const plantsQuery = useMemoDatabase(() => collection(db, "plants"), [db]);
  const { data: plants, isLoading: isPlantsLoading } = useCollection(plantsQuery);

  const handleExecute = useCallback(async () => {
    if (!formData.plantId) {
      window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: "Error: Plant ID is mandatory", isError: true } 
      }));
      return;
    }

    if (!formData.documentType && !formData.documentCategory) {
      window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: "Error: Provide either Document Type or Charge Type", isError: true } 
      }));
      return;
    }

    setLoading(true);
    try {
      // DUPLICATE RESTRICTION: Check if Charge Type exists for this Plant
      if (formData.documentCategory) {
        const q = query(
          collection(db, "billing_types"),
          where("plantId", "==", formData.plantId),
          where("documentCategory", "==", formData.documentCategory.toUpperCase())
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          window.dispatchEvent(new CustomEvent('sap-status', { 
            detail: { text: "Charge Type already exists for this Plant.", isError: true } 
          }));
          setLoading(false);
          return;
        }
      }

      addDocumentNonBlocking(collection(db, "billing_types"), {
        ...formData,
        documentCategory: formData.documentCategory.toUpperCase(),
        documentType: formData.documentType.toUpperCase(),
        createdAt: serverTimestamp(),
      });
      
      window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: "Billing type defined successfully", isError: false } 
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

            <div className="sap-selection-row">
              <label className="sap-label">Document Type</label>
              <div className="sap-input-wrapper max-w-[200px]">
                <Input
                  value={formData.documentType}
                  onChange={(e) => setFormData({...formData, documentType: e.target.value.toUpperCase()})}
                />
              </div>
            </div>

            <div className="sap-selection-row">
              <label className="sap-label">Charge Type</label>
              <div className="sap-input-wrapper max-w-[200px]">
                <Input
                  value={formData.documentCategory}
                  onChange={(e) => setFormData({...formData, documentCategory: e.target.value.toUpperCase()})}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      {loading && <div className="fixed bottom-10 right-10 bg-[#333e4f] text-white px-4 py-2 text-xs">PROCESSING...</div>}
    </div>
  );
}


