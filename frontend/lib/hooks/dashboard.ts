"use client";

import { useQuery } from "@tanstack/react-query";

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
  date: string;
  action: string;
  etf_code: string;
  etf_name: string;
  weight_before: number;
  weight_after: number;
  reason: string;
  note: string;
};

export type PortfolioHolding = {
  code: string;
  weight: number;
};

const emptyPortfolioSummary: PortfolioSummary = null;
const emptyBacktestNav: NavPoint[] = [];
const emptyMonthlyReturns: MonthlyReturn[] = [];
const emptyCurrentHoldings: Holding[] = [];
const emptyTurnover: TurnoverResponse = null;
const emptyRules: RulesResponse = null;
const emptyDataDate: DataDateResponse = { date: "" };
const emptyReport: ReportResponse = null;
const emptyComparisonSummary: ComparisonSummaryItem[] = [];
const emptyComparisonNav: Record<string, ComparisonNavPoint[]> = {};
const emptyTradeLog: TradeLogEntry[] = [];
const emptyPortfolioDetail: PortfolioHolding[] = [];

export function usePortfolioSummary() {
  return useQuery({
    queryKey: ["portfolio-summary"],
    queryFn: async () => emptyPortfolioSummary,
  });
}

export function useBacktestNav() {
  return useQuery({
    queryKey: ["backtest-nav"],
    queryFn: async () => emptyBacktestNav,
  });
}

export function useMonthlyReturns() {
  return useQuery({
    queryKey: ["monthly-returns"],
    queryFn: async () => emptyMonthlyReturns,
  });
}

export function useCurrentHoldings() {
  return useQuery({
    queryKey: ["current-holdings"],
    queryFn: async () => emptyCurrentHoldings,
  });
}

export function useTurnover() {
  return useQuery({
    queryKey: ["turnover"],
    queryFn: async () => emptyTurnover,
  });
}

export function useRules() {
  return useQuery({
    queryKey: ["rules"],
    queryFn: async () => emptyRules,
  });
}

export function useDataDate() {
  return useQuery({
    queryKey: ["data-date"],
    queryFn: async () => emptyDataDate,
  });
}

export function useReport() {
  return useQuery({
    queryKey: ["report"],
    queryFn: async () => emptyReport,
  });
}

export function useComparisonSummary() {
  return useQuery({
    queryKey: ["comparison-summary"],
    queryFn: async () => emptyComparisonSummary,
  });
}

export function useComparisonNav() {
  return useQuery({
    queryKey: ["comparison-nav"],
    queryFn: async () => emptyComparisonNav,
  });
}

export function useTradeLog() {
  return useQuery({
    queryKey: ["trade-log"],
    queryFn: async () => emptyTradeLog,
  });
}

export function usePortfolioDetail(name: string) {
  return useQuery({
    queryKey: ["portfolio-detail", name],
    queryFn: async () => emptyPortfolioDetail,
  });
}
