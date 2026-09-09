"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type ComboboxOption = string | { value: string; label: string; subLabel?: string };

export interface SapComboboxProps {
  options?: ComboboxOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  allowCustomValue?: boolean;
}

/**
 * SapCombobox
 *
 * A SAP-style searchable field combining text input with a filterable dropdown:
 *  - User can type to search / filter options.
 *  - User can pick an option from the dropdown (or use Arrow keys + Enter).
 *  - Supports string[] or object { value, label, subLabel } options.
 *  - A clear (X) button removes the value when non-empty.
 */
export const SapCombobox = ({
  options = [],
  value = "",
  onChange,
  placeholder,
  disabled,
  className,
  inputClassName,
  allowCustomValue = true,
}: SapComboboxProps) => {
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Normalize options to uniform { value, label, subLabel } structure
  const normalizedOptions = useMemo(() => {
    return (options || []).map((opt) => {
      if (typeof opt === "string") {
        return { value: opt, label: opt, subLabel: undefined };
      }
      return opt;
    });
  }, [options]);

  // Find currently selected option
  const selectedOption = useMemo(() => {
    return normalizedOptions.find((o) => o.value === value);
  }, [normalizedOptions, value]);

  const initialText = selectedOption ? selectedOption.label : (value || "");
  const [query, setQuery] = useState(initialText);

  // Sync displayed text with external controlled value
  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setQuery(selectedOption ? selectedOption.label : (value || ""));
    }
  }, [value, selectedOption]);

  // Filter options based on query
  const filtered = useMemo(() => {
    if (!query.trim()) return normalizedOptions;
    const q = query.toLowerCase().trim();
    return normalizedOptions.filter((o) =>
      o.label.toLowerCase().includes(q) ||
      (o.subLabel && o.subLabel.toLowerCase().includes(q)) ||
      o.value.toLowerCase().includes(q)
    );
  }, [normalizedOptions, query]);

  const handleSelect = (option: { value: string; label: string }) => {
    setQuery(option.label);
    if (onChange) onChange(option.value);
    setOpen(false);
    inputRef.current?.focus();
  };

  const handleInputChange = (raw: string) => {
    setQuery(raw);
    setOpen(true);
    setHighlightedIndex(0);
    if (allowCustomValue) {
      if (onChange) onChange(raw);
    } else if (raw === "") {
      if (onChange) onChange("");
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setQuery("");
    if (onChange) onChange("");
    setOpen(true);
    inputRef.current?.focus();
  };

  const handleBlur = () => {
    if (!allowCustomValue) {
      setTimeout(() => {
        if (document.activeElement !== inputRef.current) {
          setQuery(selectedOption ? selectedOption.label : "");
        }
      }, 150);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      e.preventDefault();
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (filtered.length > 0 ? (prev + 1) % filtered.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (filtered.length > 0 ? (prev - 1 + filtered.length) % filtered.length : 0));
    } else if (e.key === "Enter") {
      if (open && filtered.length > 0 && highlightedIndex >= 0 && highlightedIndex < filtered.length) {
        e.preventDefault();
        handleSelect(filtered[highlightedIndex]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          className={cn(
            "relative flex items-center w-full h-7 cursor-text bg-white",
            "focus-within:bg-[#fff9c4]",
            className
          )}
          onClick={() => {
            inputRef.current?.focus();
            setOpen(true);
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => {
              setOpen(true);
              setHighlightedIndex(0);
            }}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={placeholder || "Type to search..."}
            className={cn(
              "h-full w-full border border-gray-400 px-1.5 text-xs outline-none bg-transparent pr-12",
              "hover:bg-white focus:bg-[#fff9c4]",
              inputClassName
            )}
          />
          <div className="absolute right-0 top-0 h-full flex items-center pr-1 pointer-events-auto">
            {query ? (
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleClear}
                className="h-full w-5 flex items-center justify-center text-gray-400 hover:text-red-600"
                title="Clear"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
            <button
              type="button"
              tabIndex={-1}
              aria-hidden
              className="h-full w-5 flex items-center justify-center text-gray-500 pointer-events-none"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto min-w-[280px] max-w-[480px] max-h-[260px] overflow-y-auto p-0 rounded-none border border-gray-400 shadow-xl bg-white z-[9999]"
        align="start"
        sideOffset={2}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {filtered.length === 0 ? (
          <div className="px-3 py-2 text-[11px] text-gray-500 font-bold uppercase">No matching options</div>
        ) : (
          <ul className="py-1">
            {filtered.map((option, idx) => {
              const isHighlighted = idx === highlightedIndex;
              const isSelected = option.value === value;
              return (
                <li
                  key={option.value || idx}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(option)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={cn(
                    "px-3 py-1.5 text-xs cursor-pointer flex flex-col justify-center border-b border-gray-100 last:border-b-0",
                    isHighlighted || isSelected
                      ? "bg-[#dae8f5] text-blue-900 font-bold"
                      : "hover:bg-gray-100 text-gray-800 font-medium"
                  )}
                >
                  <div className="flex justify-between items-center gap-2">
                    <span className="truncate">{option.label}</span>
                    {option.subLabel && (
                      <span className="text-[10px] text-gray-500 font-mono shrink-0">
                        {option.subLabel}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
};
