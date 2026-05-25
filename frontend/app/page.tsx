"use client";

import { useMemo } from "react";
import { DrawdownChart } from "@/components/charts/DrawdownChart";
import { NavChart } from "@/components/charts/NavChart";
import { DailyHeatmap } from "@/components/ui/DailyHeatmap";
import { HoldingsCompositionPanel } from "@/components/ui/HoldingsCompositionPanel";
import { HoldingsTable } from "@/components/ui/HoldingsTable";
import { KpiStrip } from "@/components/ui/KpiStrip";
import { LivePortfolioSpec } from "@/components/ui/LivePortfolioSpec";
import { RuleBadge } from "@/components/ui/RuleBadge";
import { StatusBar } from "@/components/ui/StatusBar";
import { TurnoverRow } from "@/components/ui/TurnoverRow";
import {
  useBacktestNav,
  useDataDate,
  useLiveHoldings,
  usePortfolioSummary,
  useRules,
  useTradeLog,
  useTurnover,
  type Holding,
  type NavPoint,
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

function Empty() {
  return (
    <div
      style={{
        padding: "12px 14px",
        fontSize: 12,
        color: "#8595A6",
        fontFamily: "JetBrains Mono, monospace",
      }}
    >
      데이터 없음
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

export default function HomePage() {
  const dataDateQuery = useDataDate();
  const summaryQuery = usePortfolioSummary();
  const navQuery = useBacktestNav();
  const tradeLogQuery = useTradeLog();
  const turnoverQuery = useTurnover();
  const rulesQuery = useRules();
  const holdingsQuery = useLiveHoldings();

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
          운용 대시보드
        </h1>
        <StatusBar date={dataDateQuery.data?.date ?? ""} />
      </div>

      {/* KPI 스트립 */}
      {summaryQuery.isLoading ? (
        <div
          style={{
            ...PANEL_STYLE,
            padding: "12px 14px",
            fontSize: 12,
            color: "#8595A6",
            fontFamily: "JetBrains Mono, monospace",
          }}
        >
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

      {/* 현재 보유 종목 */}
      <div style={PANEL_STYLE}>
        <PanelTitle title="현재 보유 종목" />
        {holdingsQuery.isLoading ? (
          <Loading />
        ) : holdingsQuery.isError ? (
          <Empty />
        ) : (
          <HoldingsTable holdings={(holdingsQuery.data ?? []) as Holding[]} />
        )}
      </div>

      {/* 현 포트폴리오 백테스트 스펙 */}
      <LivePortfolioSpec />

      {/* 회전율 */}
      <div style={PANEL_STYLE}>
        <PanelTitle title="회전율" />
        {turnoverQuery.isLoading ? (
          <Loading />
        ) : (
          <TurnoverRow turnover={turnoverQuery.data ?? null} />
        )}
      </div>

      {/* 투자 규칙 */}
      <div style={PANEL_STYLE}>
        <PanelTitle title="투자 규칙" />
        {rulesQuery.isLoading ? (
          <Loading />
        ) : (
          <RuleBadge rules={rulesQuery.data ?? null} />
        )}
      </div>

      {/* 구성 비중 */}
      <HoldingsCompositionPanel />

      {/* 일별 수익률 */}
      <DailyHeatmap />

    </div>
  );
}
