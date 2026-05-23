"use client";

import { useMutation } from "@tanstack/react-query";
import { post } from "@/lib/api";
import type { TradeLogEntry } from "./dashboard";

export type AddTradeRequest = {
  date: string;
  action: string;
  etf_code: string;
  etf_name: string;
  weight_before: number;
  weight_after: number;
  reason: string;
  note: string;
};

export function useAddTrade() {
  return useMutation({
    mutationFn: (request: AddTradeRequest) =>
      post<TradeLogEntry>("/api/trade-log", request),
  });
}
