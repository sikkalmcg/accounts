"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, Check, X, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { isAllDivisions } from "@/lib/division-master";

export interface DivisionItem {
  id: string;
  name: string;
}

interface DivisionMultiSelectProps {
  divisions: DivisionItem[];
  selected: string[]; // ['ALL'] or array of division names like ['Division A', 'Division B']
  onChange: (selected: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export default function DivisionMultiSelect({
  divisions,
  selected,
  onChange,
  placeholder = "Select Division...",
  disabled = false,
  className,
}: DivisionMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const divisionList = useMemo(() => {
    return divisions && divisions.length > 0
      ? divisions
      : [
          { id: "DIV_A", name: "Division A" },
          { id: "DIV_B", name: "Division B" },
        ];
  }, [divisions]);

  const allDivisionNames = useMemo(() => divisionList.map((d) => d.name), [divisionList]);

  const isAll = useMemo(() => {
    return isAllDivisions(selected) || (selected.length > 0 && allDivisionNames.every((name) => selected.includes(name)));
  }, [selected, allDivisionNames]);

  const activeSelections = useMemo(() => {
    if (isAll) return ["ALL"];
    return selected.filter((d) => d !== "ALL");
  }, [isAll, selected]);

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setDropdownPos({
      top: rect.bottom + 2,
      left: rect.left,
      width: Math.max(rect.width, 240),
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

  const handleToggleDivision = (divName: string) => {
    if (isAll) {
      // Switch from All to just this single division
      onChange([divName]);
      return;
    }

    if (activeSelections.includes(divName)) {
      const remaining = activeSelections.filter((name) => name !== divName);
      if (remaining.length === 0) {
        // If everything deselected, reset to All
        onChange(["ALL"]);
      } else {
        onChange(remaining);
      }
    } else {
      const next = [...activeSelections, divName];
      if (allDivisionNames.every((name) => next.includes(name))) {
        onChange(["ALL"]);
      } else {
        onChange(next);
      }
    }
  };

  const dropdownContent = (
    <div
      data-division-dropdown
      className="w-[260px] bg-white border border-gray-400 shadow-xl shadow-black/20 pointer-events-auto select-none"
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-[#dae8f5] px-2.5 py-1.5 border-b border-gray-300 flex items-center justify-between">
        <span className="text-[10px] font-black uppercase text-gray-700 flex items-center gap-1.5">
          <Layers className="h-3 w-3" /> Division Filter
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleToggleAll}
            className="text-[9px] font-black uppercase text-emerald-700 hover:bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-0.5"
          >
            <Check className="h-2.5 w-2.5" /> All
          </button>
          <button
            type="button"
            onClick={handleToggleAll}
            className="text-[9px] font-black uppercase text-gray-600 hover:bg-gray-100 px-1.5 py-0.5 rounded flex items-center gap-0.5"
          >
            <X className="h-2.5 w-2.5" /> Reset
          </button>
        </div>
      </div>

      <div className="p-1 max-h-[220px] overflow-y-auto no-scrollbar space-y-0.5">
        {/* All Divisions Option */}
        <div
          className={cn(
            "flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors",
            isAll ? "bg-blue-50 font-bold text-blue-900" : "hover:bg-gray-100 text-gray-800"
          )}
          onClick={handleToggleAll}
        >
          <Checkbox checked={isAll} className="h-3.5 w-3.5 pointer-events-none" />
          <span className="text-[11px] flex-1">All Divisions</span>
          {isAll && (
            <span className="text-[9px] text-blue-700 font-bold bg-blue-100 px-1.5 py-0.2 rounded uppercase">
              Default
            </span>
          )}
        </div>

        <div className="border-t border-gray-200 my-1" />

        {/* Individual Divisions */}
        {divisionList.map((d) => {
          const isSelected = !isAll && activeSelections.includes(d.name);
          return (
            <div
              key={d.id || d.name}
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors",
                isSelected ? "bg-blue-50/70 font-semibold text-blue-900" : "hover:bg-gray-100 text-gray-800"
              )}
              onClick={() => handleToggleDivision(d.name)}
            >
              <Checkbox checked={isSelected} className="h-3.5 w-3.5 pointer-events-none" />
              <span className="text-[11px] flex-1">{d.name}</span>
            </div>
          );
        })}
      </div>

      <div className="bg-[#e7ebf1] border-t border-gray-300 px-2 py-1 text-[9px] font-bold text-gray-500 uppercase flex justify-between">
        <span>{isAll ? "All Divisions" : `${activeSelections.length} Selected`}</span>
        <span>{divisionList.length} Available</span>
      </div>
    </div>
  );

  return (
    <div ref={containerRef} className={cn("relative", className)}>
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
          {isAll ? (
            <span className="text-gray-800 font-semibold truncate">All</span>
          ) : activeSelections.length === 1 ? (
            <span className="text-gray-800 font-semibold truncate">{activeSelections[0]}</span>
          ) : activeSelections.length > 1 ? (
            <div className="flex items-center gap-1 min-w-0 flex-wrap">
              <span className="text-[10px] font-black text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-sm whitespace-nowrap">
                {activeSelections.length} Selected
              </span>
              {activeSelections.slice(0, 2).map((divName) => (
                <span
                  key={divName}
                  className="text-[10px] font-bold text-gray-700 bg-gray-100 border border-gray-300 px-1 py-0.5 rounded-sm whitespace-nowrap"
                >
                  {divName}
                </span>
              ))}
              {activeSelections.length > 2 && (
                <span className="text-[10px] font-bold text-gray-500 whitespace-nowrap">
                  +{activeSelections.length - 2}
                </span>
              )}
            </div>
          ) : (
            <span className="text-gray-400 truncate">{placeholder}</span>
          )}
        </div>
        <ChevronDown className={cn("h-3.5 w-3.5 text-gray-500 shrink-0 ml-1 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen &&
        dropdownPos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={dropdownRef}
            data-division-dropdown
            style={{
              position: "fixed",
              top: dropdownPos.top,
              left: dropdownPos.left,
              width: dropdownPos.width,
              zIndex: 99999,
              pointerEvents: "auto",
            }}
          >
            {dropdownContent}
          </div>,
          document.body
        )}
    </div>
  );
}
