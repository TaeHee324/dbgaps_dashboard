"use client";

import { useLiveHoldings } from "@/lib/hooks/dashboard";
import { useBacktest } from "@/lib/hooks/portfolio";
import type { BacktestResponse } from "@/lib/hooks/portfolio";

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

function formatPct(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return (v * 100).toFixed(2) + "%";
}

function formatNum(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return v.toFixed(2);
}

type KpiCardProps = {
  label: string;
  value: string;
  valueColor: string;
};

function KpiCard({ label, value, valueColor }: KpiCardProps) {
  return (
    <div
      style={{
        background: "#F7F9FC",
        border: "1px solid #E4E9EF",
        borderRadius: 4,
        padding: "6px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontFamily: "JetBrains Mono, monospace",
          textTransform: "uppercase",
          color: "#8595A6",
          letterSpacing: "0.07em",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 15,
          fontWeight: 700,
          fontFamily: "JetBrains Mono, monospace",
          fontVariantNumeric: "tabular-nums",
          color: valueColor,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function runButtonStyle(variant: "primary" | "secondary"): React.CSSProperties {
  if (variant === "primary") {
    return {
      background: "#3F2EE0",
      color: "#FFFFFF",
      border: "none",
      borderRadius: 4,
      padding: "5px 14px",
      fontSize: 12,
      cursor: "pointer",
      fontFamily: "JetBrains Mono, monospace",
    };
  }
  return {
    background: "#F7F9FC",
    color: "#3F2EE0",
    border: "1px solid #E4E9EF",
    borderRadius: 4,
    padding: "5px 14px",
    fontSize: 12,
    cursor: "pointer",
    fontFamily: "JetBrains Mono, monospace",
  };
}

function buildKpiCards(summary: NonNullable<BacktestResponse["summary"]>) {
  const cumRet = summary.cumulative_return;
  const cagr = summary.cagr;

  const pctColor = (v: number | null | undefined) => {
    if (v === null || v === undefined || !Number.isFinite(v as number)) return "#0B1B2C";
    return (v as number) >= 0 ? "#0F7A3D" : "#A4232B";
  };

  return [
    {
      label: "누적수익",
      value: formatPct(cumRet),
      valueColor: pctColor(cumRet),
    },
    {
      label: "CAGR",
      value: formatPct(cagr),
      valueColor: pctColor(cagr),
    },
    {
      label: "MDD",
      value: formatPct(summary.mdd),
      valueColor: "#A4232B",
    },
    {
      label: "샤프",
      value: formatNum(summary.sharpe),
      valueColor: "#0B1B2C",
    },
    {
      label: "칼마",
      value: formatNum(summary.calmar),
      valueColor: "#0B1B2C",
    },
    {
      label: "베타",
      value: formatNum(summary.beta),
      valueColor: "#0B1B2C",
    },
  ];
}

export function LivePortfolioSpec() {
  const holdingsQuery = useLiveHoldings();
  const backtestMutation = useBacktest();

  const holdings = holdingsQuery.data ?? [];
  const hasHoldings = holdings.length > 0;

  function runBacktest() {
    backtestMutation.mutate({
      holdings: holdings.map((h) => ({
        code: h.code,
        weight: h.current_weight,
      })),
    });
  }

  const result = backtestMutation.data ?? null;
  const isLoading = backtestMutation.isPending;
  const isError = backtestMutation.isError;

  return (
    <div style={PANEL_STYLE}>
      <PanelTitle title="현재 포트폴리오 스펙" />
      <div style={{ padding: "12px 14px" }}>
        {/* 상태 1: 보유 종목 없음 */}
        {!hasHoldings && (
          <div
            style={{
              fontSize: 12,
              fontFamily: "JetBrains Mono, monospace",
              color: "#8595A6",
            }}
          >
            보유 종목 없음 — 종목 추가 후 백테스트를 실행하세요
          </div>
        )}

        {/* 상태 2: 종목 있음, 결과 없음 (로딩도 아님, 에러도 아님) */}
        {hasHoldings && !isLoading && !isError && !result && (
          <button style={runButtonStyle("primary")} onClick={runBacktest}>
            백테스트 실행
          </button>
        )}

        {/* 상태 3: 로딩 중 */}
        {hasHoldings && isLoading && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                fontSize: 12,
                fontFamily: "JetBrains Mono, monospace",
                color: "#8595A6",
              }}
            >
              계산 중...
            </span>
            <button
              disabled
              style={{ ...runButtonStyle("primary"), opacity: 0.5, cursor: "not-allowed" }}
            >
              백테스트 실행
            </button>
          </div>
        )}

        {/* 오류 상태 */}
        {hasHoldings && isError && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                fontSize: 12,
                fontFamily: "JetBrains Mono, monospace",
                color: "#A4232B",
              }}
            >
              백테스트 오류 —
            </span>
            <button style={runButtonStyle("secondary")} onClick={runBacktest}>
              재실행
            </button>
          </div>
        )}

        {/* 상태 4: 결과 있음 */}
        {hasHoldings && !isLoading && !isError && result && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* 재실행 버튼 (우측 정렬) */}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button style={runButtonStyle("secondary")} onClick={runBacktest}>
                재실행
              </button>
            </div>

            {/* KPI 카드 6개 */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(6, 1fr)",
                gap: 8,
              }}
            >
              {buildKpiCards(result.summary).map((kpi) => (
                <KpiCard
                  key={kpi.label}
                  label={kpi.label}
                  value={kpi.value}
                  valueColor={kpi.valueColor}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import React from "react";
