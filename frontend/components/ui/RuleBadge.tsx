import type { IndividualRule, RiskAssetRule, RulesResponse } from "@/lib/hooks/dashboard";

type RuleBadgeProps = {
  rules: RulesResponse | null;
  showRiskAsset?: boolean;
  emptyLabel?: string;
};

type RuleRowProps = {
  title: string;
  current: string;
  limit: string;
  excess: string;
  passed: boolean;
  code?: string;
};

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return `${(value * 100).toFixed(1)}%`;
}

function statusClasses(passed: boolean) {
  return passed
    ? "bg-successSoft text-success border-success/20"
    : "bg-dangerSoft text-danger border-danger/20";
}

function RuleRow({ title, current, limit, excess, passed, code }: RuleRowProps) {
  return (
    <li className="flex flex-col gap-xs rounded-md border border-border bg-surface px-md py-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-xs">
          {code ? (
            <span className="font-mono text-xs font-semibold text-primary">{code}</span>
          ) : null}
          <span className="truncate text-sm font-semibold text-ink">{title}</span>
        </div>
        <div className="mt-xxs text-xs text-inkSecondary">
          현재 {current} / 한도 {limit} / 초과 {excess}
        </div>
      </div>
      <span
        className={`inline-flex w-fit items-center rounded-pill border px-sm py-xxs text-xs font-semibold ${statusClasses(
          passed,
        )}`}
      >
        {passed ? "통과" : "위반"}
      </span>
    </li>
  );
}

function individualTitle(rule: IndividualRule) {
  return rule.name ? `개별 ETF 20% 상한 · ${rule.name}` : "개별 ETF 20% 상한";
}

function riskTitle(rule: RiskAssetRule) {
  return rule.rule ? `위험자산 70% 상한 · ${rule.rule}` : "위험자산 70% 상한";
}

export function RuleBadge({
  rules,
  showRiskAsset = true,
  emptyLabel = "개별 ETF 규칙 데이터 없음",
}: RuleBadgeProps) {
  if (!rules) {
    return (
      <div className="rounded-md border border-border bg-surface px-md py-sm text-sm text-inkSecondary">
        데이터 없음
      </div>
    );
  }

  return (
    <section aria-label="투자 규칙 상태" className="space-y-sm">
      <ul className="space-y-sm">
        {rules.individual.length > 0 ? (
          rules.individual.map((rule) => (
            <RuleRow
              key={rule.code}
              code={rule.code}
              title={individualTitle(rule)}
              current={formatPercent(rule.current_weight)}
              limit={formatPercent(rule.limit)}
              excess={formatPercent(rule.excess)}
              passed={rule.passed}
            />
          ))
        ) : (
          <li className="rounded-md border border-border bg-surface px-md py-sm text-sm text-inkSecondary">
            {emptyLabel}
          </li>
        )}
        {showRiskAsset ? (
          <RuleRow
            title={riskTitle(rules.risk_asset)}
            current={formatPercent(rules.risk_asset.risky_weight)}
            limit={formatPercent(rules.risk_asset.limit)}
            excess={formatPercent(rules.risk_asset.excess)}
            passed={rules.risk_asset.passed}
          />
        ) : null}
      </ul>
    </section>
  );
}
