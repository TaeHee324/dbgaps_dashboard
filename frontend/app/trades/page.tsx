"use client";

import { useState, Fragment } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTradeLog } from "@/lib/hooks/dashboard";
import { useAddTrade, type AddTradeRequest } from "@/lib/hooks/trades";

const ACTION_OPTIONS = ["매수", "매도", "리밸런싱"] as const;

function formatWeight(v: number): string {
  return (v * 100).toFixed(2) + "%";
}

function makeDefaultForm(): AddTradeRequest {
  return {
    date: new Date().toISOString().slice(0, 10),
    action: "매수",
    etf_code: "",
    etf_name: "",
    weight_before: 0,
    weight_after: 0,
    reason: "",
    note: "",
  };
}

export default function TradesPage() {
  const queryClient = useQueryClient();
  const { data: tradeLog = [] } = useTradeLog();
  const addTrade = useAddTrade();
  const [form, setForm] = useState<AddTradeRequest>(makeDefaultForm);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const sorted = [...tradeLog].sort((a, b) => b.date.localeCompare(a.date));

  function handleChange<K extends keyof AddTradeRequest>(key: K, value: AddTradeRequest[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await addTrade.mutateAsync(form);
    setForm(makeDefaultForm());
    await queryClient.invalidateQueries({ queryKey: ["trade-log"] });
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-ink">매매일지</h1>

      <section className="rounded-lg border border-border bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold text-ink">매매 기록 입력</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-inkSecondary">날짜</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => handleChange("date", e.target.value)}
                required
                className="rounded border border-border bg-background px-2 py-1.5 text-sm text-ink"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-inkSecondary">구분</label>
              <select
                value={form.action}
                onChange={(e) => handleChange("action", e.target.value)}
                className="rounded border border-border bg-background px-2 py-1.5 text-sm text-ink"
              >
                {ACTION_OPTIONS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-inkSecondary">ETF 코드</label>
              <input
                type="text"
                value={form.etf_code}
                onChange={(e) => handleChange("etf_code", e.target.value)}
                placeholder="069500"
                className="rounded border border-border bg-background px-2 py-1.5 text-sm text-ink"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-inkSecondary">ETF 명</label>
              <input
                type="text"
                value={form.etf_name}
                onChange={(e) => handleChange("etf_name", e.target.value)}
                placeholder="KODEX 200"
                className="rounded border border-border bg-background px-2 py-1.5 text-sm text-ink"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-inkSecondary">비중 이전 (0.0 ~ 1.0)</label>
              <input
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={form.weight_before}
                onChange={(e) => handleChange("weight_before", parseFloat(e.target.value) || 0)}
                className="rounded border border-border bg-background px-2 py-1.5 text-sm text-ink"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-inkSecondary">비중 이후 (0.0 ~ 1.0)</label>
              <input
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={form.weight_after}
                onChange={(e) => handleChange("weight_after", parseFloat(e.target.value) || 0)}
                className="rounded border border-border bg-background px-2 py-1.5 text-sm text-ink"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-inkSecondary">이유</label>
            <input
              type="text"
              value={form.reason}
              onChange={(e) => handleChange("reason", e.target.value)}
              required
              className="rounded border border-border bg-background px-2 py-1.5 text-sm text-ink"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-inkSecondary">메모</label>
            <textarea
              value={form.note}
              onChange={(e) => handleChange("note", e.target.value)}
              rows={3}
              className="rounded border border-border bg-background px-2 py-1.5 text-sm text-ink"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={addTrade.isPending}
              className="rounded bg-indigo-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {addTrade.isPending ? "저장 중…" : "기록 저장"}
            </button>
            {addTrade.isError && (
              <p className="text-xs text-red-600">저장 실패. 다시 시도해주세요.</p>
            )}
          </div>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-ink">이력</h2>
        {sorted.length === 0 ? (
          <p className="text-sm text-inkSecondary">기록 없음</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surfaceMuted text-xs text-inkSecondary">
                <tr>
                  {["날짜", "구분", "ETF 코드", "ETF 명", "비중 전", "비중 후", "이유"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((row, idx) => (
                  <Fragment key={`${row.date}-${row.etf_code}-${idx}`}>
                    <tr
                      onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                      className="cursor-pointer border-t border-border hover:bg-surfaceMuted"
                    >
                      <td className="px-3 py-2 tabular-nums">{row.date}</td>
                      <td className="px-3 py-2">{row.action}</td>
                      <td className="px-3 py-2 tabular-nums">{row.etf_code}</td>
                      <td className="px-3 py-2">{row.etf_name}</td>
                      <td className="px-3 py-2 tabular-nums">{formatWeight(row.weight_before)}</td>
                      <td className="px-3 py-2 tabular-nums">{formatWeight(row.weight_after)}</td>
                      <td className="max-w-xs truncate px-3 py-2">{row.reason}</td>
                    </tr>
                    {expandedIdx === idx && row.note && (
                      <tr className="border-t border-border bg-surfaceMuted">
                        <td colSpan={7} className="px-3 py-2 text-xs text-inkSecondary">
                          메모: {row.note}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
