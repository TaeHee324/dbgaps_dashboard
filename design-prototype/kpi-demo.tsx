// ============================================================
// DBGAPS — KPI 섹션 디자인 Demo
// claude.ai 채팅창에 이 파일 전체를 붙여넣고
// "이 컴포넌트 디자인을 개선해줘" 라고 요청하세요.
// ============================================================

// ── 디자인 토큰 (실제 프로젝트 값과 동일) ──────────────────
const tokens = {
  bg:          "#F8FAFC",
  surface:     "#FFFFFF",
  surfaceMuted:"#F6F9FC",
  ink:         "#0D253D",
  inkSecondary:"#64748B",
  inkMuted:    "#94A3B8",
  border:      "#E2E8F0",
  primary:     "#533AFD",
  success:     "#16A34A",
  danger:      "#DC2626",
  shadow:      "0 1px 2px rgba(15,23,42,0.06)",
};

// ── Mock 데이터 (실제 API 응답 형태와 동일) ──────────────────
const mockSummary = {
  cagr:              0.1243,
  mdd:              -0.0821,
  sharpe:            1.34,
  cumulative_return: 0.4521,
  annual_volatility: 0.0923,
  win_rate:          0.6200,
  calmar:            1.51,
};

const mockDate = "2025-05-23";

// ── 유틸 함수 ────────────────────────────────────────────────
function fmt(value, format) {
  if (value === null || value === undefined || !isFinite(value)) return "-";
  if (format === "percent") return `${(value * 100).toFixed(2)}%`;
  return value.toFixed(2);
}

// ── StatusBar 컴포넌트 ────────────────────────────────────────
function StatusBar({ date }) {
  return (
    <div style={{
      display: "inline-flex",
      alignItems: "center",
      padding: "4px 12px",
      borderRadius: 6,
      border: `1px solid ${tokens.border}`,
      background: tokens.surface,
      boxShadow: tokens.shadow,
      fontSize: 11,
      fontWeight: 500,
      color: tokens.inkSecondary,
    }}>
      {date ? `기준일: ${date}` : "데이터 없음"}
    </div>
  );
}

// ── KPI 카드 1개 ─────────────────────────────────────────────
function KpiCard({ label, value, format }) {
  const formatted = fmt(value, format);
  const isNegative = typeof value === "number" && value < 0;
  const valueColor = label === "MDD"
    ? tokens.danger
    : tokens.ink;

  return (
    <div style={{
      padding: "12px 16px",
      borderRadius: 8,
      border: `1px solid ${tokens.border}`,
      background: tokens.surface,
      boxShadow: tokens.shadow,
    }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: tokens.inkSecondary }}>
        {label}
      </div>
      <div style={{
        marginTop: 4,
        fontSize: 22,
        fontWeight: 600,
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "-0.01em",
        color: valueColor,
      }}>
        {formatted}
      </div>
    </div>
  );
}

// ── KpiStrip (홈 버전: 3개 카드) ─────────────────────────────
function KpiStrip({ summary }) {
  const items = [
    { key: "cagr",   label: "CAGR",  format: "percent" },
    { key: "mdd",    label: "MDD",   format: "percent" },
    { key: "sharpe", label: "샤프",  format: "decimal" },
  ];

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: 8,
    }}>
      {items.map(item => (
        <KpiCard
          key={item.key}
          label={item.label}
          value={summary[item.key]}
          format={item.format}
        />
      ))}
    </div>
  );
}

// ── 섹션 래퍼 ────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: tokens.ink }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

// ── 메인 데모 페이지 ─────────────────────────────────────────
export default function Demo() {
  return (
    <div style={{
      minHeight: "100vh",
      background: tokens.bg,
      fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
      padding: "32px 24px",
    }}>
      <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>

        {/* 헤더 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: tokens.ink }}>
            DBGAPS
          </h1>
          <StatusBar date={mockDate} />
        </div>

        {/* 핵심 지표 */}
        <Section title="핵심 지표">
          <KpiStrip summary={mockSummary} />
        </Section>

        {/* 차트 플레이스홀더 (실제로는 TradingView 라이브러리 사용) */}
        <Section title="NAV와 Drawdown">
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
          }}>
            {["NAV (기준 100)", "Drawdown (%)"].map(label => (
              <div key={label} style={{
                padding: "12px 16px",
                borderRadius: 8,
                border: `1px solid ${tokens.border}`,
                background: tokens.surface,
                boxShadow: tokens.shadow,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: tokens.ink }}>{label}</div>
                <div style={{
                  height: 120,
                  background: tokens.surfaceMuted,
                  borderRadius: 6,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  color: tokens.inkMuted,
                }}>
                  차트 영역 (TradingView)
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* 운용 전략 플레이스홀더 */}
        <Section title="운용 전략">
          <div style={{
            borderRadius: 8,
            border: `1px solid ${tokens.border}`,
            background: tokens.surface,
            boxShadow: tokens.shadow,
            overflow: "hidden",
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: tokens.surfaceMuted, borderBottom: `1px solid ${tokens.border}` }}>
                  <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 11, fontWeight: 600, color: tokens.inkSecondary }}>코드</th>
                  <th style={{ padding: "8px 12px", textAlign: "right", fontSize: 11, fontWeight: 600, color: tokens.inkSecondary }}>비중</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { code: "069500", weight: "20.0%" },
                  { code: "114820", weight: "18.5%" },
                  { code: "kodex200", weight: "15.0%" },
                ].map(row => (
                  <tr key={row.code} style={{ borderBottom: `1px solid ${tokens.border}` }}>
                    <td style={{ padding: "8px 12px", fontFamily: "monospace", fontSize: 12, fontWeight: 600, color: tokens.primary }}>{row.code}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{row.weight}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

      </div>
    </div>
  );
}
