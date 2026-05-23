"use client";

import { useMutation } from "@tanstack/react-query";
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
    mutationFn: async (request: AddTradeRequest): Promise<TradeLogEntry> => ({
      ...request,
    }),
  });
}
