"use client";

import { CalendarProvider, useCalendarContext } from "./CalendarContext";
import { CalendarHeader } from "@/components/calendar/CalendarHeader";
import { MonthGrid } from "@/components/calendar/MonthGrid";
import { WeekView } from "@/components/calendar/WeekView";
import { ListView } from "@/components/calendar/ListView";
import { DayDetailPanel } from "@/components/calendar/DayDetailPanel";
import {
  useCalendarEvents,
  useCalendarWeekEvents,
  useCalendarWeeklySummary,
} from "@/lib/hooks/calendar";

function WeekStrip() {
  const { data: summaries = [] } = useCalendarWeeklySummary();
  if (!summaries.length) return null;

  return (
    <div style={{
      display: "flex", gap: 8, overflowX: "auto", marginBottom: 14,
      padding: "8px 0",
    }}>
      {summaries.map(s => (
        <div key={s.week_start} style={{
          flexShrink: 0,
          background: "#fff",
          border: "1px solid #E2E8F0",
          borderRadius: 6,
          padding: "8px 14px",
          fontSize: 12,
        }}>
          <div style={{ fontWeight: 600, color: "#0D253D", marginBottom: 2 }}>
            {s.week_start.slice(5).replace("-", "/")} 주
            {s.critical_count > 0 && (
              <span style={{ marginLeft: 6, color: "#DC2626", fontSize: 11 }}>
                핵심 {s.critical_count}건
              </span>
            )}
          </div>
          <div style={{ color: "#64748B" }}>전체 {s.total_events}건</div>
          {s.key_events.length > 0 && (
            <div style={{ color: "#533AFD", fontSize: 11, marginTop: 2 }}>
              {s.key_events.slice(0, 2).join(", ")}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function CalendarBody() {
  const { viewMode, currentYear, currentMonth, selectedDate, filters } = useCalendarContext();

  const { data: monthEvents = [], isLoading: loadingMonth } = useCalendarEvents(
    currentYear, currentMonth, filters
  );
  const { data: weekEvents = [], isLoading: loadingWeek } = useCalendarWeekEvents();

  const selectedDayEvents = selectedDate
    ? (viewMode === "week" ? weekEvents : monthEvents).filter(
        ev => ev.event_date === selectedDate ||
              (ev.event_date_end && ev.event_date <= selectedDate && ev.event_date_end >= selectedDate)
      )
    : [];

  const isLoading = viewMode === "week" ? loadingWeek : loadingMonth;
  const events = viewMode === "week" ? weekEvents : monthEvents;

  return (
    <div>
      {isLoading && (
        <div style={{ color: "#64748B", fontSize: 13, padding: "20px 0" }}>로딩 중...</div>
      )}

      {!isLoading && (
        <>
          {viewMode === "month" && (
            <MonthGrid events={events} year={currentYear} month={currentMonth} />
          )}
          {viewMode === "week" && <WeekView events={events} />}
          {viewMode === "list" && <ListView events={events} />}

          {selectedDate && selectedDayEvents.length > 0 && (
            <DayDetailPanel date={selectedDate} events={selectedDayEvents} />
          )}
        </>
      )}
    </div>
  );
}

export default function MarketPage() {
  return (
    <CalendarProvider>
      <div style={{ maxWidth: 1100 }}>
        <CalendarHeader />
        <WeekStrip />
        <CalendarBody />
      </div>
    </CalendarProvider>
  );
}
