"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface SapComboboxProps {
  options?: string[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
}

/**
 * SapCombobox
 *
 * A SAP-style "Document Type" field that combines a free-text input with a
 * filterable dropdown:
 *  - User can type any custom value manually.
 *  - Typing filters the dropdown options.
 *  - User can pick an option from the dropdown (fills the value).
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
}: SapComboboxProps) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep typed text in sync with external controlled value (except right after typing).
  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setQuery(value);
    }
  }, [value]);

  const filtered = options.filter((o) => o.toLowerCase().includes(query.toLowerCase()));

  const handleSelect = (option: string) => {
    setQuery(option);
    if (onChange) onChange(option);
    setOpen(false);
    inputRef.current?.focus();
  };

  const handleInputChange = (raw: string) => {
    setQuery(raw);
    setOpen(true);
    if (onChange) onChange(raw);
  };

  const handleClear = () => {
    setQuery("");
    if (onChange) onChange("");
    inputRef.current?.focus();
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
            onFocus={() => setOpen(true)}
            disabled={disabled}
            placeholder={placeholder || "Type or select..."}
            className={cn(
              "h-full w-full border border-gray-400 px-1.5 text-xs outline-none bg-transparent",
              "hover:bg-white focus:bg-[#fff9c4]",
              inputClassName
            )}
          />
          <div className="absolute right-0 top-0 h-full flex items-center pr-0.5">
            {query ? (
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleClear}
                className="h-full w-6 flex items-center justify-center text-gray-500 hover:text-red-600"
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
        className="w-[var(--radix-popover-trigger-width)] min-w-[180px] max-h-[220px] overflow-y-auto p-0 rounded-none border-gray-400 shadow-xl"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {filtered.length === 0 ? (
          <div className="px-3 py-2 text-[11px] text-gray-500 font-bold uppercase">No matching options</div>
        ) : (
          <ul>
            {filtered.map((option) => (
              <li
                key={option}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(option)}
                className={cn(
                  "px-3 py-1.5 text-xs cursor-default hover:bg-[#dae8f5] font-medium",
                  option === query && "bg-[#dae8f5] text-blue-900 font-bold"
                )}
              >
                {option}
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
};

