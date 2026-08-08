"use client";

import { forwardRef, useState, useEffect } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toSAPDate, parseSAPDate, toIsoDate, INPUT_DATE_FORMAT } from "@/lib/date-utils";

export interface SapDateInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "onBlur" | "value"> {
  value?: string; // Expects "yyyy-MM-dd"
  onChange?: (value: string) => void; // Sends "yyyy-MM-dd"
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
}

/**
 * SapDateInput
 *
 * A SAP-style date input that:
 *  - Displays dates in `DD-MMM-YYYY` (e.g. 04-Jun-2026)
 *  - Uses `DD-MMM-YYYY` as the default placeholder
 *  - Accepts manual keyboard entry in `DD-MMM-YYYY` and validates it strictly
 *  - Allows calendar selection via the calendar icon / native picker
 *  - Keeps the internal value in `YYYY-MM-DD` so all existing
 *    save/validation/query logic remains unchanged.
 */
export const SapDateInput = forwardRef<HTMLInputElement, SapDateInputProps>(
  ({ className, value, onChange, placeholder, disabled, readOnly, onBlur, ...props }, ref) => {
    const [displayValue, setDisplayValue] = useState(value ? toSAPDate(value) : "");
    const [isPickerOpen, setPickerOpen] = useState(false);
    const [isInvalid, setIsInvalid] = useState(false);

    // Keep the visible DD-MMM-YYYY value in sync with the controlled ISO value.
    useEffect(() => {
      setDisplayValue(value ? toSAPDate(value) : "");
      if (!value) setIsInvalid(false);
    }, [value]);

    const handleDateSelect = (date: Date | undefined) => {
      if (date) {
        const iso = format(date, INPUT_DATE_FORMAT);
        setDisplayValue(toSAPDate(iso));
        setIsInvalid(false);
        if (onChange) onChange(iso);
      }
      setPickerOpen(false);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      setDisplayValue(raw);

      // Allow partial input while typing; only validate when a full date is present.
      if (raw.trim() === "") {
        setIsInvalid(false);
        if (onChange) onChange("");
        return;
      }

      const iso = toIsoDate(raw);
      if (iso) {
        setIsInvalid(false);
        if (onChange) onChange(iso);
        setDisplayValue(toSAPDate(iso));
      } else {
        // Full-length input that fails validation -> mark invalid.
        setIsInvalid(raw.trim().length >= 10);
      }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      // On blur, snap back to the last valid value (or clear).
      setDisplayValue(value ? toSAPDate(value) : "");
      setIsInvalid(false);
      onBlur?.(e);
    };

    const selectedDate = value ? parseSAPDate(toSAPDate(value)) || undefined : undefined;

    return (
      <Popover open={isPickerOpen} onOpenChange={setPickerOpen}>
        <div className={cn("relative flex items-center w-full", className)}>
          <Input
            type="text"
            ref={ref}
            value={displayValue}
            onChange={handleInputChange}
            onBlur={handleBlur}
            disabled={disabled}
            readOnly={readOnly}
            placeholder={placeholder || "DD-MMM-YYYY"}
            aria-invalid={isInvalid || undefined}
            className={cn(
              "pr-9", // Make space for the icon
              isInvalid && "border-red-500 ring-1 ring-inset ring-red-400 focus-visible:ring-red-400"
            )}
            {...props}
          />
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled || readOnly}
              className={cn(
                "absolute right-0 top-0 h-6 w-7 shrink-0 cursor-pointer rounded-none border-l border-gray-400 bg-gray-50 text-gray-600 hover:bg-[#fff9c4] hover:text-gray-800 focus-visible:outline-none focus-visible:ring-0",
                isInvalid && "text-red-500"
              )}
              aria-label="Open calendar"
            >
              <CalendarIcon className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
        </div>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            initialFocus
            disabled={(d) => d.getFullYear() > 9999}
          />
        </PopoverContent>
      </Popover>
    );
  }
);

SapDateInput.displayName = "SapDateInput";

