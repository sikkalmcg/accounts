"use client";

import { forwardRef, useState, useEffect } from "react";
import { format, parseISO, isValid } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toSAPDate, parseSAPDate, toIsoDate, INPUT_DATE_FORMAT } from "@/lib/date-utils";

export interface SapDateInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "onBlur" | "value"> {
  value?: string; // Expects "YYYY-MM-DD"
  onChange?: (value: string) => void; // Sends "YYYY-MM-DD"
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
}

export const SapDateInput = forwardRef<HTMLInputElement, SapDateInputProps>(
  ({ className, value, onChange, placeholder, disabled, readOnly, onBlur, ...props }, ref) => {
    const [displayValue, setDisplayValue] = useState("");
    const [isPickerOpen, setPickerOpen] = useState(false);
    const [isInvalid, setIsInvalid] = useState(false);

    // Sync input text with prop value when external value changes
    useEffect(() => {
      if (value) {
        const parsed = parseISO(value);
        if (isValid(parsed)) {
          setDisplayValue(toSAPDate(value));
          setIsInvalid(false);
          return;
        }
      }
      setDisplayValue(value || "");
      setIsInvalid(false);
    }, [value]);

    const handleDateSelect = (date: Date | undefined) => {
      if (date && isValid(date)) {
        const iso = format(date, INPUT_DATE_FORMAT);
        setDisplayValue(toSAPDate(iso));
        setIsInvalid(false);
        onChange?.(iso);
      }
      setPickerOpen(false);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      setDisplayValue(raw);

      if (raw.trim() === "") {
        setIsInvalid(false);
        onChange?.("");
        return;
      }

      const iso = toIsoDate(raw);
      if (iso) {
        setIsInvalid(false);
        onChange?.(iso);
      } else {
        setIsInvalid(raw.trim().length >= 10);
      }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      if (value) {
        const iso = toIsoDate(displayValue) || value;
        setDisplayValue(toSAPDate(iso));
      } else if (displayValue) {
        const iso = toIsoDate(displayValue);
        if (iso) {
          setDisplayValue(toSAPDate(iso));
        } else {
          setIsInvalid(true);
        }
      }
      onBlur?.(e);
    };

    const getCalendarDate = () => {
      if (!value) return undefined;
      const parsed = parseSAPDate(toSAPDate(value));
      return parsed && isValid(parsed) ? parsed : undefined;
    };

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
              "pr-10",
              isInvalid && "border-destructive text-destructive focus-visible:ring-destructive"
            )}
            {...props}
          />
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              disabled={disabled || readOnly}
              className={cn(
                "absolute right-0 h-full px-3 py-2 text-muted-foreground hover:bg-transparent",
                isInvalid && "text-destructive"
              )}
              aria-label="Open calendar"
            >
              <CalendarIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
        </div>
        <PopoverContent className="w-auto p-0 border border-gray-200 shadow-md rounded-lg" align="end" sideOffset={4}>
          <Calendar
            mode="single"
            selected={getCalendarDate()}
            onSelect={handleDateSelect}
            initialFocus
            defaultMonth={getCalendarDate() || new Date()}
          />
        </PopoverContent>
      </Popover>
    );
  }
);

SapDateInput.displayName = "SapDateInput";