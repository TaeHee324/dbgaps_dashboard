import type { Holding } from "@/lib/hooks/dashboard";

type HoldingsTableProps = {
  holdings: Holding[];
};

function fmt(value: number | null | undefined, fractionDigits = 0) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toLocaleString("ko-KR", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

function fmtPct(value: number | null | undefined, fractionDigits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(fractionDigits)}%`;
}

const TH_STYLE: React.CSSProperties = {
  padding: "8px 12px",
  fontSize: 10.5,
  fontWeight: 600,
  fontFamily: "JetBrains Mono, monospace",
  color: "#8595A6",
  textTransform: "uppercase",
  letterSpacing: "0.09em",
  background: "#F7F9FC",
  borderBottom: "1px solid #E4E9EF",
  whiteSpace: "nowrap",
};

export function HoldingsTable({ holdings }: HoldingsTableProps) {
  if (holdings.length === 0) {
    return (
      <div className="px-md py-sm text-sm text-inkSecondary">보유 종목 없음</div>
    );
  }

  const sorted = [...holdings].sort((a, b) => b.current_weight - a.current_weight);
  const maxWeight = Math.max(...sorted.map((h) => h.current_weight));

  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          minWidth: 900,
          borderCollapse: "collapse",
          fontSize: 12.5,
        }}
      >
        <thead>
          <tr>
            <th style={{ ...TH_STYLE, textAlign: "left" }}>코드</th>
            <th style={{ ...TH_STYLE, textAlign: "left" }}>종목명</th>
            <th style={{ ...TH_STYLE, textAlign: "left" }}>구분</th>
            <th style={{ ...TH_STYLE, textAlign: "right" }}>수량</th>
            <th style={{ ...TH_STYLE, textAlign: "right" }}>현재가</th>
            <th style={{ ...TH_STYLE, textAlign: "right" }}>평가금액</th>
            <th style={{ ...TH_STYLE, textAlign: "right" }}>손익</th>
            <th style={{ ...TH_STYLE, textAlign: "right" }}>수익률</th>
            <th style={{ ...TH_STYLE, textAlign: "right", minWidth: 120 }}>비중</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((h) => {
            const pnlColor =
              h.unrealized_pnl > 0 ? "#0F7A3D" : h.unrealized_pnl < 0 ? "#A4232B" : "#0B1B2C";
            const retColor =
              h.unrealized_return > 0 ? "#0F7A3D" : h.unrealized_return < 0 ? "#A4232B" : "#0B1B2C";
            const barPct = (h.current_weight / maxWeight) * 100;

            return (
              <tr
                key={h.code}
                style={{ borderBottom: "1px solid #EFF2F6" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "#F7F9FC")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                {/* 코드 */}
                <td style={{ padding: "8px 12px" }}>
                  <span
                    style={{
                      fontFamily: "JetBrains Mono, monospace",
                      fontWeight: 600,
                      color: "#3F2EE0",
                      fontSize: 12,
                      letterSpacing: "0.02em",
                    }}
                  >
                    {h.code}
                  </span>
                </td>

                {/* 종목명 */}
                <td
                  style={{
                    padding: "8px 12px",
                    color: "#0B1B2C",
                    maxWidth: 200,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {h.name}
                </td>

                {/* 구분 */}
                <td style={{ padding: "8px 12px" }}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "1px 6px",
                      borderRadius: 3,
                      fontSize: 10.5,
                      fontFamily: "JetBrains Mono, monospace",
                      background: "#F7F9FC",
                      color: "#46586B",
                      border: "1px solid #E4E9EF",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h.asset_class || h.risk_type}
                  </span>
                </td>

                {/* 수량 */}
                <td
                  style={{
                    padding: "8px 12px",
                    textAlign: "right",
                    fontFamily: "JetBrains Mono, monospace",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {fmt(h.quantity)}
                </td>

                {/* 현재가 */}
                <td
                  style={{
                    padding: "8px 12px",
                    textAlign: "right",
                    fontFamily: "JetBrains Mono, monospace",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {fmt(h.current_price)}
                </td>

                {/* 평가금액 */}
                <td
                  style={{
                    padding: "8px 12px",
                    textAlign: "right",
                    fontFamily: "JetBrains Mono, monospace",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {fmt(h.market_value)}
                </td>

                {/* 손익 */}
                <td
                  style={{
                    padding: "8px 12px",
                    textAlign: "right",
                    fontFamily: "JetBrains Mono, monospace",
                    fontVariantNumeric: "tabular-nums",
                    fontWeight: 600,
                    color: pnlColor,
                  }}
                >
                  {fmt(h.unrealized_pnl)}
                </td>

                {/* 수익률 */}
                <td
                  style={{
                    padding: "8px 12px",
                    textAlign: "right",
                    fontFamily: "JetBrains Mono, monospace",
                    fontVariantNumeric: "tabular-nums",
                    fontWeight: 600,
                    color: retColor,
                  }}
                >
                  {fmtPct(h.unrealized_return)}
                </td>

                {/* 비중 — 바 차트 내장 */}
                <td style={{ padding: "8px 12px", position: "relative", minWidth: 120 }}>
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: "56%",
                      height: 6,
                      background: "#EEEBFE",
                      borderRadius: 2,
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${barPct}%`,
                        background: "#3F2EE0",
                        borderRadius: 2,
                        opacity: 0.85,
                      }}
                    />
                  </div>
                  <span
                    style={{
                      position: "relative",
                      display: "block",
                      textAlign: "right",
                      fontFamily: "JetBrains Mono, monospace",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {fmtPct(h.current_weight, 1)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
