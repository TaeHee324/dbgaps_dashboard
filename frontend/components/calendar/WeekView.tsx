"use client";
import type { CalendarEvent } from "@/lib/hooks/calendar";
import { EventBadge } from "./EventBadge";
import { useCalendarContext } from "@/app/market/CalendarContext";

const WEEKDAY_KO = ["월", "화", "수", "목", "금"];

interface Props {
  events: CalendarEvent[];
}

export function WeekView({ events }: Props) {
  const { setSelectedDate, selectedDate } = useCalendarContext();

  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - today.getDay() + 1);

  const weekDates = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().slice(0, 10);
  });

  const byDate: Record<string, CalendarEvent[]> = {};
  for (const d of weekDates) byDate[d] = [];
  for (const ev of events) {
    if (byDate[ev.event_date]) byDate[ev.event_date].push(ev);
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
      {weekDates.map((date, i) => {
        const dayEvents = (byDate[date] || []).sort((a, b) => b.importance - a.importance);
        const [, , d] = date.split("-");
        const isSelected = date === selectedDate;

        return (
          <div
            key={date}
            onClick={() => setSelectedDate(isSelected ? null : date)}
            style={{
              background: isSelected ? "#EDE9FF" : "#fff",
              border: "1px solid #E2E8F0",
              borderRadius: 6,
              padding: "10px 10px 12px",
              minHeight: 120,
              cursor: "pointer",
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 12, color: "#64748B", marginBottom: 6 }}>
              {WEEKDAY_KO[i]} {parseInt(d)}일
              {dayEvents.length > 0 && (
                <span style={{ marginLeft: 4, fontSize: 10, color: "#533AFD" }}>({dayEvents.length})</span>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {dayEvents.map(ev => (
                <EventBadge key={ev.id} event={ev} compact={false} />
              ))}
              {dayEvents.length === 0 && (
                <div style={{ fontSize: 11, color: "#CBD5E1" }}>일정 없음</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
