"use client";

import { useMemo } from "react";
import { DrawdownChart } from "@/components/charts/DrawdownChart";
import { NavChart } from "@/components/charts/NavChart";
import { DailyHeatmap } from "@/components/ui/DailyHeatmap";
import { HoldingsTable } from "@/components/ui/HoldingsTable";
import { KpiStrip } from "@/components/ui/KpiStrip";
import { RuleBadge } from "@/components/ui/RuleBadge";
import { StatusBar } from "@/components/ui/StatusBar";
import { TurnoverRow } from "@/components/ui/TurnoverRow";
import {
  useActualNav,
  useDataDate,
  useLiveHoldings,
  useLiveRules,
  usePortfolioSummary,
  useTradeLog,
  useTurnover,
  type ActualNavPoint,
  type Holding,
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

function toNavSeries(points: ActualNavPoint[] | undefined) {
  return (points ?? []).map((p) => ({
    time: p.date,
    value: (1 + p.cumulative_return) * 100,
  }));
}

function toDrawdownSeries(points: ActualNavPoint[] | undefined) {
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

function fmtKRW(value: number) {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}억원`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(0)}만원`;
  }
  return `${value.toLocaleString()}원`;
}

function DonutChart({ etfRatio, cashRatio }: { etfRatio: number; cashRatio: number }) {
  const size = 80;
  const cx = size / 2;
  const cy = size / 2;
  const r = 28;
  const strokeWidth = 12;

  // etfRatio는 0~1 범위
  const circ = 2 * Math.PI * r;
  const etfDash = circ * etfRatio;
  const cashDash = circ * cashRatio;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* 배경 원 */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="#EFF2F6"
        strokeWidth={strokeWidth}
      />
      {/* ETF 비중 (시작: 12시 방향) */}
      {etfRatio > 0 && (
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="#533AFD"
          strokeWidth={strokeWidth}
          strokeDasharray={`${etfDash} ${circ - etfDash}`}
          strokeDashoffset={circ / 4}
          strokeLinecap="butt"
        />
      )}
      {/* 현금 비중 */}
      {cashRatio > 0 && (
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="#22C55E"
          strokeWidth={strokeWidth}
          strokeDasharray={`${cashDash} ${circ - cashDash}`}
          strokeDashoffset={circ / 4 - etfDash}
          strokeLinecap="butt"
        />
      )}
    </svg>
  );
}

function AssetStatusCard({ navData }: { navData: ActualNavPoint[] | undefined }) {
  const last = navData && navData.length > 0 ? navData[navData.length - 1] : null;

  if (!last) {
    return (
      <div style={PANEL_STYLE}>
        <PanelTitle title="총 자산 현황" />
        <Empty />
      </div>
    );
  }

  const portfolioValue = last.portfolio_value;
  const cash = last.cash ?? 0;
  const totalAsset = portfolioValue + cash;
  const cumReturn = last.cumulative_return;

  const etfRatio = totalAsset > 0 ? portfolioValue / totalAsset : 0;
  const cashRatio = totalAsset > 0 ? cash / totalAsset : 0;

  const returnColor = cumReturn >= 0 ? "#16A34A" : "#DC2626";

  return (
    <div style={PANEL_STYLE}>
      <PanelTitle title="총 자산 현황" sub={last.date} />
      <div
        style={{
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          gap: 24,
        }}
      >
        {/* 도넛 차트 */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <DonutChart etfRatio={etfRatio} cashRatio={cashRatio} />
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#533AFD",
                  display: "inline-block",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 10.5,
                  color: "#8595A6",
                  fontFamily: "JetBrains Mono, monospace",
                }}
              >
                ETF {(etfRatio * 100).toFixed(1)}%
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#22C55E",
                  display: "inline-block",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 10.5,
                  color: "#8595A6",
                  fontFamily: "JetBrains Mono, monospace",
                }}
              >
                현금 {(cashRatio * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        {/* 구분선 */}
        <div style={{ width: 1, height: 80, background: "#EFF2F6", flexShrink: 0 }} />

        {/* 수치 */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "10px 32px",
            flex: 1,
          }}
        >
          {[
            { label: "총 자산", value: fmtKRW(totalAsset), color: "#0B1B2C" },
            { label: "평가금액 (ETF)", value: fmtKRW(portfolioValue), color: "#0B1B2C" },
            { label: "현금", value: fmtKRW(cash), color: "#0B1B2C" },
            {
              label: "누적수익률",
              value: `${cumReturn >= 0 ? "+" : ""}${(cumReturn * 100).toFixed(2)}%`,
              color: returnColor,
            },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 600,
                  color: "#8595A6",
                  fontFamily: "JetBrains Mono, monospace",
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                }}
              >
                {label}
              </div>
              <div
                style={{
                  fontSize: 17,
                  fontWeight: 600,
                  fontFamily: "JetBrains Mono, monospace",
                  fontVariantNumeric: "tabular-nums",
                  letterSpacing: "-0.01em",
                  color,
                }}
              >
                {value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const dataDateQuery = useDataDate();
  const summaryQuery = usePortfolioSummary();
  const actualNavQuery = useActualNav();
  const tradeLogQuery = useTradeLog();
  const turnoverQuery = useTurnover();
  const liveRulesQuery = useLiveRules();
  const holdingsQuery = useLiveHoldings();

  const navData = useMemo(() => toNavSeries(actualNavQuery.data), [actualNavQuery.data]);
  const drawdownData = useMemo(() => toDrawdownSeries(actualNavQuery.data), [actualNavQuery.data]);
  const tradeMarkers = useMemo(
    () => toTradeMarkers(tradeLogQuery.data),
    [tradeLogQuery.data],
  );

  const navPeriodSub = useMemo(() => {
    const points = actualNavQuery.data;
    if (!points || points.length === 0) return undefined;
    return `${points[0].date} ~ ${points[points.length - 1].date}`;
  }, [actualNavQuery.data]);

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

      {/* 1. KPI 카드 */}
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

      {/* 2. 총 자산 현황 카드 */}
      {actualNavQuery.isLoading ? (
        <div style={PANEL_STYLE}>
          <PanelTitle title="총 자산 현황" />
          <Loading />
        </div>
      ) : (
        <AssetStatusCard navData={actualNavQuery.data} />
      )}

      {/* 3. NAV + Drawdown */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={PANEL_STYLE}>
          <PanelTitle title="NAV" sub={navPeriodSub ?? "실제 거래 기반"} />
          <div style={{ padding: "12px 14px" }}>
            {actualNavQuery.isLoading ? (
              <Loading />
            ) : actualNavQuery.isError ? (
              <Empty />
            ) : (
              <NavChart data={navData} tradeMarkers={tradeMarkers} />
            )}
          </div>
        </div>

        <div style={PANEL_STYLE}>
          <PanelTitle title="Drawdown" sub="%" />
          <div style={{ padding: "12px 14px" }}>
            {actualNavQuery.isLoading ? (
              <Loading />
            ) : actualNavQuery.isError ? (
              <Empty />
            ) : (
              <DrawdownChart data={drawdownData} />
            )}
          </div>
        </div>
      </div>

      {/* 4. 일별 수익률 히트맵 */}
      <DailyHeatmap />

      {/* 5. 투자 규칙 카드 */}
      <div style={PANEL_STYLE}>
        <PanelTitle title="투자 규칙" />
        {liveRulesQuery.isLoading ? (
          <Loading />
        ) : (
          <RuleBadge rules={liveRulesQuery.data ?? null} />
        )}
      </div>

      {/* 6. 현재 보유 종목 */}
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

      {/* 7. 회전율 */}
      <div style={PANEL_STYLE}>
        <PanelTitle title="회전율" />
        {turnoverQuery.isLoading ? (
          <Loading />
        ) : (
          <TurnoverRow turnover={turnoverQuery.data ?? null} />
        )}
      </div>

    </div>
  );
}
