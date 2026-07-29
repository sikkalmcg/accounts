
"use client";

import { useState, useEffect, useCallback } from "react";
import { useDatabase, useCollection, useMemoDatabase, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/database";
import { collection, doc } from "@/database/mongo";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2, Trash2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function VOF02() {
  const db = useDatabase();
  const [selectedId, setSelectedId] = useState("");
  const [formData, setFormData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const billingQuery = useMemoDatabase(() => collection(db, "billing_types"), [db]);
  const { data: billingTypes, isLoading: isBillingLoading } = useCollection(billingQuery);

  const plantsQuery = useMemoDatabase(() => collection(db, "plants"), [db]);
  const { data: plants } = useCollection(plantsQuery);

  const handleSelect = (id: string) => {
    const record = billingTypes?.find(b => b.id === id);
    setFormData(record);
    setSelectedId(id);
  };

  const handleExecute = useCallback(async () => {
    if (!formData || !selectedId) {
      window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: "Error: No record selected", isError: true } 
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
      const { id, ...dataToUpdate } = formData;
      updateDocumentNonBlocking(doc(db, "billing_types", selectedId), dataToUpdate);
      window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: "Changes saved successfully", isError: false } 
      }));
    } catch (error) {
      window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: "Update failed", isError: true } 
      }));
    } finally {
      setLoading(false);
    }
  }, [formData, selectedId, db]);

  const handleDelete = async () => {
    if (!selectedId) return;
    if (!confirm("Are you sure you want to delete this billing type definition?")) return;
    
    setLoading(true);
    try {
      deleteDocumentNonBlocking(doc(db, "billing_types", selectedId));
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Record deleted successfully", isError: false } }));
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
          Change Billing Types
        </h2>
      </div>

      <div className="p-4 space-y-4">
        <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
          <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700">Selection</div>
          <div className="p-2">
            <div className="sap-selection-row">
              <label className="sap-label">Select Record</label>
              <div className="sap-input-wrapper max-md">
                <Select onValueChange={handleSelect} value={selectedId}>
                  <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {billingTypes?.map(b => (
                      <SelectItem key={b.id} value={b.id}>
                        Plant: {b.plantId} | Type: {b.documentType || '-'} | Cat: {b.documentCategory || '-'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isBillingLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>
            </div>
          </div>
        </div>

        {formData && (
          <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9] animate-in fade-in duration-300">
            <div className="bg-[#dae8f5] px-3 py-1 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700 flex justify-between items-center">
              <span>Record Data</span>
              <Button onClick={handleDelete} variant="destructive" size="sm" className="h-6 rounded-none gap-2 uppercase font-bold text-[10px]">
                <Trash2 className="h-3.5 w-3.5" /> Delete Record
              </Button>
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
                </div>
              </div>
              <div className="sap-selection-row">
                <label className="sap-label">Document Type</label>
                <Input value={formData.documentType} onChange={(e) => setFormData({...formData, documentType: e.target.value.toUpperCase()})} className="max-w-[200px]" />
              </div>
              <div className="sap-selection-row">
                <label className="sap-label">Charge Type</label>
                <Input value={formData.documentCategory} onChange={(e) => setFormData({...formData, documentCategory: e.target.value.toUpperCase()})} className="max-w-[200px]" />
              </div>
            </div>
          </div>
        )}
      </div>
      {loading && <div className="fixed bottom-10 right-10 bg-[#333e4f] text-white px-4 py-2 text-xs">SAVING...</div>}
    </div>
  );
}


