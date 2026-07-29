"use client";

import { useState, useEffect, useCallback } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { useDatabase, useCollection, useMemoDatabase } from "@/database";
import { collection } from "@/database/mongo";

interface POItem {
  id: string;
  material: string;
  qty: number;
  price: number;
  total: number;
}

export default function ME21N() {
  const db = useDatabase();
  const [vendorId, setVendorId] = useState("");
  const [plantId, setPlantId] = useState("");
  const [date, setDate] = useState("");
  const [items, setItems] = useState<POItem[]>([
    { id: '1', material: '', qty: 1, price: 0, total: 0 }
  ]);

  // Fetch Master Data
  const vendorsQuery = useMemoDatabase(() => collection(db, "vendors"), [db]);
  const { data: vendors } = useCollection(vendorsQuery);

  const plantsQuery = useMemoDatabase(() => collection(db, "plants"), [db]);
  const { data: plants, isLoading: isPlantsLoading } = useCollection(plantsQuery);

  useEffect(() => {
    setDate(new Date().toISOString().split('T')[0]);
  }, []);

  const addRow = () => {
    setItems([...items, { id: Math.random().toString(), material: '', qty: 1, price: 0, total: 0 }]);
  };

  const removeRow = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter(i => i.id !== id));
    }
  };

  const updateItem = (id: string, field: keyof POItem, value: any) => {
    setItems(items.map(i => {
      if (i.id === id) {
        const updated = { ...i, [field]: value };
        if (field === 'qty' || field === 'price') {
          updated.total = (Number(updated.qty) || 0) * (Number(updated.price) || 0);
        }
        return updated;
      }
      return i;
    }));
  };

  const handleExecute = useCallback(async () => {
    // Visibility/Logic Rule: Remove Project reference - Procurement alignment
    if (!vendorId || !plantId) {
      window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: "Error: Vendor and Plant are mandatory fields for Purchase Order", isError: true } 
      }));
      return;
    }

    const poNo = "45" + Math.floor(Math.random() * 10000000).toString();
    
    window.dispatchEvent(new CustomEvent('sap-status', { 
      detail: { text: `Standard PO ${poNo} created successfully`, isError: false } 
    }));
    
    // Reset form
    setVendorId("");
    setPlantId("");
    setItems([{ id: '1', material: '', qty: 1, price: 0, total: 0 }]);
  }, [vendorId, plantId]);

  useEffect(() => {
    window.addEventListener('sap-execute', handleExecute);
    return () => window.removeEventListener('sap-execute', handleExecute);
  }, [handleExecute]);

  const grandTotal = items.reduce((acc, curr) => acc + curr.total, 0);

  return (
    <div className="w-full flex flex-col bg-white min-h-full">
      <div className="bg-[#dae8f5] px-4 py-1 border-b border-gray-300">
        <h2 className="text-[13px] font-bold text-gray-800 uppercase italic tracking-wider">Create Purchase Order: Header & Item Overview</h2>
      </div>

      <div className="p-4 space-y-4">
        {/* Header Data - Clean Implementation without Project Reference */}
        <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
          <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700">
            PO Header Information
          </div>
          <div className="p-2 grid grid-cols-2 gap-x-8">
            <div className="space-y-1">
              <div className="sap-selection-row">
                <label className="sap-label">Vendor</label>
                <div className="sap-input-wrapper w-full">
                  <Select onValueChange={setVendorId} value={vendorId}>
                    <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]">
                      <SelectValue placeholder="" />
                    </SelectTrigger>
                    <SelectContent>
                      {vendors?.map(v => (
                        <SelectItem key={v.id} value={v.vendorId}>
                          {v.vendorId} - {v.vendorName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="sap-selection-row">
                <label className="sap-label">Purch. Plant</label>
                <div className="sap-input-wrapper w-full">
                  <Select onValueChange={setPlantId} value={plantId}>
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
            </div>
            <div className="space-y-1">
              <div className="sap-selection-row">
                <label className="sap-label">Document Date</label>
                <div className="sap-input-wrapper w-full">
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="flex h-6 w-full rounded-none border border-gray-400 bg-white px-1.5 py-1 text-xs shadow-inner focus:bg-[#fff9c4] focus-visible:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-white">
          <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] flex items-center justify-between">
            <span className="text-[12px] font-semibold text-gray-700 uppercase">Purchase Order Items</span>
            <Button onClick={addRow} variant="ghost" size="sm" className="h-5 text-[10px] px-1 hover:bg-white/50">
              <Plus className="h-3 w-3 mr-1" /> Add Row
            </Button>
          </div>
          
          <Table>
            <TableHeader className="bg-[#e7ebf1]">
              <TableRow className="h-7 hover:bg-transparent">
                <TableHead className="text-[11px] font-bold text-gray-600 border-r w-12 text-center">Pos</TableHead>
                <TableHead className="text-[11px] font-bold text-gray-600 border-r">Material Description</TableHead>
                <TableHead className="text-[11px] font-bold text-gray-600 border-r w-32">Quantity</TableHead>
                <TableHead className="text-[11px] font-bold text-gray-600 border-r w-32 text-right">Net Price</TableHead>
                <TableHead className="text-[11px] font-bold text-gray-600 text-right w-40">Value (INR)</TableHead>
                <TableHead className="w-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((row, idx) => (
                <TableRow key={row.id} className="h-7 hover:bg-blue-50/30">
                  <TableCell className="p-0 border-r text-center text-xs text-gray-500">{(idx + 1) * 10}</TableCell>
                  <TableCell className="p-0 border-r">
                    <input
                      type="text"
                      value={row.material}
                      onChange={(e) => updateItem(row.id, 'material', e.target.value)}
                      className="w-full h-full px-2 border-none shadow-none focus:bg-[#fff9c4] focus:outline-none text-xs"
                    />
                  </TableCell>
                  <TableCell className="p-0 border-r">
                    <input
                      type="number"
                      value={row.qty}
                      onChange={(e) => updateItem(row.id, 'qty', e.target.value)}
                      className="w-full h-full px-2 border-none shadow-none focus:bg-[#fff9c4] focus:outline-none text-right text-xs"
                    />
                  </TableCell>
                  <TableCell className="p-0 border-r">
                    <input
                      type="number"
                      value={row.price}
                      onChange={(e) => updateItem(row.id, 'price', e.target.value)}
                      className="w-full h-full px-2 border-none shadow-none focus:bg-[#fff9c4] focus:outline-none text-right text-xs"
                    />
                  </TableCell>
                  <TableCell className="py-0 px-2 text-right text-xs font-bold text-blue-900 bg-gray-50/50">
                    {row.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="p-0 text-center">
                    <Button variant="ghost" size="icon" onClick={() => removeRow(row.id)} className="h-6 w-6 text-red-500 hover:bg-red-50">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="bg-[#e7ebf1] p-2 flex justify-end border-t border-[#b5c7de]">
            <div className="flex items-center gap-4">
              <span className="text-[11px] font-bold text-gray-600 uppercase tracking-tighter">Total PO Net Value</span>
              <span className="text-sm font-black text-blue-800">INR {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


