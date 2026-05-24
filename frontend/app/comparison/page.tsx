"use client";

import { useMemo, useState } from "react";
import { ComparisonChart } from "@/components/charts/ComparisonChart";
import { useComparisonNav, useComparisonSummary } from "@/lib/hooks/dashboard";

type PeriodKey = "1Y" | "3Y" | "5Y" | "전체";

const PERIODS: PeriodKey[] = ["1Y", "3Y", "5Y", "전체"];

function getCutoffDate(period: PeriodKey): string | null {
  if (period === "전체") return null;
  const d = new Date();
  if (period === "1Y") d.setFullYear(d.getFullYear() - 1);
  else if (period === "3Y") d.setFullYear(d.getFullYear() - 3);
  else if (period === "5Y") d.setFullYear(d.getFullYear() - 5);
  return d.toISOString().slice(0, 10);
}

function fmtPct(v: number) {
  return Number.isFinite(v) ? `${(v * 100).toFixed(2)}%` : "-";
}

function fmtDec(v: number) {
  return Number.isFinite(v) ? v.toFixed(2) : "-";
}

export default function ComparisonPage() {
  const [period, setPeriod] = useState<PeriodKey>("전체");

  const { data: navData } = useComparisonNav();
  const { data: summaryData = [] } = useComparisonSummary();

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

  const startDates = useMemo(() => {
    if (!navData) return {} as Record<string, string>;
    return Object.fromEntries(
      Object.entries(navData).map(([name, points]) => [
        name,
        points.length > 0 ? points[0].date : "",
      ]),
    );
  }, [navData]);

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
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-ink">NAV 비교 (누적수익률)</h2>
        <ComparisonChart series={chartSeries} />
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
                    데이터 시작
                  </th>
                </tr>
              </thead>
              <tbody>
                {summaryData.map((item) => (
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
                    <td className="px-4 py-3 text-right font-numeric tabular-nums text-inkSecondary text-xs">
                      {startDates[item.portfolio_name] ?? "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
