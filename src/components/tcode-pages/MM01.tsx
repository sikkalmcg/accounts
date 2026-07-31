"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useDatabase, addDocumentNonBlocking, useCollection, useMemoDatabase } from "@/database";
import { collection, serverTimestamp } from "@/database/mongo";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

const UOM_OPTIONS = ["SQFT", "MT", "KG", "BAG", "BOX", "PCS", "OTHERS"];

const initialData = {
  plantId: "",
  productName: "", // Internal key for MATERIAL name
  hsnSac: "",
  uom: "",
  documentType: "", // New field from requirements
  documentCategory: "",
  inventoryType: "", // New field
};

export default function MM01() {
  const db = useDatabase();
  const [formData, setFormData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch Plants
  const plantsQuery = useMemoDatabase(() => collection(db, "plants"), [db]);
  const { data: plants, isLoading: isPlantsLoading } = useCollection(plantsQuery);

  // Fetch Billing Types for Document Category dropdown
  const billingQuery = useMemoDatabase(() => collection(db, "billing_types"), [db]);
  const { data: billingTypes, isLoading: isBillingLoading } = useCollection(billingQuery);

  // Filter unique categories based on selected Plant
  const availableCategories = useMemo(() => {
    if (!billingTypes || !formData.plantId) return [];
    const categories = billingTypes
      .filter(bt => bt.plantId === formData.plantId && bt.documentCategory)
      .map(bt => bt.documentCategory as string);
    return Array.from(new Set(categories));
  }, [billingTypes, formData.plantId]);

  const handleExecute = useCallback(async (dataToSave = formData, resetForm = true) => {
    const isInvalid = !dataToSave.plantId || 
                     !dataToSave.productName || 
                     !dataToSave.hsnSac || 
                     !dataToSave.uom || 
                     !dataToSave.documentType ||
                     !dataToSave.documentCategory ||
                     !dataToSave.inventoryType; // New field validation

    if (isInvalid) {
      window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: "Validation Error: All fields (Plant, Material, HSN, UOM, Charge Type) are mandatory", isError: true } 
      }));
      return false;
    }

    setLoading(true);
    try {
      await addDocumentNonBlocking(collection(db, "materials"), {
        ...dataToSave,
        createdAt: serverTimestamp(),
      });
      
      window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: `Material ${dataToSave.productName} created successfully`, isError: false } 
      }));
      if (resetForm && dataToSave === formData) setFormData(initialData);
      return true;
    } catch (error) {
      window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: "System Error: Transaction failed", isError: true } 
      }));
      return false;
    } finally {
      setLoading(false);
    }
  }, [formData, db]);

  const downloadTemplate = () => {
    const headers = ["PlantID", "MATERIAL", "HSN_SAC", "UOM", "DocumentType", "ChargeType", "InventoryType"];
    const csvContent = headers.join(",");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "MM01_Material_Template.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split("\n").map(line => line.trim()).filter(line => line !== "");
      const dataRows = lines.slice(1);
      let successCount = 0;
      let errorCount = 0;

      for (const row of dataRows) {
        const [plantId, material, hsn, uom, docType, category, inventoryType] = row.split(",").map(val => val.trim()); // Updated parsing
        if (plantId && material && hsn && uom && docType && category && inventoryType) {
          const success = await handleExecute({
            plantId,
            productName: material,
            hsnSac: hsn,
            documentType: docType,
            uom: uom.toUpperCase(),
            documentCategory: category,
            inventoryType: inventoryType, // New field
          }, false); // Pass false to prevent resetting form after each item
          if (success) successCount++;
          else errorCount++;
        } else {
          errorCount++;
        }
      }

      window.dispatchEvent(new CustomEvent('sap-status', {
        detail: { text: `Bulk Upload Finished: ${successCount} successful, ${errorCount} errors`, isError: errorCount > 0 } 
      }));
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsText(file);
  };

  useEffect(() => {
    const onExecute = () => handleExecute();
    const onCancel = () => setFormData(initialData);

    window.addEventListener('sap-execute', onExecute);
    window.addEventListener('sap-cancel', onCancel);

    return () => {
      window.removeEventListener('sap-execute', onExecute);
      window.removeEventListener('sap-cancel', onCancel);
    };
  }, [handleExecute]);

  return (
    <div className="w-full flex flex-col bg-white min-h-full">
      <div className="bg-[#dae8f5] px-4 py-1 border-b border-gray-300 flex items-center justify-between">
        <h2 className="text-[13px] font-bold text-gray-800 uppercase italic tracking-wider">
          Create Material
        </h2>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={downloadTemplate}
            className="h-6 text-[11px] font-bold text-blue-700 hover:bg-blue-50 border border-blue-200 rounded-none gap-1"
          >
            <Download className="h-3 w-3" /> Download Template
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => fileInputRef.current?.click()}
            className="h-6 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50 border border-emerald-200 rounded-none gap-1"
          >
            <Upload className="h-3 w-3" /> Bulk Upload
          </Button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleBulkUpload} 
            accept=".csv" 
            className="hidden" 
          />
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
          <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700">
            Material Master Data
          </div>
          
          <div className="p-2 space-y-1">
            <div className="sap-selection-row">
              <label className="sap-label">Plant ID <span className="text-red-500">*</span></label>
              <div className="sap-input-wrapper max-w-[200px]">
                <Select 
                  value={formData.plantId} 
                  onValueChange={(val) => setFormData({...formData, plantId: val, documentCategory: ""})}
                >
                  <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]">
                    <SelectValue />
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
              <label className="sap-label">MATERIAL <span className="text-red-500">*</span></label>
              <div className="sap-input-wrapper max-w-md">
                <Input
                  value={formData.productName}
                  onChange={(e) => setFormData({...formData, productName: e.target.value})}
                />
              </div>
            </div>

            <div className="sap-selection-row">
              <label className="sap-label">HSN/SAC <span className="text-red-500">*</span></label>
              <div className="sap-input-wrapper max-w-[200px]">
                <Input
                  value={formData.hsnSac}
                  onChange={(e) => setFormData({...formData, hsnSac: e.target.value})}
                />
              </div>
            </div>

            <div className="sap-selection-row">
              <label className="sap-label">UOM <span className="text-red-500">*</span></label>
              <div className="sap-input-wrapper max-w-[200px]">
                <Select 
                  value={formData.uom} 
                  onValueChange={(val) => setFormData({...formData, uom: val})}
                >
                  <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UOM_OPTIONS.map(opt => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="sap-selection-row">
              <label className="sap-label">Document Type <span className="text-red-500">*</span></label>
              <div className="sap-input-wrapper max-w-[200px]">
                <Select
                  value={formData.documentType}
                  onValueChange={(val) => setFormData({ ...formData, documentType: val })}
                >
                  <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Tax Invoice">Tax Invoice</SelectItem>
                    <SelectItem value="Non-Tax Invoice">Non-Tax Invoice</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="sap-selection-row">
              <label className="sap-label">Charge Type <span className="text-red-500">*</span></label>
              <div className="sap-input-wrapper max-w-[200px]">
                <Select 
                  value={formData.documentCategory} 
                  onValueChange={(val) => setFormData({...formData, documentCategory: val})}
                  disabled={!formData.plantId}
                >
                  <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCategories.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isBillingLoading && <Loader2 className="h-4 w-4 animate-spin text-blue-600 ml-1" />}
              </div>
            </div>

            {/* New field: Inventory Type */}
            <div className="sap-selection-row">
              <label className="sap-label">Inventory Type <span className="text-red-500">*</span></label>
              <div className="sap-input-wrapper max-w-[200px]">
                <Select
                  value={formData.inventoryType}
                  onValueChange={(val) => setFormData({...formData, inventoryType: val})}
                >
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
      </div>

      {loading && (
        <div className="fixed bottom-10 right-10 bg-[#333e4f] text-white px-4 py-2 text-xs border border-white/20">
          PROCESSING TRANSACTION...
        </div>
      )}
    </div>
  );
}
