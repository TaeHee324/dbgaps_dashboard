"use client";

import { useState, useMemo } from "react";
import { useBacktestNav, useMonthlyReturns, type NavPoint } from "@/lib/hooks/dashboard";
import { MonthlyBarChart } from "@/components/charts/MonthlyBarChart";

const PANEL_STYLE: React.CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid #E4E9EF",
  borderRadius: 6,
  boxShadow: "0 1px 0 rgba(11,27,44,.04), 0 1px 2px rgba(11,27,44,.04)",
};

const PANEL_HEAD_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "10px 14px",
  borderBottom: "1px solid #E4E9EF",
};

function PanelTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={PANEL_HEAD_STYLE}>
      <div
        style={{
          fontSize: 12.5,
          fontWeight: 700,
          letterSpacing: "-0.005em",
          color: "#0B1B2C",
        }}
      >
        {title}
      </div>
      {sub && (
        <div
          style={{
            fontSize: 11,
            color: "#8595A6",
            fontFamily: "JetBrains Mono, monospace",
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

const DAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "주간"];

function heatColor(r: number, maxAbs: number): string {
  const t = Math.min(1, Math.abs(r) / maxAbs);
  const a = (0.08 + t * 0.55).toFixed(3);
  return r >= 0 ? `rgba(15,122,61,${a})` : `rgba(164,35,43,${a})`;
}

function compoundReturns(returns: number[]): number {
  return returns.reduce((acc, r) => acc * (1 + r), 1) - 1;
}

/** YYYY-MM-DD 문자열 → 요일 인덱스 (0=일, 1=월 ... 6=토) */
function getDayOfWeek(dateStr: string): number {
  return new Date(dateStr + "T00:00:00").getDay();
}

type DayCell = {
  date: string | null;
  daily_return: number | null;
};

type WeekRow = DayCell[]; // Mon~Fri 5칸

function buildCalendar(
  yearMonth: string, // "YYYY-MM"
  navByDate: Map<string, number>,
): { weeks: WeekRow[]; weeklyReturns: (number | null)[] } {
  const [y, m] = yearMonth.split("-").map(Number);
  const firstDay = new Date(y, m - 1, 1);
  const lastDay = new Date(y, m, 0);

  // 첫날 요일 (0=일, 1=월 ... 6=토). 월요일 기준으로 offset 계산
  const firstDow = firstDay.getDay(); // 0~6
  // 월~금 그리드이므로 월요일이 0번째 열
  // 일요일(0) → 첫 주에 0칸 앞당김 (일요일은 그리드 없음; 이 달 1일 이전 주부터 시작)
  // 실제로 일요일 = 6번째(토+1)이므로 월 기준 offset: (dow + 6) % 7
  const startOffset = (firstDow + 6) % 7; // 0=Mon ... 4=Fri, 5=Sat, 6=Sun

  const weeks: WeekRow[] = [];
  const weeklyReturns: (number | null)[] = [];

  let currentWeek: DayCell[] = Array(5).fill(null).map(() => ({ date: null, daily_return: null }));
  let colIdx = startOffset < 5 ? startOffset : 0; // 토·일이면 새 주 시작

  // 토일이 첫날이면 빈 주를 먼저 push하지 않고 다음 주에 1일부터
  if (startOffset >= 5) {
    // 토/일: 새 주의 0번 열에서 시작
    colIdx = 0;
  }

  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dow = getDayOfWeek(dateStr); // 0=일 ... 6=토

    // 토·일은 그리드에서 건너뜀
    if (dow === 0 || dow === 6) continue;

    const colForDay = (dow + 6) % 7; // Mon=0 ... Fri=4

    // 새 주 시작 감지: colForDay < colIdx (뒤로 감) → 현재 주 저장 후 새 주
    if (colForDay < colIdx && colIdx > 0) {
      const weekReturns = currentWeek
        .filter((c) => c.daily_return !== null)
        .map((c) => c.daily_return as number);
      weeklyReturns.push(weekReturns.length > 0 ? compoundReturns(weekReturns) : null);
      weeks.push(currentWeek);
      currentWeek = Array(5).fill(null).map(() => ({ date: null, daily_return: null }));
    }

    colIdx = colForDay;
    const ret = navByDate.has(dateStr) ? navByDate.get(dateStr)! : null;
    currentWeek[colForDay] = { date: dateStr, daily_return: ret };
  }

  // 마지막 주 저장
  if (currentWeek.some((c) => c.date !== null)) {
    const weekReturns = currentWeek
      .filter((c) => c.daily_return !== null)
      .map((c) => c.daily_return as number);
    weeklyReturns.push(weekReturns.length > 0 ? compoundReturns(weekReturns) : null);
    weeks.push(currentWeek);
  }

  return { weeks, weeklyReturns };
}

function CalendarGrid({
  yearMonth,
  navByDate,
  maxAbs,
}: {
  yearMonth: string;
  navByDate: Map<string, number>;
  maxAbs: number;
}) {
  const { weeks, weeklyReturns } = useMemo(
    () => buildCalendar(yearMonth, navByDate),
    [yearMonth, navByDate],
  );

  const cellBase: React.CSSProperties = {
    borderRadius: 3,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 10,
    fontFamily: "JetBrains Mono, monospace",
    fontVariantNumeric: "tabular-nums",
    cursor: "default",
    minWidth: 36,
    height: 26,
  };

  const headerCellStyle: React.CSSProperties = {
    textAlign: "center",
    fontSize: 10,
    fontFamily: "JetBrains Mono, monospace",
    color: "#8595A6",
    letterSpacing: ".04em",
    textTransform: "uppercase",
    padding: "2px 0",
    minWidth: 36,
  };

  return (
    <div style={{ overflowX: "auto" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(6, minmax(36px, 1fr))`,
          gap: 3,
          padding: "6px 4px 4px",
          minWidth: 260,
        }}
      >
        {/* 헤더 */}
        {DAY_HEADERS.map((h) => (
          <div key={h} style={headerCellStyle}>
            {h}
          </div>
        ))}

        {/* 주별 행 */}
        {weeks.map((week, wi) => (
          <React.Fragment key={wi}>
            {week.map((cell, ci) => {
              if (cell.date === null || cell.daily_return === null) {
                return (
                  <div
                    key={ci}
                    style={{ ...cellBase, background: "#F7F9FC", color: "#B6C1CC" }}
                  >
                    ·
                  </div>
                );
              }
              const r = cell.daily_return;
              const bg = maxAbs > 0 ? heatColor(r, maxAbs) : "#F7F9FC";
              const textColor =
                maxAbs > 0 && Math.abs(r) / maxAbs > 0.55 ? "#fff" : "#0B1B2C";
              const dayNum = cell.date.split("-")[2];
              return (
                <div
                  key={ci}
                  title={`${cell.date} · ${(r * 100).toFixed(2)}%`}
                  style={{ ...cellBase, background: bg, color: textColor }}
                >
                  {dayNum}
                </div>
              );
            })}
            {/* 주간 합계 열 */}
            {(() => {
              const wr = weeklyReturns[wi];
              if (wr === null) {
                return (
                  <div style={{ ...cellBase, background: "#F7F9FC", color: "#B6C1CC" }}>
                    ·
                  </div>
                );
              }
              return (
                <div
                  title={`주간: ${(wr * 100).toFixed(2)}%`}
                  style={{
                    ...cellBase,
                    background:
                      wr >= 0 ? "rgba(15,122,61,0.14)" : "rgba(164,35,43,0.14)",
                    color: wr >= 0 ? "#0F7A3D" : "#A4232B",
                    fontWeight: 600,
                  }}
                >
                  {wr >= 0 ? "+" : ""}
                  {(wr * 100).toFixed(1)}
                </div>
              );
            })()}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

export function DailyHeatmap() {
  const navQuery = useBacktestNav();
  const monthlyQuery = useMonthlyReturns();

  const navPoints: NavPoint[] = navQuery.data ?? [];

  // 고유 YYYY-MM 목록 (오름차순)
  const months = useMemo(() => {
    const set = new Set<string>();
    for (const p of navPoints) {
      set.add(p.date.slice(0, 7));
    }
    return [...set].sort();
  }, [navPoints]);

  // 기본 선택: 마지막(최신) 월
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const activeMonth = selectedMonth ?? months[months.length - 1] ?? null;

  // date → daily_return 맵
  const navByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of navPoints) {
      map.set(p.date, p.daily_return);
    }
    return map;
  }, [navPoints]);

  // 선택된 월의 maxAbs 계산
  const maxAbs = useMemo(() => {
    if (!activeMonth) return 0.02;
    const monthReturns = navPoints
      .filter((p) => p.date.startsWith(activeMonth))
      .map((p) => Math.abs(p.daily_return));
    return Math.max(...monthReturns, 0.02);
  }, [navPoints, activeMonth]);

  // MonthlyBarChart 데이터
  const barChartData = useMemo(() => {
    return (monthlyQuery.data ?? []).map((mr) => ({
      time: `${mr.year}-${String(mr.month).padStart(2, "0")}-01`,
      value: mr.monthly_return,
    }));
  }, [monthlyQuery.data]);

  if (navPoints.length === 0) {
    return (
      <div style={PANEL_STYLE}>
        <PanelTitle title="일별 수익률 히트맵" sub="단위 %" />
        <div
          style={{
            fontSize: 12,
            fontFamily: "JetBrains Mono, monospace",
            color: "#8595A6",
            padding: "12px 14px",
          }}
        >
          데이터 없음
        </div>
      </div>
    );
  }

  return (
    <div style={PANEL_STYLE}>
      <PanelTitle title="일별 수익률 히트맵" sub="단위 %" />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "220px 1fr",
          gap: 0,
          padding: "12px 14px",
        }}
      >
        {/* 좌측: MonthlyBarChart */}
        <div style={{ paddingRight: 12, borderRight: "1px solid #E4E9EF" }}>
          <MonthlyBarChart data={barChartData} />
        </div>

        {/* 우측: 월 탭 + 달력 히트맵 */}
        <div style={{ paddingLeft: 12 }}>
          {/* 월 탭 버튼 */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 4,
              marginBottom: 10,
            }}
          >
            {months.map((ym) => {
              const isActive = ym === activeMonth;
              return (
                <button
                  key={ym}
                  onClick={() => setSelectedMonth(ym)}
                  style={{
                    padding: "3px 8px",
                    fontSize: 10.5,
                    fontFamily: "JetBrains Mono, monospace",
                    borderRadius: 3,
                    border: isActive ? "1px solid #3F2EE0" : "1px solid #E4E9EF",
                    background: isActive ? "#3F2EE0" : "#F7F9FC",
                    color: isActive ? "#FFFFFF" : "#46586B",
                    cursor: "pointer",
                    letterSpacing: "0.02em",
                  }}
                >
                  {ym}
                </button>
              );
            })}
          </div>

          {/* 달력 그리드 */}
          {activeMonth && (
            <CalendarGrid
              yearMonth={activeMonth}
              navByDate={navByDate}
              maxAbs={maxAbs}
            />
          )}
        </div>
      </div>
    </div>
  );
}

import React from "react";
