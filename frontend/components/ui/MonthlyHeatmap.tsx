"use client";

import { useMonthlyReturns } from "@/lib/hooks/dashboard";

const MONTH_LABELS = ["1","2","3","4","5","6","7","8","9","10","11","12"];

function heatColor(r: number, maxAbs: number): string {
  const t = Math.min(1, Math.abs(r) / maxAbs);
  const a = (0.08 + t * 0.55).toFixed(3);
  return r >= 0 ? `rgba(15,122,61,${a})` : `rgba(164,35,43,${a})`;
}

const cellBase: React.CSSProperties = {
  aspectRatio: "1.2 / 1",
  borderRadius: 3,
  display: "grid",
  placeItems: "center",
  fontSize: 10,
  fontFamily: "JetBrains Mono, monospace",
  fontVariantNumeric: "tabular-nums",
  cursor: "default",
};

export function MonthlyHeatmap() {
  const { data, isLoading, isError } = useMonthlyReturns();

  if (isLoading) {
    return <div className="px-md py-sm text-sm text-inkSecondary">로딩 중...</div>;
  }
  if (isError || !data || data.length === 0) {
    return <div className="px-md py-sm text-sm text-inkSecondary">데이터 없음</div>;
  }

  const years = [...new Set(data.map((d) => d.year))].sort();
  const grid: Record<string, number> = {};
  for (const d of data) {
    grid[`${d.year}-${d.month - 1}`] = d.monthly_return;
  }

  const maxAbs = Math.max(...data.map((d) => Math.abs(d.monthly_return)), 0.02);

  const yearlyTotals: Record<number, number> = {};
  for (const y of years) {
    yearlyTotals[y] = data
      .filter((d) => d.year === y)
      .reduce((acc, d) => acc * (1 + d.monthly_return), 1) - 1;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "38px repeat(12, 1fr) 50px",
          gap: 2,
          padding: "8px 4px 4px",
          minWidth: 520,
        }}
      >
        {/* header */}
        <div />
        {MONTH_LABELS.map((m) => (
          <div
            key={m}
            style={{
              textAlign: "center",
              fontSize: 10,
              fontFamily: "JetBrains Mono, monospace",
              color: "#8595A6",
              letterSpacing: ".04em",
              textTransform: "uppercase",
              padding: "2px 0",
            }}
          >
            {m}월
          </div>
        ))}
        <div
          style={{
            textAlign: "center",
            fontSize: 10,
            fontFamily: "JetBrains Mono, monospace",
            color: "#46586B",
          }}
        >
          연
        </div>

        {/* rows */}
        {years.map((y) => (
          <React.Fragment key={y}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                paddingRight: 8,
                fontSize: 10,
                fontFamily: "JetBrains Mono, monospace",
                color: "#46586B",
              }}
            >
              {y}
            </div>
            {MONTH_LABELS.map((_, mo) => {
              const r = grid[`${y}-${mo}`];
              if (r === undefined) {
                return (
                  <div key={mo} style={{ ...cellBase, background: "#F7F9FC", color: "#B6C1CC" }}>
                    ·
                  </div>
                );
              }
              const bg = heatColor(r, maxAbs);
              const color = Math.abs(r) / maxAbs > 0.55 ? "#fff" : "#0B1B2C";
              return (
                <div
                  key={mo}
                  title={`${y}-${String(mo + 1).padStart(2, "0")} · ${(r * 100).toFixed(2)}%`}
                  style={{ ...cellBase, background: bg, color }}
                >
                  {(r * 100).toFixed(1)}
                </div>
              );
            })}
            {/* yearly total */}
            {(() => {
              const tot = yearlyTotals[y];
              return (
                <div
                  key={`yt-${y}`}
                  title={`${y} 연간: ${(tot * 100).toFixed(2)}%`}
                  style={{
                    ...cellBase,
                    background: tot >= 0 ? "rgba(15,122,61,0.14)" : "rgba(164,35,43,0.14)",
                    color: tot >= 0 ? "#0F7A3D" : "#A4232B",
                    fontWeight: 600,
                  }}
                >
                  {(tot * 100).toFixed(1)}
                </div>
              );
            })()}
          </React.Fragment>
        ))}
      </div>

      {/* legend */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontFamily: "JetBrains Mono, monospace",
          fontSize: 10.5,
          color: "#8595A6",
          padding: "0 8px 8px",
        }}
      >
        <span>월간 수익률(%)</span>
        <span>−</span>
        <div style={{ display: "flex", borderRadius: 3, overflow: "hidden" }}>
          {[
            "rgba(164,35,43,0.55)",
            "rgba(164,35,43,0.30)",
            "rgba(164,35,43,0.12)",
            "#F7F9FC",
            "rgba(15,122,61,0.12)",
            "rgba(15,122,61,0.30)",
            "rgba(15,122,61,0.55)",
          ].map((c, i) => (
            <span key={i} style={{ width: 14, height: 10, background: c, display: "block" }} />
          ))}
        </div>
        <span>+</span>
      </div>
    </div>
  );
}

// React needs to be in scope for JSX in some configs
import React from "react";
