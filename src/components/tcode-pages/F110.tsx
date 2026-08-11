"use client";

import { useState, useMemo, useEffect } from "react";
import {
  format,
  isValid,
  differenceInCalendarDays,
  parseISO,
} from "date-fns";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { useDatabase, useCollection, useMemoDatabase } from "@/database";
import { collection, query, where, getDocs } from "@/database/mongo";

import {
  Search,
  Loader2,
  Download,
  Receipt,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import PlantMultiSelect from "./PlantMultiSelect";
import { getRecordPlantIds } from "@/lib/plant-master";
import { formatAmount } from "@/lib/number-utils";
import { toSAPDate } from "@/lib/date-utils";
import { downloadCsv } from "@/lib/csv-export";

/* =========================================================
   DATE HELPERS
========================================================= */

const parseFlexibleDate = (dateValue: any): Date | null => {
  if (!dateValue) return null;

  if (dateValue instanceof Date) {
    return isValid(dateValue) ? dateValue : null;
  }

  const dateStr = String(dateValue).trim();

  if (!dateStr) return null;

  // DD.MM.YYYY
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) {
    const [day, month, year] = dateStr.split(".").map(Number);
    const d = new Date(year, month - 1, day);
    return isValid(d) ? d : null;
  }

  // DD-MM-YYYY
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
    const [day, month, year] = dateStr.split("-").map(Number);
    const d = new Date(year, month - 1, day);
    return isValid(d) ? d : null;
  }

  // DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    const [day, month, year] = dateStr.split("/").map(Number);
    const d = new Date(year, month - 1, day);
    return isValid(d) ? d : null;
  }

  // YYYY-MM-DD / ISO
  const isoDate = parseISO(dateStr);
  if (isValid(isoDate)) {
    return isoDate;
  }

  return null;
};

const formatSystemDate = (dateValue: any): string => {
  const d = parseFlexibleDate(dateValue);
  return d ? toSAPDate(d) : "";
};

const normalizeString = (value: any): string => {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
};

const firstValue = (
  obj: any,
  keys: string[],
  defaultValue: any = ""
) => {
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return defaultValue;
};

const toNumber = (value: any): number => {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const cleaned = String(value)
    .replace(/,/g, "")
    .replace(/[₹$]/g, "")
    .trim();

  const number = Number(cleaned);
  return Number.isFinite(number) ? number : 0;
};

/* =========================================================
   COMPONENT
========================================================= */

export default function F110() {
  const db = useDatabase();

  /* =======================================================
     FILTER STATE
  ======================================================= */

  const [filterPlants, setFilterPlants] = useState<string[]>([]);
  const [filterConsignor, setFilterConsignor] = useState<string>("ALL");
  const [filterBillTo, setFilterBillTo] = useState<string>("ALL");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [searchText, setSearchText] = useState<string>("");

  /* =======================================================
     REPORT STATE
  ======================================================= */

  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isExecuted, setIsExecuted] = useState(false);
  const [showFilters, setShowFilters] = useState(true);

  /* =======================================================
     AUTHORIZATION
  ======================================================= */

  const [isAdmin, setIsAdmin] = useState(false);
  const [authorizedPlantIds, setAuthorizedPlantIds] = useState<string[]>([]);

  /* =======================================================
     LOAD LOGGED-IN USER
  ======================================================= */

  useEffect(() => {
    try {
      const stored = localStorage.getItem("sikka_user");

      if (!stored) {
        setIsAdmin(false);
        setAuthorizedPlantIds([]);
        return;
      }

      const parsed = JSON.parse(stored);

      const adminUser =
        parsed.username === "ajaysomra" || parsed.role === "admin";

      setIsAdmin(adminUser);

      setAuthorizedPlantIds(
        Array.isArray(parsed.assignedPlantIds) ? parsed.assignedPlantIds : []
      );
    } catch (error) {
      console.error("Unable to load user authorization:", error);
      setIsAdmin(false);
      setAuthorizedPlantIds([]);
    }
  }, []);

  /* =======================================================
     MASTER DATA
  ======================================================= */

  const plantsQuery = useMemoDatabase(() => collection(db, "plants"), [db]);
  const { data: plants } = useCollection(plantsQuery);

  const customersQuery = useMemoDatabase(() => collection(db, "customers"), [db]);
  const { data: customers } = useCollection(customersQuery);

  const firmsQuery = useMemoDatabase(() => collection(db, "firms"), [db]);
  const { data: firms } = useCollection(firmsQuery);

  /* =======================================================
     AUTHORIZED PLANTS
  ======================================================= */

  const allowedPlants = useMemo(() => {
    if (isAdmin) {
      return plants || [];
    }

    return (
      plants?.filter((plant: any) =>
        authorizedPlantIds.includes(normalizeString(plant.plantId))
      ) || []
    );
  }, [plants, isAdmin, authorizedPlantIds]);

  /* =======================================================
     SECURITY: Remove unauthorized selected plants
  ======================================================= */

  useEffect(() => {
    const allowedIds = allowedPlants.map((plant: any) =>
      normalizeString(plant.plantId)
    );

    setFilterPlants((current) =>
      current.filter((plantId) => allowedIds.includes(normalizeString(plantId)))
    );
  }, [allowedPlants]);

  /* =======================================================
     FILTERED CONSIGNORS
  ======================================================= */

  const filteredFirms = useMemo(() => {
    if (!firms) return [];

    if (filterPlants.length === 0) {
      return firms;
    }

    return firms.filter((firm: any) =>
      getRecordPlantIds(firm).some((plantId: string) =>
        filterPlants.includes(plantId)
      )
    );
  }, [firms, filterPlants]);

  /* =======================================================
     FILTERED BILL TO PARTIES
  ======================================================= */

  const filteredCustomers = useMemo(() => {
    if (!customers) return [];

    if (filterPlants.length === 0) {
      return customers;
    }

    return customers.filter((customer: any) =>
      getRecordPlantIds(customer).some((plantId: string) =>
        filterPlants.includes(plantId)
      )
    );
  }, [customers, filterPlants]);

  /* =======================================================
      MB03 INVOICE NORMALIZATION
  ======================================================= */

  const normalizeMB03Invoice = (raw: any, id: string) => {
    const invoiceNumber = normalizeString(
      firstValue(raw, [
        "invoiceNumber",
        "invoiceNo",
        "invoice_num",
        "billingDocument",
        "billingDocumentNumber",
      ])
    );

    const plantId = normalizeString(
      firstValue(raw, ["plantId", "plant", "plantID"])
    );

    const invoiceDate = firstValue(raw, [
      "invoiceDate",
      "billingDate",
      "date",
    ]);

    const consignorId = normalizeString(
      firstValue(raw, ["consignorId", "firmId", "consignor"])
    );

    const billToId = normalizeString(
      firstValue(raw, ["billTo", "billToParty", "billToPartyId", "customerId"])
    );

    const grossAmount = toNumber(
      firstValue(raw, [
        "grossAmount",
        "invoiceGrossAmount",
        "invoiceAmount",
        "totalGrossAmount",
        "totals",
      ])
    );

    let finalGrossAmount = grossAmount;

    if (typeof raw?.totals === "object" && raw?.totals !== null) {
      finalGrossAmount = toNumber(
        firstValue(raw.totals, [
          "grossAmount",
          "invoiceGrossAmount",
          "total",
        ])
      );
    }

    const chargeType = normalizeString(
      firstValue(raw, [
        "chargeType",
        "charge_type",
        "docCategory",
        "documentType",
      ])
    );

    const workingMonth = normalizeString(
      firstValue(raw, ["workingMonth", "billMonth", "billingMonth"])
    );

    return {
      ...raw,
      id,
      invoiceNumber,
      plantId,
      invoiceDate,
      consignorId,
      billToId,
      grossAmount: finalGrossAmount,
      chargeType,
      workingMonth,
    };
  };

  /* =======================================================
     PAYMENT NORMALIZATION
  ======================================================= */

  const getPaymentInvoiceNumber = (payment: any): string => {
    return normalizeString(
      firstValue(payment, [
        "invoiceNo",
        "invoiceNumber",
        "invoice_num",
        "billingDocument",
        "billingDocumentNumber",
        "invoiceReference",
        "referenceInvoice",
      ])
    );
  };

  const getPaymentDate = (payment: any): Date | null => {
    return parseFlexibleDate(
      firstValue(payment, [
        "paymentDate",
        "postingDate",
        "receiptDate",
        "documentDate",
        "date",
      ])
    );
  };

  /* =======================================================
     MIGO PAYMENT AMOUNT
     Calculates: Receipt Amount + TDS + Deduction + Interest
  ======================================================= */

  const getMIGOPaymentAmount = (payment: any): number => {
    const receiptAmount = toNumber(
      firstValue(payment, ["receiptAmount", "paymentAmount", "paidAmount"])
    );

    const tds = toNumber(
      firstValue(payment, ["tds", "tdsAmount"])
    );

    const deduction = toNumber(
      firstValue(payment, ["deduction", "deductionAmount"])
    );

    const interest = toNumber(
      firstValue(payment, ["interest", "interestAmount"])
    );

    return receiptAmount + tds + deduction + interest;
  };

  /* =======================================================
     MB03 PAYMENT AMOUNT
  ======================================================= */

  const getMB03PaymentAmount = (payment: any): number => {
    return toNumber(
      firstValue(payment, [
        "paymentAmount",
        "receiptAmount",
        "paidAmount",
        "totalPaidAmount",
        "amount",
      ])
    );
  };

  /* =======================================================
     TRANSACTION UNIQUE KEY
  ======================================================= */

  const getTransactionKey = (
    payment: any,
    source: string,
    invoiceNumber: string,
    paymentAmount: number
  ): string => {
    const id = normalizeString(
      firstValue(payment, [
        "transactionId",
        "paymentId",
        "receiptNo",
        "receiptNumber",
        "documentNumber",
        "id",
      ])
    );

    if (id) {
      return id;
    }

    const paymentDate = formatSystemDate(getPaymentDate(payment));
    return `${source}|${invoiceNumber}|${paymentDate}|${paymentAmount}`;
  };

  /* =======================================================
     EXECUTE F110
  ======================================================= */

  const handleExecute = async () => {
    if (filterPlants.length === 0) {
      window.dispatchEvent(
        new CustomEvent("sap-status", {
          detail: {
            text: "Error: At least one authorized Plant must be selected",
            isError: true,
          },
        })
      );
      return;
    }

    if (!isAdmin) {
      const unauthorizedPlant = filterPlants.find(
        (plantId) => !authorizedPlantIds.includes(normalizeString(plantId))
      );

      if (unauthorizedPlant) {
        window.dispatchEvent(
          new CustomEvent("sap-status", {
            detail: {
              text: "Error: Unauthorized Plant selected",
              isError: true,
            },
          })
        );
        return;
      }
    }

    if (!fromDate || !toDate) {
      window.dispatchEvent(
        new CustomEvent("sap-status", {
          detail: {
            text: "Error: From Date and To Date are mandatory",
            isError: true,
          },
        })
      );
      return;
    }

    const parsedFrom = parseFlexibleDate(fromDate);
    const parsedTo = parseFlexibleDate(toDate);

    if (!parsedFrom || !parsedTo) {
      window.dispatchEvent(
        new CustomEvent("sap-status", {
          detail: {
            text: "Error: Invalid From Date or To Date",
            isError: true,
          },
        })
      );
      return;
    }

    parsedFrom.setHours(0, 0, 0, 0);
    parsedTo.setHours(23, 59, 59, 999);

    if (parsedFrom > parsedTo) {
      window.dispatchEvent(
        new CustomEvent("sap-status", {
          detail: {
            text: "Error: From Date cannot be greater than To Date",
            isError: true,
          },
        })
      );
      return;
    }

    setIsSearching(true);
    setIsExecuted(true);
    setSearchText("");

    try {
      /* ===================================================
         STEPS 1-4: SERVER-SIDE MB03 INVOICES + PAYMENTS
         The server authorizes plants first, loads the MB03 invoice dataset,
         and aggregates payment receipts strictly by the matching Invoice No.
      =================================================== */
      const storedUser = JSON.parse(localStorage.getItem("sikka_user") || "{}");
      const response = await fetch(
        `/api/f110?${new URLSearchParams({
          plantIds: filterPlants.join(","),
          fromDate,
          toDate,
        }).toString()}`,
        { headers: { "x-sikka-user-id": normalizeString(storedUser.username) } }
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Unable to load F110 data");

      const mb03Invoices = (payload.invoices || []).map((invoice: any) =>
        normalizeMB03Invoice(invoice, invoice.id)
      );
      const paymentsByInvoice = new Map<string, { totalPaid: number; paymentDates: Date[] }>(
        mb03Invoices.map((invoice: any) => {
          const paymentDate = parseFlexibleDate(invoice.paymentDate);
          return [
            invoice.invoiceNumber,
            {
              totalPaid: toNumber(invoice.totalPaidAmount),
              paymentDates: paymentDate ? [paymentDate] : [],
            },
          ];
        })
      );

      /* ===================================================
         STEP 5: CUSTOMER / FIRM MAP
      =================================================== */

      const customerMap = new Map(
        (customers || []).map((customer: any) => [
          normalizeString(customer.customerId),
          customer,
        ])
      );

      const firmMap = new Map(
        (firms || []).map((firm: any) => [
          normalizeString(firm.firmId),
          firm,
        ])
      );

      /* ===================================================
         STEP 6: BUILD FINAL F110 REPORT
      =================================================== */

      let processed = mb03Invoices.map((invoice: any) => {
        const invoiceDate = parseFlexibleDate(invoice.invoiceDate);
        const paymentInfo = paymentsByInvoice.get(invoice.invoiceNumber);

        const totalPaid = paymentInfo ? paymentInfo.totalPaid : 0;
        const grossAmount = toNumber(invoice.grossAmount);
        const balanceAmount = grossAmount - totalPaid;

        const paymentDates = paymentInfo?.paymentDates || [];
        const sortedPaymentDates = [...paymentDates].sort(
          (a, b) => a.getTime() - b.getTime()
        );

        const latestPaymentDate =
          sortedPaymentDates.length > 0
            ? sortedPaymentDates[sortedPaymentDates.length - 1]
            : null;

        const paymentDays =
          invoiceDate && latestPaymentDate
            ? differenceInCalendarDays(latestPaymentDate, invoiceDate)
            : null;

        const consignor =
          firmMap.get(normalizeString(invoice.consignorId)) ||
          invoice.snapshotFirm ||
          null;

        const billTo =
          customerMap.get(normalizeString(invoice.billToId)) ||
          invoice.snapshotBillTo ||
          null;

        const workingMonth =
          invoice.workingMonth ||
          (invoiceDate ? format(invoiceDate, "MMM-yyyy") : "");

        return {
          id: invoice.id,
          plantId: invoice.plantId,
          invoiceNo: invoice.invoiceNumber,
          invoiceDate: formatSystemDate(invoice.invoiceDate),
          consignorName:
            normalizeString(
              firstValue(
                consignor,
                ["name", "firmName", "consignorName"],
                ""
              )
            ) || "N/A",
          billToName:
            normalizeString(
              firstValue(
                billTo,
                ["name", "customerName", "billToName"],
                ""
              )
            ) || "N/A",
          workingMonth,
          chargeType: invoice.chargeType || "N/A",
          grossAmount,
          totalPaidAmount: totalPaid,
          paymentDate: formatSystemDate(latestPaymentDate),
          balanceAmount,
          paymentDays:
            paymentDays !== null && paymentDays >= 0 ? paymentDays : null,
          _consignorId: invoice.consignorId,
          _billToId: invoice.billToId,
          _paymentSource: paymentInfo ? "Payment Records" : "",
        };
      });

      /* ===================================================
         STEP 7 & 8: CONSIGNOR & BILL TO FILTERS
      =================================================== */

      if (filterConsignor !== "ALL") {
        processed = processed.filter(
          (row) => row._consignorId === filterConsignor
        );
      }

      if (filterBillTo !== "ALL") {
        processed = processed.filter((row) => row._billToId === filterBillTo);
      }

      /* ===================================================
         STEP 9: SET RESULTS
      =================================================== */

      setResults(processed);
      setSearchText("");
      setShowFilters(false);

      window.dispatchEvent(
        new CustomEvent("sap-status", {
          detail: {
            text: `Found ${processed.length} invoice record(s)`,
            isError: false,
          },
        })
      );
    } catch (error) {
      console.error("F110 Execute Error:", error);
      setResults([]);
      window.dispatchEvent(
        new CustomEvent("sap-status", {
          detail: {
            text: "System Error during F110 lookup",
            isError: true,
          },
        })
      );
    } finally {
      setIsSearching(false);
    }
  };

  /* =======================================================
     REPORT SEARCH
  ======================================================= */

  const filteredResults = useMemo(() => {
    const search = searchText.trim().toLowerCase();

    if (!search) {
      return results;
    }

    return results.filter((row: any) =>
      Object.entries(row).some(([key, value]) => {
        if (key.startsWith("_")) {
          return false;
        }
        return String(value ?? "").toLowerCase().includes(search);
      })
    );
  }, [results, searchText]);

  /* =======================================================
     EXCEL / CSV EXPORT
  ======================================================= */

  const handleExport = () => {
    if (results.length === 0) {
      return;
    }

    const headers = [
      "Plant",
      "Invoice No.",
      "Date",
      "Consignor",
      "Bill to Party",
      "Working Month",
      "Charge Type",
      "Invoice Gross Amount",
      "Total Payment Amount",
      "Payment Date",
      "Balance Amount",
      "Payment Days",
    ];

    const rows = results.map((row: any) => [
      row.plantId,
      row.invoiceNo,
      row.invoiceDate,
      row.consignorName,
      row.billToName,
      row.workingMonth,
      row.chargeType,
      row.grossAmount,
      row.totalPaidAmount,
      row.paymentDate,
      row.balanceAmount,
      row.paymentDays !== null ? row.paymentDays : "",
    ]);

    downloadCsv("F110_Invoice_Payment_Report", headers, rows);
  };

  const clearSearch = () => {
    setSearchText("");
  };

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="w-full flex flex-col bg-white min-h-full select-text">
      {/* PAGE HEADER */}
      <div className="sap-header-title">F110 – Invoice & Payment Report</div>

      {/* FILTER SECTION */}
      {showFilters && (
        <div className="sap-selection-area">
          <div className="p-3 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end">
            {/* PLANT */}
            <div className="space-y-1">
              <label className="sap-label font-bold text-red-700">
                Plant *
              </label>
              <PlantMultiSelect
                plants={allowedPlants}
                selected={filterPlants}
                onChange={setFilterPlants}
              />
            </div>

            {/* CONSIGNOR */}
            <div className="space-y-1">
              <label className="sap-label">Consignor</label>
              <Select
                value={filterConsignor}
                onValueChange={setFilterConsignor}
              >
                <SelectTrigger className="h-8 text-xs rounded-none border-gray-400">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  {filteredFirms.map((firm: any) => (
                    <SelectItem key={firm.id} value={firm.firmId}>
                      {firm.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* BILL TO PARTY */}
            <div className="space-y-1">
              <label className="sap-label">Bill to Party</label>
              <Select value={filterBillTo} onValueChange={setFilterBillTo}>
                <SelectTrigger className="h-8 text-xs rounded-none border-gray-400">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  {filteredCustomers.map((customer: any) => (
                    <SelectItem key={customer.id} value={customer.customerId}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* FROM DATE */}
            <div className="space-y-1">
              <label className="sap-label font-bold text-red-700">
                From Date *
              </label>
              <Input
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
                className="h-8 text-xs rounded-none border-gray-400"
              />
            </div>

            {/* TO DATE */}
            <div className="space-y-1">
              <label className="sap-label font-bold text-red-700">
                To Date *
              </label>
              <Input
                type="date"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
                className="h-8 text-xs rounded-none border-gray-400"
              />
            </div>

            {/* EXECUTE BUTTON */}
            <Button
              onClick={handleExecute}
              disabled={isSearching}
              className="h-8 rounded-none bg-blue-700 hover:bg-blue-800 text-sm font-bold gap-2 shadow-sm"
            >
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Execute (F8)
            </Button>
          </div>
        </div>
      )}

      {/* REPORT AREA */}
      <div className="flex-1 overflow-auto no-scrollbar relative">
        {!isExecuted ? (
          <div className="flex flex-col items-center justify-center py-32 text-gray-400 opacity-30 select-none">
            <Receipt className="h-20 w-20 stroke-1 mb-4" />
            <p className="text-sm font-black uppercase tracking-[0.2em]">
              Enter mandatory parameters (Plant, From Date, To Date) & Execute
            </p>
          </div>
        ) : (
          <>
            {/* REPORT TOOLBAR */}
            <div className="bg-[#dae8f5] px-4 py-1.5 border-y border-gray-300 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setShowFilters(!showFilters)}
                  variant="outline"
                  className="h-6 rounded-none bg-white border-gray-400 text-[10px] font-bold uppercase gap-1"
                >
                  {showFilters ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                  {showFilters ? "Hide Filters" : "Show Filters"}
                </Button>

                <div className="relative flex items-center bg-white border border-gray-400 h-6 w-80 px-1">
                  <Search className="h-3.5 w-3.5 text-gray-400 mr-1" />
                  <input
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    className="w-full h-full text-xs outline-none"
                    placeholder="Search Result..."
                  />
                  {searchText && (
                    <button
                      type="button"
                      onClick={clearSearch}
                      className="text-gray-400 hover:text-red-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>

              <Button
                onClick={handleExport}
                variant="outline"
                className="h-6 rounded-none bg-white border-gray-400 text-emerald-700 text-[10px] font-bold uppercase gap-1.5 shadow-sm hover:bg-emerald-50"
              >
                <Download className="h-3.5 w-3.5" />
                Download Excel
              </Button>
            </div>

            {/* SEARCH RESULT COUNT */}
            <div className="px-4 py-1 text-[10px] text-gray-500 border-b bg-gray-50">
              Showing <b>{filteredResults.length}</b> of <b>{results.length}</b>{" "}
              records
            </div>

            {/* GRID DISPLAY */}
            {isSearching ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-10 w-10 animate-spin text-blue-700" />
              </div>
            ) : filteredResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 text-red-500 font-bold uppercase text-xs">
                No matching records found.
              </div>
            ) : (
              <Table className="min-w-[1800px] sap-alv-grid">
                <TableHeader className="sap-alv-header">
                  <TableRow className="h-8">
                    <TableHead className="w-24">Plant</TableHead>
                    <TableHead className="w-36">Invoice No.</TableHead>
                    <TableHead className="w-28">Date</TableHead>
                    <TableHead>Consignor</TableHead>
                    <TableHead>Bill to Party</TableHead>
                    <TableHead className="w-28">Working Month</TableHead>
                    <TableHead className="w-32">Charge Type</TableHead>
                    <TableHead className="w-40 text-right">
                      Invoice Gross Amount
                    </TableHead>
                    <TableHead className="w-40 text-right">
                      Total Payment Amount
                    </TableHead>
                    <TableHead className="w-28 text-center">
                      Payment Date
                    </TableHead>
                    <TableHead className="w-36 text-right">
                      Balance Amount
                    </TableHead>
                    <TableHead className="w-28 text-center">
                      Payment Days
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredResults.map((row: any, index: number) => (
                    <TableRow
                      key={row.id || `${row.invoiceNo}-${index}`}
                      className="h-8 hover:bg-blue-50/30 border-b border-gray-100 group"
                    >
                      <TableCell className="font-bold text-center">
                        {row.plantId}
                      </TableCell>
                      <TableCell className="font-mono font-black text-blue-800">
                        {row.invoiceNo}
                      </TableCell>
                      <TableCell className="font-mono">
                        {row.invoiceDate}
                      </TableCell>
                      <TableCell className="truncate max-w-[200px]">
                        {row.consignorName}
                      </TableCell>
                      <TableCell className="truncate max-w-[200px]">
                        {row.billToName}
                      </TableCell>
                      <TableCell className="font-mono text-center">
                        {row.workingMonth}
                      </TableCell>
                      <TableCell className="uppercase">
                        {row.chargeType}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold">
                        {formatAmount(row.grossAmount)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-emerald-700">
                        {formatAmount(row.totalPaidAmount)}
                      </TableCell>
                      <TableCell className="text-center font-mono">
                        {row.paymentDate || "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono font-black text-red-700">
                        {formatAmount(row.balanceAmount)}
                      </TableCell>
                      <TableCell className="text-center font-bold">
                        {row.paymentDays !== null
                          ? `${row.paymentDays} Days`
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        )}
      </div>

      {/* SAP FOOTER */}
      <div className="bg-[#333e4f] h-7 flex items-center px-4 text-white text-[10px] uppercase tracking-tighter shadow-inner border-t border-black/20">
        <div className="flex-1 flex gap-10">
          <span>F110 - Invoice & Payment Report</span>
          <span className="opacity-40">|</span>
          <span>Records: {filteredResults.length}</span>
        </div>
      </div>
    </div>
  );
}
