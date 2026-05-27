import type { StrategyMetrics } from "@/lib/utils/metrics";

export type StrategyPeriod = "1Y" | "6M" | "3M";

type Props = {
  metrics: StrategyMetrics;
  period: StrategyPeriod;
  onPeriodChange: (p: StrategyPeriod) => void;
};

type KpiItem = {
  key: keyof NonNullable<StrategyMetrics>;
  label: string;
  hint: string;
  format: "percent" | "decimal";
  decimals?: number;
  lowConfidence3M?: boolean;
};

const kpis: KpiItem[] = [
  { key: "cagr",            label: "CAGR",    hint: "연환산 복리수익률 (백테스트)",            format: "percent" },
  { key: "sharpe",          label: "샤프",     hint: "위험조정 수익률 (rf=0)",                format: "decimal", lowConfidence3M: true },
  { key: "calmar",          label: "칼마",     hint: "CAGR / |MDD|",                         format: "decimal" },
  { key: "sortino",         label: "소르티노", hint: "하방 변동성 조정 수익률",                 format: "decimal", lowConfidence3M: true },
  { key: "win_rate_monthly",label: "월별승률", hint: "월간 양의 수익률 비율",                   format: "percent", decimals: 1 },
  { key: "var_95",          label: "VaR 95%", hint: "95% 신뢰도 하루 최대 예상 손실 (백테스트)", format: "percent" },
];

const PERIODS: StrategyPeriod[] = ["1Y", "6M", "3M"];

function fmtValue(value: number | null | undefined, format: KpiItem["format"], decimals = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  if (format === "percent") return `${(value * 100).toFixed(decimals)}%`;
  return value.toFixed(decimals);
}

function valueColor(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "#46586B";
  return "#0B1B2C";
}

export function StrategyKpiStrip({ metrics, period, onPeriodChange }: Props) {
  const show3MWarning = period === "3M";

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
          전략 특성
        </span>
        <span
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 10.5,
            color: "#8595A6",
          }}
        >
          현재 포트폴리오 백테스트
        </span>
        <span
          style={{
            marginLeft: "auto",
            fontSize: 10,
            fontWeight: 600,
            color: "#533AFD",
            background: "#F4F2FF",
            border: "1px solid #C4BBFC",
            borderRadius: 3,
            padding: "1px 6px",
            fontFamily: "JetBrains Mono, monospace",
            letterSpacing: "0.04em",
            marginRight: 8,
          }}
        >
          백테스트 기반
        </span>
        {/* 기간 선택 버튼 */}
        <div style={{ display: "flex", gap: 4 }}>
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => onPeriodChange(p)}
              style={{
                padding: "2px 8px",
                fontSize: 10.5,
                fontFamily: "JetBrains Mono, monospace",
                fontWeight: 600,
                color: period === p ? "#533AFD" : "#8595A6",
                background: period === p ? "#EDE9FF" : "transparent",
                border: period === p ? "1px solid #C4BBFC" : "1px solid #E4E9EF",
                borderRadius: 3,
                cursor: "pointer",
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* KPI 그리드 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
        }}
      >
        {kpis.map((item, idx) => {
          const value = metrics?.[item.key] as number | null | undefined;
          const display = fmtValue(value, item.format, item.decimals ?? 2);
          const warn = show3MWarning && item.lowConfidence3M;
          const hint = warn
            ? `${item.hint} ※ 3M=58거래일 — 추정치 신뢰도 낮음`
            : item.hint;

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
                  color: warn ? "#B45309" : "#8595A6",
                  textTransform: "uppercase",
                  letterSpacing: "0.09em",
                }}
              >
                <span>{item.label}</span>
                <span
                  title={hint}
                  style={{
                    display: "inline-grid",
                    placeItems: "center",
                    width: 13,
                    height: 13,
                    border: `1px solid ${warn ? "#FCD34D" : "#E4E9EF"}`,
                    borderRadius: "50%",
                    fontSize: 9,
                    color: warn ? "#B45309" : "#B6C1CC",
                    cursor: "help",
                    background: warn ? "#FFFBEB" : "#F7F9FC",
                    flexShrink: 0,
                  }}
                >
                  {warn ? "!" : "?"}
                </span>
              </div>
              <div
                style={{
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: 22,
                  fontWeight: 600,
                  letterSpacing: "-0.02em",
                  fontVariantNumeric: "tabular-nums",
                  color: valueColor(value),
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
