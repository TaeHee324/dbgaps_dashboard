"use client";

import { useMutation } from "@tanstack/react-query";
import { del, post, put } from "@/lib/api";
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
  strategy_checklist: string[];
  quantity?: number | null;
  price?: number | null;
  amount?: number | null;
};

export type UpdateTradeRequest = AddTradeRequest;

export function useAddTrade() {
  return useMutation({
    mutationFn: (request: AddTradeRequest) =>
      post<TradeLogEntry>("/api/trade-log", request),
  });
}

export function useUpdateTrade() {
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateTradeRequest }) =>
      put<TradeLogEntry>(`/api/trade-log/${id}`, data),
  });
}

export function useDeleteTrade() {
  return useMutation({
    mutationFn: (id: number) => del(`/api/trade-log/${id}`),
  });
}
