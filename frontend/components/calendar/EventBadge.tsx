"use client";
import type { CalendarEvent } from "@/lib/hooks/calendar";

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
  event: CalendarEvent;
  onClick?: () => void;
  compact?: boolean;
}

export function EventBadge({ event, onClick, compact = true }: Props) {
  const style = IMPORTANCE_STYLE[event.importance as 1 | 2 | 3] ?? IMPORTANCE_STYLE[1];
  const prefix = EVENT_PREFIX[event.event_type] ?? "기타";
  const label = compact
    ? `[${prefix}] ${event.title.slice(0, 18)}${event.title.length > 18 ? "…" : ""}`
    : `[${prefix}] ${event.title}`;

  return (
    <button
      onClick={onClick}
      style={{
        ...style,
        display: "block",
        width: "100%",
        textAlign: "left",
        padding: "1px 4px",
        borderRadius: 3,
        fontSize: 11,
        fontWeight: 500,
        lineHeight: 1.4,
        cursor: onClick ? "pointer" : "default",
        border: "none",
        fontFamily: "inherit",
      }}
    >
      {label}
    </button>
  );
}
