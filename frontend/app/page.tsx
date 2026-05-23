"use client";

import { useMemo } from "react";
import { DrawdownChart } from "@/components/charts/DrawdownChart";
import { NavChart } from "@/components/charts/NavChart";
import { KpiStrip } from "@/components/ui/KpiStrip";
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

function toTradeMarkers(entries: TradeLogEntry[] | undefined) {
  return (entries ?? []).map(({ date, action, etf_name }) => ({
    date,
    action,
    etf_name,
  }));
}

function formatWeight(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return `${(value * 100).toFixed(1)}%`;
}

function StrategyTable({ holdings }: { holdings: PortfolioHolding[] }) {
  if (holdings.length === 0) {
    return (
      <div className="rounded-md border border-border bg-surface px-md py-sm text-sm text-inkSecondary">
        데이터 없음
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border bg-surface shadow-panel">
      <table className="min-w-[360px] border-collapse text-sm">
        <thead className="bg-surfaceMuted text-xs font-semibold text-inkSecondary">
          <tr className="border-b border-border">
            <th className="px-sm py-sm text-left">코드</th>
            <th className="px-sm py-sm text-right">비중</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border text-ink">
          {holdings.map((holding) => (
            <tr key={holding.code}>
              <td className="whitespace-nowrap px-sm py-sm font-mono text-xs font-semibold text-primary">
                {holding.code}
              </td>
              <td className="px-sm py-sm text-right font-numeric tabular-nums">
                {formatWeight(holding.weight)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
    <div className="mx-auto max-w-7xl space-y-xl">
      <div className="space-y-xs">
        <h1 className="text-2xl font-semibold text-ink">DBGAPS</h1>
        <StatusBar date={dataDateQuery.data?.date ?? ""} />
      </div>

      <Section title="핵심 지표">
        <SectionState isLoading={summaryQuery.isLoading} isError={summaryQuery.isError}>
          <KpiStrip summary={summaryQuery.data ?? null} variant="home" />
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

      <Section title="운용 전략">
        <SectionState isLoading={portfolioQuery.isLoading} isError={portfolioQuery.isError}>
          <StrategyTable holdings={portfolioQuery.data ?? []} />
        </SectionState>
      </Section>

      <Section title="시황">
        <div className="rounded-md border border-border bg-surface px-md py-sm text-sm text-inkSecondary">
          준비 중
        </div>
      </Section>
    </div>
  );
}
