"use client";

import { useLiveRules, type IndividualRule, type RiskAssetRule, type RulesResponse } from "@/lib/hooks/dashboard";

function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  return `${(value * 100).toFixed(1)}%`;
}

function PassBadge({ passed }: { passed: boolean }) {
  const cls = passed
    ? "bg-successSoft text-success border-success/20"
    : "bg-dangerSoft text-danger border-danger/20";
  return (
    <span className={`inline-flex items-center rounded-pill border px-sm py-xxs text-xs font-semibold ${cls}`}>
      {passed ? "통과" : "위반"}
    </span>
  );
}

type WeightTableProps = {
  rules: RulesResponse;
  isLoading: boolean;
};

function WeightTable({ rules, isLoading }: WeightTableProps) {
  if (isLoading) {
    return (
      <div className="px-4 py-6 text-sm text-inkSecondary">불러오는 중...</div>
    );
  }
  if (!rules) {
    return (
      <div className="px-4 py-6 text-sm text-inkSecondary">보유 종목 없음</div>
    );
  }

  const groupRows = rules.individual.filter((r) => r.code.startsWith("["));
  const etfRows = rules.individual.filter((r) => !r.code.startsWith("["));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-surfaceMuted text-xs text-inkSecondary">
          <tr>
            {["구분", "자산군 / ETF", "비중 상한", "현재 비중", "상태"].map((h, i) => (
              <th key={i} className="px-3 py-2 text-left font-medium whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          <tr className="even:bg-surfaceMuted/40">
            <td className="px-3 py-2 text-inkSecondary whitespace-nowrap">위험자산</td>
            <td className="px-3 py-2 text-ink">{rules.risk_asset.rule || "위험자산 합계"}</td>
            <td className="px-3 py-2 tabular-nums text-ink">{formatPct(rules.risk_asset.limit)}</td>
            <td className="px-3 py-2 tabular-nums text-ink">{formatPct(rules.risk_asset.risky_weight)}</td>
            <td className="px-3 py-2"><PassBadge passed={rules.risk_asset.passed} /></td>
          </tr>
          {groupRows.map((row) => (
            <tr key={row.code} className="even:bg-surfaceMuted/40">
              <td className="px-3 py-2 text-inkSecondary whitespace-nowrap">자산군</td>
              <td className="px-3 py-2 text-ink">{row.code.replace(/[\[\]]/g, "")}</td>
              <td className="px-3 py-2 tabular-nums text-ink">{formatPct(row.limit)}</td>
              <td className="px-3 py-2 tabular-nums text-ink">{formatPct(row.current_weight)}</td>
              <td className="px-3 py-2"><PassBadge passed={row.passed} /></td>
            </tr>
          ))}
          {etfRows.length === 0 && groupRows.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-3 py-4 text-center text-sm text-inkSecondary">
                보유 종목 없음
              </td>
            </tr>
          ) : null}
          {etfRows.map((row) => (
            <tr key={row.code} className="even:bg-surfaceMuted/40">
              <td className="px-3 py-2 text-inkSecondary whitespace-nowrap">개별 ETF</td>
              <td className="px-3 py-2">
                <span className="font-mono text-xs font-semibold text-primary mr-1">{row.code}</span>
                <span className="text-ink">{row.name}</span>
              </td>
              <td className="px-3 py-2 tabular-nums text-ink">{formatPct(row.limit)}</td>
              <td className="px-3 py-2 tabular-nums text-ink">{formatPct(row.current_weight)}</td>
              <td className="px-3 py-2"><PassBadge passed={row.passed} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const CAUTION_RULES = [
  "개별 ETF 편입 비중 상한 20%",
  "위험자산 전체 편입 비중 상한 70%",
  "초기 포트폴리오 회전율 80% 이상 필수 (2026.6.1 ~ 6.8)",
  "이후 월간 회전율 10% 이상 필수",
  "매매 시 이유(근거) 필수 기록",
  "ETF 외 상품 편입 금지",
];

const OPERATION_NOTES = [
  "수익률보다 설명 가능한 운용을 목표로 할 것",
  "전망이 틀렸을 때 기준(손절 기준)을 미리 정해둘 것",
  "매매 시 이유를 반드시 매매일지에 기록할 것",
  "포트폴리오 규칙(비중 상한) 준수 여부를 매매 전후 확인할 것",
];

export default function RulesPage() {
  const { data: rules, isLoading } = useLiveRules();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-ink">대회 룰</h1>

      <div className="rounded-lg border border-border bg-surface">
        <div className="border-b border-border px-4 py-3">
          <span className="text-sm font-semibold text-ink">평가 구조</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surfaceMuted text-xs text-inkSecondary">
              <tr>
                <th className="px-3 py-2 text-left font-medium">평가 항목</th>
                <th className="px-3 py-2 text-left font-medium">배점</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="px-3 py-2 text-ink">운용 성과 (수익률, Sharpe, MDD 등)</td>
                <td className="px-3 py-2 tabular-nums font-semibold text-ink">70점</td>
              </tr>
              <tr className="bg-surfaceMuted/40">
                <td className="px-3 py-2 text-ink">포트폴리오 구성 및 운용 일지</td>
                <td className="px-3 py-2 tabular-nums font-semibold text-ink">30점</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface">
        <div className="border-b border-border px-4 py-3">
          <span className="text-sm font-semibold text-ink">주요 일정</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surfaceMuted text-xs text-inkSecondary">
              <tr>
                <th className="px-3 py-2 text-left font-medium">일정</th>
                <th className="px-3 py-2 text-left font-medium">날짜</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                ["대회 기간", "2026.6.1 ~ 2026.8.31"],
                ["초기 포트폴리오 구성", "~ 2026.6.8"],
                ["중간 보고", "대회 기간 중 1회"],
                ["최종 제출", "2026.8.31"],
              ].map(([label, date], i) => (
                <tr key={i} className={i % 2 === 1 ? "bg-surfaceMuted/40" : ""}>
                  <td className="px-3 py-2 text-ink">{label}</td>
                  <td className="px-3 py-2 tabular-nums text-ink">{date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface">
        <div className="border-b border-border px-4 py-3">
          <span className="text-sm font-semibold text-ink">컷오프 및 주의 규칙</span>
        </div>
        <ul className="divide-y divide-border">
          {CAUTION_RULES.map((rule, i) => (
            <li key={i} className="flex items-start gap-3 px-4 py-3">
              <span className="mt-0.5 flex-shrink-0 rounded border border-warning/30 bg-warningSoft px-1.5 py-0.5 text-xs font-semibold text-warning">
                주의
              </span>
              <span className="text-sm text-ink">{rule}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg border border-border bg-surface">
        <div className="border-b border-border px-4 py-3">
          <span className="text-sm font-semibold text-ink">편입 비중 상한 — 실시간 준수 현황</span>
        </div>
        <WeightTable rules={rules ?? null} isLoading={isLoading} />
      </div>

      <div className="rounded-lg border border-border bg-surface">
        <div className="border-b border-border px-4 py-3">
          <span className="text-sm font-semibold text-ink">운용 시 주의사항</span>
        </div>
        <ul className="divide-y divide-border">
          {OPERATION_NOTES.map((note, i) => (
            <li key={i} className="flex items-start gap-3 px-4 py-3">
              <span className="mt-0.5 flex-shrink-0 text-inkSecondary text-sm">·</span>
              <span className="text-sm text-ink">{note}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
