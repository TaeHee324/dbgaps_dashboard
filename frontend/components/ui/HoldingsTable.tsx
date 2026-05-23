import type { Holding } from "@/lib/hooks/dashboard";

type HoldingsTableProps = {
  holdings: Holding[];
};

function formatNumber(value: number | null | undefined, fractionDigits = 0) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return value.toLocaleString("ko-KR", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

function formatPercent(value: number | null | undefined, fractionDigits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return `${(value * 100).toFixed(fractionDigits)}%`;
}

function pnlClass(value: number) {
  if (value > 0) {
    return "text-danger";
  }

  if (value < 0) {
    return "text-primary";
  }

  return "text-ink";
}

export function HoldingsTable({ holdings }: HoldingsTableProps) {
  if (holdings.length === 0) {
    return (
      <div className="rounded-md border border-border bg-surface px-md py-sm text-sm text-inkSecondary">
        보유 종목 없음
      </div>
    );
  }

  const sortedHoldings = [...holdings].sort((a, b) => b.current_weight - a.current_weight);

  return (
    <div className="overflow-x-auto rounded-md border border-border bg-surface shadow-panel">
      <table className="min-w-[1080px] w-full border-collapse text-sm">
        <thead className="bg-surfaceMuted text-xs font-semibold text-inkSecondary">
          <tr className="border-b border-border">
            <th className="px-sm py-sm text-left">코드</th>
            <th className="px-sm py-sm text-left">종목명</th>
            <th className="px-sm py-sm text-right">수량</th>
            <th className="px-sm py-sm text-right">평단가</th>
            <th className="px-sm py-sm text-right">현재가</th>
            <th className="px-sm py-sm text-right">평가금액</th>
            <th className="px-sm py-sm text-right">손익</th>
            <th className="px-sm py-sm text-right">수익률</th>
            <th className="px-sm py-sm text-right">비중</th>
            <th className="px-sm py-sm text-left">자산군</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border text-ink">
          {sortedHoldings.map((holding) => (
            <tr key={holding.code} className="bg-surface">
              <td className="whitespace-nowrap px-sm py-sm font-mono text-xs font-semibold text-primary">
                {holding.code}
              </td>
              <td className="max-w-[220px] truncate px-sm py-sm font-medium">{holding.name}</td>
              <td className="px-sm py-sm text-right font-numeric tabular-nums">
                {formatNumber(holding.quantity)}
              </td>
              <td className="px-sm py-sm text-right font-numeric tabular-nums">
                {formatNumber(holding.avg_price)}
              </td>
              <td className="px-sm py-sm text-right font-numeric tabular-nums">
                {formatNumber(holding.current_price)}
              </td>
              <td className="px-sm py-sm text-right font-numeric tabular-nums">
                {formatNumber(holding.market_value)}
              </td>
              <td
                className={`px-sm py-sm text-right font-numeric font-semibold tabular-nums ${pnlClass(
                  holding.unrealized_pnl,
                )}`}
              >
                {formatNumber(holding.unrealized_pnl)}
              </td>
              <td
                className={`px-sm py-sm text-right font-numeric font-semibold tabular-nums ${pnlClass(
                  holding.unrealized_return,
                )}`}
              >
                {formatPercent(holding.unrealized_return)}
              </td>
              <td className="px-sm py-sm text-right font-numeric tabular-nums">
                {formatPercent(holding.current_weight, 1)}
              </td>
              <td className="whitespace-nowrap px-sm py-sm text-inkSecondary">
                {holding.asset_class || holding.risk_type}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
