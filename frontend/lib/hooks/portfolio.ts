"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { del, get, patch, post } from "@/lib/api";
import type {
  MonthlyReturn,
  NavPoint,
  PortfolioSummary,
  RulesResponse,
} from "./dashboard";

export type EtfItem = {
  code: string;
  name: string;
  risk_type?: string;
  asset_class?: string;
};

export type EtfPricePoint = {
  date: string;
  close: number;
};

export type Portfolio = {
  name: string;
  group_name?: string | null;
  is_active?: boolean;
};

export type PortfolioHolding = {
  code: string;
  weight: number;
};

export type BacktestRequest = {
  holdings: PortfolioHolding[];
  start_date?: string;
  end_date?: string;
};

export type BacktestResponse = {
  nav: NavPoint[];
  summary: NonNullable<PortfolioSummary>;
  monthly: MonthlyReturn[];
  rules: RulesResponse;
};

export type PortfolioUpsertRequest = {
  name: string;
  holdings: PortfolioHolding[];
};

export type PortfolioUpsertResponse = {
  name: string;
  holdings: PortfolioHolding[];
};

export function useEtfList() {
  return useQuery({
    queryKey: ["etf-list"],
    queryFn: () => get<EtfItem[]>("/api/etf-list"),
  });
}

export function useEtfPrices(code: string) {
  return useQuery({
    queryKey: ["etf-prices", code],
    queryFn: () => get<EtfPricePoint[]>(`/api/etf-prices/${code}`),
    enabled: !!code,
  });
}

export function usePortfolioList() {
  return useQuery({
    queryKey: ["portfolio-list"],
    queryFn: () => get<Portfolio[]>("/api/portfolios"),
  });
}

export function useBacktest() {
  return useMutation({
    mutationFn: (request: BacktestRequest) =>
      post<BacktestResponse>("/api/backtest", request),
  });
}

export function useUpsertPortfolio() {
  return useMutation({
    mutationFn: (request: PortfolioUpsertRequest) =>
      post<PortfolioUpsertResponse>("/api/portfolios", request),
  });
}

export function useDeletePortfolio() {
  return useMutation({
    mutationFn: (name: string) => del(`/api/portfolios/${name}`),
  });
}

export function useActivatePortfolio() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => post(`/api/portfolios/${encodeURIComponent(name)}/activate`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-list"] });
    },
  });
}

export function useUpdateActiveHolding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ code, weight }: { code: string; weight: number }) =>
      patch<{ updated: string; weight: number }>(`/api/portfolios/active/holdings`, { code, weight }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-list"] });
      queryClient.invalidateQueries({ queryKey: ["risk-portfolio"] });
      queryClient.invalidateQueries({ queryKey: ["etf-risk-analysis"] });
    },
  });
}
