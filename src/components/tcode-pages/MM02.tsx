
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useDatabase, useCollection, useMemoDatabase, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/database";
import { collection, doc } from "@/database/mongo";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const UOM_OPTIONS = ["SQFT", "MT", "KG", "BAG", "BOX", "PCS", "OTHERS"];

export default function MM02() {
  const db = useDatabase();
  const [selectedId, setSelectedId] = useState("");
  const [formData, setFormData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const materialsQuery = useMemoDatabase(() => collection(db, "materials"), [db]);
  const { data: materials } = useCollection(materialsQuery);

  const plantsQuery = useMemoDatabase(() => collection(db, "plants"), [db]);
  const { data: plants, isLoading: isPlantsLoading } = useCollection(plantsQuery);

  // Fetch Billing Types for Document Category dropdown
  const billingQuery = useMemoDatabase(() => collection(db, "billing_types"), [db]);
  const { data: billingTypes, isLoading: isBillingLoading } = useCollection(billingQuery);

  // Filter unique categories based on selected Plant in formData
  const availableCategories = useMemo(() => {
    if (!billingTypes || !formData?.plantId) return [];
    const categories = billingTypes
      .filter(bt => bt.plantId === formData.plantId && bt.documentCategory)
      .map(bt => bt.documentCategory as string);
    return Array.from(new Set(categories));
  }, [billingTypes, formData?.plantId]);

  const handleSelect = (id: string) => {
    const material = materials?.find(m => m.id === id);
    setFormData(material);
    setSelectedId(id);
  };

  const handleExecute = useCallback(async () => {
    if (!formData || !selectedId) {
       window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: "Error: No material selected for modification", isError: true } 
      }));
      return;
    }

    setLoading(true);
    try {
      const { id, ...dataToUpdate } = formData;
      updateDocumentNonBlocking(doc(db, "materials", selectedId), dataToUpdate);
      window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: `Material ${formData.productName} updated successfully`, isError: false } 
      }));
    } catch (error) {
       window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: "Update failed: Database synchronization error", isError: true } 
      }));
    } finally {
      setLoading(false);
    }
  }, [formData, selectedId, db]);

  const handleDelete = async () => {
    if (!selectedId) return;
    if (!confirm("Are you sure you want to delete this material? Historical invoices will not be affected.")) return;
    
    setLoading(true);
    try {
      deleteDocumentNonBlocking(doc(db, "materials", selectedId));
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Material deleted successfully", isError: false } }));
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

  return (
    <div className="w-full flex flex-col bg-white min-h-full">
      <div className="bg-[#dae8f5] px-4 py-1 border-b border-gray-300">
        <h2 className="text-[13px] font-bold text-gray-800 uppercase italic tracking-wider">
          Change Material
        </h2>
      </div>

      <div className="p-4 space-y-4">
        <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
          <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700">Selection</div>
          <div className="p-2">
            <div className="sap-selection-row">
              <label className="sap-label">Material</label>
              <div className="sap-input-wrapper max-md">
                <Select onValueChange={handleSelect} value={selectedId}>
                  <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {materials?.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.productName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {formData && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
              <div className="bg-[#dae8f5] px-3 py-1 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700 flex justify-between items-center">
                <span>General Data</span>
                <Button onClick={handleDelete} variant="destructive" size="sm" className="h-6 rounded-none gap-2 uppercase font-bold text-[10px]">
                  <Trash2 className="h-3.5 w-3.5" /> Delete Material
                </Button>
              </div>
              <div className="p-2 space-y-1">
                <div className="sap-selection-row">
                  <label className="sap-label">Plant ID</label>
                  <div className="sap-input-wrapper max-w-[200px]">
                    <Select 
                      value={formData.plantId} 
                      onValueChange={(val) => setFormData({...formData, plantId: val, documentCategory: ""})}
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
                    {isPlantsLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  </div>
                </div>
                <div className="sap-selection-row">
                  <label className="sap-label">MATERIAL</label>
                  <div className="sap-input-wrapper max-w-md">
                    <Input value={formData.productName} onChange={(e) => setFormData({...formData, productName: e.target.value})} />
                  </div>
                </div>
                <div className="sap-selection-row">
                  <label className="sap-label">HSN/SAC</label>
                  <div className="sap-input-wrapper max-w-[200px]">
                    <Input value={formData.hsnSac} onChange={(e) => setFormData({...formData, hsnSac: e.target.value})} />
                  </div>
                </div>
                <div className="sap-selection-row">
                  <label className="sap-label">UOM</label>
                  <div className="sap-input-wrapper max-w-[200px]">
                    <Select 
                      value={formData.uom} 
                      onValueChange={(val) => setFormData({...formData, uom: val})}
                    >
                      <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {UOM_OPTIONS.map(opt => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="sap-selection-row">
                  <label className="sap-label">Charge Type</label>
                  <div className="sap-input-wrapper max-w-[200px]">
                    <Select 
                      value={formData.documentCategory} 
                      onValueChange={(val) => setFormData({...formData, documentCategory: val})}
                      disabled={!formData.plantId}
                    >
                      <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCategories.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {isBillingLoading && <Loader2 className="h-4 w-4 animate-spin text-blue-600 ml-1" />}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      {loading && <div className="fixed bottom-10 right-10 bg-[#333e4f] text-white px-4 py-2 text-xs">UPDATING MASTER...</div>}
    </div>
  );
}


