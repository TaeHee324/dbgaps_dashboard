import type { ActualNavPoint, NavPoint } from "@/lib/hooks/dashboard";

const TRADING_DAYS_PER_YEAR = 252;

export type ActualOpsMetrics = {
  cumulative_return: number;
  mdd: number;
  win_rate: number;
  annual_volatility: number;
  mdd_duration: number | null;
} | null;

export type StrategyMetrics = {
  cagr: number | null;
  sharpe: number | null;
  calmar: number | null;
  sortino: number | null;
  win_rate_monthly: number | null;
  var_95: number | null;
} | null;

export function computeActualOpsMetrics(points: ActualNavPoint[]): ActualOpsMetrics {
  if (!points || points.length < 2) return null;

  const returns = points.slice(1).map((p) => p.daily_return);
  const n = returns.length;
  if (n === 0) return null;

  const lastPoint = points[points.length - 1];
  const cumReturn = lastPoint.cumulative_return;

  const mddValue = Math.min(...points.map((p) => p.drawdown));

  const mean = returns.reduce((s, r) => s + r, 0) / n;
  const variance = n > 1 ? returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (n - 1) : 0;
  const annualVol = Math.sqrt(variance) * Math.sqrt(TRADING_DAYS_PER_YEAR);

  const winRate = returns.filter((r) => r > 0).length / n;

  let mddDuration: number | null = null;
  {
    let troughIdx = 0;
    let minDD = 0;
    for (let i = 0; i < points.length; i++) {
      if (points[i].drawdown < minDD) {
        minDD = points[i].drawdown;
        troughIdx = i;
      }
    }
    if (minDD < 0) {
      let peakIdx = 0;
      for (let i = troughIdx; i >= 0; i--) {
        if (points[i].drawdown >= 0) { peakIdx = i; break; }
      }
      let endIdx = points.length - 1;
      for (let i = troughIdx; i < points.length; i++) {
        if (points[i].drawdown >= 0) { endIdx = i; break; }
      }
      const peakDate = new Date(points[peakIdx].date + "T00:00:00");
      const endDate = new Date(points[endIdx].date + "T00:00:00");
      mddDuration = Math.round((endDate.getTime() - peakDate.getTime()) / (1000 * 60 * 60 * 24));
    } else {
      mddDuration = 0;
    }
  }

  return { cumulative_return: cumReturn, mdd: mddValue, win_rate: winRate, annual_volatility: annualVol, mdd_duration: mddDuration };
}

export function computeStrategyMetrics(points: NavPoint[]): StrategyMetrics {
  if (!points || points.length < 2) return null;

  // 슬라이스된 구간 내 daily_return 전부 사용 (actual_nav와 달리 첫 행도 유효)
  const returns = points.map((p) => p.daily_return);
  const n = returns.length;
  if (n === 0) return null;

  // 구간 누적수익률: lastPoint.cumulative_return 은 전체 백테스트 기준이므로 사용 불가.
  // portfolio_value 비율로 직접 계산.
  const firstValue = points[0].portfolio_value;
  const lastValue = points[points.length - 1].portfolio_value;
  const cumReturn = firstValue > 0 ? lastValue / firstValue - 1 : 0;

  const years = (n - 1) / TRADING_DAYS_PER_YEAR;
  const cagr = years > 0 ? Math.pow(1 + cumReturn, 1 / years) - 1 : null;

  // 구간 내 MDD: 사전 계산된 drawdown 컬럼은 전체 역사 고점 기준이므로 직접 재계산.
  let peak = points[0].portfolio_value;
  let mddValue = 0;
  for (const p of points) {
    if (p.portfolio_value > peak) peak = p.portfolio_value;
    const dd = peak > 0 ? (p.portfolio_value - peak) / peak : 0;
    if (dd < mddValue) mddValue = dd;
  }

  const mean = returns.reduce((s, r) => s + r, 0) / n;
  const variance = n > 1 ? returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (n - 1) : 0;
  const excessStd = Math.sqrt(variance);

  const sharpe =
    excessStd > 0 && Number.isFinite(excessStd)
      ? (mean / excessStd) * Math.sqrt(TRADING_DAYS_PER_YEAR)
      : null;

  const calmar = cagr !== null && mddValue < 0 ? cagr / Math.abs(mddValue) : null;

  let sortino: number | null = null;
  const downReturns = returns.filter((r) => r < 0);
  if (downReturns.length >= 2) {
    const downMean = downReturns.reduce((s, r) => s + r, 0) / downReturns.length;
    const downVariance = downReturns.reduce((s, r) => s + (r - downMean) ** 2, 0) / (downReturns.length - 1);
    const downStd = Math.sqrt(downVariance) * Math.sqrt(TRADING_DAYS_PER_YEAR);
    const annualExcess = mean * TRADING_DAYS_PER_YEAR;
    sortino = downStd > 0 ? annualExcess / downStd : null;
  }

  let winRateMonthly: number | null = null;
  {
    const monthlyMap = new Map<string, number[]>();
    for (const p of points) {
      const ym = p.date.slice(0, 7);
      if (!monthlyMap.has(ym)) monthlyMap.set(ym, []);
      monthlyMap.get(ym)!.push(p.daily_return);
    }
    const monthlyReturns = Array.from(monthlyMap.values()).map((rets) =>
      rets.reduce((acc, r) => acc * (1 + r), 1) - 1,
    );
    if (monthlyReturns.length >= 2) {
      winRateMonthly = monthlyReturns.filter((r) => r > 0).length / monthlyReturns.length;
    }
  }

  let var95: number | null = null;
  if (returns.length >= 20) {
    const sorted = [...returns].sort((a, b) => a - b);
    var95 = sorted[Math.floor(sorted.length * 0.05)];
  }

  return { cagr, sharpe, calmar, sortino, win_rate_monthly: winRateMonthly, var_95: var95 };
}
