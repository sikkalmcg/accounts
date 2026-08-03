
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useDatabase, useCollection, useMemoDatabase, addDocumentNonBlocking, updateDocumentNonBlocking } from "@/database";
import { collection, serverTimestamp, query, where, getDocs, doc, orderBy, limit } from "@/database/mongo";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Loader2, Columns, X, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { toSAPDate } from "@/lib/date-utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
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

export default function VF01() {
  const db = useDatabase();

  // 1. State Declarations
  const [assignedPlantIds, setAssignedPlantIds] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userName, setUserName] = useState("USER");
  const [plantId, setPlantId] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  
  const [billPeriod, setBillPeriod] = useState(format(new Date(), "MMM-yyyy"));
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  
  const [docType, setDocType] = useState("Tax Invoice");
  const [docCategory, setDocCategory] = useState("");
  const [billType, setBillType] = useState("BILL UNDER F.C.M.");
  const [inventoryType, setInventoryType] = useState("");
  const [vehicleNo, setVehicleNo] = useState("");
  const [consignorId, setConsignorId] = useState("");
  const [billTo, setBillTo] = useState(""); // Bill to Party
  const [shipTo, setShipTo] = useState(""); // Ship to Party
  const [isShipToApplicable, setIsShipToApplicable] = useState(false);
  const [termsAndConditions, setTermsAndConditions] = useState("");
  const [note, setNote] = useState("");
  
  const [isFetchingOptions, setIsFetchingOptions] = useState(false);
  const [isGeneratingNo, setIsGeneratingNo] = useState(false);
  const [availableOptions, setAvailableOptions] = useState<PricingOption[]>([]);
  
  // Credit Note Specifics
  const [referenceNo, setReferenceNo] = useState("");
  const [isRefFetching, setIsRefFetching] = useState(false);
  const [referenceDocId, setReferenceDocId] = useState<string | null>(null);

  const [customHeaders, setCustomHeaders] = useState<string[]>([]);
  const [newHeaderName, setNewHeaderName] = useState("");
  const [isColumnDialogOpen, setIsColumnDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [items, setItems] = useState<InvoiceItem[]>([
    { id: '1', desc: '', activity: '', hsn: '', qty: '', uom: 'PCS', rate: '0', amount: 0, gstRate: 0, customValues: [] }
  ]);

  // 2. Auth Context
  useEffect(() => {
    const stored = localStorage.getItem("sikka_user");
    if (stored) {
      const parsed = JSON.parse(stored);
      const isSysAdmin = parsed.username === "ajaysomra" || parsed.role === 'admin';
      setIsAdmin(isSysAdmin);
      setUserName(parsed.name || parsed.username || "USER");
      const plants = parsed.assignedPlantIds || (parsed.assignedPlantId ? [parsed.assignedPlantId] : []);
      setAssignedPlantIds(plants);
      if (!isSysAdmin && plants.length > 0) {
        setPlantId(plants[0]);
      }
    }
  }, []);

  // 3. Dynamic Labels & Config
  const docLabels = useMemo(() => {
    const t = docType?.toUpperCase() || "";
    if (t.includes("CREDIT NOTE")) return { no: "Credit Note Number", date: "Date", header: "Credit Note" };
    if (t.includes("DEBIT NOTE")) return { no: "Debit Note Number", date: "Date", header: "Debit Note" };
    if (t.includes("DELIVERY CHALLAN")) return { no: "Delivery Challan Number", date: "Date", header: "Delivery Challan" };
    return { no: "Invoice Number", date: "Date", header: "Billing Document" };
  }, [docType]);

  const isCreditNote = docType?.toUpperCase().includes("CREDIT NOTE");
  
  // Derived document type flags
  const isNonTax = docType?.toUpperCase() === "NON-TAX INVOICE";
  const isDeliveryChallan = docType?.toUpperCase() === "DELIVERY CHALLAN";
  const isDebitNote = docType?.toUpperCase() === "DEBIT NOTE";
  const isTaxInvoice = docType?.toUpperCase() === "TAX INVOICE";
  const showVehicleNo = inventoryType === "Supply Invoice";
  const isRCM = billType === "BILL UNDER R.C.M.";

  // 4. Auto-Invoice Number Generation
  useEffect(() => {
    async function generateNextInvoiceNo() {
      if (!plantId || !docType) {
        setInvoiceNo(""); // Clear if plant or doctype is not set
        return;
      }
      setIsGeneratingNo(true);
      try {
        const q = query(
          collection(db, "sales_invoices"),
          where("plantId", "==", plantId),
          // We query all docTypes for the plant to find the latest number regardless of type,
          // as per the new requirement for a single sequence per plant.
          orderBy("invoiceNumber", "desc"),
          limit(1)
        );
        const snap = await getDocs(q);

        if (snap.empty) {
          // If no invoices exist for the plant, allow manual entry.
          setInvoiceNo(""); 
        } else {
          const lastNo = snap.docs[0].data().invoiceNumber;
          const match = lastNo.match(/(\d+)$/);
          if (match) {
            const nextSeq = parseInt(match[0]) + 1;
            const paddedSeq = nextSeq.toString().padStart(match[0].length, '0');
            const basePrefix = lastNo.substring(0, lastNo.length - match[0].length);
            setInvoiceNo(`${basePrefix}${paddedSeq}`);
          } else {
            // Fallback for non-numeric ending, allow manual entry.
            setInvoiceNo("");
          }
        }
      } catch (error) {
        console.error("Failed to generate sequence", error);
      } finally {
        setIsGeneratingNo(false);
      }
    }
    generateNextInvoiceNo();
  }, [plantId, db, docType]);

  // 5. Master Data
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

  // Auto-fetch Consignor Name from Firm Master when plant changes
  // 6. Reference Fetch Logic
  const handleRefFetch = async () => {
    if (!referenceNo || !plantId) {
       window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Error: Reference Number and Plant are mandatory", isError: true } }));
       return;
    }
    setIsRefFetching(true);
    try {
      const q = query(
        collection(db, "sales_invoices"),
        where("invoiceNumber", "==", referenceNo.toUpperCase()),
        where("plantId", "==", plantId)
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Error: Reference Invoice not found in this plant", isError: true } }));
        return;
      }
      const inv = snap.docs[0].data();
      if (inv.status === "Cancelled") {
        window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Error: Selected Invoice is already cancelled", isError: true } }));
        return;
      }

      setBillTo(inv.billTo);
      if (inv.shipTo && inv.shipTo !== inv.billTo) {
        setIsShipToApplicable(true);
        setShipTo(inv.shipTo);
      } else {
        setIsShipToApplicable(false);
        setShipTo("");
      }
      setDocCategory(inv.docCategory);
      setBillType(inv.billType || "BILL UNDER F.C.M.");
      setInventoryType(inv.inventoryType || "");
      setCustomHeaders(inv.customHeaders || []);
      setNote(inv.note || "");
      setItems(inv.items.map((i: any) => ({ ...i, id: Math.random().toString() })));
      setReferenceDocId(snap.docs[0].id);

      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Reference Invoice data mapped successfully", isError: false } }));
    } catch (e) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Reference fetch failed", isError: true } }));
    } finally {
      setIsRefFetching(false);
    }
  };

  // 7. Pricing Options
  useEffect(() => {
    async function fetchOptions() {
      if (!plantId || !docCategory || !billTo) {
        setAvailableOptions([]);
        return;
      }
      setIsFetchingOptions(true);
      
      try {
        // Fetching from VK13 (pricing collection)
        const q = query(
          collection(db, "pricing"),
          where("plantId", "==", plantId),
          where("customerCode", "==", billTo),
          where("inventoryType", "==", inventoryType),
          where("documentType", "==", docType),
          where("documentCategory", "==", docCategory)
        );
        const snap = await getDocs(q);
        
        const options: PricingOption[] = snap.docs.map(doc => {
          const data = doc.data();
          // Fetching from MM03 (materials collection)
          const matMaster = materials?.find(m => m.productName === data.materialCode || m.materialCode === data.materialCode);
          return { // This is the description from VK13
            materialCode: data.materialCode || "",
            hsn: data.hsnSac || matMaster?.hsnSac || "",
            uom: matMaster?.uom || "PCS",
            price: data.price || 0,
            gstRate: Number(data.gstRate) || 0
          };
        });
        setAvailableOptions(options);
      } catch (error) {
        console.error("Pricing fetch failed", error);
      } finally {
        setIsFetchingOptions(false);
      }
    }
    fetchOptions();
  }, [plantId, docCategory, billTo, db, materials, inventoryType, docType]);

  // 8. Calculations
  const filteredBillingCategories = useMemo(() => {
    if (!billingTypes || !plantId) return [];
    return Array.from(new Set(billingTypes.filter(b => b.plantId === plantId && b.documentCategory).map(b => b.documentCategory!)));
  }, [billingTypes, plantId]);
  const filteredCustomers = useMemo(() => customers?.filter(c => c.plantId === plantId) || [], [customers, plantId]);
  
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

    return { taxableAmount, totalQty, cgst, sgst, igst, grossAmount: taxableAmount + cgst + sgst + igst, isInterstate, avgGst: totalGstPercent };
  }, [items, firms, customers, billTo, plantId, isNonTax]);

  // 9. Action Handlers
  const updateItem = (id: string, field: keyof InvoiceItem | number, val: string) => {
    setItems(prev => prev.map(i => {
      if (id === i.id) {
        if (typeof field === 'number') {
          const updatedCustom = [...(i.customValues || [])];
          updatedCustom[field] = val;
          return { ...i, customValues: updatedCustom };
        }

        let updated = { ...i, [field]: val };
        if (field === 'desc') {
          const selectedOption = availableOptions.find(opt => opt.materialCode === val);
          if (selectedOption) {
            updated.hsn = selectedOption.hsn;
            updated.rate = String(selectedOption.price);
            updated.uom = selectedOption.uom;
            updated.gstRate = selectedOption.gstRate;
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

  const handleAddColumn = () => {
    if (customHeaders.length >= 3) return;
    if (!newHeaderName.trim()) return;
    setCustomHeaders([...customHeaders, newHeaderName.trim()]);
    setNewHeaderName("");
    setIsColumnDialogOpen(false);
  };

  // Amount column label based on document type
  const amountColumnLabel = isNonTax ? "Invoice Amount" : isDeliveryChallan ? "Invoice Amount" : "Taxable Amount";

  const handleExecute = useCallback(async () => {
    if (!plantId || !invoiceNo || !billTo || !inventoryType) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Error: Plant, Invoice Number, Bill to Party and Inventory Type are mandatory", isError: true } }));
      return;
    }

    setIsProcessing(true);
    try {
      const d = new Date(invoiceDate);
      const m = d.getMonth();
      const y = d.getFullYear();
      const fyBase = m >= 3 ? y : y - 1;
      const billYear = `${fyBase}-${(fyBase + 1).toString().slice(-2)}`;

      const q = query(
        collection(db, "sales_invoices"), 
        where("invoiceNumber", "==", invoiceNo.toUpperCase()),
        where("plantId", "==", plantId),
        where("billYear", "==", billYear),
        where("docType", "==", docType)
      );
      
      const snap = await getDocs(q);
      if (!snap.empty) {
        window.dispatchEvent(new CustomEvent('sap-status', { 
          detail: { text: `${docLabels.no} already exists. Please enter unique Number.`, isError: true } 
        }));
        setIsProcessing(false);
        return;
      }

      if (isCreditNote && referenceDocId) {
        updateDocumentNonBlocking(doc(db, "sales_invoices", referenceDocId), {
          status: "Cancelled",
          cancelledAt: new Date().toISOString(),
          cancelledBy: userName,
          cancellationReference: invoiceNo.toUpperCase()
        });
      }

      const firm = firms?.find(f => f.plantId === plantId);
      const consignee = customers?.find(c => c.customerId === billTo);
      const shipToParty = customers?.find(c => c.customerId === (isShipToApplicable ? shipTo : billTo));

      const snapshotFirm = firm ? {
        name: firm.name, address: firm.address, gstin: firm.gstin, pan: firm.pan,
        state: firm.state, stateCode: firm.stateCode, mobile: firm.mobile, email: firm.email,
        logoData: firm.logoData || "", bankName: firm.bankName, accountNumber: firm.accountNumber, ifscCode: firm.ifscCode
      } : null;

      const snapshotBillTo = consignee ? {
        name: consignee.name, address: consignee.address, gstin: consignee.gstin,
        stateName: consignee.stateName, stateCode: consignee.stateCode, pan: consignee.pan
      } : null;

      const snapshotShipTo = shipToParty ? {
        name: shipToParty.name, address: shipToParty.address, gstin: shipToParty.gstin,
        stateName: shipToParty.stateName, stateCode: shipToParty.stateCode, pan: shipToParty.pan
      } : snapshotBillTo;

      addDocumentNonBlocking(collection(db, "sales_invoices"), {
        plantId, 
        invoiceNumber: invoiceNo.toUpperCase(), 
        invoiceDate: toSAPDate(invoiceDate), 
        billMonth: billPeriod, 
        billYear, 
        docType, 
        docCategory, 
        billType,
        inventoryType,
        vehicleNo: showVehicleNo ? vehicleNo : "",
        consignorName: firms?.find(f => f.id === consignorId)?.name || "",
        billTo, 
        shipTo: (isShipToApplicable ? shipTo : billTo) || billTo,
        originalInvoiceRef: isCreditNote ? referenceNo : null,
        items, totals, customHeaders, note,
        snapshotFirm, snapshotBillTo, snapshotShipTo,
        status: "Completed",
        createdBy: userName,
        createdAt: serverTimestamp()
      });

      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: `${docLabels.no} ${invoiceNo} posted successfully`, isError: false } }));
      
      setInvoiceNo("");
      setInventoryType("");
      setReferenceNo("");
      setReferenceDocId(null);
      setNote("");
      setItems([{ id: '1', desc: '', activity: '', hsn: '', qty: '', uom: 'PCS', rate: '0', amount: 0, gstRate: 0, customValues: [] }]);
    } catch (e) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Document posting failed", isError: true } }));
    } finally {
      setIsProcessing(false);
    }
  }, [db, plantId, invoiceNo, invoiceDate, billPeriod, docType, docCategory, billType, billTo, shipTo, isShipToApplicable, items, totals, customHeaders, note, firms, customers, userName, isCreditNote, referenceNo, referenceDocId, docLabels, consignorId, inventoryType, showVehicleNo]);

  useEffect(() => {
    const onExecute = () => handleExecute();
    window.addEventListener('sap-execute', onExecute);
    return () => window.removeEventListener('sap-execute', onExecute);
  }, [handleExecute]);

  return (
    <div className="w-full flex flex-col bg-white min-h-full">
      <div className="sap-header-title">Create {docLabels.header}: {docType}</div>

      <div className="p-4 space-y-4">
        <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
          <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700">Billing Header Details</div>
          <div className="p-2 grid grid-cols-2 gap-x-8">
            <div className="space-y-1">
              <div className="sap-selection-row">
                <label className="sap-label">Plant ID *</label>
                <Select value={plantId} onValueChange={setPlantId} disabled={!isAdmin && assignedPlantIds.length <= 1}>
                  <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {plants?.filter(p => isAdmin || assignedPlantIds.includes(p.plantId)).map(p => <SelectItem key={p.id} value={p.plantId}>{p.plantId} - {p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Inventory Type - First field */}
              <div className="sap-selection-row">
                <label className="sap-label">Inventory Type *</label>
                <Select value={inventoryType} onValueChange={setInventoryType}>
                  <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Supply Invoice">Supply Invoice</SelectItem>
                    <SelectItem value="Service Invoice">Service Invoice</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Vehicle No. - Only for Supply Invoice */}
              {showVehicleNo && (
                <div className="sap-selection-row animate-in slide-in-from-top-1 duration-200">
                  <label className="sap-label">Vehicle No.</label>
                  <Input value={vehicleNo} onChange={e => setVehicleNo(e.target.value.toUpperCase())} placeholder="Enter vehicle number..." className="h-6 text-xs uppercase" />
                </div>
              )}

              {/* Consignor Name - Auto-fetched from Firm Master */}
              <div className="sap-selection-row">
                <label className="sap-label">Consignor Name *</label>
                <Select value={consignorId} onValueChange={setConsignorId}>
                  <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]">
                    <SelectValue placeholder="Select Consignor Firm" />
                  </SelectTrigger>
                  <SelectContent>
                    {firms?.filter(f => f.plantId === plantId && f.status !== 'inactive').map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {isCreditNote && (
                <div className="sap-selection-row animate-in slide-in-from-top-2 duration-300">
                  <label className="sap-label font-bold text-red-700">Reference Number *</label>
                  <div className="sap-input-wrapper relative">
                    <Input 
                      value={referenceNo} 
                      onChange={e => setReferenceNo(e.target.value.toUpperCase())} 
                      onKeyDown={e => e.key === 'Enter' && handleRefFetch()}
                      placeholder="Enter Invoice No and Press Enter..."
                      className="pr-8 border-red-300"
                    />
                    <button onClick={handleRefFetch} className="absolute right-2 text-gray-400 hover:text-blue-600">
                      {isRefFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              )}

              <div className="sap-selection-row">
                <label className="sap-label">{docLabels.no} *</label>
                <div className="sap-input-wrapper relative">
                  <Input value={invoiceNo} onChange={e => setInvoiceNo(e.target.value.toUpperCase())} className={cn(isGeneratingNo && "opacity-50")} />
                  {isGeneratingNo && <Loader2 className="absolute right-2 h-3 w-3 animate-spin text-blue-600" />}
                </div>
              </div>
              <div className="sap-selection-row"><label className="sap-label">Date *</label><Input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} /></div>
              
              {/* Bill to Party (renamed from Consignee) */}
              <div className="sap-selection-row">
                <label className="sap-label">Bill to Party</label>
                <Select value={billTo} onValueChange={v => { setBillTo(v); }}>
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
                      setIsShipToApplicable(!!v);
                      if (!v) setShipTo("");
                    }} 
                  />
                  <span className="text-[10px] text-gray-400 ml-2 italic">(Toggle if Ship-to is different from Bill to Party)</span>
                </div>
              </div>

              {isShipToApplicable && (
                <div className="sap-selection-row animate-in slide-in-from-top-1 duration-200">
                  <label className="sap-label">Ship to Party</label>
                  <Select value={shipTo} onValueChange={setShipTo}>
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
                      <button className="flex h-6 w-full items-center justify-between rounded-none border border-gray-400 bg-white px-1.5 py-1 text-xs shadow-inner focus:bg-[#fff9c4] focus:outline-none hover:bg-gray-50 transition-colors">
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

              {/* Document Type - Fixed Dropdown */}
              <div className="sap-selection-row">
                <label className="sap-label">Document Type *</label>
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from(new Set(billingTypes?.filter(b => b.plantId === plantId && b.documentType).map(b => b.documentType!))).map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="sap-selection-row">
                <label className="sap-label">Charge Type *</label>
                <Select value={docCategory} onValueChange={v => { setDocCategory(v); if(!isCreditNote) setItems([]); }}>
                  <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]">
                    <SelectValue placeholder="Select Charge Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredBillingCategories.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sap-selection-row">
                <label className="sap-label">Bill Type</label>
                <Select value={billType} onValueChange={setBillType}>
                  <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BILL UNDER F.C.M.">BILL UNDER F.C.M. (Default)</SelectItem>
                    <SelectItem value="BILL UNDER R.C.M.">BILL UNDER R.C.M.</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* RCM Note */}
              {isRCM && (
                <div className="sap-selection-row animate-in slide-in-from-top-1 duration-200">
                  <div className="col-span-2 p-2 border border-orange-300 bg-orange-50 text-[10px] text-orange-800 font-bold italic">
                    GST Payable under Reverse Charge Mechanism (RCM). Invoice Total excludes GST payable by the recipient.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-white relative">
          {isFetchingOptions && <div className="absolute inset-0 bg-white/60 z-20 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>}
          <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-[12px] font-semibold text-gray-700 uppercase">Line Items</span>
              <Dialog open={isColumnDialogOpen} onOpenChange={setIsColumnDialogOpen}>
                <DialogTrigger asChild><Button variant="outline" size="sm" className="h-5 text-[9px] px-2 rounded-none gap-1" disabled={customHeaders.length >= 3}><Columns className="h-3 w-3" /> Add Column ({customHeaders.length}/3)</Button></DialogTrigger>
                <DialogContent className="max-w-sm rounded-none border-gray-400 p-0 overflow-hidden shadow-2xl">
                  <div className="bg-[#333e4f] text-white p-3 flex justify-between items-center"><DialogTitle className="text-[11px] font-black uppercase tracking-widest">Column Header</DialogTitle><button onClick={() => setIsColumnDialogOpen(false)}><X className="h-4 w-4" /></button></div>
                  <div className="p-6 bg-white space-y-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Manual Name</label>
                    <Input value={newHeaderName} onChange={e => setNewHeaderName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddColumn()} autoFocus />
                  </div>
                  <div className="bg-[#e1e1e1] p-3 flex justify-end gap-3"><Button onClick={handleAddColumn} className="rounded-none bg-blue-700 text-white h-8 text-xs px-6">Add Column</Button></div>
                </DialogContent>
              </Dialog>
            </div>
            <Button onClick={() => setItems([...items, { id: Math.random().toString(), desc: '', activity: '', hsn: '', qty: '', uom: 'PCS', rate: '0', amount: 0, gstRate: 0, customValues: [] }])} variant="ghost" size="sm" className="h-5 text-[10px]"><Plus className="h-3 w-3 mr-1" /> Add Row</Button>
          </div>
          <Table>
            <TableHeader className="bg-[#e7ebf1]">
              <TableRow className="h-7">
                <TableHead className="text-[11px] font-bold border-r w-10 text-center">#</TableHead>
                <TableHead className="text-[11px] font-bold border-r">Description</TableHead>
                <TableHead className="text-[11px] font-bold border-r w-40">Activity</TableHead>
                {customHeaders.map((h, idx) => <TableHead key={idx} className="text-[11px] font-bold border-r bg-blue-50/20 text-blue-900 min-w-[100px]">{h}</TableHead>)}
                <TableHead className="text-[11px] font-bold border-r w-20 text-center">HSN/SAC</TableHead>
                <TableHead className="text-[11px] font-bold border-r w-24 text-center">Qty</TableHead>
                <TableHead className="text-[11px] font-bold border-r w-20">UOM</TableHead>
                <TableHead className="text-[11px] font-bold border-r w-14 text-center">Rate</TableHead>
                <TableHead className="text-[11px] font-bold text-right w-40 pr-4">{amountColumnLabel}</TableHead>
                <TableHead className="w-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((row, idx) => (
                <TableRow key={row.id} className="h-7 hover:bg-blue-50/30">
                  <TableCell className="p-0 border-r text-center text-[10px] text-gray-500">{idx + 1}</TableCell>
                  <TableCell className="p-0 border-r">
                    <Select value={row.desc} onValueChange={v => updateItem(row.id, 'desc', v)}>
                      <SelectTrigger className="h-full border-none bg-transparent text-xs rounded-none px-2 focus:bg-[#fff9c4]"><SelectValue placeholder="" /></SelectTrigger>
                      <SelectContent>{availableOptions.map(opt => <SelectItem key={opt.materialCode} value={opt.materialCode}>{opt.materialCode}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="p-0 border-r">
                    <Input className="h-full border-none focus:bg-[#fff9c4]" value={row.activity} onChange={e => updateItem(row.id, 'activity', e.target.value)} placeholder="Enter activity..." />
                  </TableCell>
                  {customHeaders.map((_, hIdx) => (
                    <TableCell key={hIdx} className="p-0 border-r">
                      <Input className="h-full border-none focus:bg-[#fff9c4]" value={row.customValues?.[hIdx] || ""} onChange={e => updateItem(row.id, hIdx, e.target.value)} />
                    </TableCell>
                  ))}
                  <TableCell className="p-0 border-r"><Input className="h-full border-none text-center" value={row.hsn} readOnly /></TableCell>
                  <TableCell className="p-0 border-r"><Input type="number" className="h-full border-none text-center font-bold text-emerald-800" value={row.qty} onChange={e => updateItem(row.id, 'qty', e.target.value)} /></TableCell>
                  <TableCell className="p-0 border-r text-center text-[10px]">{row.uom}</TableCell>
                  <TableCell className="p-0 border-r"><Input type="number" className="h-full border-none text-center" value={row.rate} onChange={e => updateItem(row.id, 'rate', e.target.value)} /></TableCell>
                  <TableCell className="p-0 border-r bg-gray-50/50 text-right text-[11px] px-2 font-mono pr-4">{row.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="p-0 text-center"><Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => items.length > 1 && setItems(items.filter(i => i.id !== row.id))}><Trash2 className="h-3 w-3" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9] p-3 space-y-3">
             <div>
               <div className="text-[11px] font-bold text-gray-600 mb-1 uppercase tracking-tighter">Terms & Conditions</div>
              <textarea value={termsAndConditions} onChange={e => setTermsAndConditions(e.target.value)} className="w-full h-16 text-[11px] bg-white border border-gray-400 p-2 outline-none focus:border-blue-500" placeholder="Standard billing terms..."/>
             </div>
             <div>
               <div className="text-[11px] font-bold text-gray-600 mb-1 uppercase tracking-tighter">Note</div>
               <Input value={note} onChange={e => setNote(e.target.value)} className="h-7 text-[11px]" placeholder="Note will print on invoice if filled..." />
             </div>
          </div>
          <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-white shadow-inner">
            <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700 uppercase">Calculation Summary</div>
          <div className="p-3 space-y-1 text-[11px]">
              {isNonTax ? (
                <>
                  <div className="flex justify-between border-b pb-1"><span>Invoice Amount</span><span className="font-mono font-bold">{totals.taxableAmount.toLocaleString()}</span></div>
                  <div className="p-2 border border-blue-100 bg-blue-50 italic text-blue-800">Non-Tax Transaction - No GST applicable</div>
                </>
              ) : isRCM ? (
                <>
                  <div className="flex justify-between border-b pb-1"><span>Invoice Amount (Excl. GST)</span><span className="font-mono font-bold">{totals.taxableAmount.toLocaleString()}</span></div>
                  <div className="p-2 border border-orange-200 bg-orange-50 italic text-orange-700 text-[10px]">
                    GST is payable by the recipient under Reverse Charge Mechanism (RCM)
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between border-b pb-1"><span>Taxable Amount</span><span className="font-mono font-bold">{totals.taxableAmount.toLocaleString()}</span></div>
                  {totals.isInterstate ? (
                    <div className="flex justify-between text-blue-800"><span>IGST ({totals.avgGst}%)</span><span className="font-mono font-bold">{totals.igst.toLocaleString()}</span></div>
                  ) : (
                    <>
                      <div className="flex justify-between text-emerald-700"><span>CGST ({totals.avgGst / 2}%)</span><span className="font-mono font-bold">{totals.cgst.toLocaleString()}</span></div>
                      <div className="flex justify-between text-emerald-700"><span>SGST ({totals.avgGst / 2}%)</span><span className="font-mono font-bold">{totals.sgst.toLocaleString()}</span></div>
                    </>
                  )}
                </>
              )}
              <div className="flex justify-between pt-2 border-t text-sm font-black text-emerald-900 uppercase"><span>{isNonTax ? "Net Total" : isRCM ? "Net Payable (Excl. GST)" : "Gross Payable"}</span><span className="font-mono text-lg">₹ {totals.grossAmount.toLocaleString()}</span></div>
            </div>
          </div>
        </div>
      </div>
      {isProcessing && <div className="fixed bottom-10 right-10 bg-[#333e4f] text-white px-4 py-2 text-xs border border-white/20 animate-pulse z-50">SAVING DOCUMENT...</div>}
    </div>
  );
}
