"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
import { Upload, X, Loader2, Plus, Trash2, Pencil, Building2 } from "lucide-react";
import Image from "next/image";

export default function FM02() {
  const db = useDatabase();
  const [formData, setFormData] = useState<any>(null);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [canEdit, setCanEdit] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Real-time firms
  const firmsQuery = useMemoDatabase(() => collection(db, "firms"), [db]);
  const { data: firms, isLoading: isFirmsLoading } = useCollection(firmsQuery);

  // Real-time plants for validation
  const plantsQuery = useMemoDatabase(() => collection(db, "plants"), [db]);
  const { data: plants, isLoading: isPlantsLoading } = useCollection(plantsQuery);

  // Authorization check for editing
  useEffect(() => {
    const stored = localStorage.getItem("sikka_user");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const isSysAdmin = parsed.username === "ajaysomra" || parsed.role === "admin";
        setCanEdit(isSysAdmin || (parsed.tcodePermissions || []).includes("FM02"));
      } catch (e) { /* ignore */ }
    }
  }, []);

  // Helper function to extract plant IDs/Codes properly
  const normalizePlantIds = (firm: any): string[] => {
    let rawList: any[] = [];
    if (Array.isArray(firm?.assignedPlantIds) && firm.assignedPlantIds.length > 0) {
      rawList = firm.assignedPlantIds;
    } else if (Array.isArray(firm?.plantIds) && firm.plantIds.length > 0) {
      rawList = firm.plantIds;
    } else if (firm?.plantId) {
      rawList = [firm.plantId];
    }

    return rawList
      .map((item) => (typeof item === "object" ? item?.plantId || item?.id || item?.code : item))
      .filter((id): id is string => typeof id === "string" && id.trim() !== "");
  };

  const openEdit = (firm: any) => {
    const plantIds = normalizePlantIds(firm);

    setSelectedId(firm.id);
    setFormData({
      ...firm,
      assignedPlantIds: plantIds,
      consignorCode: firm.consignorCode || firm.firmId || "",
      logoData: firm.logoData || "",
      name: firm.name || "",
      address: firm.address || "",
      gstin: firm.gstin || "",
      pan: firm.pan || "",
      state: firm.state || "",
      stateCode: firm.stateCode || "",
      email: firm.email || "",
      mobile: firm.mobile || "",
      bankName: firm.bankName || "",
      accountHolderName: firm.accountHolderName || "",
      accountNumber: firm.accountNumber || "",
      ifscCode: firm.ifscCode || "",
      terms: Array.isArray(firm.terms) && firm.terms.length > 0 ? firm.terms : [""],
    });
    setEditOpen(true);
  };

  const handleGSTINChange = (val: string) => {
    const gstin = val.toUpperCase().substring(0, 15);
    const parsed = parseGSTIN(gstin);
    setFormData((prev: any) => ({
      ...prev,
      gstin,
      ...(parsed
        ? {
            pan: parsed.pan,
            state: parsed.state,
            stateCode: parsed.stateCode,
          }
        : {
            pan: "",
            state: "",
            stateCode: "",
          }),
    }));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.size <= 500 * 1024) {
      const reader = new FileReader();
      reader.onload = (ev) =>
        setFormData((prev: any) => ({ ...prev, logoData: ev.target?.result }));
      reader.readAsDataURL(file);
    } else if (file) {
      window.dispatchEvent(
        new CustomEvent("sap-status", {
          detail: { text: "Error: Logo must be under 500 KB", isError: true },
        })
      );
    }
  };

  const handleSave = useCallback(async () => {
    if (!formData || !selectedId) {
      window.dispatchEvent(
        new CustomEvent("sap-status", {
          detail: { text: "Please select a firm to update", isError: true },
        })
      );
      return;
    }

    if (
      !formData.assignedPlantIds ||
      formData.assignedPlantIds.length === 0 ||
      !formData.consignorCode ||
      !formData.name ||
      !formData.gstin
    ) {
      window.dispatchEvent(
        new CustomEvent("sap-status", {
          detail: {
            text: "Validation Error: Plant(s), Consignor Code, Name, and GSTIN are required",
            isError: true,
          },
        })
      );
      return;
    }

    if (!canEdit) {
      window.dispatchEvent(
        new CustomEvent("sap-status", {
          detail: {
            text: "Error: You do not have permission to edit consignor master data",
            isError: true,
          },
        })
      );
      return;
    }

    const normalizedCode = String(formData.consignorCode || "")
      .trim()
      .toUpperCase();
    if (!normalizedCode) {
      window.dispatchEvent(
        new CustomEvent("sap-status", {
          detail: { text: "Error: Consignor Code is mandatory", isError: true },
        })
      );
      return;
    }

    setLoading(true);
    try {
      const q = query(
        collection(db, "firms"),
        where("firmId", "==", normalizedCode)
      );
      const snap = await getDocs(q);
      const isDuplicate = snap.docs.some((d) => d.id !== selectedId);
      if (isDuplicate) {
        window.dispatchEvent(
          new CustomEvent("sap-status", {
            detail: {
              text: "Consignor Code already exists. Please enter a unique code.",
              isError: true,
            },
          })
        );
        setLoading(false);
        return;
      }

      const assignedPlantIds = Array.isArray(formData.assignedPlantIds)
        ? formData.assignedPlantIds
        : [];
      const { id, ...dataToSave } = formData;
      updateDocumentNonBlocking(doc(db, "firms", selectedId), {
        ...dataToSave,
        assignedPlantIds,
        plantId: assignedPlantIds[0] || "",
        firmId: normalizedCode,
        consignorCode: normalizedCode,
        updatedAt: new Date().toISOString(),
      });

      window.dispatchEvent(
        new CustomEvent("sap-status", {
          detail: { text: `Firm ${formData.name} updated successfully`, isError: false },
        })
      );
      setEditOpen(false);
      setFormData(null);
      setSelectedId("");
    } catch (error) {
      window.dispatchEvent(
        new CustomEvent("sap-status", {
          detail: { text: "Update failed: Check database connection", isError: true },
        })
      );
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
      deleteDocumentNonBlocking(doc(db, "firms", deleteTarget.id));
      window.dispatchEvent(
        new CustomEvent("sap-status", {
          detail: { text: "Firm record removed successfully", isError: false },
        })
      );
      setDeleteTarget(null);
    } catch (e) {
      window.dispatchEvent(
        new CustomEvent("sap-status", {
          detail: { text: "Deletion failed", isError: true },
        })
      );
    } finally {
      setLoading(false);
    }
  };

  const addTermRow = () => {
    setFormData((prev: any) => ({
      ...prev,
      terms: [...(prev?.terms || []), ""],
    }));
  };

  const removeTermRow = (idx: number) => {
    if (formData?.terms?.length > 1) {
      setFormData((prev: any) => ({
        ...prev,
        terms: prev.terms.filter((_: any, i: number) => i !== idx),
      }));
    }
  };

  const updateTermValue = (idx: number, val: string) => {
    const updated = [...(formData?.terms || [])];
    updated[idx] = val;
    setFormData((prev: any) => ({ ...prev, terms: updated }));
  };

  const getPlantCodes = (firm: any): string => {
    const codes = normalizePlantIds(firm);
    return codes.length > 0 ? codes.join(", ") : "N/A";
  };

  const handlePlantChange = (newSelectedIds: string[]) => {
    setFormData((prev: any) => ({
      ...prev,
      assignedPlantIds: Array.isArray(newSelectedIds) ? newSelectedIds : [],
    }));
  };

  return (
    <div className="w-full flex flex-col bg-white min-h-full">
      <div className="bg-[#dae8f5] px-4 py-1 border-b border-gray-300">
        <h2 className="text-[13px] font-bold text-gray-800 uppercase italic tracking-wider">
          Consignor Master: Edit / Delete
        </h2>
      </div>

      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader className="bg-[#e7ebf1] sticky top-0 z-10">
            <TableRow className="h-8">
              <TableHead className="text-[11px] border-r w-12 text-center">#</TableHead>
              <TableHead className="text-[11px] border-r w-40">Plant</TableHead>
              <TableHead className="text-[11px] border-r w-16 text-center">Logo</TableHead>
              <TableHead className="text-[11px] border-r w-32">Consignor Code</TableHead>
              <TableHead className="text-[11px] border-r">Consignor Name</TableHead>
              <TableHead className="text-[11px] border-r w-32">GSTIN</TableHead>
              <TableHead className="text-[11px] border-r w-28">PAN</TableHead>
              <TableHead className="text-[11px] border-r w-36">State</TableHead>
              <TableHead className="text-[11px] border-r w-16">State Code</TableHead>
              <TableHead className="text-[11px] w-32 text-center">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isFirmsLoading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-4 text-xs">
                  FETCHING CONSIGNORS...
                </TableCell>
              </TableRow>
            ) : !firms || firms.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-10 text-xs text-red-500 font-bold">
                  NO CONSIGNOR RECORDS FOUND
                </TableCell>
              </TableRow>
            ) : (
              firms.map((f, i) => (
                <TableRow key={f.id} className="h-10 hover:bg-blue-50/50 transition-colors">
                  <TableCell className="p-0 text-center text-[10px] border-r text-gray-400">
                    {i + 1}
                  </TableCell>
                  <TableCell className="p-0 px-2 text-[11px] border-r font-mono text-gray-700">
                    {getPlantCodes(f)}
                  </TableCell>
                  <TableCell className="p-0 border-r flex items-center justify-center">
                    {f.logoData ? (
                      <div className="w-8 h-8 relative">
                        <Image src={f.logoData} alt="Logo" fill className="object-contain" />
                      </div>
                    ) : (
                      <Building2 className="h-4 w-4 text-gray-300" />
                    )}
                  </TableCell>
                  <TableCell className="p-0 px-2 text-[11px] border-r font-mono font-bold text-blue-700">
                    {f.consignorCode || f.firmId || "-"}
                  </TableCell>
                  <TableCell className="p-0 px-2 text-[11px] border-r font-bold">
                    {f.name}
                  </TableCell>
                  <TableCell className="p-0 px-2 text-[11px] border-r font-mono">
                    {f.gstin}
                  </TableCell>
                  <TableCell className="p-0 px-2 text-[11px] border-r font-mono">
                    {f.pan}
                  </TableCell>
                  <TableCell className="p-0 px-2 text-[11px] border-r">
                    {f.state || "-"}
                  </TableCell>
                  <TableCell className="p-0 px-2 text-[11px] border-r font-mono text-center">
                    {f.stateCode || "-"}
                  </TableCell>
                  <TableCell className="p-0 px-1 border-r">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        onClick={() => openEdit(f)}
                        size="sm"
                        className="h-6 rounded-none px-2 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold gap-1"
                      >
                        <Pencil className="h-3 w-3" /> Edit
                      </Button>
                      <Button
                        onClick={() => setDeleteTarget(f)}
                        size="sm"
                        variant="destructive"
                        className="h-6 rounded-none px-2 text-[10px] font-bold gap-1"
                      >
                        <Trash2 className="h-3 w-3" /> Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Modal - modal={false} stops click intercept from dropdowns */}
      <Dialog open={editOpen} onOpenChange={setEditOpen} modal={false}>
        <DialogContent
          className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-sm p-0 z-50 shadow-2xl border border-gray-400"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader className="bg-[#dae8f5] px-4 py-2 border-b border-[#b5c7de]">
            <DialogTitle className="text-[13px] font-bold text-gray-800 uppercase italic tracking-wider">
              Edit Consignor Master
            </DialogTitle>
            <DialogDescription className="text-[11px] text-gray-600">
              Modify consignor details. Fields marked with * are mandatory.
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 space-y-4">
            {formData && (
              <>
                {/* Basic Details & Logo */}
                <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
                  <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700">
                    Basic Details & Logo
                  </div>
                  <div className="p-2 space-y-2">
                    <div className="sap-selection-row items-start">
                      <label className="sap-label mt-1">
                        Plant Access <span className="text-red-500">*</span>
                      </label>
                      <div className="sap-input-wrapper max-w-[280px]">
                        <PlantMultiSelect
                          plants={plants || []}
                          selected={formData.assignedPlantIds || []}
                          onChange={handlePlantChange}
                          isLoading={isPlantsLoading}
                          placeholder="Select Plant(s)..."
                        />
                      </div>
                    </div>

                    <div className="sap-selection-row items-start">
                      <label className="sap-label mt-1">Consignor Logo</label>
                      <div className="sap-input-wrapper gap-4">
                        <div
                          onClick={() => fileInputRef.current?.click()}
                          className="w-24 h-24 border-2 border-dashed border-gray-300 rounded flex items-center justify-center cursor-pointer hover:bg-blue-50 transition-colors relative"
                        >
                          {formData.logoData ? (
                            <>
                              <Image
                                src={formData.logoData}
                                alt="Logo"
                                fill
                                className="object-contain p-1"
                              />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFormData((prev: any) => ({ ...prev, logoData: "" }));
                                }}
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </>
                          ) : (
                            <div className="flex flex-col items-center text-gray-400">
                              <Upload className="h-6 w-6" />
                              <span className="text-[10px]">Max 500KB</span>
                            </div>
                          )}
                        </div>
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleLogoUpload}
                          accept="image/*"
                          className="hidden"
                        />
                      </div>
                    </div>

                    <div className="sap-selection-row">
                      <label className="sap-label">Consignor Code</label>
                      <div className="sap-input-wrapper max-w-[200px]">
                        <Input
                          value={formData.consignorCode || ""}
                          onChange={(e) =>
                            setFormData((prev: any) => ({
                              ...prev,
                              consignorCode: e.target.value
                                .toUpperCase()
                                .replace(/[^A-Z0-9-]/g, ""),
                            }))
                          }
                        />
                      </div>
                    </div>

                    <div className="sap-selection-row">
                      <label className="sap-label">Consignor Name</label>
                      <div className="sap-input-wrapper max-w-xl">
                        <Input
                          value={formData.name || ""}
                          onChange={(e) =>
                            setFormData((prev: any) => ({
                              ...prev,
                              name: e.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* GST Info */}
                <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
                  <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700">
                    GST & Tax Info
                  </div>
                  <div className="p-2 space-y-1">
                    <div className="sap-selection-row">
                      <label className="sap-label">GSTIN</label>
                      <div className="sap-input-wrapper max-w-[200px]">
                        <Input
                          value={formData.gstin || ""}
                          onChange={(e) => handleGSTINChange(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="sap-selection-row">
                      <label className="sap-label">PAN</label>
                      <div className="sap-input-wrapper max-w-[150px]">
                        <Input
                          value={formData.pan || ""}
                          readOnly
                          className="bg-gray-100 font-mono"
                        />
                      </div>
                    </div>
                    <div className="sap-selection-row">
                      <label className="sap-label">State / State Code</label>
                      <div className="sap-input-wrapper max-w-xl gap-1">
                        <Input
                          value={formData.stateCode || ""}
                          readOnly
                          className="w-12 bg-gray-100 text-center"
                        />
                        <Input
                          value={formData.state || ""}
                          readOnly
                          className="bg-gray-100"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Banking Info */}
                <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
                  <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700">
                    Banking and Payment Information
                  </div>
                  <div className="p-2 space-y-1">
                    <div className="sap-selection-row">
                      <label className="sap-label">Bank Name</label>
                      <div className="sap-input-wrapper max-w-md">
                        <Input
                          value={formData.bankName || ""}
                          onChange={(e) =>
                            setFormData((prev: any) => ({
                              ...prev,
                              bankName: e.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div className="sap-selection-row">
                      <label className="sap-label">Account Holder Name</label>
                      <div className="sap-input-wrapper max-w-md">
                        <Input
                          value={formData.accountHolderName || ""}
                          onChange={(e) =>
                            setFormData((prev: any) => ({
                              ...prev,
                              accountHolderName: e.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div className="sap-selection-row">
                      <label className="sap-label">Account Number</label>
                      <div className="sap-input-wrapper max-w-md">
                        <Input
                          value={formData.accountNumber || ""}
                          onChange={(e) =>
                            setFormData((prev: any) => ({
                              ...prev,
                              accountNumber: e.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div className="sap-selection-row">
                      <label className="sap-label">IFSC code</label>
                      <div className="sap-input-wrapper max-w-[200px]">
                        <Input
                          value={formData.ifscCode || ""}
                          onChange={(e) =>
                            setFormData((prev: any) => ({
                              ...prev,
                              ifscCode: e.target.value.toUpperCase(),
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Contact & Address */}
                <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
                  <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700">
                    Contact & Address
                  </div>
                  <div className="p-2 space-y-1">
                    <div className="sap-selection-row">
                      <label className="sap-label">Email</label>
                      <div className="sap-input-wrapper max-w-xl">
                        <Input
                          value={formData.email || ""}
                          onChange={(e) =>
                            setFormData((prev: any) => ({
                              ...prev,
                              email: e.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div className="sap-selection-row">
                      <label className="sap-label">Mobile</label>
                      <div className="sap-input-wrapper max-w-[200px]">
                        <Input
                          value={formData.mobile || ""}
                          onChange={(e) =>
                            setFormData((prev: any) => ({
                              ...prev,
                              mobile: e.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div className="sap-selection-row items-start">
                      <label className="sap-label mt-1">Address</label>
                      <div className="sap-input-wrapper max-w-full">
                        <Textarea
                          value={formData.address || ""}
                          onChange={(e) =>
                            setFormData((prev: any) => ({
                              ...prev,
                              address: e.target.value,
                            }))
                          }
                          rows={2}
                          className="rounded-none border-gray-400 focus:bg-[#fff9c4]"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Terms & Conditions */}
                <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
                  <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700 flex justify-between items-center">
                    <span>Terms & Conditions</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={addTermRow}
                      className="h-5 text-[10px] hover:bg-white/50 border border-transparent hover:border-blue-300 rounded-none gap-1"
                    >
                      <Plus className="h-3 w-3" /> Add Row
                    </Button>
                  </div>
                  <div className="p-2 space-y-1">
                    {(formData.terms || [""]).map((term: string, idx: number) => (
                      <div key={idx} className="sap-selection-row group">
                        <label className="sap-label">Term Row {idx + 1}</label>
                        <div className="sap-input-wrapper w-full gap-2">
                          <Input
                            value={term}
                            onChange={(e) => updateTermValue(idx, e.target.value)}
                            placeholder={`Enter term or condition #${idx + 1}`}
                          />
                          {(formData.terms || []).length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeTermRow(idx)}
                              className="h-6 w-6 text-red-500 hover:bg-red-50"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="px-4 py-3 border-t border-[#b5c7de] bg-[#f4f6f9]">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditOpen(false)}
              className="h-7 rounded-none text-[11px] font-bold"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="h-7 rounded-none text-[11px] font-bold gap-1.5"
            >
              {loading && <Loader2 className="h-3 w-3 animate-spin" />}
              {loading ? "SAVING..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Warning Confirmation Popup */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent className="max-w-md rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="h-5 w-5" /> Confirm Consignor Deletion
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[12px] leading-relaxed">
              Are you sure you want to delete consignor{" "}
              <b>{deleteTarget?.name || deleteTarget?.consignorCode || ""}</b> (Code:{" "}
              <b>{deleteTarget?.consignorCode || deleteTarget?.firmId || "-"}</b>)?
              <br />
              <br />
              This operation will permanently remove the consignor master record. Already
              generated invoices will remain frozen with current data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={loading}
              className="h-8 rounded-none text-[11px] font-bold"
            >
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

      {loading && (
        <div className="fixed bottom-10 right-10 bg-[#333e4f] text-white px-4 py-2 text-xs border border-white/20 animate-pulse z-50">
          UPDATING CONSIGNOR MASTER...
        </div>
      )}
    </div>
  );
}