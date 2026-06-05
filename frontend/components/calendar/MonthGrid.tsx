"use client";
import { useCalendarContext } from "@/app/market/CalendarContext";
import { EventBadge } from "./EventBadge";
import type { CalendarEvent } from "@/lib/hooks/calendar";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

interface Props {
  events: CalendarEvent[];
  year: number;
  month: number;
}

export function MonthGrid({ events, year, month }: Props) {
  const { selectedDate, setSelectedDate } = useCalendarContext();

  const firstDay = new Date(year, month - 1, 1).getDay();
  const totalDays = new Date(year, month, 0).getDate();
  const today = new Date().toISOString().slice(0, 10);

  const eventsByDate: Record<string, CalendarEvent[]> = {};
  for (const ev of events) {
    const startD = new Date(ev.event_date);
    const endD = ev.event_date_end ? new Date(ev.event_date_end) : startD;
    for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      if (!eventsByDate[key]) eventsByDate[key] = [];
      if (!eventsByDate[key].some(e => e.id === ev.id)) {
        eventsByDate[key].push(ev);
      }
    }
  }

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1, marginBottom: 1 }}>
        {WEEKDAYS.map((w, i) => (
          <div key={w} style={{
            textAlign: "center", fontSize: 11, fontWeight: 600,
            color: i === 0 ? "#DC2626" : i === 6 ? "#2563EB" : "#64748B",
            padding: "4px 0",
          }}>
            {w}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1 }}>
        {cells.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} style={{ minHeight: 80, background: "#F8FAFC" }} />;

          const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayEvents = (eventsByDate[dateStr] || []).sort((a, b) => b.importance - a.importance);
          const isToday = dateStr === today;
          const isSelected = dateStr === selectedDate;
          const isSun = idx % 7 === 0;
          const isSat = idx % 7 === 6;

          return (
            <div
              key={dateStr}
              onClick={() => setSelectedDate(isSelected ? null : dateStr)}
              style={{
                minHeight: 80,
                padding: "4px 4px 6px",
                background: isSelected ? "#EDE9FF" : isSun || isSat ? "#F8FAFC" : "#fff",
                border: isToday ? "2px solid #533AFD" : "1px solid #E2E8F0",
                borderRadius: 4,
                cursor: "pointer",
                overflow: "hidden",
              }}
            >
              <div style={{
                fontSize: 12, fontWeight: isToday ? 700 : 400,
                color: isSun ? "#DC2626" : isSat ? "#2563EB" : "#0D253D",
                marginBottom: 3,
              }}>
                {day}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {dayEvents.slice(0, 3).map(ev => (
                  <EventBadge key={ev.id} event={ev} compact />
                ))}
                {dayEvents.length > 3 && (
                  <div style={{ fontSize: 10, color: "#64748B", paddingLeft: 4 }}>
                    +{dayEvents.length - 3}건
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
