
"use client";

import { useState, useEffect, useCallback } from "react";
import { useDatabase, addDocumentNonBlocking } from "@/database";
import { collection, serverTimestamp, query, where, getDocs } from "@/database/mongo";

const initialData = {
  plantId: "",
  name: "",
  location: "",
};

export default function OP01() {
  const db = useDatabase();
  const [formData, setFormData] = useState(initialData);
  const [loading, setLoading] = useState(false);

  const handleExecute = useCallback(async () => {
    if (!formData.plantId || !formData.name || !formData.location) {
      window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: "Validation Error: All fields are required", isError: true } 
      }));
      return;
    }

    setLoading(true);
    try {
      // Duplicate Restriction Validation
      const q = query(collection(db, "plants"), where("plantId", "==", formData.plantId));
      const snap = await getDocs(q);
      if (!snap.empty) {
        window.dispatchEvent(new CustomEvent('sap-status', { 
          detail: { text: `Error: Plant ID ${formData.plantId} already exists`, isError: true } 
        }));
        setLoading(false);
        return;
      }

      addDocumentNonBlocking(collection(db, "plants"), {
        ...formData,
        createdAt: serverTimestamp(),
      });
      
      window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: `Plant ${formData.plantId} created successfully`, isError: false } 
      }));
      setFormData(initialData);
    } catch (e) {
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
      <div className="sap-header-title">Create Plant</div>

      <div className="p-4 space-y-4">
        <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
          <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700">
            Plant Details
          </div>
          
          <div className="p-2 space-y-1">
            <div className="sap-selection-row">
              <label className="sap-label">Plant ID</label>
              <div className="sap-input-wrapper max-w-[150px]">
                <input
                  type="text"
                  value={formData.plantId}
                  onChange={(e) => setFormData({...formData, plantId: e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 8)})}
                  className="flex h-6 w-full rounded-none border border-gray-400 bg-white px-1.5 py-1 text-xs shadow-inner focus-visible:outline-none focus:bg-[#fff9c4]"
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
      </div>
      {loading && (
        <div className="fixed bottom-10 right-10 bg-[#333e4f] text-white px-4 py-2 text-xs animate-pulse border border-white/20">
          SYSTEM: Creating Plant...
        </div>
      )}
    </div>
  );
}


