"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useDatabase, useCollection, useMemoDatabase, addDocumentNonBlocking, updateDocumentNonBlocking } from "@/database";
import { collection, serverTimestamp, query, where, getDocs, doc, orderBy, limit } from "@/database/mongo";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Loader2, Columns, X, ChevronDown, Search, AlertCircle, Info, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { GST_STATE_CODES } from "@/lib/gst-utils";
import { toSAPDate } from "@/lib/date-utils";
import { roundToTwo, formatAmount, sanitizeAmountInput } from "@/lib/number-utils";
import { SapDateInput } from "@/components/ui/sap-date-input";
import { SapCombobox } from "@/components/ui/sap-combobox";
import { getRecordPlantIds } from "@/lib/plant-master";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, parse, isValid } from "date-fns";
import { MonthYearPicker } from "@/components/ui/month-year-picker";

interface InvoiceItem {
  id: string;
  desc: string;
  descName: string;
  activity: string;
  material?: string;
  hsn: string;
  qty: string;
  uom: string;
  rate: string;
  amount: number;
  gstRate: number;
  customValues: string[];
  isFixedCharge: boolean; // To track if the rate is manual
  entryMode?: 'vk13' | 'manual';
  vk13RecordId?: string;
}

interface Vk13RateRecord {
  id: string;
  plantId: string;
  customerCode?: string;
  materialCode: string;
  materialName: string;
  hsnSac: string;
  uom: string;
  price: number | string;
  gstRate: number;
  validFrom?: string;
  validTo?: string;
  status?: string;
}

interface PricingOption {
  id: string;
  materialCode: string;
  materialName: string;
  hsn: string;
  uom: string;
  price: number | string;
  gstRate: number;
  validFrom?: string;
  validTo?: string;
}

// Helper function to parse DD-MMM-YYYY or ISO date string safely
const parseFlexibleDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  let parsed = parse(dateStr, "dd-MMM-yyyy", new Date());
  if (isValid(parsed)) return parsed;

  const formattedStr = dateStr.replace(/-([a-zA-Z]{3})-/, (match, p1) => {
    return `-${p1.charAt(0).toUpperCase()}${p1.slice(1).toLowerCase()}-`;
  });
  parsed = parse(formattedStr, "dd-MMM-yyyy", new Date());
  if (isValid(parsed)) return parsed;

  parsed = parse(dateStr, "yyyy-MM-dd", new Date());
  if (isValid(parsed)) return parsed;

  return null;
};

// Helper to safely extract array of plant IDs from billing record
const getRecordPlants = (record: any): string[] => {
  if (Array.isArray(record.plantIds) && record.plantIds.length > 0) {
    return record.plantIds;
  }
  return record.plantId ? [record.plantId] : [];
};

interface PartyDropdownProps {
  value: string;
  onValueChange: (value: string) => void;
  customers?: any[] | null;
  placeholder?: string;
  disabled?: boolean;
}

function PartyDropdown({
  value,
  onValueChange,
  customers: rawCustomers,
  placeholder = "Select Party...",
  disabled = false,
}: PartyDropdownProps) {
  const customers = useMemo(() => rawCustomers || [], [rawCustomers]);
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedCustomer = useMemo(() => {
    if (!value) return null;
    return customers.find((c) => c.customerId === value) || null;
  }, [customers, value]);

  // Resolve state name: prefer stored stateName/state, fall back to GSTIN-derived
  const getPartyState = (c: any): string => {
    const stored = (c?.stateName || c?.state || "").trim();
    if (stored) return stored;
    const gstin = (c?.gstin || "").trim();
    if (gstin.length >= 2) {
      const derived = GST_STATE_CODES[gstin.substring(0, 2)];
      if (derived) return derived;
    }
    return "";
  };

  // Dropdown label: Code – Name – State (state always shown when available)
  const formatPartyDropdownOption = (c: any): string => {
    const code = (c?.customerId || "").trim();
    const name = (c?.name || "").trim();
    const state = getPartyState(c);
    return state ? `${code} – ${name} – ${state}` : `${code} – ${name}`;
  };

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => {
      const code = (c?.customerId || "").toLowerCase();
      const name = (c?.name || "").toLowerCase();
      const state = getPartyState(c).toLowerCase();
      const full = `${code} \u2013 ${name} \u2013 ${state}`.toLowerCase();
      return code.includes(q) || name.includes(q) || state.includes(q) || full.includes(q);
    });
  }, [customers, searchTerm]);

  const handleSelect = (customerId: string) => {
    onValueChange(customerId);
    setOpen(false);
    setSearchTerm("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (filtered.length > 0 ? (prev + 1) % filtered.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (filtered.length > 0 ? (prev - 1 + filtered.length) % filtered.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered.length > 0 && highlightedIndex >= 0 && highlightedIndex < filtered.length) {
        handleSelect(filtered[highlightedIndex].customerId);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-6 w-full items-center justify-between rounded-none border border-gray-400 bg-white px-1.5 text-xs text-left focus:bg-[#fff9c4] focus:outline-none transition-colors",
            disabled && "opacity-60 cursor-not-allowed bg-gray-100"
          )}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setOpen(true);
            }
          }}
        >
          <span className={cn("truncate", !selectedCustomer && "text-gray-400")}>
            {selectedCustomer ? selectedCustomer.name : placeholder}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-gray-500 shrink-0 ml-1 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-[480px] max-w-[640px] p-0 rounded-none border border-gray-400 shadow-xl bg-white z-[9999]"
        align="start"
        sideOffset={2}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          searchInputRef.current?.focus();
        }}
      >
        <div className="p-1.5 border-b border-gray-200 bg-[#f4f7fb] flex items-center gap-1.5">
          <Search className="h-3.5 w-3.5 text-gray-400 shrink-0 ml-1" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setHighlightedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search by Code, Name, or State..."
            className="h-6 w-full text-xs px-1.5 border border-gray-300 rounded-none bg-white focus:outline-none focus:border-blue-500 placeholder:text-gray-400"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm("");
                searchInputRef.current?.focus();
              }}
              className="text-gray-400 hover:text-gray-600 px-1"
              title="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="max-h-60 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-3 py-3 text-center text-xs text-gray-500 font-medium">
              {customers.length === 0 ? "No parties found for selected Plant" : "No matching party found"}
            </div>
          ) : (
            <ul>
              {filtered.map((c, idx) => {
                const isSelected = c.customerId === value;
                const isHighlighted = idx === highlightedIndex;
                const label = formatPartyDropdownOption(c);
                return (
                  <li
                    key={c.id || c.customerId || idx}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelect(c.customerId)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={cn(
                      "px-2.5 py-1.5 text-xs cursor-pointer flex items-center justify-between border-b border-gray-100 last:border-b-0",
                      isHighlighted || isSelected
                        ? "bg-[#dae8f5] text-blue-900 font-bold"
                        : "hover:bg-gray-100 text-gray-800 font-medium"
                    )}
                  >
                    <span className="truncate">{label}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 text-blue-700 shrink-0 ml-2" />}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function VF01() {
  const db = useDatabase();

  // 1. State Declarations
  const [assignedPlantIds, setAssignedPlantIds] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userName, setUserName] = useState("USER");
  const [plantId, setPlantId] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(format(new Date(), "dd-MMM-yyyy"));
  
  const [billPeriod, setBillPeriod] = useState("");
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  
  const [docType, setDocType] = useState("");
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
  const [noValidPriceRowMaterial, setNoValidPriceRowMaterial] = useState<string>("");

  // VK13 Reimbursement States
  const [vk13Records, setVk13Records] = useState<Vk13RateRecord[]>([]);
  const [isVk13Loading, setIsVk13Loading] = useState(false);
  const [selectedVk13RecordId, setSelectedVk13RecordId] = useState<string>("");
  const [reimbursementGlobalMode, setReimbursementGlobalMode] = useState<'vk13' | 'manual'>('vk13');
  
  // Credit Note Specifics
  const [referenceNo, setReferenceNo] = useState("");
  const [isRefFetching, setIsRefFetching] = useState(false);
  const [referenceDocId, setReferenceDocId] = useState<string | null>(null);

  const [customHeaders, setCustomHeaders] = useState<string[]>([]);
  const [newHeaderName, setNewHeaderName] = useState("");
  const [isColumnDialogOpen, setIsColumnDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [items, setItems] = useState<InvoiceItem[]>([
    { id: '1', desc: '', descName: '', activity: '', hsn: '', qty: '', uom: 'PCS', rate: '0', amount: 0, gstRate: 0, customValues: [], isFixedCharge: false }
  ]);

  // 2. Auth Context
  useEffect(() => {
    const stored = localStorage.getItem("sikka_user");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const isSysAdmin = parsed.username === "ajaysomra" || parsed.role === 'admin';
        setIsAdmin(isSysAdmin);
        setUserName(parsed.name || parsed.username || "USER");
        const plants = parsed.assignedPlantIds || (parsed.assignedPlantId ? [parsed.assignedPlantId] : []);
        setAssignedPlantIds(plants);
        if (!isSysAdmin && plants.length > 0) {
          setPlantId(plants[0]);
        }
      } catch (e) { /* ignore */ }
    }
  }, []);

  // 4. Auto-Invoice Number Generation
  const generateNextInvoiceNo = useCallback(async () => {
    if (!plantId || !docType) {
      setInvoiceNo("");
      return;
    }
    setIsGeneratingNo(true);
    try {
      const q = query(
        collection(db, "sales_invoices"),
        where("plantId", "==", plantId),
        orderBy("invoiceNumber", "desc"),
        limit(1)
      );
      const snap = await getDocs(q);

      if (snap.empty) {
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
          setInvoiceNo("");
        }
      }
    } catch (error) {
      console.error("Failed to generate sequence", error);
    } finally {
      setIsGeneratingNo(false);
    }
  }, [plantId, docType, db]);

  // Handler for Plant change: clears all 6 dependent fields immediately (Requirement 4)
  const handlePlantChange = useCallback((newPlantId: string) => {
    if (newPlantId === plantId) return;
    setPlantId(newPlantId);
    setInventoryType("");
    setDocType("");
    setDocCategory("");
    setBillTo("");
    setShipTo("");
    setIsShipToApplicable(false);
    setVehicleNo("");
    setConsignorId("");
    setInvoiceNo("");
    setVk13Records([]);
    setSelectedVk13RecordId("");
    setAvailableOptions([]);
    setReferenceNo("");
    setReferenceDocId(null);
    setItems([{ id: '1', desc: '', descName: '', activity: '', hsn: '', qty: '', uom: 'PCS', rate: '0', amount: 0, gstRate: 0, customValues: [], isFixedCharge: false }]);
  }, [plantId]);

  // Auto-reset: clears Plant ID so it must be manually re-selected before next invoice.
  const resetForm = useCallback(() => {
    setPlantId(""); // Cleared & blank — must be manually re-selected for next invoice
    setInvoiceNo("");
    setInvoiceDate(format(new Date(), 'dd-MMM-yyyy')); // System format DD-MMM-YYYY
    setBillPeriod("");
    setDocType("");
    setInventoryType("");
    setDocCategory("");
    setBillTo("");
    setShipTo("");
    setIsShipToApplicable(false);
    setVehicleNo("");
    setConsignorId("");
    setTermsAndConditions("");
    setNote("");
    setReferenceNo("");
    setReferenceDocId(null);
    setVk13Records([]);
    setSelectedVk13RecordId("");
    setReimbursementGlobalMode('vk13');
    setItems([{ id: '1', desc: '', descName: '', activity: '', hsn: '', qty: '', uom: 'PCS', rate: '0', amount: 0, gstRate: 0, customValues: [], isFixedCharge: false }]);
  }, []);

  // Regenerate the invoice number only when a Plant is selected (never when blank).
  useEffect(() => {
    if (plantId && docType) {
      generateNextInvoiceNo();
    } else {
      setInvoiceNo("");
    }
  }, [plantId, db, docType, generateNextInvoiceNo]);

  // 3. Dynamic Labels & Config
  const docLabels = useMemo(() => {
    const t = docType?.toUpperCase() || "";
    if (t.includes("CREDIT NOTE")) return { no: "Credit Note Number", date: "Date", header: "Credit Note" };
    if (t.includes("DEBIT NOTE")) return { no: "Debit Note Number", date: "Date", header: "Debit Note" };
    if (t.includes("DELIVERY CHALLAN")) return { no: "Delivery Challan Number", date: "Date", header: "Delivery Challan" };
    return { no: "Invoice Number", date: "Date", header: "Billing Document" };
  }, [docType]);

  const isCreditNote = docType?.toUpperCase().includes("CREDIT NOTE");
  
  const isNonTax = docType?.toUpperCase() === "NON-TAX INVOICE";
  const isDeliveryChallan = docType?.toUpperCase() === "DELIVERY CHALLAN";
  const showVehicleNo = inventoryType === "Supply Invoice";
  const isRCM = billType === "BILL UNDER R.C.M.";

  // 5. Master Data Queries
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

  // Consignor selection logic based on Plant
  const availableConsignors = useMemo(() => {
    if (!plantId || !firms) return [];
    return firms.filter(f => getRecordPlantIds(f).includes(plantId) && f.status !== 'inactive');
  }, [firms, plantId]);

  useEffect(() => {
    if (!plantId) {
      setConsignorId("");
      return;
    }
    if (availableConsignors.length === 1) {
      setConsignorId(availableConsignors[0].id);
    } else if (availableConsignors.length > 1) {
      setConsignorId(prev => availableConsignors.some(c => c.id === prev) ? prev : "");
    } else {
      setConsignorId("");
    }
  }, [plantId, availableConsignors]);

  const isReimbursementCharge = docCategory?.trim().toUpperCase() === "REIMBURSEMENT CHARGE";

  // VK13 Reimbursement records fetch
  useEffect(() => {
    if (!plantId || !isReimbursementCharge) {
      setVk13Records([]);
      setSelectedVk13RecordId("");
      return;
    }

    let isMounted = true;
    async function fetchVk13() {
      setIsVk13Loading(true);
      try {
        const q = query(
          collection(db, "pricing"),
          where("plantId", "==", plantId)
        );
        const snap = await getDocs(q);
        if (!isMounted) return;

        const parsedInvDate = parseFlexibleDate(invoiceDate);
        const invTs = parsedInvDate ? parsedInvDate.getTime() : null;

        const validDocs = snap.docs.filter(doc => {
          const data = doc.data();
          const cat = (data.documentCategory || "").trim().toUpperCase();
          if (cat !== "REIMBURSEMENT CHARGE") return false;
          if (data.status && data.status.toLowerCase() === "inactive") return false;
          if (data.customerCode && billTo && data.customerCode !== billTo) return false;

          if (invTs) {
            const from = data.validFrom ? (parseFlexibleDate(data.validFrom)?.getTime() || -Infinity) : -Infinity;
            const to = data.validTo ? (parseFlexibleDate(data.validTo)?.getTime() || Infinity) : Infinity;
            if (invTs < from || invTs > to) return false;
          }
          return true;
        });

        const recs: Vk13RateRecord[] = validDocs.map(d => {
          const data = d.data();
          const matMaster = materials?.find(m => m.materialCode === data.materialCode || m.productName === data.materialCode);
          return {
            id: d.id,
            plantId: data.plantId,
            customerCode: data.customerCode,
            materialCode: data.materialCode || "",
            materialName: data.materialName || matMaster?.productName || data.materialCode || "",
            hsnSac: data.hsnSac || matMaster?.hsnSac || "",
            uom: data.uom || matMaster?.uom || "PCS",
            price: data.price !== undefined && data.price !== null ? data.price : "",
            gstRate: data.gstRate !== undefined && data.gstRate !== null ? Number(data.gstRate) : 0,
            validFrom: data.validFrom,
            validTo: data.validTo,
            status: data.status || "Active",
          };
        });

        setVk13Records(recs);
        if (recs.length === 1) {
          setSelectedVk13RecordId(recs[0].id);
        } else {
          setSelectedVk13RecordId("");
        }
      } catch (err) {
        console.error("Error fetching VK13 records for REIMBURSEMENT CHARGE", err);
        if (isMounted) setVk13Records([]);
      } finally {
        if (isMounted) setIsVk13Loading(false);
      }
    }

    fetchVk13();
    return () => { isMounted = false; };
  }, [plantId, isReimbursementCharge, billTo, invoiceDate, db, materials]);

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
      setInventoryType(inv.inventoryType || "Service Invoice");
      setCustomHeaders(inv.customHeaders || []);
      setNote(inv.note || "");
      setItems(inv.items.map((i: any) => ({ ...i, id: Math.random().toString(), descName: i.descName || i.desc || "" })));
      setReferenceDocId(snap.docs[0].id);

      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Reference Invoice data mapped successfully", isError: false } }));
    } catch (e) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Reference fetch failed", isError: true } }));
    } finally {
      setIsRefFetching(false);
    }
  };

  // 7. Pricing Options Fetch
  useEffect(() => {
    async function fetchOptions() {
      if (!plantId || !docCategory || !billTo) {
        setAvailableOptions([]);
        return;
      }
      setIsFetchingOptions(true);
      
      try {
        const customerPricingQuery = query(
          collection(db, "pricing"),
          where("plantId", "==", plantId),
          where("customerCode", "==", billTo),
          where("inventoryType", "==", inventoryType),
          where("documentType", "==", docType),
          where("documentCategory", "==", docCategory)
        );

        const genericPricingQuery = query(
          collection(db, "pricing"),
          where("plantId", "==", plantId),
          where("customerCode", "==", ""),
          where("inventoryType", "==", inventoryType),
          where("documentType", "==", docType),
          where("documentCategory", "==", docCategory)
        );

        const [customerSnap, genericSnap] = await Promise.all([getDocs(customerPricingQuery), getDocs(genericPricingQuery)]);
        const snap = { docs: [...customerSnap.docs, ...genericSnap.docs] };

        const parsedInvoiceDate = parseFlexibleDate(invoiceDate);
        const invoiceTs = parsedInvoiceDate ? parsedInvoiceDate.getTime() : null;
        const validDocs = snap.docs.filter(doc => {
          const data = doc.data();
          if (!invoiceTs) return true;
          const from = data.validFrom ? (parseFlexibleDate(data.validFrom)?.getTime() || -Infinity) : -Infinity;
          const to = data.validTo ? (parseFlexibleDate(data.validTo)?.getTime() || Infinity) : Infinity;
          return invoiceTs >= from && invoiceTs <= to;
        });

        const options: PricingOption[] = validDocs.map(doc => {
          const data = doc.data();
          const matMaster = materials?.find(m => m.productName === data.materialCode || m.materialCode === data.materialCode);
          const option: PricingOption = {
            id: doc.id,
            materialCode: data.materialCode || "",
            materialName: data.materialName || matMaster?.productName || data.materialCode || "",
            hsn: data.hsnSac || matMaster?.hsnSac || "",
            uom: matMaster?.uom || data.uom || "PCS",
            price: data.price || 0,
            gstRate: Number(data.gstRate) || 0,
            validFrom: data.validFrom || "",
            validTo: data.validTo || "",
          };
          return option;
        });

        setAvailableOptions(options);
        setNoValidPriceRowMaterial("");
      } catch (error) {
        console.error("Pricing fetch failed", error);
      } finally {
        setIsFetchingOptions(false);
      }
    }
    fetchOptions();
  }, [plantId, docCategory, billTo, db, materials, inventoryType, docType, invoiceDate]);

  // 8. Multi-Plant Billing Types Filter (VOF03 Master)
  const plantBillingTypes = useMemo(() => {
    if (!billingTypes || !plantId) return [];
    return billingTypes.filter(b => {
      const recPlants = getRecordPlants(b);
      const matchesPlant = recPlants.includes(plantId);
      const isActive = !b.status || b.status === "Active";
      return matchesPlant && isActive;
    });
  }, [billingTypes, plantId]);

  // Inventory Types from VOF03 for selected Plant
  const availableInventoryTypes = useMemo(() => {
    if (!plantBillingTypes.length) return [];
    return Array.from(new Set(plantBillingTypes.map(b => b.inventoryType).filter(Boolean)));
  }, [plantBillingTypes]);

  // Document Types from VOF03 for selected Plant
  const availableDocumentTypes = useMemo(() => {
    if (!plantBillingTypes.length) return [];
    const pool = inventoryType
      ? plantBillingTypes.filter(b => (b.inventoryType || '').trim().toUpperCase() === inventoryType.trim().toUpperCase())
      : plantBillingTypes;
    const types = Array.from(new Set(pool.map(b => b.documentType).filter(Boolean)));
    return types.length > 0 ? types : Array.from(new Set(plantBillingTypes.map(b => b.documentType).filter(Boolean)));
  }, [plantBillingTypes, inventoryType]);

  // Charge Types from VOF03 for selected Plant
  // Filters first by inventoryType, then further by docType (when set) so that
  // changing Document Type automatically invalidates an incompatible Charge Type
  // via the auto-clear useEffect below (line ~717).
  const availableChargeTypes = useMemo(() => {
    if (!plantBillingTypes.length) return [];

    // Step 1: narrow pool by inventoryType
    const byInventory = inventoryType
      ? plantBillingTypes.filter(b => (b.inventoryType || '').trim().toUpperCase() === inventoryType.trim().toUpperCase())
      : plantBillingTypes;

    // Step 2: further narrow by docType when selected
    const byDocType = docType
      ? byInventory.filter(b => (b.documentType || '').trim().toUpperCase() === docType.trim().toUpperCase())
      : byInventory;

    // Use the most-specific pool that has results; fall back up the chain
    const effectivePool = byDocType.length > 0 ? byDocType : byInventory.length > 0 ? byInventory : plantBillingTypes;

    const cats = Array.from(new Set(effectivePool.map(b => b.documentCategory).filter(Boolean)));
    const allPlantCats = cats.length > 0 ? cats : Array.from(new Set(plantBillingTypes.map(b => b.documentCategory).filter(Boolean)));

    // Preserve REIMBURSEMENT CHARGE if configured for the plant in VOF03 or available
    const hasReimbursement = plantBillingTypes.some(b => {
      const cat = (b.documentCategory || '').trim().toUpperCase();
      return cat === 'REIMBURSEMENT CHARGE' || cat === 'REIMBURSEMENT CHARGES';
    });
    if (hasReimbursement && !allPlantCats.some(c => c.trim().toUpperCase() === 'REIMBURSEMENT CHARGE')) {
      allPlantCats.push('REIMBURSEMENT CHARGE');
    }
    return allPlantCats;
  }, [plantBillingTypes, inventoryType, docType]);

  useEffect(() => {
    if (docType && !availableDocumentTypes.includes(docType)) {
      setDocType("");
    }
  }, [availableDocumentTypes, docType]);

  useEffect(() => {
    if (docCategory && !availableChargeTypes.includes(docCategory)) {
      setDocCategory("");
    }
  }, [availableChargeTypes, docCategory]);

  const noBillingConfigMessage = "No Document Type and Charge Type configured for the selected Plant and Inventory Type.";
  const noValidPriceMessage = "No valid price condition found for the selected Plant, Inventory Type, Document Type, Charge Type, Material Code and Invoice Date.";
  const filteredCustomers = useMemo(() => customers?.filter(c => getRecordPlantIds(c).includes(plantId) && (!c.status || c.status === "Active")) || [], [customers, plantId]);

  useEffect(() => {
    if (billTo && !filteredCustomers.some(c => c.customerId === billTo)) {
      setBillTo("");
    }
  }, [filteredCustomers, billTo]);

  useEffect(() => {
    if (shipTo && !filteredCustomers.some(c => c.customerId === shipTo)) {
      setShipTo("");
    }
  }, [filteredCustomers, shipTo]);
  
  const totals = useMemo(() => {
    const taxableAmount = roundToTwo(items.reduce((acc, i) => acc + (i.amount || 0), 0));
    const totalQty = items.reduce((acc, i) => acc + (Number(i.qty) || 0), 0);

    if (isNonTax) {
      return { taxableAmount, totalQty, cgst: 0, sgst: 0, igst: 0, grossAmount: roundToTwo(taxableAmount), isInterstate: false, avgGst: 0 };
    }

    const selectedFirm = firms?.find(f => f.id === consignorId) || firms?.find(f => getRecordPlantIds(f).includes(plantId));
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

    return { taxableAmount, totalQty, cgst: roundToTwo(cgst), sgst: roundToTwo(sgst), igst: roundToTwo(igst), grossAmount: roundToTwo(taxableAmount + cgst + sgst + igst), isInterstate, avgGst: totalGstPercent };
  }, [items, firms, customers, billTo, plantId, isNonTax, consignorId]);

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
          const selectedOption = availableOptions.find(opt => opt.id === val);
          if (selectedOption) {
            const isManualRate = !selectedOption.price || (typeof selectedOption.price === 'number' && selectedOption.price <= 0) || selectedOption.price === 'FIX';
            updated.hsn = selectedOption.hsn;
            updated.rate = selectedOption.price === 'FIX' ? '' : sanitizeAmountInput(String(selectedOption.price));
            updated.uom = selectedOption.uom;
            updated.gstRate = selectedOption.gstRate;
            updated.descName = selectedOption.materialName || selectedOption.materialCode;
            updated.isFixedCharge = isManualRate;
            setNoValidPriceRowMaterial("");
          } else {
            updated.hsn = "";
            updated.rate = "";
            updated.uom = "";
            updated.gstRate = 0;
            updated.descName = val;
            updated.isFixedCharge = true;
            setNoValidPriceRowMaterial(val ? val : "");
          }
        }

        if (field === 'rate') {
          // Restrict manual rate entry to a maximum of 2 decimal places
          updated.rate = sanitizeAmountInput(val);
          updated.isFixedCharge = true;
        }

        if (updated.isFixedCharge) {
          updated.amount = roundToTwo(Number(updated.rate) || 0);
        } else {
          updated.amount = roundToTwo((Number(updated.qty) || 0) * (Number(updated.rate) || 0));
        }
        return updated;
      }
      return i;
    }));
  };

  // Special Reimbursement Row Updater
  const updateReimbursementItem = (id: string, field: string | number, val: string) => {
    setItems(prev => prev.map(i => {
      if (i.id !== id) return i;
      if (typeof field === 'number') {
        const updatedCustom = [...(i.customValues || [])];
        updatedCustom[field] = val;
        return { ...i, customValues: updatedCustom };
      }

      let updated = { ...i, [field]: val };
      if (field === 'material') {
        updated.material = val;
        if (!updated.desc) updated.desc = val;
        if (!updated.descName) updated.descName = val;
      }
      if (field === 'desc') {
        updated.desc = val;
        updated.descName = val;
      }
      if (field === 'rate') {
        updated.rate = sanitizeAmountInput(val);
      }
      if (field === 'gstRate') {
        updated.gstRate = Number(val) || 0;
      }

      const q = Number(updated.qty) || 0;
      const r = Number(updated.rate) || 0;
      updated.amount = roundToTwo(q * r);
      return updated;
    }));
  };

  const setItemToVk13Record = (itemId: string, vk13RecId: string) => {
    const rec = vk13Records.find(r => r.id === vk13RecId);
    if (!rec) return;
    setItems(prev => prev.map(i => {
      if (i.id !== itemId) return i;
      const isManualRate = !rec.price || rec.price === 'FIX' || (typeof rec.price === 'number' && rec.price <= 0);
      const rateStr = isManualRate ? (i.rate || "") : sanitizeAmountInput(String(rec.price));
      const gstRateVal = (rec.gstRate !== undefined && rec.gstRate !== null) ? Number(rec.gstRate) : (i.gstRate || 0);
      const q = Number(i.qty) || 0;
      const r = Number(rateStr) || 0;
      return {
        ...i,
        entryMode: 'vk13',
        vk13RecordId: rec.id,
        material: rec.materialCode || "",
        desc: rec.materialName || rec.materialCode || "",
        descName: rec.materialName || rec.materialCode || "",
        hsn: rec.hsnSac || "",
        uom: rec.uom || "PCS",
        rate: rateStr,
        gstRate: gstRateVal,
        isFixedCharge: isManualRate,
        amount: roundToTwo(q * r),
      };
    }));
  };

  const setItemToManual = (itemId: string) => {
    setItems(prev => prev.map(i => {
      if (i.id !== itemId) return i;
      return {
        ...i,
        entryMode: 'manual',
        vk13RecordId: undefined,
        isFixedCharge: false,
      };
    }));
  };

  const handleGlobalModeChange = (mode: 'vk13' | 'manual') => {
    setReimbursementGlobalMode(mode);
    if (mode === 'manual') {
      setItems(prev => prev.map(i => ({
        ...i,
        entryMode: 'manual',
        vk13RecordId: undefined,
        isFixedCharge: false,
      })));
    } else {
      if (vk13Records.length > 0) {
        const targetRec = (selectedVk13RecordId ? vk13Records.find(r => r.id === selectedVk13RecordId) : null) || (vk13Records.length === 1 ? vk13Records[0] : null);
        if (targetRec) {
          setItems(prev => prev.map(i => {
            const isManualRate = !targetRec.price || targetRec.price === 'FIX' || (typeof targetRec.price === 'number' && targetRec.price <= 0);
            const rateStr = isManualRate ? (i.rate || "") : sanitizeAmountInput(String(targetRec.price));
            const gstRateVal = (targetRec.gstRate !== undefined && targetRec.gstRate !== null) ? Number(targetRec.gstRate) : (i.gstRate || 0);
            const q = Number(i.qty) || 0;
            const r = Number(rateStr) || 0;
            return {
              ...i,
              entryMode: 'vk13',
              vk13RecordId: targetRec.id,
              material: targetRec.materialCode || "",
              desc: targetRec.materialName || targetRec.materialCode || "",
              descName: targetRec.materialName || targetRec.materialCode || "",
              hsn: targetRec.hsnSac || "",
              uom: targetRec.uom || "PCS",
              rate: rateStr,
              gstRate: gstRateVal,
              isFixedCharge: isManualRate,
              amount: roundToTwo(q * r),
            };
          }));
        }
      }
    }
  };

  const handleSelectGlobalVk13Record = (recId: string) => {
    setSelectedVk13RecordId(recId);
    const rec = vk13Records.find(r => r.id === recId);
    if (rec) {
      setItems(prev => prev.map(i => {
        if (i.entryMode === 'vk13' || !i.entryMode) {
          const isManualRate = !rec.price || rec.price === 'FIX' || (typeof rec.price === 'number' && rec.price <= 0);
          const rateStr = isManualRate ? (i.rate || "") : sanitizeAmountInput(String(rec.price));
          const gstRateVal = (rec.gstRate !== undefined && rec.gstRate !== null) ? Number(rec.gstRate) : (i.gstRate || 0);
          const q = Number(i.qty) || 0;
          const r = Number(rateStr) || 0;
          return {
            ...i,
            entryMode: 'vk13',
            vk13RecordId: rec.id,
            material: rec.materialCode || "",
            desc: rec.materialName || rec.materialCode || "",
            descName: rec.materialName || rec.materialCode || "",
            hsn: rec.hsnSac || "",
            uom: rec.uom || "PCS",
            rate: rateStr,
            gstRate: gstRateVal,
            isFixedCharge: isManualRate,
            amount: roundToTwo(q * r),
          };
        }
        return i;
      }));
    }
  };

  const handleAddRow = () => {
    if (isReimbursementCharge) {
      if (reimbursementGlobalMode === 'vk13' && vk13Records.length > 0) {
        const targetRec = (selectedVk13RecordId ? vk13Records.find(r => r.id === selectedVk13RecordId) : null) || (vk13Records.length === 1 ? vk13Records[0] : null);
        if (targetRec) {
          const isManualRate = !targetRec.price || targetRec.price === 'FIX' || (typeof targetRec.price === 'number' && targetRec.price <= 0);
          const rateStr = isManualRate ? "" : sanitizeAmountInput(String(targetRec.price));
          setItems(prev => [
            ...prev,
            {
              id: Math.random().toString(),
              material: targetRec.materialCode || "",
              desc: targetRec.materialName || targetRec.materialCode || "",
              descName: targetRec.materialName || targetRec.materialCode || "",
              activity: "",
              hsn: targetRec.hsnSac || "",
              qty: "",
              uom: targetRec.uom || "PCS",
              rate: rateStr,
              amount: 0,
              gstRate: targetRec.gstRate || 0,
              customValues: [],
              isFixedCharge: isManualRate,
              entryMode: 'vk13',
              vk13RecordId: targetRec.id
            }
          ]);
          return;
        }
      }
      setItems(prev => [
        ...prev,
        {
          id: Math.random().toString(),
          desc: "",
          descName: "",
          material: "",
          activity: "",
          hsn: "",
          qty: "",
          uom: "PCS",
          rate: "",
          amount: 0,
          gstRate: 0,
          customValues: [],
          isFixedCharge: false,
          entryMode: 'manual',
          vk13RecordId: undefined
        }
      ]);
    } else {
      setItems(prev => [
        ...prev,
        { id: Math.random().toString(), desc: '', descName: '', activity: '', hsn: '', qty: '', uom: 'PCS', rate: '0', amount: 0, gstRate: 0, customValues: [], isFixedCharge: false }
      ]);
    }
  };

  // Sync initial items for REIMBURSEMENT CHARGE
  useEffect(() => {
    if (!isReimbursementCharge) return;
    if (items.length === 0) {
      if (reimbursementGlobalMode === 'vk13' && vk13Records.length === 1) {
        const rec = vk13Records[0];
        const isManualRate = !rec.price || rec.price === 'FIX' || (typeof rec.price === 'number' && rec.price <= 0);
        const rateStr = isManualRate ? "" : sanitizeAmountInput(String(rec.price));
        setItems([{
          id: Math.random().toString(),
          material: rec.materialCode || "",
          desc: rec.materialName || rec.materialCode || "",
          descName: rec.materialName || rec.materialCode || "",
          activity: "",
          hsn: rec.hsnSac || "",
          qty: "",
          uom: rec.uom || "PCS",
          rate: rateStr,
          amount: 0,
          gstRate: rec.gstRate || 0,
          customValues: [],
          isFixedCharge: isManualRate,
          entryMode: 'vk13',
          vk13RecordId: rec.id
        }]);
      } else {
        setItems([{
          id: Math.random().toString(),
          desc: "",
          descName: "",
          material: "",
          activity: "",
          hsn: "",
          qty: "",
          uom: "PCS",
          rate: "",
          amount: 0,
          gstRate: 0,
          customValues: [],
          isFixedCharge: false,
          entryMode: (vk13Records.length === 0 || reimbursementGlobalMode === 'manual') ? 'manual' : 'vk13',
          vk13RecordId: undefined
        }]);
      }
    } else if (items.length === 1 && !items[0].material && !items[0].desc && vk13Records.length === 1 && reimbursementGlobalMode === 'vk13') {
      const rec = vk13Records[0];
      const isManualRate = !rec.price || rec.price === 'FIX' || (typeof rec.price === 'number' && rec.price <= 0);
      const rateStr = isManualRate ? "" : sanitizeAmountInput(String(rec.price));
      setItems([{
        id: items[0].id,
        material: rec.materialCode || "",
        desc: rec.materialName || rec.materialCode || "",
        descName: rec.materialName || rec.materialCode || "",
        activity: items[0].activity || "",
        hsn: rec.hsnSac || "",
        qty: items[0].qty || "",
        uom: rec.uom || "PCS",
        rate: rateStr,
        amount: roundToTwo((Number(items[0].qty) || 0) * (Number(rateStr) || 0)),
        gstRate: rec.gstRate || 0,
        customValues: items[0].customValues || [],
        isFixedCharge: isManualRate,
        entryMode: 'vk13',
        vk13RecordId: rec.id
      }]);
    }
  }, [isReimbursementCharge, vk13Records, reimbursementGlobalMode, items.length]);

  const handleAddColumn = () => {
    if (customHeaders.length >= 3) return;
    if (!newHeaderName.trim()) return;
    setCustomHeaders([...customHeaders, newHeaderName.trim()]);
    setNewHeaderName("");
    setIsColumnDialogOpen(false);
  };

  const amountColumnLabel = isNonTax ? "Invoice Amount" : isDeliveryChallan ? "Invoice Amount" : "Taxable Amount";

  const handleExecute = useCallback(async () => {
    if (!plantId || !invoiceNo || !billTo || !inventoryType) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Error: Plant, Invoice Number, Bill to Party and Inventory Type are mandatory", isError: true } }));
      return;
    }
    if (!filteredCustomers.some(c => c.customerId === billTo)) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Error: Selected Bill to Party does not belong to the selected Plant.", isError: true } }));
      return;
    }
    if (isShipToApplicable && shipTo && !filteredCustomers.some(c => c.customerId === shipTo)) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Error: Selected Ship to Party does not belong to the selected Plant.", isError: true } }));
      return;
    }
    if (!billPeriod) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Error: Working Month is mandatory. Please select a month and year.", isError: true } }));
      return;
    }

    if (!consignorId) {
      window.dispatchEvent(new CustomEvent('sap-status', {
        detail: {
          text: availableConsignors.length === 0
            ? "Error: No Consignor available for the selected Plant. Cannot create invoice."
            : "Error: Consignor selection is mandatory. Please select a Consignor.",
          isError: true
        }
      }));
      return;
    }

    if (!availableConsignors.some(c => c.id === consignorId)) {
      window.dispatchEvent(new CustomEvent('sap-status', {
        detail: {
          text: "Error: Selected Consignor does not belong to the selected Plant.",
          isError: true
        }
      }));
      return;
    }

    if (isReimbursementCharge) {
      const emptyDescItem = items.find(item => (!item.desc || !item.desc.trim()) && (!item.material || !item.material.trim()));
      if (emptyDescItem) {
        window.dispatchEvent(new CustomEvent('sap-status', {
          detail: {
            text: "Error: Please enter Description/Material for all reimbursement billing items.",
            isError: true
          }
        }));
        return;
      }

      const invalidQtyItem = items.find(item => !item.qty || String(item.qty).trim() === "" || Number(item.qty) <= 0 || isNaN(Number(item.qty)));
      if (invalidQtyItem) {
        window.dispatchEvent(new CustomEvent('sap-status', {
          detail: {
            text: `Error: Quantity (Qty) is mandatory for item '${invalidQtyItem.descName || invalidQtyItem.desc || invalidQtyItem.material || "Item"}'. Please enter a valid quantity greater than zero.`,
            isError: true
          }
        }));
        return;
      }

      const invalidRateItem = items.find(item => !item.rate || Number(item.rate) <= 0 || isNaN(Number(item.rate)));
      if (invalidRateItem) {
        window.dispatchEvent(new CustomEvent('sap-status', {
          detail: {
            text: `Error: Basic Rate is mandatory for item '${invalidRateItem.descName || invalidRateItem.desc || invalidRateItem.material || "Item"}'. Please enter a rate greater than zero.`,
            isError: true
          }
        }));
        return;
      }
    } else {
      const emptyDescItem = items.find(item => !item.desc || !item.desc.trim());
      if (emptyDescItem) {
        window.dispatchEvent(new CustomEvent('sap-status', {
          detail: {
            text: "Error: Please select Material/Description for all billing items.",
            isError: true
          }
        }));
        return;
      }

      const invalidQtyItem = items.find(item => !item.qty || String(item.qty).trim() === "" || Number(item.qty) <= 0 || isNaN(Number(item.qty)));
      if (invalidQtyItem) {
        window.dispatchEvent(new CustomEvent('sap-status', {
          detail: {
            text: `Error: Quantity (Qty) is mandatory for item '${invalidQtyItem.descName || invalidQtyItem.desc || "Item"}'. Please enter a valid quantity greater than zero.`,
            isError: true
          }
        }));
        return;
      }

      const invalidItem = items.find(item => item.isFixedCharge && (!item.rate || Number(item.rate) <= 0));
      if (invalidItem) {
        window.dispatchEvent(new CustomEvent('sap-status', {
          detail: {
            text: `Error: Manual Basic Rate is required for item '${invalidItem.descName || invalidItem.desc}'. Please enter a rate greater than zero.`,
            isError: true
          }
        }));
        return;
      }
    }

    if (!docType || !docCategory) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Error: Valid Document Type and Charge Type must be selected for the selected Plant and Inventory Type", isError: true } }));
      return;
    }

    setIsProcessing(true);
    try {
      const parsedInvoiceDate = parseFlexibleDate(invoiceDate);
      if (!parsedInvoiceDate) {
        window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Error: Invalid Invoice Date format. Please use DD-MMM-YYYY.", isError: true } }));
        setIsProcessing(false);
        return;
      }
      const invoiceDateYYYYMMDD = format(parsedInvoiceDate, 'yyyy-MM-dd');

      const d = parsedInvoiceDate;
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

      const firm = firms?.find(f => f.id === consignorId) || firms?.find(f => getRecordPlantIds(f).includes(plantId));
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
        invoiceDate: toSAPDate(invoiceDateYYYYMMDD),
        billMonth: billPeriod, 
        billYear, 
        docType, 
        docCategory, 
        billType,
        inventoryType,
        vehicleNo: showVehicleNo ? vehicleNo : "",
        consignorId,
        consignorName: firm?.name || "",
        billTo, 
        shipTo: (isShipToApplicable ? shipTo : billTo) || billTo,
        originalInvoiceRef: isCreditNote ? referenceNo : null,
        items: items.map(i => ({
          ...i,
          entryMode: i.entryMode || (isReimbursementCharge ? 'manual' : undefined),
          vk13RecordId: i.vk13RecordId || undefined
        })),
        totals,
        customHeaders,
        note,
        snapshotFirm, snapshotBillTo, snapshotShipTo,
        status: "Completed",
        createdBy: userName,
        createdAt: serverTimestamp()
      });

      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: `${docLabels.no} ${invoiceNo} posted successfully`, isError: false } }));
      resetForm();
    } catch (e) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Document posting failed", isError: true } }));
    } finally {
      setIsProcessing(false);
    }
  }, [db, plantId, invoiceNo, invoiceDate, billPeriod, docType, docCategory, billType, billTo, shipTo, isShipToApplicable, items, totals, customHeaders, note, firms, customers, filteredCustomers, userName, isCreditNote, referenceNo, referenceDocId, docLabels, consignorId, inventoryType, showVehicleNo, resetForm, isReimbursementCharge, availableConsignors]);

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
                <Select value={plantId} onValueChange={handlePlantChange}>
                  <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]"><SelectValue placeholder="Select Plant..." /></SelectTrigger>
                  <SelectContent>
                    {plants?.filter(p => isAdmin || assignedPlantIds.includes(p.plantId)).map(p => <SelectItem key={p.id} value={p.plantId}>{p.plantId} - {p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Inventory Type - Filtered by selected Plant from VOF03 */}
              <div className="sap-selection-row">
                <label className="sap-label">Inventory Type *</label>
                <Select value={inventoryType} onValueChange={setInventoryType} disabled={!plantId}>
                  <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4] disabled:opacity-60 disabled:bg-gray-100">
                    <SelectValue placeholder={!plantId ? "Select Plant first..." : availableInventoryTypes.length === 0 ? "No Inventory Type found" : "Select Inventory Type..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableInventoryTypes.map((inv) => (
                      <SelectItem key={inv} value={inv}>{inv}</SelectItem>
                    ))}
                    {plantId && availableInventoryTypes.length === 0 && (
                      <div className="px-2 py-3 text-center text-[10px] font-bold text-red-500">
                        No Inventory Type configured in VOF03 for selected Plant.
                      </div>
                    )}
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

              {/* Consignor Name */}
              <div className="sap-selection-row">
                <label className="sap-label">Consignor Name *</label>
                {!plantId ? (
                  <Select disabled value="">
                    <SelectTrigger className="h-6 rounded-none border-gray-300 bg-gray-100 text-xs px-1.5 opacity-60">
                      <SelectValue placeholder="Select Plant first..." />
                    </SelectTrigger>
                  </Select>
                ) : availableConsignors.length === 0 ? (
                  <div className="w-full">
                    <Select disabled value="">
                      <SelectTrigger className="h-6 rounded-none border-red-300 bg-red-50 text-xs px-1.5 text-red-600">
                        <SelectValue placeholder="No Consignor found" />
                      </SelectTrigger>
                    </Select>
                    <div className="text-[10px] font-semibold text-red-600 mt-0.5 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      <span>No Consignor found for selected Plant.</span>
                    </div>
                  </div>
                ) : availableConsignors.length === 1 ? (
                  <div className="w-full flex items-center gap-1.5">
                    <Input
                      value={availableConsignors[0].name}
                      readOnly
                      className="h-6 text-xs bg-gray-100 font-semibold text-blue-900 border-gray-400 rounded-none cursor-not-allowed"
                    />
                    <span className="text-[9px] px-1.5 py-0.5 bg-blue-100 text-blue-800 font-bold whitespace-nowrap uppercase rounded-none border border-blue-200">
                      Auto
                    </span>
                  </div>
                ) : (
                  <Select value={consignorId} onValueChange={setConsignorId}>
                    <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]">
                      <SelectValue placeholder="Select Consignor Firm *" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableConsignors.map(f => (
                        <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
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

              {/* Invoice Date Field with DD-MMM-YYYY Format & Keyboard/Picker Input */}
              <div className="sap-selection-row">
                <label className="sap-label">Invoice Date *</label>
                <SapDateInput
                  value={invoiceDate}
                  onChange={setInvoiceDate}
                  className="h-6 border border-gray-400 rounded-none bg-white font-mono text-xs"
                />
              </div>
              
              <div className="sap-selection-row">
                <label className="sap-label">Bill to Party *</label>
                <PartyDropdown
                  value={billTo}
                  onValueChange={(v) => { setBillTo(v); }}
                  customers={filteredCustomers}
                  placeholder={!plantId ? "Select Plant first..." : "Select Bill to Party..."}
                  disabled={!plantId}
                />
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
                  <PartyDropdown
                    value={shipTo}
                    onValueChange={setShipTo}
                    customers={filteredCustomers}
                    placeholder={!plantId ? "Select Plant first..." : "Select Ship to Party..."}
                    disabled={!plantId}
                  />
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

              {/* Document Type - Filtered by selected Plant from VOF03 */}
              <div className="sap-selection-row">
                <label className="sap-label">Document Type *</label>
                <Select value={docType} onValueChange={(v) => { setDocType(v); }} disabled={!plantId}>
                  <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4] disabled:opacity-60 disabled:bg-gray-100">
                    <SelectValue placeholder={!plantId ? "Select Plant first..." : availableDocumentTypes.length === 0 ? "No Document Type found" : "Select Document Type..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDocumentTypes.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                    {plantId && availableDocumentTypes.length === 0 && (
                      <div className="px-2 py-3 text-center text-[10px] font-bold text-red-500">{noBillingConfigMessage}</div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Charge Type - Filtered by selected Plant from VOF03 */}
              <div className="sap-selection-row">
                <label className="sap-label">Charge Type *</label>
                <Select
                  value={docCategory}
                  onValueChange={v => {
                    setDocCategory(v);
                    if (!isCreditNote) setItems([{ id: '1', desc: '', descName: '', activity: '', hsn: '', qty: '', uom: 'PCS', rate: '0', amount: 0, gstRate: 0, customValues: [], isFixedCharge: false }]);
                  }}
                  disabled={!plantId}
                >
                  <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4] disabled:opacity-60 disabled:bg-gray-100">
                    <SelectValue placeholder={!plantId ? "Select Plant first..." : availableChargeTypes.length === 0 ? "No Charge Type found" : "Select Charge Type..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableChargeTypes.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                    {plantId && availableChargeTypes.length === 0 && (
                      <div className="px-2 py-3 text-center text-[10px] font-bold text-red-500">{noBillingConfigMessage}</div>
                    )}
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
          {(isFetchingOptions || isVk13Loading) && <div className="absolute inset-0 bg-white/60 z-20 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>}
          <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-[12px] font-semibold text-gray-700 uppercase">Billing Items</span>
              <Dialog open={isColumnDialogOpen} onOpenChange={setIsColumnDialogOpen}>
                <DialogTrigger asChild><Button variant="outline" size="sm" className="h-5 text-[9px] px-2 rounded-none gap-1" disabled={customHeaders.length >= 3}><Columns className="h-3 w-3" /> Add Column ({customHeaders.length}/3)</Button></DialogTrigger>
                <DialogContent className="max-w-sm rounded-none border-gray-400 p-0 overflow-hidden shadow-2xl">
                  <div className="bg-[#333e4f] text-white p-3 flex justify-between items-center"><DialogTitle className="text-[11px] font-black uppercase tracking-widest">Column Header</DialogTitle><button onClick={() => setIsColumnDialogOpen(false)}><X className="h-4 w-4" /></button></div>
                  <div className="p-6 bg-white space-y-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Column Name</label>
                    <Input value={newHeaderName} onChange={e => setNewHeaderName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddColumn()} autoFocus />
                  </div>
                  <div className="bg-[#e1e1e1] p-3 flex justify-end gap-3"><Button onClick={handleAddColumn} className="rounded-none bg-blue-700 text-white h-8 text-xs px-6">Add Column</Button></div>
                </DialogContent>
              </Dialog>
            </div>
            <Button onClick={handleAddRow} variant="ghost" size="sm" className="h-5 text-[10px]"><Plus className="h-3 w-3 mr-1" /> Add Row</Button>
          </div>

          {/* Section 6 & 7: REIMBURSEMENT CHARGE Rate Records Info & Global Mode Toggle */}
          {isReimbursementCharge && (
            <>
              {vk13Records.length === 0 && !isVk13Loading && (
                <div className="px-3 py-2 bg-blue-50 border-b border-blue-200 flex items-center gap-2 animate-in slide-in-from-top-1 duration-200">
                  <Info className="h-4 w-4 text-blue-600 shrink-0" />
                  <span className="text-[11px] font-bold text-blue-800">
                    No VK13 rate record found for the selected Plant. Manual Billing Item entry is available.
                  </span>
                </div>
              )}
              {vk13Records.length > 0 && (
                <div className="px-3 py-2 bg-[#f4f7fa] border-b border-[#b5c7de] flex flex-wrap items-center justify-between gap-3 animate-in slide-in-from-top-1 duration-200">
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-[11px] font-bold text-gray-700 uppercase">Billing Item Mode:</span>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer font-semibold text-gray-800 hover:text-blue-900">
                      <input
                        type="radio"
                        name="reimbursementGlobalMode"
                        checked={reimbursementGlobalMode === 'vk13'}
                        onChange={() => handleGlobalModeChange('vk13')}
                        className="accent-blue-600 cursor-pointer"
                      />
                      <span>Use VK13 Rate Record</span>
                    </label>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer font-semibold text-gray-800 hover:text-blue-900">
                      <input
                        type="radio"
                        name="reimbursementGlobalMode"
                        checked={reimbursementGlobalMode === 'manual'}
                        onChange={() => handleGlobalModeChange('manual')}
                        className="accent-blue-600 cursor-pointer"
                      />
                      <span>Manual Entry</span>
                    </label>
                  </div>
                  {reimbursementGlobalMode === 'vk13' && vk13Records.length > 1 && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-[11px] font-bold text-gray-700 whitespace-nowrap">Select VK13 Rate Record:</span>
                      <Select value={selectedVk13RecordId} onValueChange={handleSelectGlobalVk13Record}>
                        <SelectTrigger className="h-6 w-80 rounded-none border-gray-400 bg-white text-xs px-2 focus:bg-[#fff9c4]">
                          <SelectValue placeholder="Select VK13 Rate Record..." />
                        </SelectTrigger>
                        <SelectContent>
                          {vk13Records.map(rec => (
                            <SelectItem key={rec.id} value={rec.id}>
                              {rec.materialCode} {rec.materialName ? `(${rec.materialName})` : ''} - ₹{rec.price || 'Manual'} - GST {rec.gstRate ? `${rec.gstRate}%` : '0%'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {!isReimbursementCharge && noValidPriceRowMaterial && (
            <div className="px-3 py-2 bg-red-50 border-b border-red-200 flex items-center gap-2 animate-in slide-in-from-top-1 duration-200">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
              <span className="text-[11px] font-bold text-red-700">
                Material {noValidPriceRowMaterial}: {noValidPriceMessage}
              </span>
            </div>
          )}

          {isReimbursementCharge ? (
            /* REIMBURSEMENT CHARGE Billing Items Table */
            <Table>
              <TableHeader className="bg-[#e7ebf1]">
                <TableRow className="h-7">
                  <TableHead className="text-[11px] font-bold border-r w-8 text-center">#</TableHead>
                  <TableHead className="text-[11px] font-bold border-r w-24 text-center">Source</TableHead>
                  <TableHead className="text-[11px] font-bold border-r w-32">Material</TableHead>
                  <TableHead className="text-[11px] font-bold border-r min-w-[140px]">Description</TableHead>
                  <TableHead className="text-[11px] font-bold border-r w-32">Activity</TableHead>
                  {customHeaders.map((h, idx) => <TableHead key={idx} className="text-[11px] font-bold border-r bg-blue-50/20 text-blue-900 min-w-[100px]">{h}</TableHead>)}
                  <TableHead className="text-[11px] font-bold border-r w-20 text-center">HSN/SAC</TableHead>
                  <TableHead className="text-[11px] font-bold border-r w-20 text-center">Qty</TableHead>
                  <TableHead className="text-[11px] font-bold border-r w-16 text-center">UOM</TableHead>
                  <TableHead className="text-[11px] font-bold border-r w-20 text-center">GST Rate %</TableHead>
                  <TableHead className="text-[11px] font-bold border-r w-20 text-center">Basic Rate</TableHead>
                  <TableHead className="text-[11px] font-bold text-right w-32 pr-4">{amountColumnLabel}</TableHead>
                  <TableHead className="w-8"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row, idx) => {
                  const isVk13Row = row.entryMode === 'vk13';
                  const activeVk13Rec = isVk13Row && row.vk13RecordId ? vk13Records.find(r => r.id === row.vk13RecordId) : null;
                  const isRateControlled = Boolean(isVk13Row && activeVk13Rec && Number(activeVk13Rec.price) > 0 && activeVk13Rec.price !== 'FIX');
                  const isGstControlled = Boolean(isVk13Row && activeVk13Rec && activeVk13Rec.gstRate !== undefined && activeVk13Rec.gstRate !== null && Number(activeVk13Rec.gstRate) > 0);
                  const isMaterialControlled = Boolean(isVk13Row && activeVk13Rec && activeVk13Rec.materialCode);

                  return (
                    <TableRow key={row.id} className="h-7 hover:bg-blue-50/30">
                      <TableCell className="p-0 border-r text-center text-[10px] text-gray-500">{idx + 1}</TableCell>
                      
                      {/* Source with Toggle */}
                      <TableCell className="p-0 border-r text-center">
                        <div className="flex items-center justify-center gap-1">
                          {isVk13Row ? (
                            <span className="px-1.5 py-0.5 text-[9px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                              VK13
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              Manual
                            </span>
                          )}
                          <Popover>
                            <PopoverTrigger asChild>
                              <button className="text-[9px] text-gray-400 hover:text-blue-600 p-0.5" title="Change row entry source">
                                <ChevronDown className="h-3 w-3" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-60 p-2 text-xs space-y-1.5" align="start">
                              <div className="font-bold text-[10px] text-gray-500 uppercase pb-1 border-b">Row Entry Source</div>
                              <button
                                onClick={() => setItemToManual(row.id)}
                                className={cn(
                                  "w-full text-left px-2 py-1 text-xs rounded flex items-center justify-between hover:bg-gray-100",
                                  !isVk13Row && "bg-amber-50 font-bold text-amber-900 border border-amber-200"
                                )}
                              >
                                <span>Manual Entry</span>
                                {!isVk13Row && <Check className="h-3.5 w-3.5 text-amber-700" />}
                              </button>
                              {vk13Records.length > 0 && (
                                <div className="pt-1 border-t space-y-1">
                                  <div className="text-[9px] text-gray-500 font-bold uppercase">Apply VK13 Rate Record:</div>
                                  {vk13Records.map(r => (
                                    <button
                                      key={r.id}
                                      onClick={() => setItemToVk13Record(row.id, r.id)}
                                      className={cn(
                                        "w-full text-left px-2 py-1 text-[11px] rounded hover:bg-blue-50 flex items-center justify-between",
                                        isVk13Row && row.vk13RecordId === r.id && "bg-blue-50 font-bold text-blue-900 border border-blue-200"
                                      )}
                                    >
                                      <span className="truncate">{r.materialCode} - ₹{r.price || 'Manual'} ({r.gstRate || 0}%)</span>
                                      {isVk13Row && row.vk13RecordId === r.id && <Check className="h-3 w-3 text-blue-700 shrink-0" />}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </PopoverContent>
                          </Popover>
                        </div>
                      </TableCell>

                      {/* Material */}
                      <TableCell className="p-0 border-r">
                        <Input
                          className={cn(
                            "h-full border-none text-xs uppercase px-2",
                            isMaterialControlled ? "bg-gray-100 text-blue-950 font-semibold" : "focus:bg-[#fff9c4]"
                          )}
                          value={row.material || ""}
                          onChange={e => updateReimbursementItem(row.id, 'material', e.target.value)}
                          readOnly={isMaterialControlled}
                          placeholder="Material code..."
                        />
                      </TableCell>

                      {/* Description */}
                      <TableCell className="p-0 border-r">
                        <Input
                          className="h-full border-none focus:bg-[#fff9c4] text-xs px-2"
                          value={row.descName || row.desc || ""}
                          onChange={e => updateReimbursementItem(row.id, 'desc', e.target.value)}
                          placeholder="Enter description..."
                        />
                      </TableCell>

                      {/* Activity */}
                      <TableCell className="p-0 border-r">
                        <Input
                          className="h-full border-none focus:bg-[#fff9c4] text-xs px-2"
                          value={row.activity || ""}
                          onChange={e => updateReimbursementItem(row.id, 'activity', e.target.value)}
                          placeholder="Enter activity..."
                        />
                      </TableCell>

                      {/* Custom Headers */}
                      {customHeaders.map((_, hIdx) => (
                        <TableCell key={hIdx} className="p-0 border-r">
                          <Input
                            className="h-full border-none focus:bg-[#fff9c4] text-xs px-2"
                            value={row.customValues?.[hIdx] || ""}
                            onChange={e => updateReimbursementItem(row.id, hIdx, e.target.value)}
                          />
                        </TableCell>
                      ))}

                      {/* HSN/SAC */}
                      <TableCell className="p-0 border-r">
                        <Input
                          className={cn(
                            "h-full border-none text-center text-xs px-1",
                            isVk13Row && row.hsn ? "bg-gray-50 font-mono" : "focus:bg-[#fff9c4]"
                          )}
                          value={row.hsn || ""}
                          onChange={e => updateReimbursementItem(row.id, 'hsn', e.target.value)}
                          readOnly={isVk13Row && Boolean(row.hsn)}
                          placeholder="HSN/SAC"
                        />
                      </TableCell>

                      {/* Qty */}
                      <TableCell className="p-0 border-r">
                        <Input
                          type="number"
                          className="h-full border-none text-center font-bold text-emerald-800 focus:bg-[#fff9c4] text-xs px-1"
                          value={row.qty}
                          onChange={e => updateReimbursementItem(row.id, 'qty', e.target.value)}
                          placeholder="0"
                        />
                      </TableCell>

                      {/* UOM */}
                      <TableCell className="p-0 border-r text-center text-[10px]">
                        <Input
                          className={cn(
                            "h-full border-none text-center text-xs uppercase px-1",
                            isVk13Row && row.uom ? "bg-gray-50" : "focus:bg-[#fff9c4]"
                          )}
                          value={row.uom || "PCS"}
                          onChange={e => updateReimbursementItem(row.id, 'uom', e.target.value.toUpperCase())}
                          readOnly={isVk13Row && Boolean(row.uom)}
                        />
                      </TableCell>

                      {/* GST Rate % */}
                      <TableCell className="p-0 border-r text-center font-bold text-[10px] text-purple-700">
                        {isGstControlled ? (
                          <Input
                            className="h-full border-none text-center bg-gray-50 text-xs font-bold text-purple-700 px-1"
                            value={row.gstRate !== undefined ? `${row.gstRate}%` : "-"}
                            readOnly
                            title="GST Rate from VK13 - read only"
                          />
                        ) : (
                          <Input
                            type="number"
                            className="h-full border-none text-center bg-white text-purple-700 font-bold text-xs focus:bg-[#fff9c4] px-1"
                            value={row.gstRate ?? ""}
                            onChange={e => updateReimbursementItem(row.id, 'gstRate', e.target.value)}
                            placeholder="GST %"
                            title="Manual GST Rate entry"
                          />
                        )}
                      </TableCell>

                      {/* Basic Rate */}
                      <TableCell className="p-0 border-r">
                        {isRateControlled ? (
                          <Input
                            className="h-full border-none text-center font-bold text-xs bg-gray-100 text-gray-600 px-1"
                            value={row.rate}
                            readOnly
                            title="Basic Rate from VK13 - read only"
                          />
                        ) : (
                          <Input
                            type="number"
                            className="h-full border-none text-center font-bold text-xs bg-white text-emerald-700 focus:bg-[#fff9c4] px-1"
                            value={row.rate}
                            onChange={e => updateReimbursementItem(row.id, 'rate', e.target.value)}
                            placeholder="Rate"
                            title="Manual Basic Rate entry"
                          />
                        )}
                      </TableCell>

                      {/* Amount */}
                      <TableCell className="p-0 border-r bg-gray-50/50 text-right text-[11px] px-2 font-mono pr-4">
                        {formatAmount(row.amount)}
                      </TableCell>

                      {/* Delete */}
                      <TableCell className="p-0 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-red-500"
                          onClick={() => items.length > 1 && setItems(items.filter(i => i.id !== row.id))}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            /* Standard VF01 Billing Items Table for all other charge types - EXACTLY UNCHANGED */
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
                  <TableHead className="text-[11px] font-bold border-r w-20 text-center">GST Rate %</TableHead>
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
                      <SapCombobox
                        options={availableOptions.map(opt => ({
                          value: opt.id,
                          label: opt.materialName || opt.materialCode,
                          subLabel: opt.price ? `Rate: ${opt.price}` : undefined
                        }))}
                        value={row.desc}
                        onChange={v => updateItem(row.id, 'desc', v)}
                        placeholder="Type or select material..."
                        className="h-full border-none bg-transparent"
                        inputClassName="border-none bg-transparent text-xs h-full px-2 cursor-pointer focus:cursor-text"
                        allowCustomValue={false}
                      />
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
                    <TableCell className="p-0 border-r text-center text-[10px]"><Input className="h-full border-none text-center bg-gray-50 text-xs" value={row.uom} readOnly /></TableCell>
                    <TableCell className="p-0 border-r text-center font-bold text-[10px] text-purple-700"><Input className="h-full border-none text-center bg-gray-50 text-xs" value={row.gstRate ? `${row.gstRate}%` : "-"} readOnly /></TableCell>
                    <TableCell className="p-0 border-r">
                      <Input
                        type="number"
                        className={cn("h-full border-none text-center font-bold text-xs", row.isFixedCharge ? "bg-white text-emerald-700" : "bg-gray-100 text-gray-600")}
                        value={row.rate}
                        onChange={e => updateItem(row.id, 'rate', e.target.value)}
                        readOnly={!row.isFixedCharge}
                        title={row.isFixedCharge ? "Fixed charge - editable" : "Basic Rate from VK13 - read only"}
                      />
                    </TableCell>
                    <TableCell className="p-0 border-r bg-gray-50/50 text-right text-[11px] px-2 font-mono pr-4">{formatAmount(row.amount)}</TableCell>
                    <TableCell className="p-0 text-center"><Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => items.length > 1 && setItems(items.filter(i => i.id !== row.id))}><Trash2 className="h-3 w-3" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
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
                  <div className="flex justify-between border-b pb-1"><span>Invoice Amount</span><span className="font-mono font-bold">{formatAmount(totals.taxableAmount)}</span></div>
                  <div className="p-2 border border-blue-100 bg-blue-50 italic text-blue-800">Non-Tax Transaction - No GST applicable</div>
                </>
              ) : isRCM ? (
                <>
                  <div className="flex justify-between border-b pb-1"><span>Invoice Amount (Excl. GST)</span><span className="font-mono font-bold">{formatAmount(totals.taxableAmount)}</span></div>
                  <div className="p-2 border border-orange-200 bg-orange-50 italic text-orange-700 text-[10px]">
                    GST is payable by the recipient under Reverse Charge Mechanism (RCM)
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between border-b pb-1"><span>Taxable Amount</span><span className="font-mono font-bold">{formatAmount(totals.taxableAmount)}</span></div>
                  {totals.isInterstate ? (
                    <div className="flex justify-between text-blue-800"><span>IGST ({totals.avgGst}%)</span><span className="font-mono font-bold">{formatAmount(totals.igst)}</span></div>
                  ) : (
                    <>
                      <div className="flex justify-between text-emerald-700"><span>CGST ({totals.avgGst / 2}%)</span><span className="font-mono font-bold">{formatAmount(totals.cgst)}</span></div>
                      <div className="flex justify-between text-emerald-700"><span>SGST ({totals.avgGst / 2}%)</span><span className="font-mono font-bold">{formatAmount(totals.sgst)}</span></div>
                    </>
                  )}
                </>
              )}
              <div className="flex justify-between pt-2 border-t text-sm font-black text-emerald-900 uppercase"><span>{isNonTax ? "Net Total" : isRCM ? "Net Payable (Excl. GST)" : "Gross Payable"}</span><span className="font-mono text-lg">₹ {formatAmount(totals.grossAmount)}</span></div>
            </div>
          </div>
        </div>
      </div>
      {isProcessing && <div className="fixed bottom-10 right-10 bg-[#333e4f] text-white px-4 py-2 text-xs border border-white/20 animate-pulse z-50">SAVING DOCUMENT...</div>}
    </div>
  );
}