"use client";

import { forwardRef, useRef } from "react";
import { cn } from "@/lib/utils";
import { toSAPDate } from "@/lib/date-utils";

/**
 * SapDateInput
 *
 * A SAP-style date input that displays dates in `DD-MMM-YYYY` (e.g. 10-Jun-2026)
 * while keeping the internal value in `YYYY-MM-DD` (the HTML5 input[type=date]
 * requirement), so all existing save/validation/query logic remains unchanged.
 *
 * It renders a formatted text layer on top of an invisible native
 * `<input type="date">`. Clicking anywhere on the field opens the native
 * browser calendar picker.
 */
export interface SapDateInputProps {
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  min?: string;
  max?: string;
  className?: string;
}

export const SapDateInput = forwardRef<HTMLInputElement, SapDateInputProps>(
  ({ value = "", onChange, disabled, readOnly, placeholder, min, max, className }, ref) => {
    const inputRef = useRef<HTMLInputElement | null>(null);

    const display = toSAPDate(value) || placeholder || "DD-MMM-YYYY";

    return (
      <div
        className={cn(
          "relative inline-flex w-full items-center overflow-hidden",
          disabled && "opacity-60",
          className
        )}
      >
        {/* Formatted DD-MMM-YYYY text layer */}
        <div
          className={cn(
            "pointer-events-none flex h-full w-full items-center truncate px-2 font-mono text-xs",
            value ? "text-gray-800" : "text-gray-400"
          )}
        >
          {display}
        </div>

        {/* Invisible native date input overlay (opens the calendar picker) */}
        <input
          ref={(el) => {
            inputRef.current = el;
            if (typeof ref === "function") ref(el);
            else if (ref) ref.current = el;
          }}
          type="date"
          value={value}
          min={min}
          max={max}
          disabled={disabled}
          readOnly={readOnly}
          onChange={(e) => onChange?.(e.target.value)}
          onClick={() => {
            // Ensure the picker opens on first click even if value is empty.
            if (inputRef.current) {
              try {
                inputRef.current.showPicker?.();
              } catch {
                /* fallback: native input handles it */
              }
            }
          }}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label={placeholder || "Date"}
        />
      </div>
    );
  }
);

SapDateInput.displayName = "SapDateInput";
