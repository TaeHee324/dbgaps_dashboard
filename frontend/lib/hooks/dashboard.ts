"use client";

import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api";

export type PortfolioSummary = {
  cumulative_return: number;
  cagr: number;
  mdd: number;
  alpha: number;
  beta: number;
  annual_volatility: number;
  win_rate: number;
  sharpe: number;
  calmar: number;
} | null;

export type NavPoint = {
  date: string;
  portfolio_value: number;
  daily_return: number;
  cumulative_return: number;
  drawdown: number;
};

export type MonthlyReturn = {
  year: number;
  month: number;
  monthly_return: number;
};

export type Holding = {
  code: string;
  name: string;
  quantity: number;
  avg_price: number;
  cost_basis: number;
  price_date: string;
  current_price: number;
  market_value: number;
  unrealized_pnl: number;
  unrealized_return: number;
  current_weight: number;
  risk_type: string;
  asset_class: string;
};

export type IndividualRule = {
  code: string;
  name: string;
  current_weight: number;
  limit: number;
  excess: number;
  passed: boolean;
};

export type RiskAssetRule = {
  rule: string;
  risky_weight: number;
  limit: number;
  excess: number;
  passed: boolean;
};

export type RulesResponse = {
  individual: IndividualRule[];
  risk_asset: RiskAssetRule;
} | null;

export type TurnoverBase = {
  traded_value: number;
  turnover: number;
  turnover_source: string;
  limit: number;
  passed: boolean;
};

export type TurnoverWithDate = TurnoverBase & {
  date: string;
};

export type TurnoverResponse = {
  initial: TurnoverBase;
  weekly: TurnoverWithDate[];
  monthly: TurnoverWithDate[];
} | null;

export type DataDateResponse = {
  date: string;
};

export type ReportResponse = {
  content: string;
  filename: string;
} | null;

export type ComparisonSummaryItem = {
  portfolio_name: string;
  cagr: number;
  mdd: number;
  sharpe: number;
  calmar: number;
};

export type ComparisonNavPoint = {
  date: string;
  portfolio_value: number;
  cumulative_return: number;
};

export type TradeLogEntry = {
  id: number;
  date: string;
  action: string;
  etf_code: string;
  etf_name: string;
  weight_before: number;
  weight_after: number;
  reason: string;
  note: string;
  strategy_checklist: string[];
};

export type PortfolioHolding = {
  code: string;
  weight: number;
};

export function usePortfolioSummary() {
  return useQuery({
    queryKey: ["portfolio-summary"],
    queryFn: () => get<PortfolioSummary>("/api/portfolio-summary"),
  });
}

export function useBacktestNav() {
  return useQuery({
    queryKey: ["backtest-nav"],
    queryFn: () => get<NavPoint[]>("/api/backtest-nav"),
  });
}

export function useMonthlyReturns() {
  return useQuery({
    queryKey: ["monthly-returns"],
    queryFn: () => get<MonthlyReturn[]>("/api/monthly-returns"),
  });
}

export function useCurrentHoldings() {
  return useQuery({
    queryKey: ["current-holdings"],
    queryFn: () => get<Holding[]>("/api/holdings"),
  });
}

export function useTurnover() {
  return useQuery({
    queryKey: ["turnover"],
    queryFn: () => get<TurnoverResponse>("/api/turnover"),
  });
}

export function useRules() {
  return useQuery({
    queryKey: ["rules"],
    queryFn: () => get<RulesResponse>("/api/rules"),
  });
}

export function useDataDate() {
  return useQuery({
    queryKey: ["data-date"],
    queryFn: () => get<DataDateResponse>("/api/data-date"),
  });
}

export function useReport() {
  return useQuery({
    queryKey: ["report"],
    queryFn: () => get<ReportResponse>("/api/report"),
  });
}

export type ReportListItem = {
  filename: string;
  title: string;
  period: string;
};

export function useReports() {
  return useQuery({
    queryKey: ["reports"],
    queryFn: () => get<ReportListItem[]>("/api/reports"),
  });
}

export function useReportDetail(filename: string) {
  return useQuery({
    queryKey: ["report", filename],
    queryFn: () => get<ReportResponse>(`/api/report/${encodeURIComponent(filename)}`),
    enabled: !!filename,
  });
}

export function useComparisonSummary() {
  return useQuery({
    queryKey: ["comparison-summary"],
    queryFn: () => get<ComparisonSummaryItem[]>("/api/comparison/summary"),
  });
}

export function useComparisonNav() {
  return useQuery({
    queryKey: ["comparison-nav"],
    queryFn: () => get<Record<string, ComparisonNavPoint[]>>("/api/comparison/nav"),
  });
}

export function useTradeLog() {
  return useQuery({
    queryKey: ["trade-log"],
    queryFn: () => get<TradeLogEntry[]>("/api/trade-log"),
  });
}

export function usePortfolioDetail(name: string) {
  return useQuery({
    queryKey: ["portfolio-detail", name],
    queryFn: () => get<PortfolioHolding[]>(`/api/portfolios/${encodeURIComponent(name)}`),
  });
}
