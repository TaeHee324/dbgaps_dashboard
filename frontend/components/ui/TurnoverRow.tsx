import type { TurnoverBase, TurnoverResponse, TurnoverWithDate } from "@/lib/hooks/dashboard";

type TurnoverRowProps = {
  turnover: TurnoverResponse;
};

type TurnoverCardProps = {
  title: string;
  rows: Array<TurnoverBase | TurnoverWithDate>;
};

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return `${(value * 100).toFixed(1)}%`;
}

function formatAmount(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return value.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
}

function hasDate(row: TurnoverBase | TurnoverWithDate): row is TurnoverWithDate {
  return "date" in row;
}

function statusClasses(passed: boolean) {
  return passed
    ? "bg-successSoft text-success border-success/20"
    : "bg-dangerSoft text-danger border-danger/20";
}

function TurnoverCard({ title, rows }: TurnoverCardProps) {
  return (
    <div className="rounded-md border border-border bg-surface p-md shadow-panel">
      <div className="text-sm font-semibold text-ink">{title}</div>
      {rows.length > 0 ? (
        <div className="mt-sm space-y-sm">
          {rows.map((row, index) => (
            <div
              key={hasDate(row) ? `${row.date}-${index}` : `initial-${index}`}
              className="rounded-sm border border-border bg-surfaceMuted p-sm"
            >
              <div className="flex items-start justify-between gap-sm">
                <div>
                  {hasDate(row) ? (
                    <div className="text-xs font-medium text-inkSecondary">{row.date}</div>
                  ) : null}
                  <div className="font-numeric text-lg font-semibold tabular-nums text-ink">
                    {formatPercent(row.turnover)}
                  </div>
                </div>
                <span
                  className={`inline-flex items-center rounded-pill border px-sm py-xxs text-xs font-semibold ${statusClasses(
                    row.passed,
                  )}`}
                >
                  {row.passed ? "통과" : "위반"}
                </span>
              </div>
              <div className="mt-xs grid grid-cols-2 gap-xs text-xs text-inkSecondary">
                <span>거래금액 {formatAmount(row.traded_value)}</span>
                <span>최소 {formatPercent(row.limit)}</span>
                <span className="col-span-2">출처 {row.turnover_source || "-"}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-sm rounded-sm border border-border bg-surfaceMuted px-sm py-sm text-sm text-inkSecondary">
          데이터 없음
        </div>
      )}
    </div>
  );
}

export function TurnoverRow({ turnover }: TurnoverRowProps) {
  if (!turnover) {
    return (
      <div className="rounded-md border border-border bg-surface px-md py-sm text-sm text-inkSecondary">
        데이터 없음
      </div>
    );
  }

  return (
    <section aria-label="회전율" className="grid grid-cols-1 gap-sm lg:grid-cols-3">
      <TurnoverCard title="초기 누적 회전율" rows={[turnover.initial]} />
      <TurnoverCard title="주간 회전율 최근값" rows={turnover.weekly.slice(-3).reverse()} />
      <TurnoverCard title="월간 회전율 최근값" rows={turnover.monthly.slice(-3).reverse()} />
    </section>
  );
}
