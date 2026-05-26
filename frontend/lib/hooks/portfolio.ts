"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { del, get, post } from "@/lib/api";
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
