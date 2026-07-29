
"use client";

import { useState, useEffect, useCallback } from "react";
import { useDatabase, useCollection, useMemoDatabase, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/database";
import { collection, doc } from "@/database/mongo";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OP02() {
  const db = useDatabase();
  const [selectedId, setSelectedId] = useState("");
  const [formData, setFormData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const plantsQuery = useMemoDatabase(() => collection(db, "plants"), [db]);
  const { data: plants } = useCollection(plantsQuery);

  const handleSelect = (id: string) => {
    const plant = plants?.find(p => p.id === id);
    setFormData(plant);
    setSelectedId(id);
  };

  const handleExecute = useCallback(async () => {
    if (!formData || !selectedId) {
       window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: "Please select a plant to edit", isError: true } 
      }));
      return;
    }
    setLoading(true);
    try {
      const { id, ...data } = formData;
      updateDocumentNonBlocking(doc(db, "plants", selectedId), data);
      window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: `Plant ${formData.plantId} updated successfully`, isError: false } 
      }));
    } catch (error) {
      window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: "Update failed: Server connection error", isError: true } 
      }));
    } finally {
      setLoading(false);
    }
  }, [formData, selectedId, db]);

  const handleDelete = async () => {
    if (!selectedId) return;
    if (!confirm("CRITICAL WARNING: Deleting a Plant is not recommended if it has historical transactions. Do you wish to remove this Plant ID from master repository?")) return;
    
    setLoading(true);
    try {
      deleteDocumentNonBlocking(doc(db, "plants", selectedId));
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Plant removed from repository", isError: false } }));
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
          Edit Plant
        </h2>
      </div>

      <div className="p-4 space-y-4">
        <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
          <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700">
            Selection
          </div>
          <div className="p-2">
            <div className="sap-selection-row">
              <label className="sap-label">Select Plant</label>
              <div className="sap-input-wrapper max-w-md">
                <Select onValueChange={handleSelect} value={selectedId}>
                  <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]">
                    <SelectValue placeholder="Choose plant to edit" />
                  </SelectTrigger>
                  <SelectContent>
                    {plants?.map(p => <SelectItem key={p.id} value={p.id}>{p.plantId} - {p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {formData && (
          <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9] animate-in fade-in duration-300">
            <div className="bg-[#dae8f5] px-3 py-1 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700 flex justify-between items-center">
              <span>Plant Data</span>
              <Button onClick={handleDelete} variant="destructive" size="sm" className="h-6 rounded-none gap-2 uppercase font-bold text-[10px]">
                <Trash2 className="h-3.5 w-3.5" /> Delete Plant
              </Button>
            </div>
            <div className="p-2 space-y-1">
              <div className="sap-selection-row">
                <label className="sap-label">Plant ID</label>
                <div className="sap-input-wrapper max-w-[150px]">
                  <input
                    type="text"
                    value={formData.plantId}
                    disabled
                    className="flex h-6 w-full rounded-none border border-gray-400 bg-gray-100 px-1.5 py-1 text-xs shadow-inner cursor-not-allowed"
                  />
                </div>
              </div>
              <div className="sap-selection-row">
                <label className="sap-label">Plant Name</label>
                <div className="sap-input-wrapper max-w-md">
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="flex h-6 w-full rounded-none border border-gray-400 bg-white px-1.5 py-1 text-xs shadow-inner focus-visible:outline-none focus:bg-[#fff9c4]"
                  />
                </div>
              </div>
              <div className="sap-selection-row">
                <label className="sap-label">Plant Location</label>
                <div className="sap-input-wrapper max-w-md">
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({...formData, location: e.target.value})}
                    className="flex h-6 w-full rounded-none border border-gray-400 bg-white px-1.5 py-1 text-xs shadow-inner focus-visible:outline-none focus:bg-[#fff9c4]"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      {loading && <div className="fixed bottom-10 right-10 bg-[#333e4f] text-white px-4 py-2 text-xs">PROCESSING...</div>}
    </div>
  );
}


