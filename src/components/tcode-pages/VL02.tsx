"use client";

import { useState, useEffect, useCallback } from "react";
import { useDatabase, useCollection, useMemoDatabase, updateDocumentNonBlocking } from "@/database";
import { collection, doc, query, orderBy } from "@/database/mongo";
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

export default function VL02() {
  const db = useDatabase();
  const [selectedId, setSelectedId] = useState("");
  const [formData, setFormData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const conditionsQuery = useMemoDatabase(() => query(collection(db, "price_conditions"), orderBy("createdAt", "desc")), [db]);
  const { data: conditions, isLoading: isConditionsLoading } = useCollection(conditionsQuery);

  const handleSelect = (id: string) => {
    const record = conditions?.find(r => r.id === id);
    setFormData(record);
    setSelectedId(id);
  };

  const handleExecute = useCallback(async () => {
    if (!formData || !selectedId) {
      window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: "Error: No price condition selected for modification", isError: true } 
      }));
      return;
    }

    setLoading(true);
    try {
      const { id, ...dataToUpdate } = formData;
      updateDocumentNonBlocking(doc(db, "price_conditions", selectedId), dataToUpdate);
      window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: "Price condition updated successfully", isError: false } 
      }));
    } catch (error) {
      window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: "Update failed: Database synchronization error", isError: true } 
      }));
    } finally {
      setLoading(false);
    }
  }, [formData, selectedId, db]);

  useEffect(() => {
    const onExecute = () => handleExecute();
    window.addEventListener('sap-execute', onExecute);
    return () => window.removeEventListener('sap-execute', onExecute);
  }, [handleExecute]);

  return (
    <div className="w-full flex flex-col bg-white min-h-full">
      <div className="bg-[#dae8f5] px-4 py-1 border-b border-gray-300">
        <h2 className="text-[13px] font-bold text-gray-800 uppercase italic tracking-wider">
          Change Price Condition
        </h2>
      </div>

      <div className="p-4 space-y-4">
        <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
          <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700">Selection</div>
          <div className="p-2">
            <div className="sap-selection-row">
              <label className="sap-label">Select Condition</label>
              <div className="sap-input-wrapper max-md">
                <Select onValueChange={handleSelect} value={selectedId}>
                  <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]">
                    <SelectValue placeholder="Choose record to change" />
                  </SelectTrigger>
                  <SelectContent>
                    {conditions?.map(r => (
                      <SelectItem key={r.id} value={r.id}>
                        Plant: {r.plantId} | Cust: {r.customerId} | MATERIAL: {r.materialCode}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isConditionsLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>
            </div>
          </div>
        </div>

        {formData && (
          <div className="space-y-4 animate-in fade-in duration-300">
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
        )}
      </div>
      {loading && <div className="fixed bottom-10 right-10 bg-[#333e4f] text-white px-4 py-2 text-xs">UPDATING CONDITION...</div>}
    </div>
  );
}


