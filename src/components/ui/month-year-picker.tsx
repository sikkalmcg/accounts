"use client";

import React, { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, setYear, setMonth } from "date-fns";

const months = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

interface MonthYearPickerProps {
  value: string; // MMM-yyyy
  onChange: (value: string) => void;
  onClose?: () => void;
}

export function MonthYearPicker({ value, onChange, onClose }: MonthYearPickerProps) {
  // Parse current value or default to now
  const [currentDate, setCurrentDate] = useState(() => {
    if (!value) return new Date();
    try {
      const [m, y] = value.split("-");
      const monthIdx = months.indexOf(m);
      return new Date(parseInt(y), monthIdx !== -1 ? monthIdx : 0, 1);
    } catch {
      return new Date();
    }
  });

  const year = currentDate.getFullYear();
  const currentMonthName = format(currentDate, "MMM");

  const handlePrevYear = () => {
    setCurrentDate(prev => setYear(prev, prev.getFullYear() - 1));
  };

  const handleNextYear = () => {
    setCurrentDate(prev => setYear(prev, prev.getFullYear() + 1));
  };

  const handleMonthSelect = (monthIdx: number) => {
    const newDate = setMonth(currentDate, monthIdx);
    const formatted = format(newDate, "MMM-yyyy");
    onChange(formatted);
    if (onClose) onClose();
  };

  return (
    <div className="w-[340px] p-5 bg-white border border-gray-200 shadow-2xl rounded-xl animate-in zoom-in-95 duration-200">
      {/* Year Header */}
      <div className="flex items-center justify-between mb-8 px-2">
        <button 
          type="button"
          onClick={handlePrevYear}
          className="p-1.5 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <span className="text-2xl font-bold text-gray-800 tracking-tight">{year}</span>
        <button 
          type="button"
          onClick={handleNextYear}
          className="p-1.5 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      </div>

      {/* Months Grid */}
      <div className="grid grid-cols-3 gap-3">
        {months.map((m, idx) => {
          const isSelected = m === currentMonthName && currentDate.getFullYear() === year;
          return (
            <button
              key={m}
              type="button"
              onClick={() => handleMonthSelect(idx)}
              className={cn(
                "h-12 text-[14px] font-semibold border rounded-lg transition-all shadow-sm active:scale-95",
                isSelected 
                  ? "bg-[#2A6BD5] text-white border-[#2A6BD5] shadow-blue-200" 
                  : "bg-white text-gray-700 border-gray-100 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700"
              )}
            >
              {m}
            </button>
          );
        })}
      </div>
    </div>
  );
}


