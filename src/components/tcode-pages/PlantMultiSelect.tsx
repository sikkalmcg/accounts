"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Check, ChevronDown, X, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

interface Plant {
  id: string;
  plantId: string;
  name?: string;
}

interface PlantMultiSelectProps {
  plants: Plant[] | null | undefined;
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
  /** Restrict the list of selectable plants (e.g. user's authorized plants) */
  allowedPlantIds?: string[];
  className?: string;
}

/**
 * Reusable multi-select Plant dropdown with:
 * - Search box
 * - Select All / Clear All buttons
 * - Checkbox list of plants
 * - Selected plant chips + count
 * - Portal-based popup so it is never clipped by ancestor overflow
 */
export default function PlantMultiSelect({
  plants,
  selected,
  onChange,
  placeholder = "Select Plant(s)",
  disabled = false,
  isLoading = false,
  allowedPlantIds,
  className,
}: PlantMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Determine the selectable list
  const plantList = useMemo(() => {
    if (!plants) return [];
    if (allowedPlantIds && allowedPlantIds.length > 0) {
      return plants.filter((p) => allowedPlantIds.includes(p.plantId));
    }
    return plants;
  }, [plants, allowedPlantIds]);

  // Compute popup position from the trigger button's bounding rect
  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setDropdownPos({
      top: rect.bottom + 2,
      left: rect.left,
      width: Math.max(rect.width, 340),
    });
  }, []);

  const openDropdown = useCallback(() => {
    updatePosition();
    setIsOpen(true);
  }, [updatePosition]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const inContainer = containerRef.current?.contains(target);
      const inDropdown = dropdownRef.current?.contains(target) ?? false;
      // Only close if the click is outside BOTH the trigger container and the
      // portal-rendered dropdown. The dropdown is rendered via createPortal to
      // document.body, so it is NOT a child of containerRef.
      if (!inContainer && !inDropdown) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Reposition on scroll/resize while open
  useEffect(() => {
    if (!isOpen) return;
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen, updatePosition]);

  const filteredPlants = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return plantList;
    return plantList.filter(
      (p) =>
        p.plantId.toLowerCase().includes(q) ||
        (p.name || "").toLowerCase().includes(q)
    );
  }, [plantList, search]);

  const selectedCount = selected.length;
  const totalCount = plantList.length;

  const togglePlant = (plantId: string) => {
    if (selected.includes(plantId)) {
      onChange(selected.filter((id) => id !== plantId));
    } else {
      onChange([...selected, plantId]);
    }
  };

  const selectAll = () => {
    const allIds = plantList.map((p) => p.plantId);
    // Merge with already-selected (non-selectable) ids to avoid data loss
    onChange(Array.from(new Set([...selected, ...allIds])));
  };

  const clearAll = () => {
    const removable = new Set(plantList.map((p) => p.plantId));
    onChange(selected.filter((id) => !removable.has(id)));
  };

  const allSelected = totalCount > 0 && plantList.every((p) => selected.includes(p.plantId));

  const selectedLabels = plantList
    .filter((p) => selected.includes(p.plantId))
    .map((p) => p.plantId);

  const dropdownContent = (
    <div className="w-[340px] bg-white border border-gray-400 shadow-xl shadow-black/20">
      <div className="bg-[#dae8f5] px-2 py-1.5 border-b border-gray-300 flex items-center justify-between">
        <span className="text-[10px] font-black uppercase text-gray-700 flex items-center gap-1.5">
          <Layers className="h-3 w-3" /> Select Plants
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={selectAll}
            disabled={totalCount === 0}
            className="text-[9px] font-black uppercase text-emerald-700 hover:bg-emerald-50 px-1.5 py-0.5 rounded disabled:opacity-40 flex items-center gap-0.5"
          >
            <Check className="h-2.5 w-2.5" /> Select All
          </button>
          <button
            type="button"
            onClick={clearAll}
            disabled={totalCount === 0}
            className="text-[9px] font-black uppercase text-red-600 hover:bg-red-50 px-1.5 py-0.5 rounded disabled:opacity-40 flex items-center gap-0.5"
          >
            <X className="h-2.5 w-2.5" /> Clear All
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="p-1.5 border-b border-gray-200 flex items-center gap-1.5">
        <Search className="h-3 w-3 text-gray-400 shrink-0" />
        <input
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search plant by ID / name..."
          className="w-full h-6 text-[11px] outline-none border border-gray-300 px-1.5 focus:border-blue-500"
        />
      </div>

      {/* List */}
      <div className="max-h-[180px] overflow-y-auto no-scrollbar p-1">
        {isLoading ? (
          <div className="text-[10px] text-gray-400 py-3 text-center">Loading Plants...</div>
        ) : filteredPlants.length === 0 ? (
          <div className="text-[10px] text-red-500 py-3 text-center font-bold">
            No plants found. Create a plant first (OP01).
          </div>
        ) : (
          filteredPlants.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-2 p-1.5 hover:bg-blue-50 rounded cursor-pointer"
              onClick={() => togglePlant(p.plantId)}
            >
              <Checkbox
                checked={selected.includes(p.plantId)}
                onCheckedChange={() => togglePlant(p.plantId)}
                onClick={(e) => e.stopPropagation()}
                className="h-3.5 w-3.5"
              />
              <span className="text-[11px] font-bold cursor-pointer flex-1">
                {p.plantId}
                {p.name ? <span className="text-[10px] text-gray-500 font-medium ml-1">- {p.name}</span> : null}
              </span>
              {allSelected && <span className="text-[9px] text-emerald-600 font-black uppercase">All</span>}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="bg-[#e7ebf1] border-t border-gray-300 px-2 py-1 text-[9px] font-bold text-gray-500 uppercase flex justify-between">
        <span>{selectedCount} selected</span>
        <span>{totalCount} total</span>
      </div>
    </div>
  );

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (isOpen) {
            setIsOpen(false);
          } else {
            openDropdown();
          }
        }}
        className={cn(
          "flex w-full items-center justify-between h-7 rounded-none border border-gray-400 bg-white px-2 text-xs shadow-inner focus:bg-[#fff9c4] focus:outline-none hover:bg-gray-50 transition-colors",
          disabled && "opacity-50 cursor-not-allowed bg-gray-100"
        )}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {selectedCount === 0 ? (
            <span className="text-gray-400 truncate">{placeholder}</span>
          ) : (
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <span className="text-[10px] font-black text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-sm whitespace-nowrap">
                {selectedCount} Selected
              </span>
              {selectedLabels.slice(0, 3).map((label) => (
                <span key={label} className="text-[10px] font-bold text-gray-700 bg-gray-100 border border-gray-300 px-1 py-0.5 rounded-sm whitespace-nowrap">
                  {label}
                </span>
              ))}
              {selectedLabels.length > 3 && (
                <span className="text-[10px] font-bold text-gray-500 whitespace-nowrap">
                  +{selectedLabels.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
        <ChevronDown className={cn("h-3.5 w-3.5 text-gray-500 shrink-0", isOpen && "rotate-180")} />
      </button>

      {/* Portal Dropdown — rendered to document.body so it's never clipped */}
      {isOpen &&
        dropdownPos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: "fixed",
              top: dropdownPos.top,
              left: dropdownPos.left,
              width: dropdownPos.width,
              zIndex: 99999,
            }}
          >
            {dropdownContent}
          </div>,
          document.body
        )}
    </div>
  );
}

