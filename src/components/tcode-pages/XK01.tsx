"use client";

import { useState, useEffect, useCallback } from "react";
import { useDatabase, addDocumentNonBlocking, useCollection, useMemoDatabase } from "@/database";
import { collection, serverTimestamp, query, orderBy, limit, getDocs, where } from "@/database/mongo";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const initialData = {
  vendorCode: "",
  vendorName: "",
  contact: "",
  address: "",
  gstin: "",
  plantId: "",
  pan: "",
  bankName: "",
  accountNumber: "",
  ifscCode: "",
};

export default function XK01() {
  const db = useDatabase();
  const [formData, setFormData] = useState(initialData);
  const [loading, setLoading] = useState(false);

  // Fetch plants for the dropdown
  const plantsQuery = useMemoDatabase(() => collection(db, "plants"), [db]);
  const { data: plants, isLoading: isPlantsLoading } = useCollection(plantsQuery);

  const handleExecute = useCallback(async () => {
    if (!formData.vendorCode || !formData.vendorName || !formData.contact || !formData.plantId) {
      window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: "Validation Error: Vendor Code, Vendor Name, Contact, and Plant ID are required", isError: true } 
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


