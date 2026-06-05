"use client";
import type React from "react";
import { useCalendarContext } from "@/app/market/CalendarContext";

type ViewMode = "month" | "week" | "list";

const CATEGORIES = [
  { value: "", label: "전체" },
  { value: "macro_us", label: "미국 거시" },
  { value: "macro_kr", label: "한국 거시" },
  { value: "earnings", label: "기업 실적" },
  { value: "market", label: "시장 이벤트" },
];

const IMPORTANCE_OPTIONS = [
  { value: 1, label: "전체" },
  { value: 2, label: "주의 이상" },
  { value: 3, label: "핵심만" },
];

const btnStyle: React.CSSProperties = {
  padding: "3px 10px",
  borderRadius: 4,
  fontSize: 12,
  background: "#F6F9FC",
  color: "#0D253D",
  border: "1px solid #E2E8F0",
  cursor: "pointer",
};

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "2px 10px",
        borderRadius: 9999,
        fontSize: 11,
        fontWeight: active ? 600 : 400,
        background: active ? "#EDE9FF" : "#F1F5F9",
        color: active ? "#533AFD" : "#64748B",
        border: active ? "1px solid #533AFD" : "1px solid #E2E8F0",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

export function CalendarHeader() {
  const { viewMode, setViewMode, currentYear, currentMonth, navigateMonth, filters, setFilters } =
    useCalendarContext();

  const VIEWS: { key: ViewMode; label: string }[] = [
    { key: "month", label: "월간" },
    { key: "week", label: "주간" },
    { key: "list", label: "목록" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: "#0D253D", margin: 0 }}>
          시황·경제 캘린더
        </h1>

        {viewMode === "month" && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={() => navigateMonth(-1)} style={btnStyle}>◀</button>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#0D253D", minWidth: 80, textAlign: "center" }}>
              {currentYear}년 {currentMonth}월
            </span>
            <button onClick={() => navigateMonth(1)} style={btnStyle}>▶</button>
            <button onClick={() => navigateMonth(0)} style={{ ...btnStyle, fontSize: 11 }}>오늘</button>
          </div>
        )}

        <div style={{ display: "flex", gap: 2, marginLeft: "auto" }}>
          {VIEWS.map(v => (
            <button
              key={v.key}
              onClick={() => setViewMode(v.key)}
              style={{
                ...btnStyle,
                background: viewMode === v.key ? "#533AFD" : "#F6F9FC",
                color: viewMode === v.key ? "#fff" : "#0D253D",
                fontWeight: viewMode === v.key ? 600 : 400,
              }}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>카테고리:</span>
        {CATEGORIES.map(c => (
          <FilterChip
            key={c.value}
            label={c.label}
            active={filters.category === c.value || (c.value === "" && !filters.category)}
            onClick={() => setFilters({ ...filters, category: c.value || undefined })}
          />
        ))}
        <span style={{ fontSize: 11, color: "#64748B", fontWeight: 600, marginLeft: 8 }}>중요도:</span>
        {IMPORTANCE_OPTIONS.map(o => (
          <FilterChip
            key={o.value}
            label={o.label}
            active={(filters.importance_min ?? 1) === o.value}
            onClick={() => setFilters({ ...filters, importance_min: o.value })}
          />
        ))}
      </div>
    </div>
  );
}
