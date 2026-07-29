
"use client";

import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useDatabase, useCollection, useMemoDatabase, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/database";
import { collection, doc, query, where, getDocs } from "@/database/mongo";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseGSTIN } from "@/lib/gst-utils";

export default function XD02() {
  const db = useDatabase();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [formData, setFormData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Fetch Customers for Selection
  const customersQuery = useMemoDatabase(() => collection(db, "customers"), [db]);
  const { data: customers } = useCollection(customersQuery);

  // Fetch Plants for Dropdown
  const plantsQuery = useMemoDatabase(() => collection(db, "plants"), [db]);
  const { data: plants, isLoading: isPlantsLoading } = useCollection(plantsQuery);

  const handleSelectCustomer = (id: string) => {
    const customer = customers?.find(c => c.id === id);
    if (customer) {
      setFormData({
        ...customer,
        stateName: customer.stateName || "",
        stateCode: customer.stateCode || "",
        pan: customer.pan || "",
        address: customer.address || "",
      });
      setSelectedCustomerId(id);
    }
  };

  const handleGSTINChange = (val: string) => {
    const gstin = val.toUpperCase().substring(0, 15);
    const parsed = parseGSTIN(gstin);
    
    setFormData((prev: any) => ({
      ...prev,
      gstin,
      ...(parsed ? {
        pan: parsed.pan,
        stateName: parsed.state,
        stateCode: parsed.stateCode,
      } : {
        pan: prev.pan,
        stateName: prev.stateName,
        stateCode: prev.stateCode,
      })
    }));
  };

  const handleExecute = useCallback(async () => {
    if (!formData || !selectedCustomerId) {
       window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: "Error: No customer selected for modification", isError: true } 
      }));
      return;
    }

    setLoading(true);
    try {
      // Duplicate Restriction Validation for Code
      const q = query(collection(db, "customers"), where("customerId", "==", formData.customerId));
      const snap = await getDocs(q);
      const isDuplicate = snap.docs.some(doc => doc.id !== selectedCustomerId);
      
      if (isDuplicate) {
        window.dispatchEvent(new CustomEvent('sap-status', { 
          detail: { text: `Error: Customer Code ${formData.customerId} already exists`, isError: true } 
        }));
        setLoading(false);
        return;
      }

      const customerRef = doc(db, "customers", selectedCustomerId);
      const { id, ...dataToUpdate } = formData;
      updateDocumentNonBlocking(customerRef, dataToUpdate);
      window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: `Customer ${formData.customerId} updated successfully`, isError: false } 
      }));
    } catch (error) {
       window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: "Update failed: Database synchronization error", isError: true } 
      }));
    } finally {
      setLoading(false);
    }
  }, [formData, selectedCustomerId, db]);

  const handleDelete = async () => {
    if (!selectedCustomerId) return;
    if (!confirm("Confirm Deletion: Removing this customer from master data will not affect past invoices. Proceed?")) return;
    
    setLoading(true);
    try {
      deleteDocumentNonBlocking(doc(db, "customers", selectedCustomerId));
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Customer removed successfully", isError: false } }));
      setSelectedCustomerId("");
      setFormData(null);
    } catch (e) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Deletion failed", isError: true } }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const onExecute = () => handleExecute();
    const onCancel = () => {
      setFormData(null);
      setSelectedCustomerId("");
      window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: "Changes discarded", isError: false } 
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
      <div className="bg-[#dae8f5] px-4 py-1 border-b border-gray-300">
        <h2 className="text-[13px] font-bold text-gray-800 uppercase italic tracking-wider">
          CUSTOMER MASTER: CHANGE INITIAL SCREEN
        </h2>
      </div>

      <div className="p-4 space-y-4">
        <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
          <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700">
            Selection
          </div>
          <div className="p-2 space-y-1">
            <div className="sap-selection-row">
              <label className="sap-label">Customer</label>
              <div className="sap-input-wrapper max-w-md">
                <Select onValueChange={handleSelectCustomer} value={selectedCustomerId}>
                  <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]">
                    <SelectValue placeholder="Choose customer to change" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.customerId} - {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {formData && (
          <div className="animate-in fade-in duration-300 space-y-4">
            <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
              <div className="bg-[#dae8f5] px-3 py-1 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700 flex justify-between items-center">
                <span>Customer Data</span>
                <Button onClick={handleDelete} variant="destructive" size="sm" className="h-6 rounded-none gap-2 uppercase font-bold text-[10px]">
                  <Trash2 className="h-3.5 w-3.5" /> Delete Customer
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
                    {isPlantsLoading && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
                  </div>
                </div>

                <div className="sap-selection-row">
                  <label className="sap-label">Customer Code</label>
                  <div className="sap-input-wrapper max-w-[200px]">
                    <Input
                      value={formData.customerId}
                      onChange={(e) => setFormData({...formData, customerId: e.target.value.replace(/[^0-9]/g, "").slice(0, 8)})}
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
                      value={formData.address || ""}
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
        )}
      </div>

      {loading && (
        <div className="fixed bottom-10 right-10 bg-[#333e4f] text-white px-4 py-2 text-xs animate-pulse border border-white/20">
          SYSTEM: Updating Records...
        </div>
      )}
    </div>
  );
}


