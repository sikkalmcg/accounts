
"use client";

import { useState, useEffect, useCallback } from "react";
import { useDatabase, useCollection, useMemoDatabase, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/database";
import { collection, doc } from "@/database/mongo";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function XK02() {
  const db = useDatabase();
  const [selectedId, setSelectedId] = useState("");
  const [formData, setFormData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const vendorsQuery = useMemoDatabase(() => collection(db, "vendors"), [db]);
  const { data: vendors } = useCollection(vendorsQuery);

  const handleSelect = (id: string) => {
    const vendor = vendors?.find(v => v.id === id);
    setFormData({
      ...vendor,
      vendorCode: vendor?.vendorCode || vendor?.vendorId || "",
    });
    setSelectedId(id);
  };

  const handleExecute = useCallback(async () => {
    if (!formData || !selectedId) {
       window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: "Error: No vendor selected for modification", isError: true } 
      }));
      return;
    }

    const normalizedCode = String(formData.vendorCode || "").trim().toUpperCase();
    if (!normalizedCode) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Error: Vendor Code is mandatory", isError: true } }));
      return;
    }

    setLoading(true);
    try {
      const { id, ...dataToUpdate } = formData;
      updateDocumentNonBlocking(doc(db, "vendors", selectedId), { ...dataToUpdate, vendorId: normalizedCode, vendorCode: normalizedCode });
      window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: `Vendor ${formData.vendorId} updated successfully`, isError: false } 
      }));
    } catch (error) {
       window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: "Update failed: Database error", isError: true } 
      }));
    } finally {
      setLoading(false);
    }
  }, [formData, selectedId, db]);

  const handleDelete = async () => {
    if (!selectedId) return;
    if (!confirm("Are you sure you want to delete this vendor master record? This will not affect already processed stock receipts or payment data.")) return;
    
    setLoading(true);
    try {
      deleteDocumentNonBlocking(doc(db, "vendors", selectedId));
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Vendor removed successfully", isError: false } }));
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
          Change Vendor
        </h2>
      </div>

      <div className="p-4 space-y-4">
        <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
          <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700">Selection</div>
          <div className="p-2">
            <div className="sap-selection-row">
              <label className="sap-label">Vendor</label>
              <div className="sap-input-wrapper max-md">
                <Select onValueChange={handleSelect} value={selectedId}>
                  <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]">
                    <SelectValue placeholder="" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors?.map(v => <SelectItem key={v.id} value={v.id}>{v.vendorId} - {v.vendorName}</SelectItem>)}
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
                <span>Vendor Data</span>
                <Button onClick={handleDelete} variant="destructive" size="sm" className="h-6 rounded-none gap-2 uppercase font-bold text-[10px]">
                  <Trash2 className="h-3.5 w-3.5" /> Delete Vendor
                </Button>
              </div>
              <div className="p-2 space-y-1">
                <div className="sap-selection-row">
                  <label className="sap-label">Vendor Code</label>
                  <div className="sap-input-wrapper max-md">
                    <Input value={formData.vendorCode} onChange={(e) => setFormData({...formData, vendorCode: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "")})} />
                  </div>
                </div>
                <div className="sap-selection-row">
                  <label className="sap-label">Vendor Name</label>
                  <div className="sap-input-wrapper max-md">
                    <Input value={formData.vendorName} onChange={(e) => setFormData({...formData, vendorName: e.target.value})} />
                  </div>
                </div>
                <div className="sap-selection-row">
                  <label className="sap-label">Contact</label>
                  <div className="sap-input-wrapper max-w-[200px]">
                    <Input value={formData.contact} onChange={(e) => setFormData({...formData, contact: e.target.value})} />
                  </div>
                </div>
                <div className="sap-selection-row">
                  <label className="sap-label">GSTIN</label>
                  <div className="sap-input-wrapper max-w-[200px]">
                    <Input value={formData.gstin} onChange={(e) => setFormData({...formData, gstin: e.target.value.toUpperCase()})} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      {loading && <div className="fixed bottom-10 right-10 bg-[#333e4f] text-white px-4 py-2 text-xs">UPDATING...</div>}
    </div>
  );
}


