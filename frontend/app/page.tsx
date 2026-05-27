"use client";

import { useMemo, useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DrawdownChart } from "@/components/charts/DrawdownChart";
import { NavChart } from "@/components/charts/NavChart";
import { PieChart } from "@/components/charts/PieChart";
import { DailyHeatmap } from "@/components/ui/DailyHeatmap";
import { HoldingsTable } from "@/components/ui/HoldingsTable";
import { ActualOpsKpiStrip } from "@/components/ui/ActualOpsKpiStrip";
import { StrategyKpiStrip, type StrategyPeriod } from "@/components/ui/StrategyKpiStrip";
import { RuleBadge } from "@/components/ui/RuleBadge";
import { StatusBar } from "@/components/ui/StatusBar";
import { TurnoverRow } from "@/components/ui/TurnoverRow";
import {
  useActualNav,
  useBacktestNav,
  useDataDate,
  useLiveHoldings,
  useLiveRules,
  useTradeLog,
  useTurnover,
  type ActualNavPoint,
  type Holding,
  type LiveHolding,
  type IndividualRule,
  type TradeLogEntry,
} from "@/lib/hooks/dashboard";
import { computeActualOpsMetrics, computeStrategyMetrics } from "@/lib/utils/metrics";

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
  if (value >= 100_000_000) {
    return `${(value / 100_000_000).toFixed(2)}억원`;
  }
  if (value >= 10_000) {
    return `${(value / 10_000).toFixed(0)}만원`;
  }
  return `${value.toLocaleString()}원`;
}


const INITIAL_CAPITAL = 1_000_000_000;

function AssetStatusCard({ holdings }: { holdings: LiveHolding[] | undefined }) {
  const h = holdings ?? [];

  const totalMarketValue = h.reduce((sum, x) => sum + x.market_value, 0);
  const totalCostBasis = h.reduce((sum, x) => sum + x.cost_basis, 0);
  const cashBalance = Math.max(0, INITIAL_CAPITAL - totalCostBasis);

  const riskMap: Record<string, number> = {};
  for (const x of h) {
    riskMap[x.risk_type] = (riskMap[x.risk_type] ?? 0) + x.market_value;
  }

  const assetMap: Record<string, number> = {};
  for (const x of h) {
    assetMap[x.asset_class] = (assetMap[x.asset_class] ?? 0) + x.market_value;
  }

  const total = cashBalance + totalMarketValue;

  const cashInvestData = [
    { label: "현금", value: total > 0 ? cashBalance / total : 0 },
    { label: "투자자산", value: total > 0 ? totalMarketValue / total : 0 },
  ];

  const riskTotal = Object.values(riskMap).reduce((s, v) => s + v, 0);
  const riskData = Object.entries(riskMap).map(([label, value]) => ({
    label,
    value: riskTotal > 0 ? value / riskTotal : 0,
  }));

  const assetTotal = Object.values(assetMap).reduce((s, v) => s + v, 0);
  const assetData = Object.entries(assetMap).map(([label, value]) => ({
    label,
    value: assetTotal > 0 ? value / assetTotal : 0,
  }));

  const charts = [
    { title: "현금/투자자산", data: cashInvestData },
    { title: "위험/안전자산", data: riskData },
    { title: "자산군별", data: assetData },
  ];

  return (
    <div style={PANEL_STYLE}>
      <PanelTitle title="총 자산 현황" />
      <div style={{ padding: "16px 20px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        {charts.map(({ title, data }) => (
          <div key={title} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#8595A6",
                fontFamily: "JetBrains Mono, monospace",
                textTransform: "uppercase",
                letterSpacing: "0.07em",
              }}
            >
              {title}
            </div>
            {data.length > 0 ? (
              <PieChart data={data} size={120} />
            ) : (
              <div style={{ fontSize: 12, color: "#8595A6" }}>데이터 없음</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const PERIOD_DAYS: Record<StrategyPeriod, number> = { "1Y": 252, "6M": 126, "3M": 63 };

export default function HomePage() {
  const dataDateQuery = useDataDate();
  const actualNavQuery = useActualNav();
  const backtestNavQuery = useBacktestNav();
  const tradeLogQuery = useTradeLog();
  const turnoverQuery = useTurnover();
  const liveRulesQuery = useLiveRules();
  const holdingsQuery = useLiveHoldings();
  const queryClient = useQueryClient();

  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [strategyPeriod, setStrategyPeriod] = useState<StrategyPeriod>("1Y");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  async function handleRefresh() {
    setRefreshing(true);
    setRefreshError(null);
    try {
      await fetch(`${apiBase}/api/refresh-prices`, { method: "POST" });
    } catch {
      setRefreshing(false);
      setRefreshError("갱신 요청 실패");
      return;
    }
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${apiBase}/api/refresh-status`);
        const data = await res.json();
        if (data.status === "done" || data.status === "error") {
          if (pollRef.current) clearInterval(pollRef.current);
          setRefreshing(false);
          if (data.status === "error") setRefreshError("갱신 중 오류 발생");
          queryClient.invalidateQueries();
        }
      } catch {
        if (pollRef.current) clearInterval(pollRef.current);
        setRefreshing(false);
        setRefreshError("상태 조회 실패");
      }
    }, 3000);
  }

  const actualOpsMetrics = useMemo(
    () => computeActualOpsMetrics(actualNavQuery.data ?? []),
    [actualNavQuery.data],
  );

  const strategyPoints = useMemo(() => {
    const pts = backtestNavQuery.data ?? [];
    return pts.slice(-PERIOD_DAYS[strategyPeriod]);
  }, [backtestNavQuery.data, strategyPeriod]);

  const strategyMetrics = useMemo(
    () => computeStrategyMetrics(strategyPoints),
    [strategyPoints],
  );

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

  const actualNavSince = useMemo(() => {
    const points = actualNavQuery.data;
    if (!points || points.length === 0) return undefined;
    return points[0].date;
  }, [actualNavQuery.data]);

  return (
    <div style={{ maxWidth: 1320, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

      {/* 헤더 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            style={{
              padding: "4px 12px",
              fontSize: 12,
              fontFamily: "JetBrains Mono, monospace",
              fontWeight: 600,
              color: refreshing ? "#8595A6" : "#533AFD",
              background: "#F4F2FF",
              border: "1px solid #C4BBFC",
              borderRadius: 4,
              cursor: refreshing ? "not-allowed" : "pointer",
              opacity: refreshing ? 0.7 : 1,
            }}
          >
            {refreshing ? "갱신 중..." : "현재가 갱신"}
          </button>
          {refreshError && (
            <span style={{ fontSize: 11, color: "#DC2626", fontFamily: "JetBrains Mono, monospace" }}>
              {refreshError}
            </span>
          )}
        </div>
        <StatusBar date={dataDateQuery.data?.date ?? ""} />
      </div>

      {/* 1. KPI — 실제 운용 성과 */}
      {actualNavQuery.isLoading ? (
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
        <ActualOpsKpiStrip metrics={actualOpsMetrics} since={actualNavSince} />
      )}

      {/* 1-B. KPI — 전략 특성 (백테스트) */}
      {backtestNavQuery.isLoading ? (
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
        <StrategyKpiStrip
          metrics={strategyMetrics}
          period={strategyPeriod}
          onPeriodChange={setStrategyPeriod}
        />
      )}

      {/* 2. 총 자산 현황 카드 */}
      {holdingsQuery.isLoading ? (
        <div style={PANEL_STYLE}>
          <PanelTitle title="총 자산 현황" />
          <Loading />
        </div>
      ) : (
        <AssetStatusCard holdings={holdingsQuery.data} />
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
      <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div
          style={{
            fontSize: 12.5,
            fontWeight: 700,
            color: "#0B1B2C",
          }}
        >
          투자 규칙
        </div>
        {liveRulesQuery.isLoading ? (
          <div style={PANEL_STYLE}>
            <Loading />
          </div>
        ) : liveRulesQuery.data ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
            <div style={PANEL_STYLE}>
              <PanelTitle title="개별 ETF" />
              <div style={{ padding: "12px 14px" }}>
                <RuleBadge
                  rules={{
                    individual: liveRulesQuery.data.individual.filter((r: IndividualRule) => !r.code.startsWith("[")),
                    risk_asset: liveRulesQuery.data.risk_asset,
                  }}
                  showRiskAsset={false}
                />
              </div>
            </div>
            <div style={PANEL_STYLE}>
              <PanelTitle title="섹터 / 위험자산" />
              <div style={{ padding: "12px 14px" }}>
                <RuleBadge
                  rules={{
                    individual: liveRulesQuery.data.individual.filter((r: IndividualRule) => r.code.startsWith("[")),
                    risk_asset: liveRulesQuery.data.risk_asset,
                  }}
                  emptyLabel="섹터 규칙 데이터 없음"
                />
              </div>
            </div>
          </div>
        ) : (
          <div style={PANEL_STYLE}>
            <div style={{ padding: "12px 14px" }}>
              <RuleBadge rules={null} />
            </div>
          </div>
        )}
      </section>

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
