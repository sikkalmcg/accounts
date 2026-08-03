"use client";

import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useDatabase, useCollection, useMemoDatabase, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/database";
import { collection, doc, query, where, getDocs } from "@/database/mongo";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { parseGSTIN } from "@/lib/gst-utils";
import PlantMultiSelect from "./PlantMultiSelect";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Trash2, Pencil, Building2 } from "lucide-react";

export default function XK02() {
  const db = useDatabase();
  const [formData, setFormData] = useState<any>(null);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [canEdit, setCanEdit] = useState(false);

  // Real-time vendors
  const vendorsQuery = useMemoDatabase(() => collection(db, "vendors"), [db]);
  const { data: vendors, isLoading: isVendorsLoading } = useCollection(vendorsQuery);

  // Real-time plants for validation
  const plantsQuery = useMemoDatabase(() => collection(db, "plants"), [db]);
  const { data: plants, isLoading: isPlantsLoading } = useCollection(plantsQuery);

  // Authorization check for editing
  useEffect(() => {
    const stored = localStorage.getItem("sikka_user");
    if (stored) {
      const parsed = JSON.parse(stored);
      const isSysAdmin = parsed.username === "ajaysomra" || parsed.role === "admin";
      setCanEdit(isSysAdmin || (parsed.tcodePermissions || []).includes("XK02"));
    }
  }, []);

  const openEdit = (vendor: any) => {
    const plantIds = Array.isArray(vendor.assignedPlantIds) && vendor.assignedPlantIds.length > 0
      ? vendor.assignedPlantIds
      : (vendor.plantId ? [vendor.plantId] : []);
    setSelectedId(vendor.id);
    setFormData({
      ...vendor,
      assignedPlantIds: plantIds,
      vendorCode: vendor.vendorCode || vendor.vendorId || "",
      vendorName: vendor.vendorName || "",
      contact: vendor.contact || "",
      address: vendor.address || "",
      gstin: vendor.gstin || "",
      pan: vendor.pan || "",
      stateName: vendor.stateName || "",
      stateCode: vendor.stateCode || "",
      bankName: vendor.bankName || "",
      accountNumber: vendor.accountNumber || "",
      ifscCode: vendor.ifscCode || "",
    });
    setEditOpen(true);
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
        pan: "",
        stateName: "",
        stateCode: "",
      }),
    }));
  };

  const handleSave = useCallback(async () => {
    if (!formData || !selectedId) {
      window.dispatchEvent(new CustomEvent("sap-status", {
        detail: { text: "Please select a vendor to update", isError: true },
      }));
      return;
    }

    if (!formData.assignedPlantIds || formData.assignedPlantIds.length === 0 || !formData.vendorName || !formData.contact || !formData.vendorCode) {
      window.dispatchEvent(new CustomEvent("sap-status", {
        detail: { text: "Validation Error: Plant(s), Vendor Code, Vendor Name, and Contact are required", isError: true },
      }));
      return;
    }

    if (!canEdit) {
      window.dispatchEvent(new CustomEvent("sap-status", {
        detail: { text: "Error: You do not have permission to edit vendor master data", isError: true },
      }));
      return;
    }

    const normalizedCode = String(formData.vendorCode || "").trim().toUpperCase();
    if (!normalizedCode) {
      window.dispatchEvent(new CustomEvent("sap-status", {
        detail: { text: "Error: Vendor Code is mandatory", isError: true },
      }));
      return;
    }

    setLoading(true);
    try {
      const q = query(collection(db, "vendors"), where("vendorCode", "==", normalizedCode));
      const snap = await getDocs(q);
      const isDuplicate = snap.docs.some(d => d.id !== selectedId);
      if (isDuplicate) {
        window.dispatchEvent(new CustomEvent("sap-status", {
          detail: { text: "Vendor Code already exists. Please enter a unique code.", isError: true },
        }));
        setLoading(false);
        return;
      }

      const assignedPlantIds = Array.isArray(formData.assignedPlantIds) ? formData.assignedPlantIds : [];
      const { id, ...dataToSave } = formData;
      updateDocumentNonBlocking(doc(db, "vendors", selectedId), {
        ...dataToSave,
        assignedPlantIds,
        plantId: assignedPlantIds[0] || "", // backward compatibility with single-plant queries
        vendorId: normalizedCode,
        vendorCode: normalizedCode,
        updatedAt: new Date().toISOString(),
      });

      window.dispatchEvent(new CustomEvent("sap-status", {
        detail: { text: `Vendor ${formData.vendorName} updated successfully`, isError: false },
      }));
      setEditOpen(false);
      setFormData(null);
      setSelectedId("");
    } catch (error) {
      window.dispatchEvent(new CustomEvent("sap-status", {
        detail: { text: "Update failed: Check database connection", isError: true },
      }));
    } finally {
      setLoading(false);
    }
  }, [formData, selectedId, canEdit, db]);

  useEffect(() => {
    const onExecute = () => handleSave();
    window.addEventListener("sap-execute", onExecute);
    return () => window.removeEventListener("sap-execute", onExecute);
  }, [handleSave]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setLoading(true);
    try {
      deleteDocumentNonBlocking(doc(db, "vendors", deleteTarget.id));
      window.dispatchEvent(new CustomEvent("sap-status", {
        detail: { text: "Vendor record removed successfully", isError: false },
      }));
      setDeleteTarget(null);
    } catch (e) {
      window.dispatchEvent(new CustomEvent("sap-status", {
        detail: { text: "Deletion failed", isError: true },
      }));
    } finally {
      setLoading(false);
    }
  };

  const getPlantCodes = (vendor: any): string => {
    if (Array.isArray(vendor.assignedPlantIds) && vendor.assignedPlantIds.length > 0) {
      return vendor.assignedPlantIds.join(", ");
    }
    return vendor.plantId || "N/A";
  };

  const getVendorState = (vendor: any): { state: string; stateCode: string } => {
    const storedState = vendor.stateName || "";
    const storedCode = vendor.stateCode || "";
    if (storedState || storedCode) return { state: storedState || "-", stateCode: storedCode || "-" };
    if (vendor.gstin && vendor.gstin.length >= 15) {
      const parsed = parseGSTIN(vendor.gstin);
      if (parsed) return { state: parsed.state, stateCode: parsed.stateCode };
    }
    return { state: "-", stateCode: "-" };
  };

  return (
    <div className="w-full flex flex-col bg-white min-h-full">
      <div className="bg-[#dae8f5] px-4 py-1 border-b border-gray-300">
        <h2 className="text-[13px] font-bold text-gray-800 uppercase italic tracking-wider">
          Vendor Master: Edit / Delete
        </h2>
      </div>

      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader className="bg-[#e7ebf1] sticky top-0 z-10">
            <TableRow className="h-8">
              <TableHead className="text-[11px] border-r w-12 text-center">#</TableHead>
              <TableHead className="text-[11px] border-r w-40">Plant</TableHead>
              <TableHead className="text-[11px] border-r w-32">Vendor Code</TableHead>
              <TableHead className="text-[11px] border-r">Vendor Name</TableHead>
              <TableHead className="text-[11px] border-r w-36">GSTIN</TableHead>
              <TableHead className="text-[11px] border-r w-36">State</TableHead>
              <TableHead className="text-[11px] border-r w-20">State Code</TableHead>
              <TableHead className="text-[11px] w-32 text-center">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isVendorsLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-4 text-xs">FETCHING VENDORS...</TableCell></TableRow>
            ) : !vendors || vendors.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-10 text-xs text-red-500 font-bold">NO VENDOR RECORDS FOUND</TableCell></TableRow>
            ) : vendors.map((v, i) => {
              const vs = getVendorState(v);
              return (
                <TableRow key={v.id} className="h-10 hover:bg-blue-50/50 transition-colors">
                  <TableCell className="p-0 text-center text-[10px] border-r text-gray-400">{i + 1}</TableCell>
                  <TableCell className="p-0 px-2 text-[11px] border-r font-mono text-gray-700">{getPlantCodes(v)}</TableCell>
                  <TableCell className="p-0 px-2 text-[11px] border-r font-mono font-bold text-blue-700">{v.vendorCode || v.vendorId || "-"}</TableCell>
                  <TableCell className="p-0 px-2 text-[11px] border-r font-bold">{v.vendorName}</TableCell>
                  <TableCell className="p-0 px-2 text-[11px] border-r font-mono">{v.gstin || "-"}</TableCell>
                  <TableCell className="p-0 px-2 text-[11px] border-r">{vs.state}</TableCell>
                  <TableCell className="p-0 px-2 text-[11px] border-r font-mono text-center">{vs.stateCode}</TableCell>
                  <TableCell className="p-0 px-1 border-r">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        onClick={() => openEdit(v)}
                        size="sm"
                        className="h-6 rounded-none px-2 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold gap-1"
                      >
                        <Pencil className="h-3 w-3" /> Edit
                      </Button>
                      <Button
                        onClick={() => setDeleteTarget(v)}
                        size="sm"
                        variant="destructive"
                        className="h-6 rounded-none px-2 text-[10px] font-bold gap-1"
                      >
                        <Trash2 className="h-3 w-3" /> Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Edit Modal — all XK01 fields */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-sm p-0">
          <DialogHeader className="bg-[#dae8f5] px-4 py-2 border-b border-[#b5c7de]">
            <DialogTitle className="text-[13px] font-bold text-gray-800 uppercase italic tracking-wider">
              Edit Vendor Master
            </DialogTitle>
            <DialogDescription className="text-[11px] text-gray-600">
              Modify vendor details. Fields marked with * are mandatory.
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 space-y-4">
            {formData && (
              <>
                {/* Vendor General Data */}
                <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
                  <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700">
                    Vendor General Data
                  </div>
                  <div className="p-2 space-y-1">
                    <div className="sap-selection-row items-start">
                      <label className="sap-label mt-1">Plant Access <span className="text-red-500">*</span></label>
                      <div className="sap-input-wrapper max-w-[280px]">
                        <PlantMultiSelect
                          plants={plants}
                          selected={formData.assignedPlantIds || []}
                          onChange={(ids) => setFormData((prev: any) => ({ ...prev, assignedPlantIds: ids }))}
                          isLoading={isPlantsLoading}
                          placeholder="Select Plant(s)..."
                        />
                      </div>
                    </div>

                    <div className="sap-selection-row">
                      <label className="sap-label">Vendor Code</label>
                      <div className="sap-input-wrapper max-w-[200px]">
                        <Input
                          value={formData.vendorCode}
                          onChange={(e) => setFormData((prev: any) => ({ ...prev, vendorCode: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "") }))}
                        />
                      </div>
                    </div>

                    <div className="sap-selection-row">
                      <label className="sap-label">Vendor Name</label>
                      <div className="sap-input-wrapper max-w-md">
                        <Input value={formData.vendorName} onChange={(e) => setFormData((prev: any) => ({ ...prev, vendorName: e.target.value }))} />
                      </div>
                    </div>

                    <div className="sap-selection-row">
                      <label className="sap-label">Contact Details</label>
                      <div className="sap-input-wrapper max-w-[200px]">
                        <Input value={formData.contact} onChange={(e) => setFormData((prev: any) => ({ ...prev, contact: e.target.value }))} />
                      </div>
                    </div>

                    <div className="sap-selection-row">
                      <label className="sap-label">GSTIN</label>
                      <div className="sap-input-wrapper max-w-[200px]">
                        <Input value={formData.gstin} onChange={(e) => handleGSTINChange(e.target.value)} />
                      </div>
                    </div>

                    <div className="sap-selection-row">
                      <label className="sap-label">PAN Number</label>
                      <div className="sap-input-wrapper max-w-[150px]">
                        <Input value={formData.pan} readOnly className="bg-gray-100 font-mono" />
                      </div>
                    </div>

                    <div className="sap-selection-row">
                      <label className="sap-label">State Name</label>
                      <div className="sap-input-wrapper max-w-md">
                        <Input value={formData.stateName} readOnly className="bg-gray-100" />
                      </div>
                    </div>

                    <div className="sap-selection-row">
                      <label className="sap-label">State Code</label>
                      <div className="sap-input-wrapper max-w-[100px]">
                        <Input value={formData.stateCode} readOnly className="bg-gray-100 text-center" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Banking and Payment Information */}
                <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
                  <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700">
                    Banking and Payment Information
                  </div>
                  <div className="p-2 space-y-1">
                    <div className="sap-selection-row">
                      <label className="sap-label">Bank Name</label>
                      <div className="sap-input-wrapper max-w-md">
                        <Input value={formData.bankName} onChange={(e) => setFormData((prev: any) => ({ ...prev, bankName: e.target.value }))} />
                      </div>
                    </div>
                    <div className="sap-selection-row">
                      <label className="sap-label">Account Number</label>
                      <div className="sap-input-wrapper max-w-md">
                        <Input value={formData.accountNumber} onChange={(e) => setFormData((prev: any) => ({ ...prev, accountNumber: e.target.value }))} />
                      </div>
                    </div>
                    <div className="sap-selection-row">
                      <label className="sap-label">IFSC code</label>
                      <div className="sap-input-wrapper max-w-[200px]">
                        <Input value={formData.ifscCode} onChange={(e) => setFormData((prev: any) => ({ ...prev, ifscCode: e.target.value.toUpperCase() }))} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Address */}
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
                          onChange={(e) => setFormData((prev: any) => ({ ...prev, address: e.target.value }))}
                          className="rounded-none border-gray-400 focus:bg-[#fff9c4]"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="px-4 py-3 border-t border-[#b5c7de] bg-[#f4f6f9]">
            <Button variant="outline" onClick={() => setEditOpen(false)} className="h-7 rounded-none text-[11px] font-bold">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading} className="h-7 rounded-none text-[11px] font-bold gap-1.5">
              {loading && <Loader2 className="h-3 w-3 animate-spin" />}
              {loading ? "SAVING..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Warning Confirmation Popup */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="max-w-md rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="h-5 w-5" /> Confirm Vendor Deletion
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[12px] leading-relaxed">
              Are you sure you want to delete vendor{" "}
              <b>{deleteTarget?.vendorName || ""}</b> (Code:{" "}
              <b>{deleteTarget?.vendorCode || deleteTarget?.vendorId || "-"}</b>)?
              <br />
              <br />
              This operation will permanently remove the vendor master record. Already processed stock receipts and payment data will remain unaffected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading} className="h-8 rounded-none text-[11px] font-bold">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={loading}
              className="h-8 rounded-none text-[11px] font-bold bg-red-600 hover:bg-red-700"
            >
              {loading ? "Deleting..." : "Yes, Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {loading && <div className="fixed bottom-10 right-10 bg-[#333e4f] text-white px-4 py-2 text-xs border border-white/20 animate-pulse">UPDATING VENDOR MASTER...</div>}
    </div>
  );
}

