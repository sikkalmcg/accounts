"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDatabase, useCollection, useMemoDatabase, updateDocumentNonBlocking } from "@/database";
import { collection, query, orderBy, doc, DocumentReference } from "@/database/mongo";
import { Search, Loader2, QrCode, ArrowLeft, CheckCircle2, X, RotateCcw, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import { toSAPDate } from "@/lib/date-utils";
import { SapDateInput } from "@/components/ui/sap-date-input";
import { getRecordPlantIds } from "@/lib/plant-master";
import { formatAmount } from "@/lib/number-utils";
import { IRNPreviewDialog, matchesDateRange } from "./IRNShared";
import { validateDuplicate } from "@/lib/duplicate-validator";
import PlantMultiSelect from "./PlantMultiSelect";

const getInitialDates = () => {
  const now = new Date();
  const past7 = new Date();
  past7.setDate(now.getDate() - 7);
  const toISO = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  return {
    from: toISO(past7),
    to: toISO(now)
  };
};

export default function IRN01() {
  const db = useDatabase();
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [search, setSearch] = useState("");
  const [assignedPlantId, setAssignedPlantId] = useState("");
  const [assignedPlantIds, setAssignedPlantIds] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  // Date and Plant filters (Default 1 week)
  const initialDates = useMemo(() => getInitialDates(), []);
  const [fromDate, setFromDate] = useState(initialDates.from);
  const [toDate, setToDate] = useState(initialDates.to);
  const [filterPlants, setFilterPlants] = useState<string[]>([]);

  const [irnData, setIrnData] = useState({
    irnNumber: "",
    ackNo: "",
    ackDate: new Date().toISOString().split('T')[0],
    qrData: "",
  });

  const [userName, setUserName] = useState("USER");

  useEffect(() => {
    const stored = localStorage.getItem("sikka_user");
    if (stored) {
      const parsed = JSON.parse(stored);
      const sysAdmin = parsed.username === "ajaysomra" || parsed.role === 'admin';
      setIsAdmin(sysAdmin);
      const plantIds = Array.isArray(parsed.assignedPlantIds)
        ? parsed.assignedPlantIds
        : (parsed.assignedPlantId ? [parsed.assignedPlantId] : []);
      setAssignedPlantIds(plantIds);
      setAssignedPlantId(parsed.assignedPlantId || "");
      setUserName(parsed.name || parsed.username || "USER");
      if (!sysAdmin && plantIds.length > 0) {
        setFilterPlants([...plantIds]);
      }
    }
  }, []);

  const allowedPlantIds = useMemo(() => {
    if (isAdmin) return undefined;
    return assignedPlantIds.length > 0 ? assignedPlantIds : (assignedPlantId ? [assignedPlantId] : undefined);
  }, [isAdmin, assignedPlantIds, assignedPlantId]);

  const invoicesQuery = useMemoDatabase(() => query(collection(db, "sales_invoices"), orderBy("createdAt", "desc")), [db]);
  const { data: allInvoices, isLoading } = useCollection(invoicesQuery);
  const plantsQuery = useMemoDatabase(() => collection(db, "plants"), [db]);
  const { data: plants } = useCollection(plantsQuery);
  const customersQuery = useMemoDatabase(() => collection(db, "customers"), [db]);
  const { data: customers } = useCollection(customersQuery);
  const firmsQuery = useMemoDatabase(() => collection(db, "firms"), [db]);
  const { data: firms } = useCollection(firmsQuery);

  const customerMap = useMemo(() => {
    const map: Record<string, any> = {};
    customers?.forEach(c => { map[c.customerId] = c; });
    return map;
  }, [customers]);

  const filteredInvoices = useMemo(() => {
    if (!allInvoices) return [];
    let base = allInvoices;

    // 1. Plant authorization for non-admin
    if (!isAdmin) {
      const allowed = assignedPlantIds.length > 0 ? assignedPlantIds : (assignedPlantId ? [assignedPlantId] : []);
      if (allowed.length > 0) {
        base = base.filter(i => allowed.includes(i.plantId));
      }
    }

    // 2. Filter by user-selected Plant(s)
    if (filterPlants.length > 0) {
      base = base.filter(i => filterPlants.includes(i.plantId));
    }

    // 3. Exclude Cancelled, Non-Tax Invoices, and those with IRN already
    base = base.filter(i => 
      (!i.irnNumber || i.irnNumber.trim() === "") && 
      i.status !== "Cancelled" &&
      i.docType?.toUpperCase() !== "NON-TAX INVOICE"
    );

    // 4. Date Range Filter
    if (fromDate || toDate) {
      base = base.filter(i => {
        const invDate = i.invoiceDate || i.createdAt;
        return matchesDateRange(invDate, fromDate, toDate);
      });
    }

    // 5. Search query filter
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      base = base.filter(i => 
        i.invoiceNumber?.toLowerCase().includes(q) ||
        i.plantId?.toLowerCase().includes(q) ||
        customerMap[i.billTo]?.name?.toLowerCase().includes(q) ||
        customerMap[i.shipTo]?.name?.toLowerCase().includes(q) ||
        customerMap[i.billTo]?.gstin?.toLowerCase().includes(q) ||
        customerMap[i.shipTo]?.gstin?.toLowerCase().includes(q) ||
        i.billYear?.toLowerCase().includes(q)
      );
    }

    return base;
  }, [allInvoices, search, isAdmin, assignedPlantId, assignedPlantIds, filterPlants, fromDate, toDate, customerMap]);

  const handleExecute = useCallback(async () => {
    if (!selectedInvoice) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Error: No invoice selected", isError: true } }));
      return;
    }

    // Mandatory fields: IRN Number, ACK Number, ACK Date, QR Code
    const missing: string[] = [];
    if (!irnData.irnNumber?.trim()) missing.push("IRN Number");
    if (!irnData.ackNo?.trim()) missing.push("ACK Number");
    if (!irnData.ackDate?.trim()) missing.push("ACK Date");
    if (!irnData.qrData?.trim()) missing.push("QR Code");
    if (missing.length > 0) {
      window.dispatchEvent(new CustomEvent('sap-status', {
        detail: { text: `Validation Error: Missing mandatory field(s): ${missing.join(", ")}`, isError: true }
      }));
      return;
    }

    setIsGenerating(true);
    try {
      // Duplicate validation across all plants (collection-level, regardless of selected plant)
      const irnError = await validateDuplicate(db, "sales_invoices", "irnNumber", irnData.irnNumber);
      if (irnError) {
        window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: irnError, isError: true } }));
        setIsGenerating(false);
        return;
      }
      const ackError = await validateDuplicate(db, "sales_invoices", "ackNo", irnData.ackNo);
      if (ackError) {
        window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: ackError, isError: true } }));
        setIsGenerating(false);
        return;
      }

      // Sync Invoice Date with ACK Date as per requirement
      const syncedDate = toSAPDate(irnData.ackDate);

      updateDocumentNonBlocking(doc(db, "sales_invoices", selectedInvoice.id), {
        irnNumber: irnData.irnNumber.trim().toUpperCase(),
        ackNo: irnData.ackNo.trim().toUpperCase(),
        ackDate: syncedDate,
        invoiceDate: syncedDate, // Ensure Invoice Date is updated to match ACK Date
        qrData: irnData.qrData,
        irnStatus: "Generated",
        irnUpdatedAt: new Date().toISOString(),
        irnGeneratedBy: userName
      });

      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: `IRN generated for invoice ${selectedInvoice.invoiceNumber}`, isError: false } }));
      setTimeout(() => {
        setSelectedInvoice(null);
        setIrnData({ irnNumber: "", ackNo: "", ackDate: new Date().toISOString().split('T')[0], qrData: "" });
        setIsGenerating(false);
      }, 500);
    } catch (e) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "System Error: IRN generation failed", isError: true } }));
      setIsGenerating(false);
    }
  }, [db, selectedInvoice, irnData, userName]);

  if (selectedInvoice) {
    const consignee = customerMap[selectedInvoice.billTo];
    const shipTo = customerMap[selectedInvoice.shipTo] || consignee;
    const totals = selectedInvoice.totals || {};
    const item1 = selectedInvoice.items?.[0] || {};
    const gstPct = totals.avgGst || 0;
    const isInterstate = totals.isInterstate;
const firm = firms?.find(f => getRecordPlantIds(f).includes(selectedInvoice.plantId));

    const description = selectedInvoice.description || item1.desc || item1.activity || "N/A";
    const totalQuantity = selectedInvoice.totals?.totalQty || 0;
    const quantityWithUom = totalQuantity ? `${Number(totalQuantity).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} ${item1.uom || "PCS"}` : "0 PCS";
    const invoiceDate = selectedInvoice.invoiceDate || selectedInvoice.createdAt || "";

    return (
      <div className="w-full flex flex-col bg-white min-h-full select-text animate-in slide-in-from-right duration-300">
        <div className="bg-[#dae8f5] px-4 py-1 border-b border-gray-300 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => setSelectedInvoice(null)} className="p-1 hover:bg-black/5 rounded text-blue-800"><ArrowLeft className="h-4 w-4" /></button>
            <h2 className="text-[13px] font-bold text-gray-800 uppercase italic tracking-wider">Generate IRN: Invoice {selectedInvoice.invoiceNumber}</h2>
          </div>
        </div>
        <div className="p-4 space-y-4">
          <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
            <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[11px] font-semibold text-gray-700">Invoice Context</div>
            <div className="p-3 grid grid-cols-4 gap-x-6 gap-y-4 text-[11px]">
              <div><label className="text-gray-500 block uppercase font-bold text-[9px]">Plant</label><span className="font-bold">{selectedInvoice.plantId}</span></div>
              <div><label className="text-gray-500 block uppercase font-bold text-[9px]">Consignor Name</label><span className="font-bold truncate">{firm?.name || "N/A"}</span></div>
              <div><label className="text-gray-500 block uppercase font-bold text-[9px]">Consignor GSTIN</label><span className="font-bold font-mono">{firm?.gstin || "N/A"}</span></div>
              <div><label className="text-gray-500 block uppercase font-bold text-[9px]">Consignor State</label><span className="font-bold">{firm?.stateName || firm?.state || "N/A"}</span></div>

              <div><label className="text-gray-500 block uppercase font-bold text-[9px]">Bill-to Party Name</label><span className="font-bold truncate">{consignee?.name || "N/A"}</span></div>
              <div><label className="text-gray-500 block uppercase font-bold text-[9px]">Bill-to Party GSTIN</label><span className="font-bold font-mono">{consignee?.gstin || "N/A"}</span></div>
              <div><label className="text-gray-500 block uppercase font-bold text-[9px]">Bill-to Party State</label><span className="font-bold">{consignee?.stateName || "N/A"}</span></div>
              <div><label className="text-gray-500 block uppercase font-bold text-[9px]">Invoice No.</label><span className="font-bold text-blue-700">{selectedInvoice.invoiceNumber}</span></div>

              <div><label className="text-gray-500 block uppercase font-bold text-[9px]">Invoice Date</label><span className="font-bold">{invoiceDate}</span></div>
              <div><label className="text-gray-500 block uppercase font-bold text-[9px]">Inventory Type</label><span className="font-bold uppercase">{selectedInvoice.inventoryType || "N/A"}</span></div>
              <div><label className="text-gray-500 block uppercase font-bold text-[9px]">Document Type</label><span className="font-bold uppercase">{selectedInvoice.docType || "N/A"}</span></div>
              <div><label className="text-gray-500 block uppercase font-bold text-[9px]">Charge Type</label><span className="font-bold uppercase text-blue-800">{selectedInvoice.docCategory || "N/A"}</span></div>

              <div className="col-span-2"><label className="text-gray-500 block uppercase font-bold text-[9px]">Description</label><span className="font-bold truncate block">{description}</span></div>
              <div><label className="text-gray-500 block uppercase font-bold text-[9px]">Total Quantity with UOM</label><span className="font-bold">{quantityWithUom}</span></div>
              <div><label className="text-gray-500 block uppercase font-bold text-[9px]">HSN/SAC Code</label><span className="font-bold">{item1.hsn || "N/A"}</span></div>
              <div><label className="text-gray-500 block uppercase font-bold text-[9px]">Taxable Amount</label><span className="font-bold">₹ {formatAmount(totals.taxableAmount)}</span></div>

              <div><label className="text-gray-500 block uppercase font-bold text-[9px]">GST Rate (%)</label><span className="font-bold">{gstPct.toFixed(2)}</span></div>
              {!isInterstate ? (
                <>
                  <div><label className="text-gray-500 block uppercase font-bold text-[9px]">CGST Amount</label><span className="font-bold">₹ {formatAmount(totals.cgst)}</span></div>
                  <div><label className="text-gray-500 block uppercase font-bold text-[9px]">SGST Amount</label><span className="font-bold">₹ {formatAmount(totals.sgst)}</span></div>
                </>
              ) : (
                <>
                  <div className="col-span-2"><label className="text-gray-500 block uppercase font-bold text-[9px]">IGST Amount</label><span className="font-bold">₹ {formatAmount(totals.igst)}</span></div>
                </>
              )}

              <div className="bg-emerald-700 p-1.5 rounded-sm text-white col-span-4 flex justify-between items-center mt-2 shadow-sm">
                <span className="uppercase font-bold text-[9px] tracking-widest">Gross Payable Amount (Final Settlement)</span>
                <span className="font-black text-[13px]">₹ {formatAmount(selectedInvoice.totals?.grossAmount)}</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2 border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f0f4f8]">
              <div className="bg-[#dae8f5] px-3 py-1 border-b border-[#b5c7de] text-[12px] font-bold text-blue-900 flex items-center gap-2"><QrCode className="h-4 w-4" /> IRN Data Entry</div>
              <div className="p-4 space-y-4">
                <div className="sap-selection-row"><label className="sap-label w-40">IRN Number</label><Input value={irnData.irnNumber} onChange={e => setIrnData({...irnData, irnNumber: e.target.value})} className="font-mono text-[11px] tracking-widest" /></div>
                <div className="sap-selection-row"><label className="sap-label w-40">ACK Number</label><Input value={irnData.ackNo} onChange={e => setIrnData({...irnData, ackNo: e.target.value})} className="font-mono w-64" /></div>
<div className="sap-selection-row"><label className="sap-label w-40">ACK Date</label><SapDateInput value={irnData.ackDate} onChange={val => setIrnData({...irnData, ackDate: val})} className="w-48" /></div>
              </div>
            </div>
            <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-white">
              <div className="bg-[#dae8f5] px-3 py-1 border-b border-[#b5c7de] text-[12px] font-bold text-gray-700">QR Code</div>
              <div onPaste={(e) => {
                const items = e.clipboardData.items;
                for (const item of Array.from(items)) {
                  if (item.type.indexOf("image") !== -1) {
                    const reader = new FileReader();
                    reader.onload = (ev) => setIrnData(prev => ({ ...prev, qrData: ev.target?.result as string }));
                    reader.readAsDataURL(item.getAsFile()!);
                  }
                }
              }} className="h-48 m-4 border-2 border-dashed border-gray-300 flex flex-col items-center justify-center bg-gray-50 relative">
                {irnData.qrData ? <><Image src={irnData.qrData} alt="QR" fill className="object-contain p-2" /><button onClick={() => setIrnData({...irnData, qrData: ""})} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5"><X className="h-3 w-3" /></button></> : <div className="text-gray-400 text-center"><QrCode className="h-10 w-10 mx-auto opacity-20" /><p className="text-[10px] uppercase font-bold">Ctrl+V to paste QR</p></div>}
              </div>
            </div>
          </div>
        </div>
        <div className="mt-auto border-t bg-[#e1e1e1] p-3 flex justify-end gap-3 shadow-inner">
          <Button onClick={() => setSelectedInvoice(null)} variant="outline" className="rounded-none h-8 uppercase text-xs font-bold">Cancel</Button>
          <Button onClick={handleExecute} disabled={isGenerating} className="rounded-none bg-emerald-700 hover:bg-emerald-800 text-white h-8 gap-2 uppercase text-xs font-bold">{isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Generate IRN</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col bg-white min-h-full select-text">
      <div className="sap-header-title">IRN01 - E-Invoicing Control Center (Pending IRN)</div>
      
      {/* Selection / Filter Bar */}
      <div className="bg-[#e7ebf1] border-b border-[#b5c7de] px-4 py-1.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Plant MultiSelect */}
          <div className="flex items-center gap-1.5">
            <label className="text-[11px] font-bold text-gray-700 uppercase whitespace-nowrap">Plant:</label>
            <div className="w-56">
              <PlantMultiSelect
                plants={plants || []}
                selected={filterPlants}
                onChange={setFilterPlants}
                placeholder="All Authorized Plants"
                allowedPlantIds={allowedPlantIds}
              />
            </div>
          </div>

          {/* From Date */}
          <div className="flex items-center gap-1.5">
            <label className="text-[11px] font-bold text-gray-700 uppercase whitespace-nowrap">From Date:</label>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-7 w-36 text-xs bg-white border-gray-400 rounded-none px-2 shadow-inner focus:bg-[#fff9c4]"
            />
          </div>

          {/* To Date */}
          <div className="flex items-center gap-1.5">
            <label className="text-[11px] font-bold text-gray-700 uppercase whitespace-nowrap">To Date:</label>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-7 w-36 text-xs bg-white border-gray-400 rounded-none px-2 shadow-inner focus:bg-[#fff9c4]"
            />
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const init = getInitialDates();
                setFromDate(init.from);
                setToDate(init.to);
              }}
              className="h-7 text-[10px] font-bold uppercase rounded-none bg-white border-gray-400 text-gray-700 hover:bg-gray-100 px-2"
              title="Filter to Last 7 Days (1 Week)"
            >
              1 Week
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setFromDate("");
                setToDate("");
              }}
              className="h-7 text-[10px] font-bold uppercase rounded-none bg-white border-gray-400 text-gray-700 hover:bg-gray-100 px-2"
              title="Show All Dates"
            >
              All Dates
            </Button>
            {(fromDate || toDate || filterPlants.length > 0 || search) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  const init = getInitialDates();
                  setFromDate(init.from);
                  setToDate(init.to);
                  setFilterPlants(isAdmin ? [] : (assignedPlantIds.length > 0 ? [...assignedPlantIds] : []));
                  setSearch("");
                }}
                className="h-7 text-[10px] font-bold uppercase text-red-600 hover:bg-red-50 hover:text-red-700 px-2 flex items-center gap-1"
                title="Reset all filters to default"
              >
                <RotateCcw className="h-3 w-3" /> Reset
              </Button>
            )}
          </div>
        </div>

        {/* Search & Pending Count */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center bg-white border border-gray-400 h-7 w-64 px-1 group focus-within:border-blue-500 shadow-inner">
            <Search className="h-3.5 w-3.5 text-gray-400 mr-1 shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-full text-xs outline-none bg-transparent"
              placeholder="Search Invoices..."
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="text-gray-400 hover:text-red-600 text-xs px-1"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>
          <div className="text-[11px] font-bold text-red-700 uppercase tracking-tight bg-red-50 border border-red-200 px-2.5 py-1 rounded-sm shadow-sm whitespace-nowrap flex items-center gap-1.5">
            <span>Pending:</span>
            <span className="text-red-900 font-black text-xs">{filteredInvoices.length}</span>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-auto no-scrollbar">
        <Table className="min-w-[1500px] sap-alv-grid">
          <TableHeader className="sap-alv-header">
            <TableRow className="h-8">
              <TableHead className="text-[11px] font-bold border-r w-12 text-center bg-[#e1e1e1]">#</TableHead>
              <TableHead className="text-[11px] font-bold border-r w-32 text-center bg-[#e1e1e1]">Action</TableHead>
              <TableHead className="text-[11px] font-bold border-r w-24 text-center">Plant</TableHead>
              <TableHead className="text-[11px] font-bold border-r w-40">Invoice Number</TableHead>
              <TableHead className="text-[11px] font-bold border-r w-32">Date</TableHead>
              <TableHead className="text-[11px] font-bold border-r w-28 text-center">FY</TableHead>
              <TableHead className="text-[11px] font-bold border-r w-64">Consignee</TableHead>
              <TableHead className="text-[11px] font-bold border-r w-32 text-center">State</TableHead>
              <TableHead className="text-[11px] font-bold text-right pr-6 bg-blue-50/50">Gross Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={9} className="text-center py-24 text-xs opacity-30">RETRIEVING RECORDS...</TableCell></TableRow> : filteredInvoices.map((inv, i) => (
              <TableRow key={inv.id} className="h-8 hover:bg-blue-50/50 border-b border-gray-100 group">
                <TableCell className="p-0 text-center text-gray-400 text-[10px] border-r group-hover:text-blue-600">{i + 1}</TableCell>
                <TableCell className="p-0 border-r text-center px-1"><Button onClick={() => setSelectedInvoice(inv)} variant="ghost" size="sm" className="h-6 w-full text-[9px] font-black uppercase text-emerald-700 hover:bg-emerald-100 rounded-none border border-emerald-200">Generate IRN</Button></TableCell>
                <TableCell className="p-0 px-2 text-[11px] border-r text-center font-bold text-gray-600">{inv.plantId}</TableCell>
                  <TableCell className="p-0 px-2 text-[11px] border-r font-black font-mono text-blue-900">
                    <IRNPreviewDialog invoice={inv} firms={firms} customerMap={customerMap} />
                  </TableCell>
                <TableCell className="p-0 px-2 text-[11px] border-r font-mono">{inv.invoiceDate}</TableCell>
                <TableCell className="p-0 px-2 text-[11px] border-r text-center">{inv.billYear}</TableCell>
                <TableCell className="p-0 px-2 text-[11px] border-r truncate font-semibold uppercase">{customerMap[inv.shipTo]?.name || customerMap[inv.billTo]?.name || inv.billTo}</TableCell>
                <TableCell className="p-0 px-2 text-[11px] border-r text-center">{customerMap[inv.shipTo]?.stateName || "-"}</TableCell>
<TableCell className="p-0 px-2 text-[11px] text-right font-black text-emerald-900 pr-6 bg-blue-50/30 group-hover:bg-emerald-50 transition-colors">₹ {formatAmount(inv.totals?.grossAmount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
