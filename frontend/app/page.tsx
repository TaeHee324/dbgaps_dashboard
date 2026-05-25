"use client";

import { useMemo } from "react";
import { DrawdownChart } from "@/components/charts/DrawdownChart";
import { NavChart } from "@/components/charts/NavChart";
import { KpiStrip } from "@/components/ui/KpiStrip";
import { MonthlyHeatmap } from "@/components/ui/MonthlyHeatmap";
import { StatusBar } from "@/components/ui/StatusBar";
import {
  useBacktestNav,
  useDataDate,
  usePortfolioDetail,
  usePortfolioSummary,
  useTradeLog,
  type NavPoint,
  type PortfolioHolding,
  type TradeLogEntry,
} from "@/lib/hooks/dashboard";

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

function Loading() {
  return (
    <div
      style={{
        padding: "12px 14px",
        fontSize: 12,
        color: "#8595A6",
        fontFamily: "JetBrains Mono, monospace",
      }}
    >
      로딩 중...
    </div>
  );
}

function Empty({ message = "데이터 없음" }: { message?: string }) {
  return (
    <div
      style={{
        padding: "12px 14px",
        fontSize: 12,
        color: "#8595A6",
        fontFamily: "JetBrains Mono, monospace",
      }}
    >
      {message}
    </div>
  );
}

function toNavSeries(points: NavPoint[] | undefined) {
  return (points ?? []).map((p) => ({
    time: p.date,
    value: (1 + p.cumulative_return) * 100,
  }));
}

function toDrawdownSeries(points: NavPoint[] | undefined) {
  return (points ?? []).map((p) => ({
    time: p.date,
    value: p.drawdown * 100,
  }));
}

function toTradeMarkers(entries: TradeLogEntry[] | undefined) {
  return (entries ?? []).map(({ date, action, etf_name }) => ({
    date,
    action,
    etf_name,
  }));
}

function formatWeight(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

function StrategyTable({ holdings }: { holdings: PortfolioHolding[] }) {
  if (holdings.length === 0) return <Empty />;

  const maxW = Math.max(...holdings.map((h) => h.weight));

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
      <thead>
        <tr>
          <th
            style={{
              padding: "8px 12px",
              textAlign: "left",
              fontSize: 10.5,
              fontWeight: 600,
              fontFamily: "JetBrains Mono, monospace",
              color: "#8595A6",
              textTransform: "uppercase",
              letterSpacing: "0.09em",
              background: "#F7F9FC",
              borderBottom: "1px solid #E4E9EF",
            }}
          >
            코드
          </th>
          <th
            style={{
              padding: "8px 12px",
              textAlign: "right",
              fontSize: 10.5,
              fontWeight: 600,
              fontFamily: "JetBrains Mono, monospace",
              color: "#8595A6",
              textTransform: "uppercase",
              letterSpacing: "0.09em",
              background: "#F7F9FC",
              borderBottom: "1px solid #E4E9EF",
              minWidth: 120,
            }}
          >
            비중
          </th>
        </tr>
      </thead>
      <tbody>
        {holdings.map((h) => {
          const barPct = (h.weight / maxW) * 100;
          return (
            <tr key={h.code} style={{ borderBottom: "1px solid #EFF2F6" }}>
              <td style={{ padding: "8px 12px" }}>
                <span
                  style={{
                    fontFamily: "JetBrains Mono, monospace",
                    fontWeight: 600,
                    color: "#3F2EE0",
                    fontSize: 12,
                    letterSpacing: "0.02em",
                  }}
                >
                  {h.code}
                </span>
              </td>
              <td style={{ padding: "8px 12px", position: "relative", minWidth: 120 }}>
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: "56%",
                    height: 6,
                    background: "#EEEBFE",
                    borderRadius: 2,
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${barPct}%`,
                      background: "#3F2EE0",
                      borderRadius: 2,
                      opacity: 0.85,
                    }}
                  />
                </div>
                <span
                  style={{
                    position: "relative",
                    display: "block",
                    textAlign: "right",
                    fontFamily: "JetBrains Mono, monospace",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {formatWeight(h.weight)}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default function HomePage() {
  const dataDateQuery = useDataDate();
  const summaryQuery = usePortfolioSummary();
  const navQuery = useBacktestNav();
  const tradeLogQuery = useTradeLog();
  const portfolioQuery = usePortfolioDetail("base");

  const navData = useMemo(() => toNavSeries(navQuery.data), [navQuery.data]);
  const drawdownData = useMemo(() => toDrawdownSeries(navQuery.data), [navQuery.data]);
  const tradeMarkers = useMemo(
    () => toTradeMarkers(tradeLogQuery.data),
    [tradeLogQuery.data],
  );

  return (
    <div style={{ maxWidth: 1320, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

      {/* 헤더 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <h1
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: "-0.01em",
            color: "#0B1B2C",
          }}
        >
          전략 대시보드
        </h1>
        <StatusBar date={dataDateQuery.data?.date ?? ""} />
      </div>

      {/* KPI 스트립 */}
      {summaryQuery.isLoading ? (
        <div style={{ ...PANEL_STYLE, padding: "12px 14px", fontSize: 12, color: "#8595A6", fontFamily: "JetBrains Mono, monospace" }}>
          로딩 중...
        </div>
      ) : (
        <KpiStrip summary={summaryQuery.data ?? null} />
      )}

      {/* NAV + Drawdown */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={PANEL_STYLE}>
          <PanelTitle title="NAV" sub="기준 100 · 로그 미적용" />
          <div style={{ padding: "12px 14px" }}>
            {navQuery.isLoading ? (
              <Loading />
            ) : navQuery.isError ? (
              <Empty />
            ) : (
              <NavChart data={navData} tradeMarkers={tradeMarkers} />
            )}
          </div>
        </div>

        <div style={PANEL_STYLE}>
          <PanelTitle title="Drawdown" sub="%" />
          <div style={{ padding: "12px 14px" }}>
            {navQuery.isLoading ? (
              <Loading />
            ) : navQuery.isError ? (
              <Empty />
            ) : (
              <DrawdownChart data={drawdownData} />
            )}
          </div>
        </div>
      </div>

      {/* 운용 전략 (full-width) */}
      <div style={PANEL_STYLE}>
        <PanelTitle title="운용 전략" sub="전략 ID base" />
        {portfolioQuery.isLoading ? (
          <Loading />
        ) : portfolioQuery.isError ? (
          <Empty />
        ) : (
          <StrategyTable holdings={portfolioQuery.data ?? []} />
        )}
      </div>

      {/* 월별 히트맵 (full-width) */}
      <div style={PANEL_STYLE}>
        <PanelTitle title="월별 수익률 히트맵" sub="단위 %" />
        <MonthlyHeatmap />
      </div>

    </div>
  );
}
