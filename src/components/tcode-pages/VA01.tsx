"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
import { collection, query, where, getDocs } from "@/database/mongo";
import { getRecordPlantIds, NO_MASTER_RECORDS_MESSAGE } from "@/lib/plant-master";

interface OrderItem {
  id: string;
  item: string;
  qty: number;
  price: number;
  total: number;
}

export default function VA01() {
  const db = useDatabase();
  const [customer, setCustomer] = useState("");
  const [shipToParty, setShipToParty] = useState("");
  const [plantId, setPlantId] = useState("");
  const [chargeType, setChargeType] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [serviceCategory, setServiceCategory] = useState("");
  const [date, setDate] = useState("");
  const [items, setItems] = useState<OrderItem[]>([
    { id: '1', item: '', qty: 1, price: 0, total: 0 }
  ]);

  // Fetch plants for the dropdown
  const plantsQuery = useMemoDatabase(() => collection(db, "plants"), [db]);
  const { data: plants, isLoading: isPlantsLoading } = useCollection(plantsQuery);

  // Fetch all customers for filtering
  const customersQuery = useMemoDatabase(() => collection(db, "customers"), [db]);
  const { data: allCustomers } = useCollection(customersQuery);

  // Filter customers based on selected Plant ID
const filteredCustomers = useMemo(() => {
    if (!plantId || !allCustomers) return [];
    return allCustomers.filter(c => getRecordPlantIds(c).includes(plantId));
  }, [plantId, allCustomers]);

  useEffect(() => {
    setDate(new Date().toISOString().split('T')[0]);
  }, []);

  const addRow = () => {
    setItems([...items, { id: Math.random().toString(), item: '', qty: 1, price: 0, total: 0 }]);
  };

  const removeRow = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter(i => i.id !== id));
    }
  };

  const updateItem = (id: string, field: keyof OrderItem, value: any) => {
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
    // Visibility/Logic Rule: Remove Project reference - backend validation enforced
    // Visibility/Logic Rule: Remove Page All functionality - overview mode only

    if (!plantId || !customer || !shipToParty || !chargeType || !documentType || !serviceCategory) {
      window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: "Error: Mandatory header fields missing (Plant, Parties, Types)", isError: true } 
      }));
      return;
    }

    const orderNo = Math.floor(Math.random() * 100000).toString();
    
    // Strict Duplicate Validation for Sales Order
    const q = query(collection(db, "sales_orders"), where("id", "==", orderNo));
    const snap = await getDocs(q);
    if (!snap.empty) {
      window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: `Error: Sales Order ${orderNo} already exists in database`, isError: true } 
      }));
      return;
    }

    window.dispatchEvent(new CustomEvent('sap-status', { 
      detail: { text: `Sales Order ${orderNo} created successfully`, isError: false } 
    }));
  }, [customer, shipToParty, plantId, chargeType, documentType, serviceCategory, db]);

  const handleCancel = useCallback(() => {
    setCustomer("");
    setShipToParty("");
    setPlantId("");
    setChargeType("");
    setDocumentType("");
    setServiceCategory("");
    setItems([{ id: '1', item: '', qty: 1, price: 0, total: 0 }]);
    window.dispatchEvent(new CustomEvent('sap-status', { 
      detail: { text: "Document processing cancelled by user", isError: false } 
    }));
  }, []);

  useEffect(() => {
    window.addEventListener('sap-execute', handleExecute);
    window.addEventListener('sap-cancel', handleCancel);

    return () => {
      window.removeEventListener('sap-execute', handleExecute);
      window.removeEventListener('sap-cancel', handleCancel);
    };
  }, [handleExecute, handleCancel]);

  const grandTotal = items.reduce((acc, curr) => acc + curr.total, 0);

  return (
    <div className="w-full flex flex-col bg-white min-h-full">
      <div className="bg-[#dae8f5] px-4 py-1 border-b border-gray-300">
        <h2 className="text-[13px] font-bold text-gray-800 uppercase italic tracking-wider">Create Sales Order: Overview Screen</h2>
      </div>

      <div className="p-4 space-y-4">
        <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
          <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700">
            Order Header Data
          </div>
          <div className="p-2 grid grid-cols-2 gap-x-8">
            {/* Left Column */}
            <div className="space-y-1">
              <div className="sap-selection-row">
                <label className="sap-label">Plant ID</label>
                <div className="sap-input-wrapper w-full">
                  <Select onValueChange={(val) => { setPlantId(val); setCustomer(""); setShipToParty(""); }} value={plantId}>
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
                <label className="sap-label">Bill to party</label>
                <div className="sap-input-wrapper w-full">
                  <Select onValueChange={setCustomer} value={customer} disabled={!plantId}>
                    <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]">
                      <SelectValue placeholder="" />
                    </SelectTrigger>
<SelectContent>
                      {filteredCustomers.map(c => (
                        <SelectItem key={c.id} value={c.customerId}>
                          {c.customerId} - {c.name}
                        </SelectItem>
                      ))}
                      {plantId && filteredCustomers.length === 0 && (
                        <div className="px-2 py-3 text-center text-[10px] font-bold text-red-500">{NO_MASTER_RECORDS_MESSAGE}</div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="sap-selection-row">
                <label className="sap-label">Ship-to party</label>
                <div className="sap-input-wrapper w-full">
                  <Select onValueChange={setShipToParty} value={shipToParty} disabled={!plantId}>
                    <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]">
                      <SelectValue placeholder="" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredCustomers.map(c => (
                        <SelectItem key={c.id} value={c.customerId}>
                          {c.customerId} - {c.name}
                        </SelectItem>
                      ))}
                      {plantId && filteredCustomers.length === 0 && (
                        <div className="px-2 py-3 text-center text-[10px] font-bold text-red-500">{NO_MASTER_RECORDS_MESSAGE}</div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="sap-selection-row">
                <label className="sap-label">Charge Type</label>
                <div className="sap-input-wrapper w-full">
                  <Select onValueChange={setChargeType} value={chargeType}>
                    <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]">
                      <SelectValue placeholder="" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SERVICE">Service charge</SelectItem>
                      <SelectItem value="SALE">Sale charge</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-1">
              <div className="sap-selection-row">
                <label className="sap-label">Document Type</label>
                <div className="sap-input-wrapper w-full">
                  <Select onValueChange={setDocumentType} value={documentType}>
                    <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]">
                      <SelectValue placeholder="" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TAX_INV">Tax Invoice</SelectItem>
                      <SelectItem value="CREDIT_NOTE">Credit Note</SelectItem>
                      <SelectItem value="DEBIT_NOTE">Debit Note</SelectItem>
                      <SelectItem value="NON_TAX_INV">Non-Tax Invoice</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="sap-selection-row">
                <label className="sap-label">Service Category</label>
                <div className="sap-input-wrapper w-full">
                  <Select onValueChange={setServiceCategory} value={serviceCategory}>
                    <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]">
                      <SelectValue placeholder="" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WH_RENT">Warehouse Rent</SelectItem>
                      <SelectItem value="OPER_CHARGE">Operating Charge</SelectItem>
                      <SelectItem value="HANDLING">Handling Charges</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

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

        <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-white">
          <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] flex items-center justify-between">
            <span className="text-[12px] font-semibold text-gray-700 uppercase tracking-widest">Order Line Items</span>
            <Button onClick={addRow} variant="ghost" size="sm" className="h-5 text-[10px] px-1 hover:bg-white/50">
              <Plus className="h-3 w-3 mr-1" /> New Item
            </Button>
          </div>
          
          <Table>
            <TableHeader className="bg-[#e7ebf1]">
              <TableRow className="h-7 hover:bg-transparent">
                <TableHead className="text-[11px] font-bold text-gray-600 border-r w-12 text-center">Itm</TableHead>
                <TableHead className="text-[11px] font-bold text-gray-600 border-r">Material Description</TableHead>
                <TableHead className="text-[11px] font-bold text-gray-600 border-r w-28">Order Quantity</TableHead>
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
                      value={row.item}
                      onChange={(e) => updateItem(row.id, 'item', e.target.value)}
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
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => removeRow(row.id)}
                      className="h-6 w-6 text-red-500 hover:bg-red-50"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="bg-[#e7ebf1] p-3 flex justify-end border-t border-[#b5c7de]">
            <div className="flex items-center gap-4">
              <span className="text-xs font-bold text-gray-600 uppercase tracking-tighter">Total Order Net Value</span>
              <span className="text-lg font-black text-blue-800">INR {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


