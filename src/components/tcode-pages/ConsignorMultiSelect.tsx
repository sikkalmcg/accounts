"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, Check, X, Search, Building } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ConsignorItem {
  id: string;
  firmId?: string;
  consignorCode?: string;
  name: string;
}

interface ConsignorMultiSelectProps {
  consignors: ConsignorItem[] | null | undefined;
  selected: string[]; // ['ALL'] or array of firmIds
  onChange: (selected: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export default function ConsignorMultiSelect({
  consignors,
  selected,
  onChange,
  placeholder = "All Consignors",
  disabled = false,
  className,
}: ConsignorMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const consignorList = useMemo(() => {
    return consignors || [];
  }, [consignors]);

  const isAll = useMemo(() => {
    if (!selected || selected.length === 0) return true;
    return selected.includes("ALL");
  }, [selected]);

  const activeSelections = useMemo(() => {
    if (isAll) return ["ALL"];
    return selected.filter((id) => id !== "ALL");
  }, [isAll, selected]);

  const filteredList = useMemo(() => {
    if (!search.trim()) return consignorList;
    const q = search.toLowerCase();
    return consignorList.filter((c) => {
      const code = (c.consignorCode || c.firmId || "").toLowerCase();
      const name = (c.name || "").toLowerCase();
      return code.includes(q) || name.includes(q);
    });
  }, [consignorList, search]);

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setDropdownPos({
      top: rect.bottom + 2,
      left: rect.left,
      width: Math.max(rect.width, 280),
    });
  }, []);

  const openDropdown = useCallback(() => {
    updatePosition();
    setIsOpen(true);
  }, [updatePosition]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const inContainer = containerRef.current?.contains(target);
      const inDropdown = dropdownRef.current?.contains(target) ?? false;
      if (!inContainer && !inDropdown) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

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

  const handleToggleAll = () => {
    onChange(["ALL"]);
  };

  const handleToggleItem = (consignorKey: string) => {
    if (isAll) {
      // Transitioning from ALL to single selected
      onChange([consignorKey]);
      return;
    }

    const exists = activeSelections.includes(consignorKey);
    let next: string[];
    if (exists) {
      next = activeSelections.filter((id) => id !== consignorKey);
    } else {
      next = [...activeSelections, consignorKey];
    }

    // If all individual items selected, revert to ALL
    if (next.length === 0 || next.length >= consignorList.length) {
      onChange(["ALL"]);
    } else {
      onChange(next);
    }
  };

  const handleSelectAllFiltered = () => {
    onChange(["ALL"]);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(["ALL"]);
  };

  // Selected names for trigger button
  const triggerLabel = useMemo(() => {
    if (isAll || activeSelections.length === 0) {
      return "All Consignors";
    }

    const selectedFirms = consignorList.filter((c) => {
      const key = c.firmId || c.id;
      return activeSelections.includes(key) || activeSelections.includes(c.name);
    });

    if (selectedFirms.length === 1) {
      return selectedFirms[0].name;
    }
    if (selectedFirms.length > 1) {
      return `${selectedFirms[0].name}, +${selectedFirms.length - 1} more`;
    }
    return `${activeSelections.length} Selected`;
  }, [isAll, activeSelections, consignorList]);

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => (isOpen ? setIsOpen(false) : openDropdown())}
        className={cn(
          "flex h-8 w-full items-center justify-between rounded-none border border-gray-400 bg-white px-2 py-1 text-xs text-left shadow-none transition-colors",
          "hover:border-gray-500 focus:outline-none focus:bg-[#fff9c4]",
          disabled && "cursor-not-allowed opacity-50 bg-gray-100",
          !isAll && "border-[#215284] bg-blue-50/20"
        )}
      >
        <span className="truncate font-normal text-gray-800 flex-1 mr-1">
          {triggerLabel}
        </span>

        <div className="flex items-center gap-1 shrink-0 ml-1">
          {!isAll && (
            <span
              onClick={handleClear}
              title="Clear selection"
              className="rounded-full p-0.5 hover:bg-gray-200 text-gray-400 hover:text-gray-700"
            >
              <X className="h-3 w-3" />
            </span>
          )}
          {!isAll && (
            <span className="bg-[#215284] text-white text-[10px] font-bold px-1 py-0.2 rounded-sm leading-tight">
              {activeSelections.length}
            </span>
          )}
          <ChevronDown
            className={cn("h-3.5 w-3.5 text-gray-500 transition-transform duration-150", isOpen && "rotate-180")}
          />
        </div>
      </button>

      {isOpen &&
        dropdownPos &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: "fixed",
              top: `${dropdownPos.top}px`,
              left: `${dropdownPos.left}px`,
              minWidth: `${dropdownPos.width}px`,
              zIndex: 99999,
            }}
            className="rounded-none border border-gray-400 bg-white shadow-lg text-xs animate-in fade-in-50 zoom-in-95 duration-100"
          >
            {/* SEARCH BOX */}
            <div className="p-1.5 border-b border-gray-200 bg-gray-50">
              <div className="relative">
                <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search consignor..."
                  className="w-full pl-7 pr-2 py-1 text-xs bg-white border border-gray-300 rounded-none focus:outline-none focus:border-blue-500"
                  autoFocus
                />
              </div>
            </div>

            {/* QUICK ACTIONS */}
            <div className="flex items-center justify-between px-2 py-1 bg-gray-100 border-b border-gray-200 text-[11px] text-gray-600">
              <span>{consignorList.length} Consignor(s)</span>
              <div className="flex gap-2 font-medium">
                <button
                  type="button"
                  onClick={handleSelectAllFiltered}
                  className="text-blue-700 hover:underline cursor-pointer"
                >
                  All
                </button>
                <span>|</span>
                <button
                  type="button"
                  onClick={() => onChange(["ALL"])}
                  className="text-gray-600 hover:underline cursor-pointer"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* OPTIONS LIST */}
            <div className="max-h-56 overflow-y-auto divide-y divide-gray-100">
              {/* ALL OPTION */}
              <div
                onClick={handleToggleAll}
                className={cn(
                  "flex items-center gap-2 px-2.5 py-1.5 cursor-pointer select-none transition-colors",
                  isAll ? "bg-blue-50 font-semibold text-blue-900" : "hover:bg-gray-100 text-gray-800"
                )}
              >
                <Checkbox
                  checked={isAll}
                  onCheckedChange={handleToggleAll}
                  className="h-3.5 w-3.5 rounded-none border-gray-400"
                />
                <Building className="h-3.5 w-3.5 text-blue-600" />
                <span className="flex-1">All Consignors</span>
                {isAll && <Check className="h-3.5 w-3.5 text-blue-700" />}
              </div>

              {/* INDIVIDUAL CONSIGNORS */}
              {filteredList.map((consignor) => {
                const key = consignor.firmId || consignor.id;
                const isSelected = !isAll && activeSelections.includes(key);
                const code = consignor.consignorCode || consignor.firmId;

                return (
                  <div
                    key={key}
                    onClick={() => handleToggleItem(key)}
                    className={cn(
                      "flex items-center gap-2 px-2.5 py-1.5 cursor-pointer select-none transition-colors",
                      isSelected ? "bg-blue-50 text-blue-900 font-medium" : "hover:bg-gray-50 text-gray-700"
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => handleToggleItem(key)}
                      className="h-3.5 w-3.5 rounded-none border-gray-400"
                    />
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="truncate">{consignor.name}</span>
                      {code && (
                        <span className="text-[10px] text-gray-400 font-mono">
                          Code: {code}
                        </span>
                      )}
                    </div>
                    {isSelected && <Check className="h-3.5 w-3.5 text-blue-700 shrink-0" />}
                  </div>
                );
              })}

              {filteredList.length === 0 && (
                <div className="py-4 text-center text-gray-400 text-xs italic">
                  No consignors found
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
