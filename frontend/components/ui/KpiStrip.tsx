import type { PortfolioSummary } from "@/lib/hooks/dashboard";

type KpiStripProps = {
  summary: PortfolioSummary;
};

type KpiItem = {
  key: keyof NonNullable<PortfolioSummary>;
  label: string;
  hint: string;
  format: "percent" | "decimal";
  decimals?: number;
  downIsGood?: boolean;
};

const kpis: KpiItem[] = [
  { key: "cagr",              label: "CAGR",    hint: "연환산 복리수익률",        format: "percent" },
  { key: "mdd",               label: "MDD",     hint: "최대낙폭",                format: "percent", downIsGood: true },
  { key: "sharpe",            label: "샤프",    hint: "위험조정 수익률",          format: "decimal" },
  { key: "cumulative_return", label: "누적수익", hint: "기준일까지 누적 총수익률", format: "percent" },
  { key: "annual_volatility", label: "변동성",  hint: "연환산 표준편차",          format: "percent", downIsGood: true },
  { key: "win_rate",          label: "승률",    hint: "일간 양의 수익률 비율",    format: "percent", decimals: 1 },
  { key: "calmar",            label: "칼마",    hint: "CAGR / |MDD|",           format: "decimal" },
];

function fmtValue(value: number | null | undefined, format: KpiItem["format"], decimals = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  if (format === "percent") return `${(value * 100).toFixed(decimals)}%`;
  return value.toFixed(decimals);
}

function valueColor(item: KpiItem, value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "#46586B";
  if (item.key === "mdd") return "#A4232B";
  return "#0B1B2C";
}

export function KpiStrip({ summary }: KpiStripProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(7, 1fr)",
        background: "#FFFFFF",
        border: "1px solid #E4E9EF",
        borderRadius: 6,
        boxShadow: "0 1px 0 rgba(11,27,44,.04), 0 1px 2px rgba(11,27,44,.04)",
        overflow: "hidden",
      }}
    >
      {kpis.map((item, idx) => {
        const value = summary?.[item.key] as number | null | undefined;
        const display = fmtValue(value, item.format, item.decimals ?? 2);
        return (
          <div
            key={item.key}
            style={{
              padding: "14px 16px 12px",
              borderRight: idx < kpis.length - 1 ? "1px solid #EFF2F6" : "none",
              display: "flex",
              flexDirection: "column",
              gap: 4,
              minWidth: 0,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: 10.5,
                fontWeight: 600,
                fontFamily: "JetBrains Mono, monospace",
                color: "#8595A6",
                textTransform: "uppercase",
                letterSpacing: "0.09em",
              }}
            >
              <span>{item.label}</span>
              <span
                title={item.hint}
                style={{
                  display: "inline-grid",
                  placeItems: "center",
                  width: 13,
                  height: 13,
                  border: "1px solid #E4E9EF",
                  borderRadius: "50%",
                  fontSize: 9,
                  color: "#B6C1CC",
                  cursor: "help",
                  background: "#F7F9FC",
                  flexShrink: 0,
                }}
              >
                ?
              </span>
            </div>
            <div
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: 22,
                fontWeight: 600,
                letterSpacing: "-0.02em",
                fontVariantNumeric: "tabular-nums",
                color: valueColor(item, value),
                lineHeight: 1.1,
              }}
            >
              {display}
            </div>
          </div>
        );
      })}
    </div>
  );
}
