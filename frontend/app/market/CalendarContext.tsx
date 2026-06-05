"use client";

import { createContext, useContext, useState } from "react";
import type { CalendarFilters } from "@/lib/hooks/calendar";

type ViewMode = "month" | "week" | "list";

interface CalendarContextValue {
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
  currentYear: number;
  currentMonth: number;
  navigateMonth: (delta: number) => void;
  selectedDate: string | null;
  setSelectedDate: (d: string | null) => void;
  filters: CalendarFilters;
  setFilters: (f: CalendarFilters) => void;
}

const CalendarContext = createContext<CalendarContextValue | null>(null);

export function CalendarProvider({ children }: { children: React.ReactNode }) {
  const today = new Date();

  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [filters, setFilters] = useState<CalendarFilters>({ importance_min: 2 });

  function navigateMonth(delta: number) {
    if (delta === 0) {
      setCurrentYear(today.getFullYear());
      setCurrentMonth(today.getMonth() + 1);
      return;
    }
    setCurrentMonth(prev => {
      const next = prev + delta;
      if (next > 12) { setCurrentYear(y => y + 1); return 1; }
      if (next < 1)  { setCurrentYear(y => y - 1); return 12; }
      return next;
    });
    setSelectedDate(null);
  }

  return (
    <CalendarContext.Provider value={{
      viewMode, setViewMode,
      currentYear, currentMonth, navigateMonth,
      selectedDate, setSelectedDate,
      filters, setFilters,
    }}>
      {children}
    </CalendarContext.Provider>
  );
}

export function useCalendarContext() {
  const ctx = useContext(CalendarContext);
  if (!ctx) throw new Error("useCalendarContext must be used inside CalendarProvider");
  return ctx;
}
