
"use client";

import { useState, useEffect, useCallback } from "react";
import { useDatabase, addDocumentNonBlocking, useCollection, useMemoDatabase } from "@/database";
import { collection, serverTimestamp, query, orderBy, limit, getDocs } from "@/database/mongo";
import { Save, Loader2 } from "lucide-react";
import { parseGSTIN } from "@/lib/gst-utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const initialData = {
  plantId: "",
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

  // Fetch plants for the dropdown
  const plantsQuery = useMemoDatabase(() => collection(db, "plants"), [db]);
  const { data: plants, isLoading: isPlantsLoading } = useCollection(plantsQuery);

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
    if (!formData.name || !formData.mobile || !formData.plantId) {
      window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: "Validation Error: Customer Name, Mobile, and Plant ID are required", isError: true } 
      }));
      return;
    }

    setLoading(true);
    try {
      const customersRef = collection(db, "customers");
      const q = query(customersRef, orderBy("customerId", "desc"), limit(1));
      const snap = await getDocs(q);
      
      let nextId = 30000000;
      if (!snap.empty) {
        const lastIdStr = snap.docs[0].data().customerId;
        const lastId = parseInt(lastIdStr);
        if (!isNaN(lastId) && lastId >= 30000000) {
          nextId = lastId + 1;
        }
      }
      
      const customerId = nextId.toString();

      addDocumentNonBlocking(collection(db, "customers"), {
        ...formData,
        customerId,
        createdAt: serverTimestamp(),
      });
      
      window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: `Customer ${customerId} created successfully`, isError: false } 
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


