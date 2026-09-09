"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker, useDayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = false,
  formatters,
  components,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-4 bg-white w-[300px] select-none", className)}
      formatters={{
        formatWeekdayName: (day) =>
          day.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(),
        ...formatters,
      }}
      classNames={{
        months: "flex flex-col space-y-3",
        month: "space-y-3",
        month_caption: "relative flex items-center justify-center pt-1 pb-2",
        caption_label: "w-full text-center",
        nav: "absolute inset-x-0 flex items-center justify-between z-10 px-1 top-2",
        button_previous: cn(
          buttonVariants({ variant: "ghost" }),
          "h-7 w-7 bg-transparent p-0 opacity-60 hover:opacity-100"
        ),
        button_next: cn(
          buttonVariants({ variant: "ghost" }),
          "h-7 w-7 bg-transparent p-0 opacity-60 hover:opacity-100"
        ),
        month_grid: "w-full border-collapse",
        weekdays: "grid grid-cols-7 mb-2 text-center",
        weekday:
          "text-black font-bold text-[10px] tracking-tight uppercase flex items-center justify-center h-8",
        weeks: "flex flex-col space-y-1",
        week: "grid grid-cols-7 place-items-center w-full",
        day: "h-9 w-9 p-0 relative flex items-center justify-center",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-bold text-base text-black hover:bg-gray-100 rounded-md flex items-center justify-center"
        ),
        selected: "[&>button]:bg-black [&>button]:text-white [&>button]:hover:bg-black [&>button]:hover:text-white rounded-md",
        today: "[&>button]:bg-gray-100 [&>button]:text-black [&>button]:font-extrabold",
        outside:
          "text-gray-300 opacity-40",
        disabled: "text-gray-300 opacity-30",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        MonthCaption: ({ calendarMonth, displayIndex, ...monthCaptionProps }) => {
          const { goToMonth } = useDayPicker()
          const month = calendarMonth.date
          const currentYear = month.getFullYear()
          const currentMonth = month.getMonth()

          const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
            const newMonth = parseInt(e.target.value, 10)
            goToMonth(new Date(currentYear, newMonth, 1))
          }

          const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
            const newYear = parseInt(e.target.value, 10)
            goToMonth(new Date(newYear, currentMonth, 1))
          }

          const MONTH_NAMES = [
            "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
            "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"
          ]

          const baseYears = Array.from({ length: 30 }, (_, i) => 2015 + i)
          const years = Array.from(new Set([...baseYears, currentYear])).sort((a, b) => a - b)

          return (
            <div {...monthCaptionProps} className={cn("relative flex items-center justify-center gap-1.5 pt-1 pb-2 px-8", monthCaptionProps.className)}>
              <select
                value={currentMonth}
                onChange={handleMonthChange}
                className="h-7 text-xs font-bold text-gray-800 bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded px-1.5 cursor-pointer focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                {MONTH_NAMES.map((name, idx) => (
                  <option key={idx} value={idx}>
                    {name}
                  </option>
                ))}
              </select>
              <select
                value={currentYear}
                onChange={handleYearChange}
                className="h-7 text-xs font-bold text-gray-800 bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded px-1.5 cursor-pointer focus:ring-1 focus:ring-blue-500 focus:outline-none font-mono"
              >
                {years.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>
          )
        },
        Chevron: ({ orientation }) => {
          if (orientation === "left") {
            return <ChevronLeft className="h-4 w-4" />
          }
          return <ChevronRight className="h-4 w-4" />
        },
        ...components,
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }