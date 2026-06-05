"use client";
import type { CalendarEvent } from "@/lib/hooks/calendar";
import { useCalendarContext } from "@/app/market/CalendarContext";

const IMPORTANCE_STYLE = {
  3: { background: "#FEE2E2", color: "#DC2626" },
  2: { background: "#FEF3C7", color: "#D97706" },
  1: { background: "#F1F5F9", color: "#64748B" },
} as const;

const EVENT_PREFIX: Record<string, string> = {
  economic_release: "지표", central_bank: "CB", earnings: "실적",
  index_change: "지수", options_expiry: "만기", market_holiday: "휴장",
  tech_conference: "컨퍼", medical_conf: "의학", summit: "정상",
};

interface Props {
  events: CalendarEvent[];
}

export function ListView({ events }: Props) {
  const { setSelectedDate, selectedDate } = useCalendarContext();

  const groups: Record<string, CalendarEvent[]> = {};
  for (const ev of events) {
    if (!groups[ev.event_date]) groups[ev.event_date] = [];
    groups[ev.event_date].push(ev);
  }
  const sortedDates = Object.keys(groups).sort();

  if (sortedDates.length === 0) {
    return <div style={{ color: "#64748B", fontSize: 13, padding: 20 }}>해당 기간에 이벤트가 없습니다.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {sortedDates.map(date => {
        const dayEvents = groups[date].sort((a, b) => b.importance - a.importance);
        const [, m, d] = date.split("-");
        const isSelected = date === selectedDate;

        return (
          <div key={date}>
            <div
              onClick={() => setSelectedDate(isSelected ? null : date)}
              style={{
                padding: "6px 12px",
                background: isSelected ? "#EDE9FF" : "#F6F9FC",
                borderTop: "1px solid #E2E8F0",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
                color: "#0D253D",
              }}
            >
              {m}월 {parseInt(d)}일 ({dayEvents.length}건)
            </div>
            {dayEvents.map(ev => {
              const impStyle = IMPORTANCE_STYLE[ev.importance as 1|2|3] ?? IMPORTANCE_STYLE[1];
              const prefix = EVENT_PREFIX[ev.event_type] ?? "기타";
              const impLabel = ev.importance === 3 ? "핵심" : ev.importance === 2 ? "주의" : "참고";
              return (
                <div
                  key={ev.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "60px 40px 36px 1fr 80px 80px 80px",
                    gap: "0 12px",
                    padding: "6px 12px",
                    borderBottom: "1px solid #F1F5F9",
                    fontSize: 12,
                    alignItems: "center",
                    background: "#fff",
                  }}
                >
                  <span style={{ color: "#64748B", fontVariantNumeric: "tabular-nums" }}>
                    {ev.kst_time ?? "미정"}
                  </span>
                  <span style={{
                    ...impStyle,
                    borderRadius: 3,
                    padding: "1px 4px",
                    fontSize: 10,
                    fontWeight: 600,
                    textAlign: "center",
                  }}>
                    {impLabel}
                  </span>
                  <span style={{ color: "#64748B", fontSize: 11 }}>{ev.country ?? "—"}</span>
                  <span style={{ color: "#0D253D", fontWeight: 500 }}>
                    <span style={{ color: "#64748B", marginRight: 4, fontSize: 10 }}>[{prefix}]</span>
                    {ev.title}
                    {ev.period && <span style={{ color: "#94A3B8", marginLeft: 6, fontSize: 10 }}>{ev.period}</span>}
                  </span>
                  <span style={{ color: "#64748B", fontVariantNumeric: "tabular-nums", textAlign: "right" }}>
                    {ev.previous ?? "—"}
                  </span>
                  <span style={{ color: "#64748B", fontVariantNumeric: "tabular-nums", textAlign: "right" }}>
                    {ev.forecast ?? ev.consensus ?? "—"}
                  </span>
                  <span style={{
                    color: ev.actual
                      ? (ev.surprise_dir === 1 ? "#16A34A" : ev.surprise_dir === -1 ? "#DC2626" : "#0D253D")
                      : "#CBD5E1",
                    fontVariantNumeric: "tabular-nums",
                    textAlign: "right",
                    fontWeight: ev.actual ? 600 : 400,
                  }}>
                    {ev.actual ?? "—"}
                  </span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
