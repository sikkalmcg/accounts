
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useDatabase, useCollection, useMemoDatabase, updateDocumentNonBlocking } from "@/database";
import { collection, doc, query, where, getDocs } from "@/database/mongo";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Loader2, Search, FileEdit, Lock, AlertTriangle, Columns, X, ChevronDown } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { toSAPDate, toInputDate } from "@/lib/date-utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MonthYearPicker } from "@/components/ui/month-year-picker";

interface InvoiceItem {
  id: string;
  desc: string;
  activity: string;
  hsn: string;
  qty: string;
  uom: string;
  rate: string;
  amount: number;
  gstRate: number;
  customValues: string[];
}

interface PricingOption {
  materialCode: string;
  hsn: string;
  uom: string;
  price: number;
  gstRate: number;
}

export default function VF02() {
  const db = useDatabase();

  // Selection State
  const [searchInvoiceNo, setSearchInvoiceNo] = useState("");
  const [searchPlantId, setSearchPlantId] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [selectedDocId, setSelectedId] = useState<string | null>(null);
  const [invoiceRecord, setInvoiceRecord] = useState<any>(null);

  // Form State
  const [plantId, setPlantId] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [billPeriod, setBillPeriod] = useState("");
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  
  const [docType, setDocType] = useState("");
  const [docCategory, setDocCategory] = useState("");
  const [billType, setBillType] = useState("BILL UNDER F.C.M.");
  const [inventoryType, setInventoryType] = useState("");
  const [billTo, setBillTo] = useState(""); // Consignee
  const [shipTo, setShipTo] = useState(""); // Ship to Party
  const [isShipToApplicable, setIsShipToApplicable] = useState(false);
  const [note, setNote] = useState("");
  
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [customHeaders, setCustomHeaders] = useState<string[]>([]);
  
  // Master Data State
  const [assignedPlantId, setAssignedPlantId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [availableOptions, setAvailableOptions] = useState<PricingOption[]>([]);
  const [isFetchingOptions, setIsFetchingOptions] = useState(false);

  // Authorization Check
  useEffect(() => {
    const stored = localStorage.getItem("sikka_user");
    if (stored) {
      const parsed = JSON.parse(stored);
      const isSysAdmin = parsed.username === "ajaysomra" || parsed.role === 'admin';
      setIsAdmin(isSysAdmin);
      setAssignedPlantId(parsed.assignedPlantId || "");
      if (!isSysAdmin && parsed.assignedPlantId) {
        setSearchPlantId(parsed.assignedPlantId);
      }
    }
  }, []);

  const docLabels = useMemo(() => {
    const t = docType.toUpperCase();
    if (t.includes("CREDIT NOTE")) return { no: "Credit Note Number", date: "Date" };
    if (t.includes("DEBIT NOTE")) return { no: "Debit Note Number", date: "Date" };
    if (t.includes("DELIVERY CHALLAN")) return { no: "Delivery Challan Number", date: "Date" };
    return { no: "Invoice Number", date: "Date" };
  }, [docType]);

  const isIrnGenerated = !!invoiceRecord?.irnNumber;
  const isNonTax = docType?.toUpperCase() === "NON-TAX INVOICE" || docType?.toUpperCase() === "NON TAX INVOICE";

  // Master Data Fetching
  const plantsQuery = useMemoDatabase(() => collection(db, "plants"), [db]);
  const { data: plants } = useCollection(plantsQuery);
  const billingQuery = useMemoDatabase(() => collection(db, "billing_types"), [db]);
  const { data: billingTypes } = useCollection(billingQuery);
  const customersQuery = useMemoDatabase(() => collection(db, "customers"), [db]);
  const { data: customers } = useCollection(customersQuery);
  const firmsQuery = useMemoDatabase(() => collection(db, "firms"), [db]);
  const { data: firms } = useCollection(firmsQuery);
  const materialsQuery = useMemoDatabase(() => collection(db, "materials"), [db]);
  const { data: materials } = useCollection(materialsQuery);

  // Fetch pricing options
  useEffect(() => {
    async function fetchOptions() {
      if (!plantId || !docCategory || !billTo) {
        setAvailableOptions([]);
        return;
      }
      setIsFetchingOptions(true);
      try {
        const q = query(
          collection(db, "pricing"),
          where("plantId", "==", plantId),
          where("documentCategory", "==", docCategory),
          where("customerCode", "==", billTo)
        );
        const snap = await getDocs(q);
        const options: PricingOption[] = snap.docs.map(doc => {
          const data = doc.data();
          const matMaster = materials?.find(m => m.productName === data.materialCode);
          return {
            materialCode: data.materialCode || "",
            hsn: data.hsnSac || matMaster?.hsnSac || "",
            uom: matMaster?.uom || "PCS",
            price: data.price || 0,
            gstRate: Number(data.gstRate) || 0
          };
        });
        setAvailableOptions(options);
      } catch (e) {
        console.error("Pricing fetch failed", e);
      } finally {
        setIsFetchingOptions(false);
      }
    }
    fetchOptions();
  }, [plantId, docCategory, billTo, db, materials]);

  const handleSearch = async () => {
    if (!searchInvoiceNo || !searchPlantId) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Enter Number and Plant ID", isError: true } }));
      return;
    }

    setIsSearching(true);
    try {
      const q = query(collection(db, "sales_invoices"), 
        where("invoiceNumber", "==", searchInvoiceNo.toUpperCase()), 
        where("plantId", "==", searchPlantId)
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: `Document ${searchInvoiceNo} not found`, isError: true } }));
        setSelectedId(null);
        setInvoiceRecord(null);
      } else {
        const data = snap.docs[0].data();
        setSelectedId(snap.docs[0].id);
        setInvoiceRecord(data);
        setPlantId(data.plantId);
        setInvoiceNo(data.invoiceNumber);
        setInvoiceDate(toInputDate(data.invoiceDate));
        setBillPeriod(data.billMonth || "");
        setDocType(data.docType || "");
        setDocCategory(data.docCategory || "");
        setBillType(data.billType || "BILL UNDER F.C.M.");
        setInventoryType(data.inventoryType || "");
        setBillTo(data.billTo || "");
        setNote(data.note || "");
        
        if (data.shipTo && data.shipTo !== data.billTo) {
          setIsShipToApplicable(true);
          setShipTo(data.shipTo);
        } else {
          setIsShipToApplicable(false);
          setShipTo("");
        }
        
        setItems(data.items || []);
        setCustomHeaders(data.customHeaders || []);
        window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Document retrieved successfully", isError: false } }));
      }
    } catch (e) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Search failed: Server error", isError: true } }));
    } finally {
      setIsSearching(false);
    }
  };

  const totals = useMemo(() => {
    const taxableAmount = items.reduce((acc, i) => acc + (i.amount || 0), 0);
    const totalQty = items.reduce((acc, i) => acc + (Number(i.qty) || 0), 0);
    
    if (isNonTax) {
      return { taxableAmount, totalQty, cgst: 0, sgst: 0, igst: 0, grossAmount: taxableAmount, isInterstate: false, avgGst: 0 };
    }

    const selectedFirm = firms?.find(f => f.plantId === plantId);
    const selectedCustomer = customers?.find(c => c.customerId === billTo);
    const firmStateCode = selectedFirm?.gstin?.substring(0, 2);
    const custStateCode = selectedCustomer?.gstin?.substring(0, 2);
    const isInterstate = firmStateCode !== custStateCode && firmStateCode !== undefined;
    
    let cgst = 0, sgst = 0, igst = 0;
    let totalGstPercent = 0;

    items.forEach(item => {
      const itemAmount = item.amount || 0;
      const rate = item.gstRate || 0;
      totalGstPercent = Math.max(totalGstPercent, rate);

      if (!isInterstate) {
        cgst += (itemAmount * (rate / 100)) / 2;
        sgst += (itemAmount * (rate / 100)) / 2;
      } else {
        igst += (itemAmount * (rate / 100));
      }
    });

    return { 
      taxableAmount, 
      totalQty, 
      cgst, 
      sgst, 
      igst, 
      grossAmount: taxableAmount + cgst + sgst + igst,
      isInterstate,
      avgGst: totalGstPercent
    };
  }, [items, firms, customers, billTo, plantId, isNonTax]);

  const updateItem = (id: string, field: keyof InvoiceItem | number, val: string) => {
    if (isIrnGenerated) return;
    setItems(prev => prev.map(i => {
      if (i.id === id) {
        if (typeof field === 'number') {
          const updatedCustom = [...(i.customValues || [])];
          updatedCustom[field] = val;
          return { ...i, customValues: updatedCustom };
        }

        let updated = { ...i, [field]: val };
        if (field === 'desc') {
          const opt = availableOptions.find(o => o.materialCode === val);
          if (opt) {
            updated.hsn = opt.hsn;
            updated.rate = String(opt.price);
            updated.uom = opt.uom;
            updated.gstRate = opt.gstRate;
          }
        }
        if (field === 'qty' || field === 'rate' || field === 'desc') {
          updated.amount = (Number(updated.qty) || 0) * (Number(updated.rate) || 0);
        }
        return updated;
      }
      return i;
    }));
  };

  const handleExecute = useCallback(() => {
    if (!selectedDocId || isIrnGenerated) return;

    const d = new Date(invoiceDate);
    const m = d.getMonth();
    const y = d.getFullYear();
    const fyBase = m >= 3 ? y : y - 1;
    const billYear = `${fyBase}-${(fyBase + 1).toString().slice(-2)}`;

    const consignee = customers?.find(c => c.customerId === billTo);
    const shipToParty = customers?.find(c => c.customerId === (isShipToApplicable ? shipTo : billTo));

    const snapshotBillTo = consignee ? {
      name: consignee.name, address: consignee.address, gstin: consignee.gstin,
      stateName: consignee.stateName, stateCode: consignee.stateCode, pan: consignee.pan
    } : null;

    const snapshotShipTo = shipToParty ? {
      name: shipToParty.name, address: shipToParty.address, gstin: shipToParty.gstin,
      stateName: shipToParty.stateName, stateCode: shipToParty.stateCode, pan: shipToParty.pan
    } : snapshotBillTo;

    updateDocumentNonBlocking(doc(db, "sales_invoices", selectedDocId), {
      invoiceDate: toSAPDate(invoiceDate), 
      billMonth: billPeriod, 
      billYear, 
      docType, 
      docCategory, 
      billType,
      inventoryType,
      billTo, 
      shipTo: (isShipToApplicable ? shipTo : billTo) || billTo,
      items, 
      totals,
      customHeaders,
      note,
      snapshotBillTo,
      snapshotShipTo,
      updatedAt: new Date().toISOString()
    });

    window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: `Document ${invoiceNo} updated successfully`, isError: false } }));
  }, [db, selectedDocId, isIrnGenerated, invoiceDate, billPeriod, docType, docCategory, billType, billTo, shipTo, isShipToApplicable, items, totals, invoiceNo, customHeaders, note, customers]);

  useEffect(() => {
    const onExec = () => handleExecute();
    window.addEventListener('sap-execute', onExec);
    return () => window.removeEventListener('sap-execute', onExec);
  }, [handleExecute]);

  const filteredBilling = useMemo(() => billingTypes?.filter(b => b.plantId === plantId) || [], [billingTypes, plantId]);
  const filteredCustomers = useMemo(() => customers?.filter(c => c.plantId === plantId) || [], [customers, plantId]);

  return (
    <div className="w-full flex flex-col bg-white min-h-full">
      <div className="bg-[#dae8f5] px-4 py-1 border-b border-gray-300">
        <h2 className="text-[13px] font-bold text-gray-800 uppercase italic tracking-wider">
          Change Billing Document
        </h2>
      </div>

      <div className="p-4 space-y-4">
        <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
          <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700 flex items-center gap-2">
            <Search className="h-3.5 w-3.5" /> Selection
          </div>
          <div className="p-3 grid grid-cols-3 gap-4">
            <div className="sap-selection-row">
              <label className="sap-label w-32">Number</label>
              <Input value={searchInvoiceNo} onChange={e => setSearchInvoiceNo(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} />
            </div>
            <div className="sap-selection-row">
              <label className="sap-label w-24">Plant</label>
              <Select value={searchPlantId} onValueChange={setSearchPlantId} disabled={!isAdmin}>
                <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {plants?.map(p => <SelectItem key={p.id} value={p.plantId}>{p.plantId} - {p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSearch} disabled={isSearching} variant="outline" className="h-6 rounded-none text-xs border-gray-400 gap-2">
              {isSearching ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileEdit className="h-3 w-3" />}
              Fetch Document
            </Button>
          </div>
        </div>

        {selectedDocId && (
          <div className="space-y-4 animate-in fade-in duration-300">
            {isIrnGenerated && (
              <Alert variant="destructive" className="rounded-none border-red-200 bg-red-50 py-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle className="text-xs font-black uppercase">Document Locked</AlertTitle>
                <AlertDescription className="text-[11px] font-bold">
                  Invoice modification is not allowed after IRN generation. Sensitive fields are read-only.
                </AlertDescription>
              </Alert>
            )}

            <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
              <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700 flex justify-between items-center">
                <span>Billing Header Details</span>
                <span className="flex items-center gap-1 text-emerald-700 text-[10px] font-bold uppercase tracking-widest">
                  <Lock className="h-3 w-3" /> Locked to Plant: {plantId}
                </span>
              </div>
              <div className="p-2 grid grid-cols-2 gap-x-8">
                <div className="space-y-1">
                  <div className="sap-selection-row"><label className="sap-label">{docLabels.no}</label><Input value={invoiceNo} disabled className="bg-gray-100" /></div>
                  <div className="sap-selection-row"><label className="sap-label">Date</label><Input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} disabled={isIrnGenerated} /></div>
                  <div className="sap-selection-row">
                    <label className="sap-label">Consignee (Bill to)</label>
                    <Select value={billTo} onValueChange={(v) => { setBillTo(v); }} disabled={isIrnGenerated}>
                      <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]"><SelectValue /></SelectTrigger>
                      <SelectContent>{filteredCustomers.map(c => <SelectItem key={c.id} value={c.customerId}>{c.customerId} - {c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  
                  <div className="sap-selection-row">
                    <label className="sap-label">Ship to Party Applicable?</label>
                    <div className="sap-input-wrapper h-6 flex items-center">
                      <Checkbox 
                        checked={isShipToApplicable} 
                        onCheckedChange={(v) => {
                          if (isIrnGenerated) return;
                          setIsShipToApplicable(!!v);
                          if (!v) setShipTo("");
                        }} 
                        disabled={isIrnGenerated}
                      />
                      <span className="text-[10px] text-gray-400 ml-2 italic">(Toggle if Ship-to is different from Consignee)</span>
                    </div>
                  </div>

                  {isShipToApplicable && (
                    <div className="sap-selection-row animate-in slide-in-from-top-1 duration-200">
                      <label className="sap-label">Ship to Party</label>
                      <Select value={shipTo} onValueChange={setShipTo} disabled={isIrnGenerated}>
                        <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]"><SelectValue /></SelectTrigger>
                        <SelectContent>{filteredCustomers.map(c => <SelectItem key={c.id} value={c.customerId}>{c.customerId} - {c.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <div className="sap-selection-row">
                    <label className="sap-label">Working Month</label>
                    <div className="w-full">
                      <Popover open={isPickerOpen} onOpenChange={setIsPickerOpen}>
                        <PopoverTrigger asChild>
                          <button 
                            disabled={isIrnGenerated}
                            className="flex h-6 w-full items-center justify-between rounded-none border border-gray-400 bg-white px-1.5 py-1 text-xs shadow-inner focus:bg-[#fff9c4] focus:outline-none hover:bg-gray-50 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
                          >
                            <span className="font-bold text-blue-900">{billPeriod}</span>
                            <ChevronDown className="h-3 w-3 text-gray-400" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 border-none bg-transparent" align="start" sideOffset={5}>
                          <MonthYearPicker 
                            value={billPeriod} 
                            onChange={(val) => {
                              setBillPeriod(val);
                              setIsPickerOpen(false);
                            }} 
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  <div className="sap-selection-row">
                    <label className="sap-label">Document Type</label>
                    <Select value={docType} onValueChange={setDocType} disabled={isIrnGenerated}>
                      <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]"><SelectValue /></SelectTrigger>
                      <SelectContent>{filteredBilling.filter(b => b.documentType).map(b => <SelectItem key={b.id} value={b.documentType!}>{b.documentType}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="sap-selection-row">
                    <label className="sap-label">Charge Type</label>
                    <Select value={docCategory} onValueChange={v => { setDocCategory(v); setItems([]); }} disabled={isIrnGenerated}>
                      <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]"><SelectValue /></SelectTrigger>
                      <SelectContent>{filteredBilling.filter(b => b.documentCategory).map(b => <SelectItem key={b.id} value={b.documentCategory!}>{b.documentCategory}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="sap-selection-row">
                    <label className="sap-label">Bill Type</label>
                    <Select value={billType} onValueChange={setBillType} disabled={isIrnGenerated}>
                      <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BILL UNDER F.C.M.">BILL UNDER F.C.M.</SelectItem>
                        <SelectItem value="BILL UNDER R.C.M.">BILL UNDER R.C.M.</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sap-selection-row">
                    <label className="sap-label">Inventory Type</label>
                    <Select value={inventoryType} onValueChange={setInventoryType} disabled={isIrnGenerated}>
                      <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Service Invoice">Service Invoice</SelectItem>
                        <SelectItem value="Supply Invoice">Supply Invoice</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-white relative min-h-[200px]">
              {isFetchingOptions && <div className="absolute inset-0 bg-white/60 z-20 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>}
              <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-[12px] font-semibold text-gray-700 uppercase">Billing Items</span>
                  {customHeaders.map((h, i) => (
                    <div key={i} className="bg-blue-50 text-[9px] font-black text-blue-800 px-2 py-0.5 border border-blue-200 uppercase tracking-tighter">
                      {h}
                    </div>
                  ))}
                </div>
                {!isIrnGenerated && (
                  <Button onClick={() => setItems([...items, { id: Math.random().toString(), desc: '', activity: '', hsn: '', qty: '', uom: 'PCS', rate: '0', amount: 0, gstRate: 0, customValues: [] }])} variant="ghost" size="sm" className="h-5 text-[10px] hover:bg-white/50"><Plus className="h-3 w-3 mr-1" /> Add Row</Button>
                )}
              </div>
              <Table>
                <TableHeader className="bg-[#e7ebf1]">
                  <TableRow className="h-7">
                    <TableHead className="text-[11px] font-bold border-r w-10 text-center">#</TableHead>
                    <TableHead className="text-[11px] font-bold border-r">Description</TableHead>
                    <TableHead className="text-[11px] font-bold border-r w-40">Activity</TableHead>
                    {customHeaders.map((header, idx) => (
                      <TableHead key={idx} className="text-[11px] font-bold border-r bg-blue-50/30 text-blue-900 min-w-[120px]">{header}</TableHead>
                    ))}
                    <TableHead className="text-[11px] font-bold border-r w-20 text-center">HSN/SAC</TableHead>
                    <TableHead className="text-[11px] font-bold border-r w-24 text-center">Qty</TableHead>
                    <TableHead className="text-[11px] font-bold border-r w-20">UOM</TableHead>
                    <TableHead className="text-[11px] font-bold border-r w-14 text-center">Rate</TableHead>
                    <TableHead className="text-[11px] font-bold text-right w-40 pr-4">Amount</TableHead>
                    {!isIrnGenerated && <TableHead className="w-8"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((row, idx) => (
                    <TableRow key={row.id} className="h-7 hover:bg-blue-50/30">
                      <TableCell className="p-0 text-center text-[10px] text-gray-400">{idx + 1}</TableCell>
                      <TableCell className="p-0 border-r">
                        <Select value={row.desc} onValueChange={v => updateItem(row.id, 'desc', v)} disabled={isIrnGenerated}>
                          <SelectTrigger className="h-full border-none bg-transparent text-xs rounded-none px-2 shadow-none focus:bg-[#fff9c4]"><SelectValue placeholder="" /></SelectTrigger>
                          <SelectContent>{availableOptions.map(o => <SelectItem key={o.materialCode} value={o.materialCode}>{o.materialCode}</SelectItem>)}</SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="p-0 border-r">
                        <Input 
                          className="h-full border-none shadow-none focus:bg-[#fff9c4]" 
                          value={row.activity} 
                          onChange={e => updateItem(row.id, 'activity', e.target.value)} 
                          disabled={isIrnGenerated}
                          placeholder="Enter activity..."
                        />
                      </TableCell>
                      {customHeaders.map((_, hIdx) => (
                        <TableCell key={hIdx} className="p-0 border-r bg-blue-50/10">
                          <Input 
                            className="h-full border-none shadow-none focus:bg-[#fff9c4]" 
                            value={row.customValues?.[hIdx] || ""} 
                            onChange={e => updateItem(row.id, hIdx, e.target.value)} 
                            disabled={isIrnGenerated}
                          />
                        </TableCell>
                      ))}
                      <TableCell className="p-0 border-r"><Input className="h-full border-none shadow-none" value={row.hsn} readOnly /></TableCell>
                      <TableCell className="p-0 border-r"><Input type="number" className="h-full border-none shadow-none text-center font-bold text-blue-800" value={row.qty} onChange={e => updateItem(row.id, 'qty', e.target.value)} disabled={isIrnGenerated} /></TableCell>
                      <TableCell className="p-0 border-r text-center text-[10px] text-gray-500">{row.uom}</TableCell>
                      <TableCell className="p-0 border-r"><Input type="number" className="h-full border-none shadow-none text-center" value={row.rate} onChange={e => updateItem(row.id, 'rate', e.target.value)} disabled={isIrnGenerated} /></TableCell>
                      <TableCell className="p-0 border-r bg-gray-50/50 text-right text-[11px] px-2 font-mono font-bold pr-4">{row.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                      {!isIrnGenerated && (
                        <TableCell className="p-0 text-center">
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => items.length > 1 && setItems(items.filter(i => i.id !== row.id))}><Trash2 className="h-3 w-3" /></Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9] p-3 space-y-3">
                <div>
                  <div className="text-[11px] font-bold text-gray-600 mb-1 uppercase tracking-tighter">Modification Log</div>
                  <div className="text-[10px] text-gray-500 font-mono">
                    Document Status: {isIrnGenerated ? "LOCKED (E-INVOICE GENERATED)" : "ACTIVE • REVISION MODE"}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-bold text-gray-600 mb-1 uppercase tracking-tighter">Note</div>
                  <Input 
                    value={note} 
                    onChange={e => setNote(e.target.value)} 
                    disabled={isIrnGenerated}
                    className="h-7 text-[11px]" 
                    placeholder="Update document note..." 
                  />
                </div>
              </div>
              <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-white shadow-inner">
                <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700 uppercase">Calculation Summary (INR)</div>
                <div className="p-3 space-y-1.5 text-[11px]">
                  {!isNonTax ? (
                    <>
                      <div className="flex justify-between border-b pb-1"><span>Taxable Amount</span><span className="font-mono font-bold">{totals.taxableAmount.toLocaleString()}</span></div>
                      {totals.isInterstate ? (
                        <div className="flex justify-between text-blue-800"><span>Integrated GST ({totals.avgGst}%)</span><span className="font-mono font-bold">{totals.igst.toLocaleString()}</span></div>
                      ) : (
                        <>
                          <div className="flex justify-between text-emerald-700"><span>Central GST ({totals.avgGst / 2}%)</span><span className="font-mono font-bold">{totals.cgst.toLocaleString()}</span></div>
                          <div className="flex justify-between text-emerald-700"><span>State GST ({totals.avgGst / 2}%)</span><span className="font-mono font-bold">{totals.sgst.toLocaleString()}</span></div>
                        </>
                      )}
                    </>
                  ) : (
                    <div className="bg-blue-50/50 p-2 border border-blue-100 rounded-sm mb-2 italic text-blue-800">
                      Non-Taxable Document
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t text-sm font-black text-emerald-900 uppercase">
                    <span>{isNonTax ? "Net Total Amount" : "Gross Payable Amount"}</span>
                    <span className="font-mono text-lg">₹ {totals.grossAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


