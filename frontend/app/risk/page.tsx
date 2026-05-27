"use client";

import { useMemo } from "react";
import {
  useActualNav,
  useRiskPortfolio,
  useEtfRiskAnalysis,
  type EtfRiskItem,
} from "@/lib/hooks/dashboard";
import { computeActualOpsMetrics } from "@/lib/utils/metrics";

// ─── Design tokens ───────────────────────────────────────────────────────────
const C = {
  ink: "#0D253D",
  inkSecondary: "#64748B",
  border: "#E2E8F0",
  surface: "#FFFFFF",
  surfaceMuted: "#F6F9FC",
  success: "#16A34A",
  successBg: "#DCFCE7",
  warning: "#D97706",
  warningBg: "#FEF3C7",
  danger: "#DC2626",
  dangerBg: "#FEE2E2",
  orange: "#EA580C",
  orangeBg: "#FFEDD5",
  primary: "#533AFD",
  primaryBg: "#EDE9FF",
} as const;

const PANEL: React.CSSProperties = {
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: 6,
  boxShadow: "0 1px 0 rgba(11,27,44,.04), 0 1px 2px rgba(11,27,44,.04)",
};

const MONO: React.CSSProperties = { fontFamily: "JetBrains Mono, monospace" };

// ─── Helpers ─────────────────────────────────────────────────────────────────
function pct(v: number | null | undefined, decimals = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(decimals)}%`;
}

function pctP(v: number | null | undefined, decimals = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const s = (v * 100).toFixed(decimals);
  return v > 0 ? `+${s}%p` : `${s}%p`;
}

// ─── MDD badge ───────────────────────────────────────────────────────────────
function mddStage(mdd: number | null | undefined): { label: string; color: string; bg: string } {
  const a = mdd !== null && mdd !== undefined ? Math.abs(mdd) : 0;
  if (a < 0.10) return { label: "정상", color: C.success, bg: C.successBg };
  if (a < 0.15) return { label: "경고", color: C.warning, bg: C.warningBg };
  if (a < 0.20) return { label: "위험", color: C.orange, bg: C.orangeBg };
  return { label: "재검토", color: C.danger, bg: C.dangerBg };
}

function volStage(vol: number | null | undefined): { label: string; color: string; bg: string } {
  const v = vol ?? 0;
  if (v < 0.15) return { label: "안정", color: C.success, bg: C.successBg };
  if (v < 0.25) return { label: "보통", color: C.warning, bg: C.warningBg };
  return { label: "높음", color: C.danger, bg: C.dangerBg };
}

function healthStage(status: string): { color: string; bg: string } {
  if (status === "정상") return { color: C.success, bg: C.successBg };
  if (status === "주의") return { color: C.warning, bg: C.warningBg };
  return { color: C.danger, bg: C.dangerBg };
}

function hhhStage(label: string): { color: string; bg: string } {
  if (label === "분산양호") return { color: C.success, bg: C.successBg };
  if (label === "보통") return { color: C.warning, bg: C.warningBg };
  return { color: C.danger, bg: C.dangerBg };
}

function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span
      style={{
        ...MONO,
        fontSize: 10,
        fontWeight: 700,
        color,
        background: bg,
        border: `1px solid ${color}33`,
        borderRadius: 3,
        padding: "1px 6px",
        letterSpacing: "0.04em",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

// ─── Summary Card ─────────────────────────────────────────────────────────────
function SummaryCard({
  title,
  badge,
  value,
  sub,
  accentColor,
  children,
}: {
  title: string;
  badge: React.ReactNode;
  value: React.ReactNode;
  sub?: string;
  accentColor: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      style={{
        ...PANEL,
        borderLeft: `4px solid ${accentColor}`,
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: C.ink, letterSpacing: "-0.005em" }}>
          {title}
        </span>
        {badge}
      </div>
      <div
        style={{
          ...MONO,
          fontSize: 22,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          fontVariantNumeric: "tabular-nums",
          color: C.ink,
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      {children}
      {sub && (
        <div style={{ ...MONO, fontSize: 11, color: C.inkSecondary }}>{sub}</div>
      )}
    </div>
  );
}

// ─── Rebalancing Banner ───────────────────────────────────────────────────────
function RebalancingBanner({ items }: { items: EtfRiskItem[] }) {
  const drifters = items.filter(
    (x) => x.target_weight !== null && x.weight_drift !== null && Math.abs(x.weight_drift!) >= 0.05
  );
  if (drifters.length === 0) return null;

  return (
    <div
      style={{
        background: "#FFFBEB",
        border: `1px solid #FCD34D`,
        borderRadius: 6,
        padding: "12px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#92400E" }}>
        ⚠ 리밸런싱 검토 필요
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {drifters.map((x) => {
          const over = (x.weight_drift ?? 0) > 0;
          return (
            <span
              key={x.code}
              style={{ ...MONO, fontSize: 11.5, color: over ? C.danger : C.warning }}
            >
              {x.name} {pctP(x.weight_drift)} {over ? "↑" : "↓"}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ─── ETF Risk Table ───────────────────────────────────────────────────────────
function drawdownCellStyle(dd: number): React.CSSProperties {
  if (dd < -0.15) return { background: C.dangerBg, color: C.danger };
  if (dd < -0.10) return { background: C.warningBg, color: C.warning };
  return { color: C.inkSecondary };
}

function driftCell(drift: number | null): { text: string; color: string } {
  if (drift === null || !Number.isFinite(drift)) return { text: "—", color: C.inkSecondary };
  const abs = Math.abs(drift);
  if (drift >= 0.05) return { text: `▲ ${pctP(drift)}`, color: C.danger };
  if (drift <= -0.05) return { text: `▼ ${pctP(drift)}`, color: C.warning };
  return { text: pctP(drift), color: C.inkSecondary };
}

function EtfRiskTable({ items }: { items: EtfRiskItem[] }) {
  if (items.length === 0) {
    return (
      <div style={{ ...MONO, padding: "12px 14px", fontSize: 12, color: C.inkSecondary }}>
        보유 ETF 없음
      </div>
    );
  }

  const TH: React.CSSProperties = {
    ...MONO,
    fontSize: 10,
    fontWeight: 700,
    color: C.inkSecondary,
    textTransform: "uppercase" as const,
    letterSpacing: "0.07em",
    padding: "8px 12px",
    whiteSpace: "nowrap" as const,
    borderBottom: `1px solid ${C.border}`,
    background: C.surfaceMuted,
    textAlign: "right" as const,
  };

  const TD_BASE: React.CSSProperties = {
    ...MONO,
    fontSize: 12,
    fontVariantNumeric: "tabular-nums",
    padding: "9px 12px",
    borderBottom: `1px solid ${C.border}`,
    textAlign: "right" as const,
    whiteSpace: "nowrap" as const,
  };

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ ...TH, textAlign: "left" }}>ETF</th>
            <th style={TH}>현재비중</th>
            <th style={TH}>목표비중</th>
            <th style={TH}>이탈폭</th>
            <th style={TH}>개별 MDD</th>
            <th style={TH}>현재낙폭</th>
            <th style={TH}>20일 변동성</th>
            <th style={TH}>위험기여도</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const rowBg = item.current_drawdown < -0.15 ? "#FFF1F2" : "transparent";
            const dd = driftCell(item.weight_drift);
            const ddStyle = drawdownCellStyle(item.current_drawdown);
            const rcOverweight =
              item.risk_contribution_pct !== null &&
              item.current_weight > 0 &&
              item.risk_contribution_pct > item.current_weight * 2;

            return (
              <tr key={item.code} style={{ background: rowBg }}>
                <td
                  style={{
                    ...TD_BASE,
                    textAlign: "left",
                    maxWidth: 200,
                  }}
                >
                  <div style={{ fontWeight: 600, color: C.ink, fontSize: 12 }}>{item.name}</div>
                  <div style={{ fontSize: 10, color: C.inkSecondary }}>{item.code}</div>
                </td>
                <td style={{ ...TD_BASE, color: C.ink }}>{pct(item.current_weight)}</td>
                <td style={{ ...TD_BASE, color: C.inkSecondary }}>
                  {item.target_weight !== null ? pct(item.target_weight) : "—"}
                </td>
                <td style={{ ...TD_BASE, color: dd.color }}>{dd.text}</td>
                <td style={{ ...TD_BASE, color: C.danger }}>{pct(item.individual_mdd)}</td>
                <td
                  style={{
                    ...TD_BASE,
                    ...ddStyle,
                    borderRadius: ddStyle.background ? 3 : 0,
                  }}
                >
                  {pct(item.current_drawdown)}
                </td>
                <td style={{ ...TD_BASE, color: C.inkSecondary }}>{pct(item.vol_20d)}</td>
                <td
                  style={{
                    ...TD_BASE,
                    background: rcOverweight ? C.warningBg : undefined,
                    color: rcOverweight ? C.warning : C.inkSecondary,
                  }}
                  title={rcOverweight ? "비중 대비 위험 집중" : undefined}
                >
                  {item.risk_contribution_pct !== null
                    ? `${(item.risk_contribution_pct * 100).toFixed(1)}%${rcOverweight ? " !" : ""}`
                    : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function RiskPage() {
  const actualNavQuery = useActualNav();
  const riskPortfolioQuery = useRiskPortfolio();
  const etfRiskQuery = useEtfRiskAnalysis();

  const actualOpsMetrics = useMemo(
    () => computeActualOpsMetrics(actualNavQuery.data ?? []),
    [actualNavQuery.data]
  );

  const mdd = actualOpsMetrics?.mdd ?? null;
  const mddDuration = actualOpsMetrics?.mdd_duration ?? null;
  const vol = actualOpsMetrics?.annual_volatility ?? null;
  const mddS = mddStage(mdd);
  const volS = volStage(vol);

  const rp = riskPortfolioQuery.data;
  const hhi = rp?.hhi ?? null;
  const hhiLabel = rp?.hhi_label ?? "—";
  const hhiS = rp ? hhhStage(hhiLabel) : { color: C.inkSecondary, bg: C.surfaceMuted };
  const health = rp?.data_health;
  const healthS = health ? healthStage(health.status) : { color: C.inkSecondary, bg: C.surfaceMuted };

  const etfItems = etfRiskQuery.data ?? [];

  // MDD 체류 since date 계산 (actualNavQuery에서 trough 직전 최고점 찾기)
  const mddSinceDate = useMemo(() => {
    const points = actualNavQuery.data;
    if (!points || points.length === 0) return null;
    let troughIdx = 0;
    let minDD = 0;
    for (let i = 0; i < points.length; i++) {
      if (points[i].drawdown < minDD) {
        minDD = points[i].drawdown;
        troughIdx = i;
      }
    }
    if (minDD >= 0) return null;
    for (let i = troughIdx; i >= 0; i--) {
      if (points[i].drawdown >= 0) return points[i].date;
    }
    return points[0].date;
  }, [actualNavQuery.data]);

  return (
    <div style={{ maxWidth: 1320, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
      {/* 헤더 */}
      <h1
        style={{
          margin: 0,
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: "-0.01em",
          color: C.ink,
        }}
      >
        리스크 관리
      </h1>

      {/* 섹션 1 — 리스크 요약 카드 4개 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {/* MDD 카드 */}
        <SummaryCard
          title="MDD"
          badge={<Badge label={mddS.label} color={mddS.color} bg={mddS.bg} />}
          value={<span style={{ color: C.danger }}>{pct(mdd)}</span>}
          accentColor={mddS.color}
        >
          {mddDuration !== null && mddDuration > 0 && (
            <div style={{ ...MONO, fontSize: 11, color: C.inkSecondary }}>
              체류 {mddDuration}일
              {mddSinceDate && ` · since ${mddSinceDate}`}
            </div>
          )}
        </SummaryCard>

        {/* HHI 집중도 카드 */}
        <SummaryCard
          title="집중도 (HHI)"
          badge={
            rp ? (
              <Badge label={hhiLabel} color={hhiS.color} bg={hhiS.bg} />
            ) : (
              <span style={{ ...MONO, fontSize: 10, color: C.inkSecondary }}>—</span>
            )
          }
          value={hhi !== null ? hhi.toFixed(3) : "—"}
          accentColor={hhiS.color}
        >
          {hhi !== null && (
            <div>
              <div
                style={{
                  height: 6,
                  background: C.border,
                  borderRadius: 3,
                  overflow: "hidden",
                  marginBottom: 4,
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${Math.min((hhi / 0.25) * 100, 100)}%`,
                    background: hhiS.color,
                    borderRadius: 3,
                    transition: "width 0.3s",
                  }}
                />
              </div>
              <div style={{ ...MONO, fontSize: 10, color: C.inkSecondary }}>0 ─────────────── 0.25</div>
            </div>
          )}
        </SummaryCard>

        {/* 연환산 변동성 카드 */}
        <SummaryCard
          title="연환산 변동성"
          badge={<Badge label={volS.label} color={volS.color} bg={volS.bg} />}
          value={pct(vol)}
          sub="전체 운용기간 기준"
          accentColor={volS.color}
        />

        {/* 데이터 헬스 카드 */}
        <SummaryCard
          title="데이터 헬스"
          badge={
            health ? (
              <Badge label={health.status} color={healthS.color} bg={healthS.bg} />
            ) : (
              <span style={{ ...MONO, fontSize: 10, color: C.inkSecondary }}>—</span>
            )
          }
          value={
            <span style={{ ...MONO, fontSize: 18 }}>
              {health?.latest_price_date ?? "—"}
            </span>
          }
          sub={
            health
              ? `${health.business_days_stale} 영업일 경과`
              : undefined
          }
          accentColor={healthS.color}
        />
      </div>

      {/* 리밸런싱 경고 배너 */}
      {etfItems.length > 0 && <RebalancingBanner items={etfItems} />}

      {/* 섹션 2 — ETF별 리스크 테이블 */}
      <div style={PANEL}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 14px",
            borderBottom: `1px solid ${C.border}`,
            background: C.surfaceMuted,
          }}
        >
          <span style={{ fontSize: 12.5, fontWeight: 700, color: C.ink, letterSpacing: "-0.005em" }}>
            ETF별 리스크 분석
          </span>
          <span style={{ ...MONO, fontSize: 10.5, color: C.inkSecondary }}>
            위험기여도 내림차순
          </span>
        </div>
        {etfRiskQuery.isLoading ? (
          <div style={{ ...MONO, padding: "12px 14px", fontSize: 12, color: C.inkSecondary }}>
            로딩 중...
          </div>
        ) : (
          <EtfRiskTable items={etfItems} />
        )}
      </div>
    </div>
  );
}
