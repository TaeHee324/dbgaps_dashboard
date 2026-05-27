import type { ActualOpsMetrics } from "@/lib/utils/metrics";

type Props = {
  metrics: ActualOpsMetrics;
  since?: string;
};

type KpiItem = {
  key: keyof NonNullable<ActualOpsMetrics>;
  label: string;
  hint: string;
  format: "percent" | "days";
  decimals?: number;
};

const kpis: KpiItem[] = [
  { key: "cumulative_return", label: "누적수익률", hint: "기준일까지 누적 총수익률",        format: "percent" },
  { key: "mdd",               label: "MDD",       hint: "최대낙폭 (실제 운용 기간)",        format: "percent" },
  { key: "win_rate",          label: "일간승률",   hint: "일간 양의 수익률 비율",            format: "percent", decimals: 1 },
  { key: "annual_volatility", label: "연환산 변동성", hint: "연환산 표준편차 (실제 거래)",   format: "percent" },
  { key: "mdd_duration",      label: "MDD기간",   hint: "최대낙폭 발생~회복 기간 (캘린더일)", format: "days" },
];

function fmtValue(value: number | null | undefined, format: KpiItem["format"], decimals = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  if (format === "percent") return `${(value * 100).toFixed(decimals)}%`;
  return `${Math.round(value)}일`;
}

function valueColor(key: KpiItem["key"], value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "#46586B";
  if (key === "mdd") return "#A4232B";
  if (key === "cumulative_return") return value >= 0 ? "#0F5132" : "#A4232B";
  return "#0B1B2C";
}

export function ActualOpsKpiStrip({ metrics, since }: Props) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E4E9EF",
        borderRadius: 6,
        boxShadow: "0 1px 0 rgba(11,27,44,.04), 0 1px 2px rgba(11,27,44,.04)",
        overflow: "hidden",
      }}
    >
      {/* 헤더 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 16px",
          borderBottom: "1px solid #E4E9EF",
          background: "#F7F9FC",
        }}
      >
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 700,
            color: "#0B1B2C",
            letterSpacing: "-0.005em",
          }}
        >
          실제 운용 성과
        </span>
        {since && (
          <span
            style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: 10.5,
              color: "#8595A6",
            }}
          >
            since {since}
          </span>
        )}
        <span
          style={{
            marginLeft: "auto",
            fontSize: 10,
            fontWeight: 600,
            color: "#0F5132",
            background: "#D1FAE5",
            border: "1px solid #A7F3D0",
            borderRadius: 3,
            padding: "1px 6px",
            fontFamily: "JetBrains Mono, monospace",
            letterSpacing: "0.04em",
          }}
        >
          실제 거래 기반
        </span>
      </div>

      {/* KPI 그리드 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
        }}
      >
        {kpis.map((item, idx) => {
          const value = metrics?.[item.key] as number | null | undefined;
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
                  color: valueColor(item.key, value),
                  lineHeight: 1.1,
                }}
              >
                {display}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
