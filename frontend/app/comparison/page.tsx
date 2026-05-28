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

// ─── C4: 프론트엔드 메트릭 계산 ─────────────────────────────────────────────
type ComputedMetrics = {
  cagr: number | null;
  mdd: number | null;
  sharpe: number | null;
  calmar: number | null;
};

function computeMetrics(points: ComparisonNavPoint[]): ComputedMetrics {
  if (points.length < 2) return { cagr: null, mdd: null, sharpe: null, calmar: null };

  const values = points.map((p) => p.portfolio_value);
  const first = values[0];
  const last = values[values.length - 1];

  const startDate = new Date(points[0].date);
  const endDate = new Date(points[points.length - 1].date);
  const days = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);

  if (days <= 0 || first <= 0) return { cagr: null, mdd: null, sharpe: null, calmar: null };

  // CAGR
  const cagr = Math.pow(last / first, 365 / days) - 1;

  // MDD
  let peak = values[0];
  let mdd = 0;
  for (const v of values) {
    if (v > peak) peak = v;
    const dd = 1 - v / peak;
    if (dd > mdd) mdd = dd;
  }

  // Daily returns
  const dailyReturns: number[] = [];
  for (let i = 1; i < values.length; i++) {
    if (values[i - 1] > 0) {
      dailyReturns.push((values[i] - values[i - 1]) / values[i - 1]);
    }
  }

  let sharpe: number | null = null;
  if (dailyReturns.length > 1) {
    const mean = dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length;
    const variance =
      dailyReturns.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / dailyReturns.length;
    const std = Math.sqrt(variance);
    sharpe = std > 0 ? (mean / std) * Math.sqrt(252) : null;
  }

  const calmar = mdd > 0 ? cagr / mdd : null;

  return { cagr, mdd: -mdd, sharpe, calmar };
}

// ─── C5: 정렬 ────────────────────────────────────────────────────────────────
type SortKey = "cagr" | "mdd" | "sharpe" | "calmar";
type SortDir = "asc" | "desc";

// ─── 현재 운용 행 타입 ────────────────────────────────────────────────────────
const LIVE_PORTFOLIO_NAME = "현재 운용";

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
      names.add(LIVE_PORTFOLIO_NAME);
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

  const liveExtraMetrics = useMemo(() => {
    if (filteredActualNav.length < 2) return { sortino: null, vol: null, winRate: null };
    const returns = filteredActualNav
      .map((p) => p.daily_return)
      .filter((r) => Number.isFinite(r));
    if (!returns.length) return { sortino: null, vol: null, winRate: null };
    const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
    const downReturns = returns.filter((r) => r < 0);
    const downStd =
      downReturns.length > 1
        ? Math.sqrt(
            downReturns.reduce((s, r) => s + r * r, 0) / downReturns.length,
          ) * Math.sqrt(252)
        : null;
    const sortino = downStd && downStd > 0 ? (mean * 252) / downStd : null;
    const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length;
    const vol = Math.sqrt(variance * 252);
    const wins = returns.filter((r) => r > 0).length;
    const winRate = returns.length > 0 ? wins / returns.length : null;
    return { sortino, vol, winRate };
  }, [filteredActualNav]);

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

  // 차트 시리즈
  const chartSeries = useMemo(() => {
    return Object.fromEntries(
      Object.entries(filteredNavPoints).map(([name, points]) => {
        const values = points.map((p) => {
          if (chartMode === "drawdown") {
            return { time: p.date, value: p.drawdown != null ? p.drawdown * 100 : 0 };
          }
          return { time: p.date, value: p.cumulative_return * 100 };
        });
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
    () => Object.fromEntries(
      (portfolioList ?? []).map((p) => [p.name, p.group_name])
    ),
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

  // 필터된 summary (선택된 것만) — 그룹에 관계없이 표시 여부는 그룹 접기로 제어
  const allGroups = Array.from(groupedItems.keys());

  // 테이블 행: 현재 운용 + 나머지
  function getMetric(name: string, key: SortKey): number | null {
    if (period === "전체") {
      // 전체 기간이면 원래 summary 데이터 사용
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

  function getExtraMetric(name: string, key: "sortino" | "annual_volatility" | "win_rate") {
    // 필터 기간이 전체일 때만 백엔드 데이터 사용, 아니면 "—"
    if (period === "전체") {
      const item = summaryData.find((s) => s.portfolio_name === name);
      if (!item) return null;
      return item[key] ?? null;
    }
    return null;
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

        {/* 포트폴리오 선택 체크박스 */}
        {summaryData.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {summaryData.map((s) => (
              <label
                key={s.portfolio_name}
                className="flex cursor-pointer items-center gap-1.5 text-sm"
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

        {/* C6: y축 여백 1% */}
        <ComparisonChart series={filteredChartSeries} yPadding={0.01} />

        <p className="text-xs text-inkMuted">
          * 포트폴리오별 데이터 시작일이 다를 수 있습니다. 비교 시 기간 차이에 유의하세요.
        </p>
      </section>

      {/* 비교 지표 테이블 */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-ink">비교 지표</h2>

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
                      {fmtDec(liveExtraMetrics.sortino)}
                    </td>
                    <td className="px-4 py-3 text-right font-numeric tabular-nums text-ink">
                      {fmtPct(liveExtraMetrics.vol)}
                    </td>
                    <td className="px-4 py-3 text-right font-numeric tabular-nums text-ink">
                      {fmtPct(liveExtraMetrics.winRate)}
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
                    // 그룹 내 아이템 행
                    ...(!collapsed
                      ? items
                          .filter((item) => selectedPortfolios.has(item.portfolio_name))
                          .map((item) => (
                            <tr
                              key={item.portfolio_name}
                              className="border-b border-border last:border-0 hover:bg-surfaceMuted"
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

        {period !== "전체" && (
          <p className="text-xs text-inkMuted">
            * {period} 기간 CAGR/MDD/샤프/칼마는 선택 기간 데이터로 프론트엔드 재계산값입니다.
            소르티노·연간변동성·승률은 전체 기간 기준입니다.
          </p>
        )}
      </section>
    </div>
  );
}
