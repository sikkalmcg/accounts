"use client";

import { useState, useEffect, useCallback } from "react";
import { useDatabase, addDocumentNonBlocking, useCollection, useMemoDatabase } from "@/database";
import { collection, serverTimestamp, query, where, getDocs } from "@/database/mongo";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";

const rows = [
  { label: "Basic Price", codeKey: "basicPriceCode", descKey: "basicPriceDesc" },
  { label: "Transit Charge", codeKey: "transitChargeCode", descKey: "transitChargeDesc" },
  { label: "Customer Freight", codeKey: "customerFreightCode", descKey: "customerFreightDesc" },
  { label: "Vendor Freight", codeKey: "vendorFreightCode", descKey: "vendorFreightDesc" },
  { label: "Special Discount", codeKey: "specialDiscountCode", descKey: "specialDiscountDesc" },
  { label: "Offer Discount", codeKey: "offerDiscountCode", descKey: "offerDiscountDesc" },
  { label: "Cash Discount", codeKey: "cashDiscountCode", descKey: "cashDiscountDesc" },
  { label: "Depot Charge", codeKey: "depotChargeCode", descKey: "depotChargeDesc" },
];

const initialData = {
  plantId: "",
  customerId: "",
  materialCode: "",
  basicPriceCode: "",
  basicPriceDesc: "",
  transitChargeCode: "",
  transitChargeDesc: "",
  customerFreightCode: "",
  customerFreightDesc: "",
  vendorFreightCode: "",
  vendorFreightDesc: "",
  specialDiscountCode: "",
  specialDiscountDesc: "",
  offerDiscountCode: "",
  offerDiscountDesc: "",
  cashDiscountCode: "",
  cashDiscountDesc: "",
  depotChargeCode: "",
  depotChargeDesc: "",
};

export default function VL01() {
  const db = useDatabase();
  const [formData, setFormData] = useState(initialData);
  const [loading, setLoading] = useState(false);

  // Fetch Master Data for Dropdowns
  const plantsQuery = useMemoDatabase(() => collection(db, "plants"), [db]);
  const { data: plants, isLoading: isPlantsLoading } = useCollection(plantsQuery);

  const customersQuery = useMemoDatabase(() => collection(db, "customers"), [db]);
  const { data: customers } = useCollection(customersQuery);

  const materialsQuery = useMemoDatabase(() => collection(db, "materials"), [db]);
  const { data: materials } = useCollection(materialsQuery);

  const handleExecute = useCallback(async () => {
    if (!formData.plantId || !formData.customerId || !formData.materialCode) {
      window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: "Validation Error: Plant, Customer and MATERIAL are required", isError: true } 
      }));
      return;
    }

    setLoading(true);
    try {
      // Check for existing condition for this combination
      const q = query(
        collection(db, "price_conditions"), 
        where("plantId", "==", formData.plantId),
        where("customerId", "==", formData.customerId),
        where("materialCode", "==", formData.materialCode)
      );
      
      const snap = await getDocs(q);
      if (!snap.empty) {
        window.dispatchEvent(new CustomEvent('sap-status', { 
          detail: { text: "Error: Price condition already exists for this combination", isError: true } 
        }));
        setLoading(false);
        return;
      }

      addDocumentNonBlocking(collection(db, "price_conditions"), {
        ...formData,
        createdAt: serverTimestamp(),
      });
      
      window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: "Price condition record created successfully", isError: false } 
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
          Create Price Condition
        </h2>
      </div>

      <div className="p-4 space-y-4">
        <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
          <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700">
            Selection Criteria
          </div>
          
          <div className="p-2 space-y-1">
            <div className="sap-selection-row">
              <label className="sap-label">Plant ID</label>
              <div className="sap-input-wrapper max-w-[200px]">
                <Select value={formData.plantId} onValueChange={(val) => setFormData({...formData, plantId: val})}>
                  <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]">
                    <SelectValue placeholder="" />
                  </SelectTrigger>
                  <SelectContent>
                    {plants?.map(p => <SelectItem key={p.id} value={p.plantId}>{p.plantId} - {p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {isPlantsLoading && <Loader2 className="h-3 w-3 animate-spin" />}
              </div>
            </div>

            <div className="sap-selection-row">
              <label className="sap-label">Customer</label>
              <div className="sap-input-wrapper max-w-md">
                <Select value={formData.customerId} onValueChange={(val) => setFormData({...formData, customerId: val})}>
                  <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]">
                    <SelectValue placeholder="" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers?.map(c => <SelectItem key={c.id} value={c.customerId}>{c.customerId} - {c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="sap-selection-row">
              <label className="sap-label">MATERIAL</label>
              <div className="sap-input-wrapper max-w-md">
                <Select value={formData.materialCode} onValueChange={(val) => setFormData({...formData, materialCode: val})}>
                  <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]">
                    <SelectValue placeholder="" />
                  </SelectTrigger>
                  <SelectContent>
                    {materials?.map(m => (
                      <SelectItem key={m.id} value={m.productName}>
                        {m.productName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-white">
          <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700">
            Price Condition Details
          </div>
          <Table>
            <TableHeader className="bg-[#e7ebf1]">
              <TableRow className="h-7 hover:bg-transparent">
                <TableHead className="text-[11px] font-bold text-gray-600 border-r w-48">Condition Type</TableHead>
                <TableHead className="text-[11px] font-bold text-gray-600 border-r w-48">Code</TableHead>
                <TableHead className="text-[11px] font-bold text-gray-600">Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.label} className="h-7 hover:bg-blue-50/30">
                  <TableCell className="p-0 px-2 border-r text-[11px] font-medium text-gray-700 bg-gray-50/50">
                    {row.label}
                  </TableCell>
                  <TableCell className="p-0 border-r">
                    <input
                      type="text"
                      value={(formData as any)[row.codeKey]}
                      onChange={(e) => setFormData({...formData, [row.codeKey]: e.target.value})}
                      className="w-full h-full px-2 border-none shadow-none focus:bg-[#fff9c4] focus:outline-none text-xs font-mono"
                    />
                  </TableCell>
                  <TableCell className="p-0">
                    <input
                      type="text"
                      value={(formData as any)[row.descKey]}
                      onChange={(e) => setFormData({...formData, [row.descKey]: e.target.value})}
                      className="w-full h-full px-2 border-none shadow-none focus:bg-[#fff9c4] focus:outline-none text-xs"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {loading && (
        <div className="fixed bottom-10 right-10 bg-[#333e4f] text-white px-4 py-2 text-xs">
          SAVING PRICE CONDITION...
        </div>
      )}
    </div>
  );
}


