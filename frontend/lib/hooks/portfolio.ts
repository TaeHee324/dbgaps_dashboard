"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import type {
  MonthlyReturn,
  NavPoint,
  PortfolioSummary,
  RulesResponse,
} from "./dashboard";

export type EtfItem = {
  code: string;
  name: string;
};

export type EtfPricePoint = {
  date: string;
  close: number;
};

export type Portfolio = {
  name: string;
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

const emptyEtfList: EtfItem[] = [];
const emptyEtfPrices: EtfPricePoint[] = [];
const emptyPortfolioList: Portfolio[] = [];

const emptyBacktestResponse: BacktestResponse = {
  nav: [],
  summary: {
    cumulative_return: 0,
    cagr: 0,
    mdd: 0,
    alpha: 0,
    beta: 0,
    annual_volatility: 0,
    win_rate: 0,
    sharpe: 0,
    calmar: 0,
  },
  monthly: [],
  rules: null,
};

export function useEtfList() {
  return useQuery({
    queryKey: ["etf-list"],
    queryFn: async () => emptyEtfList,
  });
}

export function useEtfPrices(code: string) {
  return useQuery({
    queryKey: ["etf-prices", code],
    queryFn: async () => emptyEtfPrices,
  });
}

export function usePortfolioList() {
  return useQuery({
    queryKey: ["portfolio-list"],
    queryFn: async () => emptyPortfolioList,
  });
}

export function useBacktest() {
  return useMutation({
    mutationFn: async (request: BacktestRequest) => {
      void request;
      return emptyBacktestResponse;
    },
  });
}

export function useUpsertPortfolio() {
  return useMutation({
    mutationFn: async (
      request: PortfolioUpsertRequest,
    ): Promise<PortfolioUpsertResponse> => ({
      name: request.name,
      holdings: request.holdings,
    }),
  });
}

export function useDeletePortfolio() {
  return useMutation({
    mutationFn: async (name: string): Promise<void> => {
      void name;
    },
  });
}
