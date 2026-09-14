"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useDatabase, useCollection, useMemoDatabase, addDocumentNonBlocking } from "@/database";
import { collection, serverTimestamp } from "@/database/mongo";
import { validateDuplicate } from "@/lib/duplicate-validator";
import { DEFAULT_DIVISIONS } from "@/lib/division-master";

const initialData = {
  plantId: "",
  name: "",
  location: "",
  division: "",
};

export default function OP01() {
  const db = useDatabase();
  const [formData, setFormData] = useState(initialData);
  const [loading, setLoading] = useState(false);

  const plantsQuery = useMemoDatabase(() => collection(db, "plants"), [db]);
  const { data: plants } = useCollection(plantsQuery);

  const divisionsQuery = useMemoDatabase(() => collection(db, "divisions"), [db]);
  const { data: dbDivisions } = useCollection(divisionsQuery);
  const divisions = useMemo(() => {
    const base = ((dbDivisions && dbDivisions.length > 0 ? dbDivisions : DEFAULT_DIVISIONS) as any[]).map((d: any) => ({
      id: d.id || d.name,
      name: d.name
    }));
    const existingNames = new Set(base.map(d => (d.name || "").trim().toLowerCase()));
    plants?.forEach((p: any) => {
      const divName = (p.division || "").trim();
      if (divName && !existingNames.has(divName.toLowerCase())) {
        existingNames.add(divName.toLowerCase());
        base.push({ id: divName, name: divName });
      }
    });
    return base;
  }, [dbDivisions, plants]);

  const handleExecute = useCallback(async () => {
    // 1. Mandatory Validation: Plant ID, Plant Name, Division
    if (!formData.plantId || !formData.plantId.trim()) {
      window.dispatchEvent(new CustomEvent('sap-status', {
        detail: { text: "Plant ID is required.", isError: true }
      }));
      return;
    }

    if (!formData.name || !formData.name.trim()) {
      window.dispatchEvent(new CustomEvent('sap-status', {
        detail: { text: "Plant Name is required.", isError: true }
      }));
      return;
    }

    if (!formData.division || !formData.division.trim()) {
      window.dispatchEvent(new CustomEvent('sap-status', {
        detail: { text: "Division is required.", isError: true }
      }));
      return;
    }

    setLoading(true);
    try {
      // Duplicate Restriction Validation
      const error = await validateDuplicate(db, "plants", "plantId", formData.plantId);
      if (error) {
        window.dispatchEvent(new CustomEvent('sap-status', {
          detail: { text: error, isError: true }
        }));
        setLoading(false);
        return;
      }

      const normalizedPlantId = formData.plantId.trim().toUpperCase();
      const normalizedDivision = formData.division.trim();

      addDocumentNonBlocking(collection(db, "plants"), {
        plantId: normalizedPlantId,
        name: formData.name.trim(),
        location: formData.location ? formData.location.trim() : "",
        division: normalizedDivision,
        createdAt: serverTimestamp(),
      });

      // Automatically register new manual division into divisions collection if not already present
      const existsInDb = divisions.some((d: any) => (d.name || d).toLowerCase() === normalizedDivision.toLowerCase());
      if (!existsInDb) {
        addDocumentNonBlocking(collection(db, "divisions"), {
          name: normalizedDivision,
          code: normalizedDivision.toUpperCase().replace(/[^A-Z0-9]/g, "_"),
          createdAt: serverTimestamp(),
        });
      }

      window.dispatchEvent(new CustomEvent('sap-status', {
        detail: { text: `Plant ${normalizedPlantId} created successfully`, isError: false }
      }));
      setFormData(initialData);
    } catch (e) {
      window.dispatchEvent(new CustomEvent('sap-status', {
        detail: { text: "System Error: Transaction failed", isError: true }
      }));
    } finally {
      setLoading(false);
    }
  }, [formData, db, divisions]);

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
      <div className="sap-header-title">Create Plant</div>

      <div className="p-4 space-y-4">
        <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
          <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700">
            Plant Details
          </div>

          <div className="p-2 space-y-1">
            <div className="sap-selection-row">
              <label className="sap-label">
                Plant ID <span className="text-red-500 font-bold">*</span>
              </label>
              <div className="sap-input-wrapper max-w-[150px]">
                <input
                  type="text"
                  value={formData.plantId}
                  onChange={(e) => setFormData({ ...formData, plantId: e.target.value.replace(/[^a-zA-Z0-9@-]/g, "").toUpperCase().slice(0, 16) })}
                  placeholder="e.g. ID20"
                  className="flex h-6 w-full rounded-none border border-gray-400 bg-white px-1.5 py-1 text-xs shadow-inner focus-visible:outline-none focus:bg-[#fff9c4]"
                />
              </div>
            </div>

            <div className="sap-selection-row">
              <label className="sap-label">
                Plant Name <span className="text-red-500 font-bold">*</span>
              </label>
              <div className="sap-input-wrapper max-w-md">
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Sikka Central Plant"
                  className="flex h-6 w-full rounded-none border border-gray-400 bg-white px-1.5 py-1 text-xs shadow-inner focus-visible:outline-none focus:bg-[#fff9c4]"
                />
              </div>
            </div>

            <div className="sap-selection-row">
              <label className="sap-label">
                Division <span className="text-red-500 font-bold">*</span>
              </label>
              <div className="sap-input-wrapper max-w-md">
                <input
                  type="text"
                  list="op01-division-list"
                  value={formData.division}
                  onChange={(e) => setFormData({ ...formData, division: e.target.value })}
                  placeholder="Enter Division *"
                  className="flex h-6 w-full rounded-none border border-gray-400 bg-white px-1.5 py-1 text-xs shadow-inner focus-visible:outline-none focus:bg-[#fff9c4]"
                />
                <datalist id="op01-division-list">
                  {divisions.map((d: any) => (
                    <option key={d.id || d.name} value={d.name} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="sap-selection-row">
              <label className="sap-label">Plant Location</label>
              <div className="sap-input-wrapper max-w-md">
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Optional"
                  className="flex h-6 w-full rounded-none border border-gray-400 bg-white px-1.5 py-1 text-xs shadow-inner focus-visible:outline-none focus:bg-[#fff9c4]"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      {loading && (
        <div className="fixed bottom-10 right-10 bg-[#333e4f] text-white px-4 py-2 text-xs animate-pulse border border-white/20">
          SYSTEM: Creating Plant...
        </div>
      )}
    </div>
  );
}
