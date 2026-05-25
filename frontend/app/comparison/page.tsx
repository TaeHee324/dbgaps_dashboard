"use client";

import { useEffect, useMemo, useState } from "react";
import { ComparisonChart } from "@/components/charts/ComparisonChart";
import { useComparisonNav, useComparisonSummary } from "@/lib/hooks/dashboard";

type PeriodKey = "1Y" | "3Y" | "5Y" | "전체";
type ChartMode = "nav" | "drawdown";

const PERIODS: PeriodKey[] = ["1Y", "3Y", "5Y", "전체"];

function getCutoffDate(period: PeriodKey): string | null {
  if (period === "전체") return null;
  const d = new Date();
  if (period === "1Y") d.setFullYear(d.getFullYear() - 1);
  else if (period === "3Y") d.setFullYear(d.getFullYear() - 3);
  else if (period === "5Y") d.setFullYear(d.getFullYear() - 5);
  return d.toISOString().slice(0, 10);
}

function fmtPct(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(2)}%`;
}

function fmtDec(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(2);
}

export default function ComparisonPage() {
  const [period, setPeriod] = useState<PeriodKey>("전체");
  const [chartMode, setChartMode] = useState<ChartMode>("nav");
  const [selectedPortfolios, setSelectedPortfolios] = useState<Set<string>>(new Set());

  const { data: navData } = useComparisonNav();
  const { data: summaryData = [] } = useComparisonSummary();

  // summaryData 로드 시 전체 선택으로 초기화
  useEffect(() => {
    if (summaryData.length > 0 && selectedPortfolios.size === 0) {
      setSelectedPortfolios(new Set(summaryData.map((s) => s.portfolio_name)));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summaryData]);

  const cutoffDate = getCutoffDate(period);

  const chartSeries = useMemo(() => {
    if (!navData) return {};
    return Object.fromEntries(
      Object.entries(navData).map(([name, points]) => [
        name,
        points
          .filter((p) => !cutoffDate || p.date >= cutoffDate)
          .map((p) => ({ time: p.date, value: p.cumulative_return })),
      ]),
    );
  }, [navData, cutoffDate]);

  const filteredSummary = summaryData.filter((s) => selectedPortfolios.has(s.portfolio_name));

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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-ink">포트폴리오 비교</h1>

      {/* 기간 필터 */}
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
          {/* 차트 모드 토글 */}
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

        {chartMode === "nav" ? (
          <ComparisonChart series={filteredChartSeries} />
        ) : (
          <div className="flex h-80 items-center justify-center rounded-md border border-border bg-surface text-sm text-inkMuted">
            drawdown 데이터 없음
          </div>
        )}

        <p className="text-xs text-inkMuted">
          * 포트폴리오별 데이터 시작일이 다를 수 있습니다. 비교 시 기간 차이에 유의하세요.
        </p>
      </section>

      {/* 비교 지표 테이블 */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-ink">비교 지표</h2>
        {summaryData.length === 0 ? (
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
                  <th className="px-4 py-3 text-right text-xs font-semibold text-inkSecondary">
                    CAGR
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-inkSecondary">
                    MDD
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-inkSecondary">
                    샤프
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-inkSecondary">
                    칼마
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
                </tr>
              </thead>
              <tbody>
                {filteredSummary.map((item) => (
                  <tr
                    key={item.portfolio_name}
                    className="border-b border-border last:border-0 hover:bg-surfaceMuted"
                  >
                    <td className="px-4 py-3 font-medium text-ink">
                      {item.portfolio_name}
                    </td>
                    <td className="px-4 py-3 text-right font-numeric tabular-nums text-ink">
                      {fmtPct(item.cagr)}
                    </td>
                    <td className="px-4 py-3 text-right font-numeric tabular-nums text-ink">
                      {fmtPct(item.mdd)}
                    </td>
                    <td className="px-4 py-3 text-right font-numeric tabular-nums text-ink">
                      {fmtDec(item.sharpe)}
                    </td>
                    <td className="px-4 py-3 text-right font-numeric tabular-nums text-ink">
                      {fmtDec(item.calmar)}
                    </td>
                    <td className="px-4 py-3 text-right font-numeric tabular-nums text-ink">
                      {fmtDec(item.sortino)}
                    </td>
                    <td className="px-4 py-3 text-right font-numeric tabular-nums text-ink">
                      {fmtPct(item.annual_volatility)}
                    </td>
                    <td className="px-4 py-3 text-right font-numeric tabular-nums text-ink">
                      {fmtPct(item.win_rate)}
                    </td>
                    <td className="px-4 py-3 text-right font-numeric tabular-nums text-xs text-inkSecondary">
                      {startDates[item.portfolio_name] ?? "-"}
                    </td>
                  </tr>
                ))}
                {filteredSummary.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-6 text-center text-sm text-inkMuted">
                      선택된 포트폴리오가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
