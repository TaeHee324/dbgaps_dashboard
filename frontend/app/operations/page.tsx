"use client";

import { useMemo } from "react";
import { ComparisonChart } from "@/components/charts/ComparisonChart";
import { DrawdownChart } from "@/components/charts/DrawdownChart";
import { MonthlyBarChart } from "@/components/charts/MonthlyBarChart";
import { NavChart } from "@/components/charts/NavChart";
import { HoldingsTable } from "@/components/ui/HoldingsTable";
import { KpiStrip } from "@/components/ui/KpiStrip";
import { RuleBadge } from "@/components/ui/RuleBadge";
import { StatusBar } from "@/components/ui/StatusBar";
import { TurnoverRow } from "@/components/ui/TurnoverRow";
import {
  useBacktestNav,
  useComparisonNav,
  useComparisonSummary,
  useCurrentHoldings,
  useDataDate,
  useMonthlyReturns,
  usePortfolioSummary,
  useRules,
  useTradeLog,
  useTurnover,
  type ComparisonNavPoint,
  type ComparisonSummaryItem,
  type MonthlyReturn,
  type NavPoint,
  type TradeLogEntry,
} from "@/lib/hooks/dashboard";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-sm">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

function SectionState({
  isLoading,
  isError,
  children,
}: {
  isLoading?: boolean;
  isError?: boolean;
  children: React.ReactNode;
}) {
  if (isLoading) {
    return (
      <div className="rounded-md border border-border bg-surface px-md py-sm text-sm text-inkSecondary">
        로딩 중...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-md border border-border bg-surface px-md py-sm text-sm text-inkSecondary">
        데이터 없음
      </div>
    );
  }

  return <>{children}</>;
}

function toNavSeries(points: NavPoint[] | undefined) {
  return (points ?? []).map((point) => ({
    time: point.date,
    value: (1 + point.cumulative_return) * 100,
  }));
}

function toDrawdownSeries(points: NavPoint[] | undefined) {
  return (points ?? []).map((point) => ({
    time: point.date,
    value: point.drawdown * 100,
  }));
}

function toMonthlySeries(points: MonthlyReturn[] | undefined) {
  return (points ?? []).map((point) => ({
    time: `${point.year}-${String(point.month).padStart(2, "0")}-01`,
    value: point.monthly_return,
  }));
}

function toComparisonSeries(data: Record<string, ComparisonNavPoint[]> | undefined) {
  return Object.fromEntries(
    Object.entries(data ?? {}).map(([name, points]) => [
      name,
      points.map((point) => ({
        time: point.date,
        value: point.cumulative_return,
      })),
    ]),
  );
}

function toTradeMarkers(entries: TradeLogEntry[] | undefined) {
  return (entries ?? []).map(({ date, action, etf_name }) => ({
    date,
    action,
    etf_name,
  }));
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return `${(value * 100).toFixed(2)}%`;
}

function formatDecimal(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return value.toFixed(2);
}

function ComparisonTable({ rows }: { rows: ComparisonSummaryItem[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-border bg-surface px-md py-sm text-sm text-inkSecondary">
        데이터 없음
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border bg-surface shadow-panel">
      <table className="min-w-[640px] w-full border-collapse text-sm">
        <thead className="bg-surfaceMuted text-xs font-semibold text-inkSecondary">
          <tr className="border-b border-border">
            <th className="px-sm py-sm text-left">포트폴리오</th>
            <th className="px-sm py-sm text-right">CAGR</th>
            <th className="px-sm py-sm text-right">MDD</th>
            <th className="px-sm py-sm text-right">샤프</th>
            <th className="px-sm py-sm text-right">칼마</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border text-ink">
          {rows.map((row) => (
            <tr key={row.portfolio_name}>
              <td className="whitespace-nowrap px-sm py-sm font-medium">
                {row.portfolio_name}
              </td>
              <td className="px-sm py-sm text-right font-numeric tabular-nums">
                {formatPercent(row.cagr)}
              </td>
              <td className="px-sm py-sm text-right font-numeric tabular-nums">
                {formatPercent(row.mdd)}
              </td>
              <td className="px-sm py-sm text-right font-numeric tabular-nums">
                {formatDecimal(row.sharpe)}
              </td>
              <td className="px-sm py-sm text-right font-numeric tabular-nums">
                {formatDecimal(row.calmar)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function OperationsPage() {
  const dataDateQuery = useDataDate();
  const summaryQuery = usePortfolioSummary();
  const navQuery = useBacktestNav();
  const tradeLogQuery = useTradeLog();
  const turnoverQuery = useTurnover();
  const rulesQuery = useRules();
  const monthlyQuery = useMonthlyReturns();
  const comparisonSummaryQuery = useComparisonSummary();
  const comparisonNavQuery = useComparisonNav();
  const holdingsQuery = useCurrentHoldings();

  const navData = useMemo(() => toNavSeries(navQuery.data), [navQuery.data]);
  const drawdownData = useMemo(() => toDrawdownSeries(navQuery.data), [navQuery.data]);
  const monthlyData = useMemo(() => toMonthlySeries(monthlyQuery.data), [monthlyQuery.data]);
  const comparisonSeries = useMemo(
    () => toComparisonSeries(comparisonNavQuery.data),
    [comparisonNavQuery.data],
  );
  const tradeMarkers = useMemo(
    () => toTradeMarkers(tradeLogQuery.data),
    [tradeLogQuery.data],
  );

  return (
    <div className="mx-auto max-w-7xl space-y-xl">
      <div className="space-y-xs">
        <h1 className="text-2xl font-semibold text-ink">운용현황</h1>
        <StatusBar date={dataDateQuery.data?.date ?? ""} />
      </div>

      <Section title="핵심 지표">
        <SectionState isLoading={summaryQuery.isLoading} isError={summaryQuery.isError}>
          <KpiStrip summary={summaryQuery.data ?? null} />
        </SectionState>
      </Section>

      <Section title="NAV와 Drawdown">
        <SectionState
          isLoading={navQuery.isLoading || tradeLogQuery.isLoading}
          isError={navQuery.isError}
        >
          <div className="grid grid-cols-1 gap-lg xl:grid-cols-2">
            <div className="space-y-xs rounded-md border border-border bg-surface p-md shadow-panel">
              <h3 className="text-sm font-semibold text-ink">NAV (기준 100)</h3>
              <NavChart data={navData} tradeMarkers={tradeMarkers} />
            </div>
            <div className="space-y-xs rounded-md border border-border bg-surface p-md shadow-panel">
              <h3 className="text-sm font-semibold text-ink">Drawdown (%)</h3>
              <DrawdownChart data={drawdownData} />
            </div>
          </div>
        </SectionState>
      </Section>

      <Section title="회전율">
        <SectionState isLoading={turnoverQuery.isLoading} isError={turnoverQuery.isError}>
          <TurnoverRow turnover={turnoverQuery.data ?? null} />
        </SectionState>
      </Section>

      <Section title="투자 규칙">
        <SectionState isLoading={rulesQuery.isLoading} isError={rulesQuery.isError}>
          <RuleBadge rules={rulesQuery.data ?? null} />
        </SectionState>
      </Section>

      <Section title="월간 수익률">
        <SectionState isLoading={monthlyQuery.isLoading} isError={monthlyQuery.isError}>
          <div className="rounded-md border border-border bg-surface p-md shadow-panel">
            <MonthlyBarChart data={monthlyData} />
          </div>
        </SectionState>
      </Section>

      <Section title="포트폴리오 비교">
        <SectionState
          isLoading={comparisonNavQuery.isLoading || comparisonSummaryQuery.isLoading}
          isError={comparisonNavQuery.isError || comparisonSummaryQuery.isError}
        >
          <div className="space-y-md">
            <div className="rounded-md border border-border bg-surface p-md shadow-panel">
              <ComparisonChart series={comparisonSeries} />
            </div>
            <ComparisonTable rows={comparisonSummaryQuery.data ?? []} />
          </div>
        </SectionState>
      </Section>

      <Section title="현재 보유 종목">
        <SectionState isLoading={holdingsQuery.isLoading} isError={holdingsQuery.isError}>
          <HoldingsTable holdings={holdingsQuery.data ?? []} />
        </SectionState>
      </Section>
    </div>
  );
}
