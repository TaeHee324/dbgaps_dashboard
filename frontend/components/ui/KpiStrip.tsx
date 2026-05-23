import type { PortfolioSummary } from "@/lib/hooks/dashboard";

type KpiStripProps = {
  summary: PortfolioSummary;
  variant?: "home" | "full";
};

type KpiItem = {
  key: keyof NonNullable<PortfolioSummary>;
  label: string;
  format: "percent" | "decimal";
};

const homeKpis: KpiItem[] = [
  { key: "cagr", label: "CAGR", format: "percent" },
  { key: "mdd", label: "MDD", format: "percent" },
  { key: "sharpe", label: "샤프", format: "decimal" },
];

const fullKpis: KpiItem[] = [
  { key: "cumulative_return", label: "누적수익률", format: "percent" },
  { key: "cagr", label: "CAGR", format: "percent" },
  { key: "mdd", label: "MDD", format: "percent" },
  { key: "annual_volatility", label: "연간변동성", format: "percent" },
  { key: "win_rate", label: "승률", format: "percent" },
  { key: "sharpe", label: "샤프", format: "decimal" },
  { key: "calmar", label: "칼마", format: "decimal" },
];

function formatKpiValue(value: number | null | undefined, format: KpiItem["format"]) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  if (format === "percent") {
    return `${(value * 100).toFixed(2)}%`;
  }

  return value.toFixed(2);
}

export function KpiStrip({ summary, variant = "full" }: KpiStripProps) {
  const items = variant === "home" ? homeKpis : fullKpis;
  const gridClassName =
    variant === "home"
      ? "grid grid-cols-1 gap-sm sm:grid-cols-3"
      : "grid grid-cols-1 gap-sm sm:grid-cols-2 lg:grid-cols-7";

  return (
    <section
      aria-label="포트폴리오 핵심 지표"
      className={gridClassName}
    >
      {items.map((item) => (
        <div
          key={item.key}
          className="rounded-md border border-border bg-surface px-md py-sm shadow-panel"
        >
          <div className="text-xs font-medium text-inkSecondary">{item.label}</div>
          <div className="mt-xs font-numeric text-xl font-semibold tabular-nums text-ink">
            {formatKpiValue(summary?.[item.key], item.format)}
          </div>
        </div>
      ))}
    </section>
  );
}
