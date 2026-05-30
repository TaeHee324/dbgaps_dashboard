"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ComparisonChart } from "@/components/charts/ComparisonChart";
import {
  useActualNav,
  useComparisonNav,
  useComparisonSummary,
  useLiveHoldings,
  type ActualNavPoint,
  type ComparisonNavPoint,
  type ComparisonSummaryItem,
} from "@/lib/hooks/dashboard";
import { useDeletePortfolio, usePortfolioList } from "@/lib/hooks/portfolio";

// ─── Portfolio Scatter Chart ─────────────────────────────────────────────────
const METRIC_OPTIONS = [
  { key: "annual_volatility", label: "연간변동성" },
  { key: "cagr", label: "CAGR" },
  { key: "mdd", label: "MDD (절댓값)" },
  { key: "sharpe", label: "샤프" },
  { key: "calmar", label: "칼마" },
  { key: "sortino", label: "소르티노" },
  { key: "win_rate", label: "승률" },
] as const;

type MetricKey = (typeof METRIC_OPTIONS)[number]["key"];

function formatMetricValue(v: number, key: MetricKey): string {
  if (key === "sharpe" || key === "calmar" || key === "sortino") return v.toFixed(2);
  return `${(v * 100).toFixed(1)}%`;
}

// ─── C4: 프론트엔드 메트릭 계산 ─────────────────────────────────────────────
type ComputedMetrics = {
  cagr: number | null;
  mdd: number | null;
  sharpe: number | null;
  calmar: number | null;
  sortino: number | null;
  annual_volatility: number | null;
  win_rate: number | null;
};

function computeMetrics(points: ComparisonNavPoint[]): ComputedMetrics {
  const nullResult: ComputedMetrics = {
    cagr: null,
    mdd: null,
    sharpe: null,
    calmar: null,
    sortino: null,
    annual_volatility: null,
    win_rate: null,
  };
  if (points.length < 2) return nullResult;

  const values = points.map((p) => p.portfolio_value);
  const first = values[0];
  const last = values[values.length - 1];

  const startDate = new Date(points[0].date);
  const endDate = new Date(points[points.length - 1].date);
  const days = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);

  if (days <= 0 || first <= 0) return nullResult;

  // CAGR
  const cagr = Math.pow(last / first, 365 / days) - 1;

  // MDD
  let peak = values[0];
  let mddRaw = 0;
  for (const v of values) {
    if (v > peak) peak = v;
    const dd = 1 - v / peak;
    if (dd > mddRaw) mddRaw = dd;
  }

  // Daily returns from portfolio_value
  const dailyReturns: number[] = [];
  for (let i = 1; i < values.length; i++) {
    if (values[i - 1] > 0) {
      dailyReturns.push((values[i] - values[i - 1]) / values[i - 1]);
    }
  }

  let sharpe: number | null = null;
  let annual_volatility: number | null = null;
  let sortino: number | null = null;
  let win_rate: number | null = null;

  if (dailyReturns.length > 1) {
    const mean = dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length;
    const variance =
      dailyReturns.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / dailyReturns.length;
    const std = Math.sqrt(variance);
    sharpe = std > 0 ? (mean / std) * Math.sqrt(252) : null;
    annual_volatility = Math.sqrt(variance * 252);

    const downReturns = dailyReturns.filter((r) => r < 0);
    if (downReturns.length > 1) {
      const downStd =
        Math.sqrt(downReturns.reduce((s, r) => s + r * r, 0) / downReturns.length) *
        Math.sqrt(252);
      sortino = downStd > 0 ? (mean * 252) / downStd : null;
    }

    const wins = dailyReturns.filter((r) => r > 0).length;
    win_rate = dailyReturns.length > 0 ? wins / dailyReturns.length : null;
  }

  const calmar = mddRaw > 0 ? cagr / mddRaw : null;

  return { cagr, mdd: -mddRaw, sharpe, calmar, sortino, annual_volatility, win_rate };
}

function PortfolioScatterChart({
  data,
  computedMetricsMap,
  period,
  activePortfolioName,
  selectedPortfolios,
}: {
  data: ComparisonSummaryItem[];
  computedMetricsMap: Record<string, ComputedMetrics>;
  period: PeriodKey;
  activePortfolioName: string | null;
  selectedPortfolios: Set<string>;
}) {
  const [xKey, setXKey] = useState<MetricKey>("annual_volatility");
  const [yKey, setYKey] = useState<MetricKey>("cagr");

  function getScatterValue(item: ComparisonSummaryItem, key: MetricKey): number | null {
    if (period === "전체") {
      const raw = item[key as keyof ComparisonSummaryItem];
      if (raw === null || raw === undefined || typeof raw !== "number" || !Number.isFinite(raw))
        return null;
      return key === "mdd" ? Math.abs(raw as number) : (raw as number);
    }
    const m = computedMetricsMap[item.portfolio_name];
    if (!m) return null;
    const v = m[key as keyof ComputedMetrics];
    if (v === null || v === undefined || !Number.isFinite(v)) return null;
    return key === "mdd" ? Math.abs(v) : v;
  }

  const points = useMemo(() => {
    return data
      .filter((item) => selectedPortfolios.has(item.portfolio_name))
      .map((item) => {
        const x = getScatterValue(item, xKey);
        const y = getScatterValue(item, yKey);
        if (x === null || y === null) return null;
        return { item, x, y };
      })
      .filter((p): p is { item: ComparisonSummaryItem; x: number; y: number } => p !== null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, xKey, yKey, period, computedMetricsMap, selectedPortfolios]);

  // SVG layout constants
  const W = 400, H = 340;
  const top = 20, right = 20, bottom = 40, left = 50;
  const plotW = W - left - right;
  const plotH = H - top - bottom;

  const { xMin, xMax, yMin, yMax } = useMemo(() => {
    if (points.length === 0) return { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const xMinV = Math.min(...xs);
    const xMaxV = Math.max(...xs);
    const yMinV = Math.min(...ys);
    const yMaxV = Math.max(...ys);
    const xPad = (xMaxV - xMinV) * 0.15 || 0.05;
    const yPad = (yMaxV - yMinV) * 0.15 || 0.05;
    return {
      xMin: xMinV - xPad,
      xMax: xMaxV + xPad,
      yMin: yMinV - yPad,
      yMax: yMaxV + yPad,
    };
  }, [points]);

  const toSvgX = (v: number) => left + ((v - xMin) / (xMax - xMin)) * plotW;
  const toSvgY = (v: number) => top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  const xLabel = METRIC_OPTIONS.find((o) => o.key === xKey)?.label ?? xKey;
  const yLabel = METRIC_OPTIONS.find((o) => o.key === yKey)?.label ?? yKey;

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      {/* 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <span className="text-sm font-semibold text-slate-800">포트폴리오 위험-수익 분포</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">X</span>
          <select
            value={xKey}
            onChange={(e) => setXKey(e.target.value as MetricKey)}
            className="text-xs border border-slate-200 rounded px-2 py-1 bg-white"
          >
            {METRIC_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
          <span className="text-xs text-slate-500">Y</span>
          <select
            value={yKey}
            onChange={(e) => setYKey(e.target.value as MetricKey)}
            className="text-xs border border-slate-200 rounded px-2 py-1 bg-white"
          >
            {METRIC_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 차트 */}
      {data.length === 0 ? (
        <p className="text-xs text-slate-500 text-center py-10">
          백테스트 데이터가 없습니다. run_engine.py를 실행해 주세요.
        </p>
      ) : (
        <div style={{ width: "100%", height: 340 }}>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            style={{ width: "100%", height: "100%" }}
            aria-label="포트폴리오 위험-수익 산점도"
          >
            {/* 격자선 */}
            {[0, 0.25, 0.5, 0.75, 1].map((t) => {
              const gy = top + t * plotH;
              const gx = left + t * plotW;
              const yVal = yMax - t * (yMax - yMin);
              const xVal = xMin + t * (xMax - xMin);
              return (
                <g key={t}>
                  <line x1={left} y1={gy} x2={left + plotW} y2={gy} stroke="#E2E8F0" strokeWidth={0.5} />
                  <text
                    x={left - 4}
                    y={gy + 4}
                    textAnchor="end"
                    fontSize={9}
                    fill="#64748B"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {formatMetricValue(yVal, yKey)}
                  </text>
                  <line x1={gx} y1={top} x2={gx} y2={top + plotH} stroke="#E2E8F0" strokeWidth={0.5} />
                  {t > 0 && t < 1 && (
                    <text
                      x={gx}
                      y={top + plotH + 14}
                      textAnchor="middle"
                      fontSize={9}
                      fill="#64748B"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {formatMetricValue(xVal, xKey)}
                    </text>
                  )}
                </g>
              );
            })}

            {/* 축 레이블 */}
            <text
              x={left + plotW / 2}
              y={H - 4}
              textAnchor="middle"
              fontSize={10}
              fill="#64748B"
              fontFamily="JetBrains Mono, monospace"
            >
              {xLabel}
            </text>
            <text
              x={10}
              y={top + plotH / 2}
              textAnchor="middle"
              fontSize={10}
              fill="#64748B"
              fontFamily="JetBrains Mono, monospace"
              transform={`rotate(-90, 10, ${top + plotH / 2})`}
            >
              {yLabel}
            </text>

            {/* 데이터 점 */}
            {points.map(({ item, x, y }, idx) => {
              const isActive = item.portfolio_name === activePortfolioName;
              const cx = toSvgX(x);
              const cy = toSvgY(y);
              const shortName =
                item.portfolio_name.length > 6
                  ? item.portfolio_name.slice(0, 6) + "…"
                  : item.portfolio_name;
              const labelDy = idx % 2 === 0 ? -9 : 13;
              return (
                <g key={item.portfolio_name}>
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isActive ? 5 : 4}
                    fill={isActive ? "#4F46E5" : "#94A3B8"}
                    stroke={isActive ? "#3730A3" : "none"}
                    strokeWidth={isActive ? 2 : 0}
                  >
                    <title>{`${item.portfolio_name}\n${xLabel}: ${formatMetricValue(x, xKey)}\n${yLabel}: ${formatMetricValue(y, yKey)}`}</title>
                  </circle>
                  <text
                    x={cx}
                    y={cy}
                    dy={labelDy}
                    textAnchor="middle"
                    fontSize={9}
                    fill={isActive ? "#4F46E5" : "#64748B"}
                    fontWeight={isActive ? 700 : 400}
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {shortName}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}

// ─── 기간 필터 ───────────────────────────────────────────────────────────────
type PeriodKey = "1M" | "3M" | "6M" | "1Y" | "전체";
type ChartMode = "nav" | "drawdown";

const PERIODS: PeriodKey[] = ["1M", "3M", "6M", "1Y", "전체"];

function getCutoffDate(period: PeriodKey): string | null {
  if (period === "전체") return null;
  const d = new Date();
  if (period === "1M") d.setMonth(d.getMonth() - 1);
  else if (period === "3M") d.setMonth(d.getMonth() - 3);
  else if (period === "6M") d.setMonth(d.getMonth() - 6);
  else if (period === "1Y") d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

// ─── 포맷 헬퍼 ───────────────────────────────────────────────────────────────
function fmtPct(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(2)}%`;
}

function fmtDec(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(2);
}

// ─── C5: 정렬 ────────────────────────────────────────────────────────────────
type SortKey = "cagr" | "mdd" | "sharpe" | "calmar";
type SortDir = "asc" | "desc";

// ─── C3: 그룹핑 헬퍼 ─────────────────────────────────────────────────────────
function groupPortfolios(
  items: ComparisonSummaryItem[],
  groupMap: Record<string, string | null | undefined>,
): Map<string, ComparisonSummaryItem[]> {
  const map = new Map<string, ComparisonSummaryItem[]>();
  for (const item of items) {
    const g = groupMap[item.portfolio_name] ?? "기타";
    if (!map.has(g)) map.set(g, []);
    map.get(g)!.push(item);
  }
  return map;
}

// ─── 메인 페이지 ─────────────────────────────────────────────────────────────
export default function ComparisonPage() {
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<PeriodKey>("전체");
  const [chartMode, setChartMode] = useState<ChartMode>("nav");
  const [selectedPortfolios, setSelectedPortfolios] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data: navData } = useComparisonNav();
  const { data: summaryData = [] } = useComparisonSummary();
  const { data: liveHoldings = [] } = useLiveHoldings();
  const { data: actualNav = [] } = useActualNav();
  const deleteMutation = useDeletePortfolio();

  // 전체 선택 초기화
  useEffect(() => {
    if (summaryData.length > 0 && selectedPortfolios.size === 0) {
      const names = new Set(summaryData.map((s) => s.portfolio_name));
      setSelectedPortfolios(names);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summaryData]);

  const cutoffDate = getCutoffDate(period);

  // C1: 현재 운용 — actual nav 기간 필터 및 메트릭 계산
  const filteredActualNav = useMemo<ActualNavPoint[]>(() => {
    if (!cutoffDate) return actualNav;
    return actualNav.filter((p) => p.date >= cutoffDate);
  }, [actualNav, cutoffDate]);

  const liveMetrics = useMemo(
    () => computeMetrics(filteredActualNav as ComparisonNavPoint[]),
    [filteredActualNav],
  );

  const liveStartDate = useMemo(
    () => (actualNav.length > 0 ? actualNav[0].date : null),
    [actualNav],
  );

  // 기간 필터된 nav 포인트
  const filteredNavPoints = useMemo<Record<string, ComparisonNavPoint[]>>(() => {
    if (!navData) return {};
    return Object.fromEntries(
      Object.entries(navData).map(([name, points]) => [
        name,
        points.filter((p) => !cutoffDate || p.date >= cutoffDate),
      ]),
    );
  }, [navData, cutoffDate]);

  // C4: 기간별 계산된 메트릭
  const computedMetricsMap = useMemo<Record<string, ComputedMetrics>>(() => {
    const result: Record<string, ComputedMetrics> = {};
    for (const [name, points] of Object.entries(filteredNavPoints)) {
      result[name] = computeMetrics(points);
    }
    return result;
  }, [filteredNavPoints]);

  // Step 2: 차트 시리즈 재정규화 (기간 필터 시 원점 0 시작)
  const chartSeries = useMemo(() => {
    return Object.fromEntries(
      Object.entries(filteredNavPoints).map(([name, points]) => {
        if (points.length === 0) return [name, []];
        if (chartMode === "drawdown") {
          // 기간 내 portfolio_value로 고점 직접 계산
          let peak = points[0].portfolio_value;
          const ddMap = new Map<string, number>();
          for (const pt of points) {
            if (pt.portfolio_value > peak) peak = pt.portfolio_value;
            ddMap.set(pt.date, peak > 0 ? ((peak - pt.portfolio_value) / peak) * 100 : 0);
          }
          const values = points.map((p) => ({
            time: p.date,
            value: -(ddMap.get(p.date) ?? 0),
          }));
          return [name, values];
        }
        // NAV 모드: 기간 첫 포인트 기준으로 재정규화
        const base = points[0].portfolio_value ?? 1;
        const values = points.map((p) => ({
          time: p.date,
          value: (p.portfolio_value / base - 1) * 100,
        }));
        return [name, values];
      }),
    );
  }, [filteredNavPoints, chartMode]);

  const filteredChartSeries = Object.fromEntries(
    Object.entries(chartSeries).filter(([name]) => selectedPortfolios.has(name)),
  );

  const startDates = useMemo(() => {
    if (!navData) return {} as Record<string, string>;
    return Object.fromEntries(
      Object.entries(navData).map(([name, points]) => [
        name,
        points.length > 0 ? points[0].date : "",
      ]),
    );
  }, [navData]);

  function togglePortfolio(name: string) {
    setSelectedPortfolios((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  // C5: 정렬
  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function sortIcon(key: SortKey) {
    if (sortKey !== key) return <span className="ml-0.5 text-inkMuted">↕</span>;
    return <span className="ml-0.5 text-primary">{sortDir === "desc" ? "▼" : "▲"}</span>;
  }

  // C2: 삭제 핸들러
  async function handleDelete(name: string) {
    if (!confirm(`포트폴리오 "${name}"를 삭제하시겠습니까?`)) return;
    setDeleteError(null);
    try {
      await deleteMutation.mutateAsync(name);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["comparison-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["comparison-nav"] }),
        queryClient.invalidateQueries({ queryKey: ["portfolio-list"] }),
      ]);
      queryClient.removeQueries({ queryKey: ["portfolio-detail", name] });
      setSelectedPortfolios((prev) => {
        const next = new Set(prev);
        next.delete(name);
        return next;
      });
    } catch {
      setDeleteError(`"${name}" 삭제 실패`);
    }
  }

  // C3: 그룹 접기/펼치기
  function toggleGroup(group: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }

  const { data: portfolioList } = usePortfolioList();

  const groupMap = useMemo(
    () =>
      Object.fromEntries((portfolioList ?? []).map((p) => [p.name, p.group_name])),
    [portfolioList],
  );

  const activePortfolioName = useMemo(
    () => (portfolioList ?? []).find((p) => p.is_active)?.name ?? null,
    [portfolioList],
  );

  // C5: 정렬된 summary (현재 운용 행 제외)
  const sortedSummary = useMemo(() => {
    const items = [...summaryData];
    if (!sortKey) return items;
    return items.sort((a, b) => {
      const getVal = (item: ComparisonSummaryItem): number => {
        const m = computedMetricsMap[item.portfolio_name];
        if (!m) return -Infinity;
        const v = m[sortKey as keyof ComputedMetrics];
        return v ?? -Infinity;
      };
      const av = getVal(a);
      const bv = getVal(b);
      return sortDir === "desc" ? bv - av : av - bv;
    });
  }, [summaryData, sortKey, sortDir, computedMetricsMap]);

  // 그룹핑
  const groupedItems = useMemo(
    () => groupPortfolios(sortedSummary, groupMap),
    [sortedSummary, groupMap],
  );

  const allGroups = Array.from(groupedItems.keys());

  // 테이블 행: 현재 운용 + 나머지
  function getMetric(name: string, key: SortKey): number | null {
    if (period === "전체") {
      const item = summaryData.find((s) => s.portfolio_name === name);
      if (!item) return null;
      if (key === "cagr") return item.cagr;
      if (key === "mdd") return item.mdd;
      if (key === "sharpe") return item.sharpe;
      if (key === "calmar") return item.calmar;
      return null;
    }
    return computedMetricsMap[name]?.[key] ?? null;
  }

  // Step 4: getExtraMetric — 기간 필터 시에도 계산값 사용
  function getExtraMetric(name: string, key: "sortino" | "annual_volatility" | "win_rate") {
    if (period === "전체") {
      const item = summaryData.find((s) => s.portfolio_name === name);
      if (!item) return null;
      return item[key] ?? null;
    }
    return computedMetricsMap[name]?.[key] ?? null;
  }

  const colSpan = 10; // 포트폴리오 + CAGR + MDD + 샤프 + 칼마 + 소르티노 + 연간변동성 + 승률 + 시작 + 삭제

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-ink">포트폴리오 비교</h1>

      {/* C4: 기간 필터 */}
      <div className="flex gap-1">
        {PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              period === p
                ? "bg-primary text-white"
                : "text-inkSecondary hover:bg-surfaceMuted"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* NAV 비교 차트 */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">NAV 비교 (누적수익률)</h2>
          <div className="flex gap-1 rounded-md border border-border p-0.5">
            <button
              onClick={() => setChartMode("nav")}
              className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                chartMode === "nav"
                  ? "bg-primary text-white"
                  : "text-inkSecondary hover:bg-surfaceMuted"
              }`}
            >
              NAV
            </button>
            <button
              onClick={() => setChartMode("drawdown")}
              className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                chartMode === "drawdown"
                  ? "bg-primary text-white"
                  : "text-inkSecondary hover:bg-surfaceMuted"
              }`}
            >
              Drawdown
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 items-start">
          <div className="space-y-2">
            {/* C6: y축 여백 1%, height=340 */}
            <ComparisonChart series={filteredChartSeries} yPadding={0.01} height={340} />

            <p className="text-xs text-inkMuted">
              * 포트폴리오별 데이터 시작일이 다를 수 있습니다. 비교 시 기간 차이에 유의하세요.
            </p>
          </div>

          <PortfolioScatterChart
            data={summaryData}
            computedMetricsMap={computedMetricsMap}
            period={period}
            activePortfolioName={activePortfolioName}
            selectedPortfolios={selectedPortfolios}
          />
        </div>
      </section>

      {/* 비교 지표 테이블 */}
      <section className="space-y-2">
        {/* Step 5: 체크박스를 비교 지표 헤더 옆으로 이동 */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h2 className="text-sm font-semibold text-ink">비교 지표</h2>
          {summaryData.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {summaryData.map((s) => (
                <label
                  key={s.portfolio_name}
                  className="flex cursor-pointer items-center gap-1.5 text-xs"
                >
                  <input
                    type="checkbox"
                    checked={selectedPortfolios.has(s.portfolio_name)}
                    onChange={() => togglePortfolio(s.portfolio_name)}
                    className="accent-primary"
                  />
                  <span className="text-ink">{s.portfolio_name}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {deleteError && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{deleteError}</p>
        )}

        {summaryData.length === 0 && liveHoldings.length === 0 ? (
          <p className="text-sm text-inkSecondary">
            run_engine.py를 실행하면 비교 지표가 표시됩니다.
          </p>
        ) : (
          <div className="overflow-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface">
                <tr className="text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-inkSecondary">
                    포트폴리오
                  </th>
                  <th
                    className="cursor-pointer select-none px-4 py-3 text-right text-xs font-semibold text-inkSecondary hover:text-ink"
                    onClick={() => handleSort("cagr")}
                  >
                    CAGR{sortIcon("cagr")}
                  </th>
                  <th
                    className="cursor-pointer select-none px-4 py-3 text-right text-xs font-semibold text-inkSecondary hover:text-ink"
                    onClick={() => handleSort("mdd")}
                  >
                    MDD{sortIcon("mdd")}
                  </th>
                  <th
                    className="cursor-pointer select-none px-4 py-3 text-right text-xs font-semibold text-inkSecondary hover:text-ink"
                    onClick={() => handleSort("sharpe")}
                  >
                    샤프{sortIcon("sharpe")}
                  </th>
                  <th
                    className="cursor-pointer select-none px-4 py-3 text-right text-xs font-semibold text-inkSecondary hover:text-ink"
                    onClick={() => handleSort("calmar")}
                  >
                    칼마{sortIcon("calmar")}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-inkSecondary">
                    소르티노
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-inkSecondary">
                    연간변동성
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-inkSecondary">
                    승률
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-inkSecondary">
                    데이터 시작
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-inkSecondary">
                    삭제
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* C1: 현재 운용 고정 행 */}
                {liveHoldings.length > 0 && (
                  <tr className="border-b border-border bg-blue-50/40 hover:bg-blue-50/60">
                    <td className="px-4 py-3 font-semibold text-primary">
                      <span className="mr-1.5 inline-block rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                        현재 운용
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-numeric tabular-nums text-ink">
                      {fmtPct(liveMetrics.cagr)}
                    </td>
                    <td className="px-4 py-3 text-right font-numeric tabular-nums text-ink">
                      {fmtPct(liveMetrics.mdd)}
                    </td>
                    <td className="px-4 py-3 text-right font-numeric tabular-nums text-ink">
                      {fmtDec(liveMetrics.sharpe)}
                    </td>
                    <td className="px-4 py-3 text-right font-numeric tabular-nums text-ink">
                      {fmtDec(liveMetrics.calmar)}
                    </td>
                    <td className="px-4 py-3 text-right font-numeric tabular-nums text-ink">
                      {fmtDec(liveMetrics.sortino)}
                    </td>
                    <td className="px-4 py-3 text-right font-numeric tabular-nums text-ink">
                      {fmtPct(liveMetrics.annual_volatility)}
                    </td>
                    <td className="px-4 py-3 text-right font-numeric tabular-nums text-ink">
                      {fmtPct(liveMetrics.win_rate)}
                    </td>
                    <td className="px-4 py-3 text-right font-numeric tabular-nums text-xs text-inkSecondary">
                      {liveStartDate ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right" />
                  </tr>
                )}

                {/* C3: 그룹별 행 */}
                {allGroups.map((group) => {
                  const items = groupedItems.get(group) ?? [];
                  const collapsed = collapsedGroups.has(group);
                  return [
                    // 그룹 헤더
                    <tr key={`group-${group}`} className="border-b border-border bg-surfaceMuted">
                      <td
                        colSpan={colSpan}
                        className="cursor-pointer px-4 py-2"
                        onClick={() => toggleGroup(group)}
                      >
                        <span className="text-xs font-semibold text-inkSecondary">
                          {collapsed ? "▶" : "▼"} {group}
                          <span className="ml-1.5 font-normal text-inkMuted">({items.length})</span>
                        </span>
                      </td>
                    </tr>,
                    // 그룹 내 아이템 행 — 모두 표시, 체크 안된 행은 dim 처리
                    ...(!collapsed
                      ? items.map((item) => (
                          <tr
                            key={item.portfolio_name}
                            className={`border-b border-border last:border-0 hover:bg-surfaceMuted transition-opacity ${
                              !selectedPortfolios.has(item.portfolio_name) ? "opacity-40" : ""
                            }`}
                          >
                            <td className="px-4 py-3 font-medium text-ink">
                              {item.portfolio_name}
                            </td>
                            <td className="px-4 py-3 text-right font-numeric tabular-nums text-ink">
                              {fmtPct(getMetric(item.portfolio_name, "cagr"))}
                            </td>
                            <td className="px-4 py-3 text-right font-numeric tabular-nums text-ink">
                              {fmtPct(getMetric(item.portfolio_name, "mdd"))}
                            </td>
                            <td className="px-4 py-3 text-right font-numeric tabular-nums text-ink">
                              {fmtDec(getMetric(item.portfolio_name, "sharpe"))}
                            </td>
                            <td className="px-4 py-3 text-right font-numeric tabular-nums text-ink">
                              {fmtDec(getMetric(item.portfolio_name, "calmar"))}
                            </td>
                            <td className="px-4 py-3 text-right font-numeric tabular-nums text-ink">
                              {fmtDec(getExtraMetric(item.portfolio_name, "sortino"))}
                            </td>
                            <td className="px-4 py-3 text-right font-numeric tabular-nums text-ink">
                              {fmtPct(getExtraMetric(item.portfolio_name, "annual_volatility"))}
                            </td>
                            <td className="px-4 py-3 text-right font-numeric tabular-nums text-ink">
                              {fmtPct(getExtraMetric(item.portfolio_name, "win_rate"))}
                            </td>
                            <td className="px-4 py-3 text-right font-numeric tabular-nums text-xs text-inkSecondary">
                              {startDates[item.portfolio_name] ?? "—"}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => handleDelete(item.portfolio_name)}
                                disabled={deleteMutation.isPending}
                                className="rounded px-2 py-0.5 text-xs text-red-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
                                title={`"${item.portfolio_name}" 삭제`}
                              >
                                삭제
                              </button>
                            </td>
                          </tr>
                        ))
                      : []),
                  ];
                })}

                {summaryData.length === 0 && (
                  <tr>
                    <td colSpan={colSpan} className="px-4 py-6 text-center text-sm text-inkMuted">
                      저장된 포트폴리오가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Step 7: 주석 텍스트 수정 */}
        {period !== "전체" && (
          <p className="text-xs text-inkMuted">
            * {period} 기간 모든 지표는 선택 기간 데이터로 프론트엔드 재계산값입니다.
          </p>
        )}
      </section>
    </div>
  );
}
