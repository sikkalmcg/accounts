"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = false,
  formatters,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-4 bg-white w-[300px] select-none", className)}
      formatters={{
        formatWeekdayName: (day) =>
          day.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(),
        formatCaption: (month) => {
          const year = month.getFullYear()
          const monthName = month.toLocaleDateString("en-US", { month: "long" }).toUpperCase()
          return (
            <div className="flex flex-col items-center justify-center">
              <span className="text-[11px] font-medium tracking-widest text-gray-500">{year}</span>
              <span className="text-2xl font-black tracking-wider text-black">{monthName}</span>
            </div>
          )
        },
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
        Chevron: ({ orientation }) => {
          if (orientation === "left") {
            return <ChevronLeft className="h-4 w-4" />
          }
          return <ChevronRight className="h-4 w-4" />
        },
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }