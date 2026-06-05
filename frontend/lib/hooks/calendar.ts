"use client";

import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api";

export type CalendarEvent = {
  id: number;
  event_date: string;
  event_date_end: string | null;
  kst_time: string | null;
  title: string;
  event_type: string;
  category: string;
  country: string | null;
  importance: number;
  period: string | null;
  release_type: string | null;
  measurement: string | null;
  unit: string | null;
  previous: string | null;
  consensus: string | null;
  forecast: string | null;
  actual: string | null;
  surprise_dir: number | null;
  status: string;
  affected_assets: string[];
  portfolio_note: string | null;
  description: string | null;
  metadata: Record<string, unknown> | null;
};

export type CalendarWeeklySummary = {
  week_start: string;
  week_end: string;
  total_events: number;
  critical_count: number;
  major_count: number;
  key_events: string[];
};

export type CalendarFilters = {
  category?: string;
  country?: string;
  importance_min?: number;
};

function buildQuery(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") sp.set(k, String(v));
  }
  return sp.toString() ? `?${sp.toString()}` : "";
}

export function useCalendarEvents(
  year: number,
  month: number,
  filters: CalendarFilters = {}
) {
  const { category, country, importance_min = 1 } = filters;
  return useQuery({
    queryKey: ["calendar-events", year, month, category, country, importance_min],
    queryFn: () =>
      get<CalendarEvent[]>(
        `/api/calendar/events${buildQuery({ year, month, category, country, importance_min })}`
      ),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCalendarWeekEvents() {
  return useQuery({
    queryKey: ["calendar-week"],
    queryFn: () => get<CalendarEvent[]>("/api/calendar/events/week"),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCalendarEvent(eventId: number | null) {
  return useQuery({
    queryKey: ["calendar-event", eventId],
    queryFn: () => get<CalendarEvent>(`/api/calendar/events/${eventId}`),
    enabled: eventId !== null,
    staleTime: 10 * 60 * 1000,
  });
}

export function useCalendarWeeklySummary() {
  return useQuery({
    queryKey: ["calendar-weekly-summary"],
    queryFn: () => get<CalendarWeeklySummary[]>("/api/calendar/weekly-summary"),
    staleTime: 60 * 60 * 1000,
  });
}
