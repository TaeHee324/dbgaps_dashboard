"use client";

import { useState, Fragment } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTradeLog, usePortfolioEtfs, type TradeLogEntry } from "@/lib/hooks/dashboard";
import { useEtfList, useEtfPrices } from "@/lib/hooks/portfolio";
import { useAddTrade, useUpdateTrade, useDeleteTrade, type AddTradeRequest } from "@/lib/hooks/trades";

const STRATEGY_OPTIONS = [
  "이해 가능한 사업 (투자원칙 범위 내)",
  "장기 보유 관점 (최소 5년 이상)",
  "강력한 경쟁 우위 (모트 존재)",
  "합리적인 가격 매수",
  "감정이 아닌 데이터 기반 결정",
  "분산 투자 원칙 준수",
] as const;

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
    strategy_checklist: [],
    quantity: null,
    price: null,
    amount: null,
  };
}

export default function TradesPage() {
  const queryClient = useQueryClient();
  const { data: tradeLog = [] } = useTradeLog();
  const { data: etfList = [] } = useEtfList();
  const { data: portfolioEtfs = [] } = usePortfolioEtfs();
  const addTrade = useAddTrade();
  const updateTrade = useUpdateTrade();
  const deleteTrade = useDeleteTrade();

  const [form, setForm] = useState<AddTradeRequest>(makeDefaultForm);
  const [editId, setEditId] = useState<number | null>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [calcTotalAssets, setCalcTotalAssets] = useState<number>(0);
  const [calcTargetWeight, setCalcTargetWeight] = useState<number>(0);

  const { data: etfPrices = [] } = useEtfPrices(form.etf_code);
  const latestPrice = etfPrices.length > 0 ? etfPrices[etfPrices.length - 1].close : 0;
  const calcNeededQty =
    latestPrice > 0 && calcTotalAssets > 0 && calcTargetWeight > 0
      ? Math.floor((calcTotalAssets * (calcTargetWeight / 100)) / latestPrice)
      : null;

  const sorted = [...tradeLog].sort((a, b) => b.date.localeCompare(a.date));

  function handleEditClick(row: TradeLogEntry) {
    setEditId(row.id);
    setForm({
      date: row.date,
      action: row.action,
      etf_code: row.etf_code,
      etf_name: row.etf_name,
      weight_before: row.weight_before * 100,
      weight_after: row.weight_after * 100,
      reason: row.reason,
      note: row.note,
      strategy_checklist: row.strategy_checklist ?? [],
      quantity: row.quantity ?? null,
      price: row.price ?? null,
      amount: row.amount ?? null,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleEtfCodeChange(code: string) {
    const match = etfList.find((e) => e.code === code);
    setForm((prev) => ({
      ...prev,
      etf_code: code,
      etf_name: match ? match.name : prev.etf_name,
    }));
  }

  function handleChange<K extends keyof AddTradeRequest>(key: K, value: AddTradeRequest[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      ...form,
      weight_before: form.weight_before / 100,
      weight_after: form.weight_after / 100,
    };
    if (editId !== null) {
      await updateTrade.mutateAsync({ id: editId, data: payload });
    } else {
      await addTrade.mutateAsync(payload);
    }
    setForm(makeDefaultForm());
    setEditId(null);
    await queryClient.invalidateQueries({ queryKey: ["trade-log"] });
    await queryClient.invalidateQueries({ queryKey: ["live-holdings"] });
    await queryClient.invalidateQueries({ queryKey: ["current-holdings"] });
    await queryClient.invalidateQueries({ queryKey: ["portfolio-etfs"] });
  }

  async function handleDelete(id: number) {
    await deleteTrade.mutateAsync(id);
    await queryClient.invalidateQueries({ queryKey: ["trade-log"] });
  }

  const isPending = addTrade.isPending || updateTrade.isPending;
  const isError = addTrade.isError || updateTrade.isError;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-ink">매매일지</h1>

      <section className="rounded-lg border border-border bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold text-ink">
          {editId !== null ? "매매 기록 수정" : "매매 기록 입력"}
        </h2>
        {editId !== null && (
          <button
            type="button"
            onClick={() => { setEditId(null); setForm(makeDefaultForm()); }}
            className="mb-3 text-xs text-inkSecondary hover:underline"
          >
            ✕ 수정 취소
          </button>
        )}
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
            {form.action === "매도" ? (
              <div className="flex flex-col gap-1 sm:col-span-2">
                <label className="text-xs text-inkSecondary">ETF 선택 (보유 중)</label>
                <select
                  value={form.etf_code}
                  onChange={(e) => {
                    const etf = portfolioEtfs.find((h) => h.code === e.target.value);
                    setForm((prev) => ({
                      ...prev,
                      etf_code: e.target.value,
                      etf_name: etf ? etf.name : prev.etf_name,
                    }));
                  }}
                  className="rounded border border-border bg-background px-2 py-1.5 text-sm text-ink"
                >
                  <option value="">선택</option>
                  {portfolioEtfs.map((h) => (
                    <option key={h.code} value={h.code}>{h.code} — {h.name}</option>
                  ))}
                </select>
              </div>
            ) : form.action === "리밸런싱" ? (
              <div className="flex flex-col gap-1 sm:col-span-2">
                <label className="text-xs text-inkSecondary">ETF 선택 (운용 포트폴리오)</label>
                <select
                  value={form.etf_code}
                  onChange={(e) => {
                    const etf = portfolioEtfs.find((h) => h.code === e.target.value);
                    setForm((prev) => ({
                      ...prev,
                      etf_code: e.target.value,
                      etf_name: etf ? etf.name : prev.etf_name,
                    }));
                  }}
                  className="rounded border border-border bg-background px-2 py-1.5 text-sm text-ink"
                >
                  <option value="">선택</option>
                  {portfolioEtfs.map((h) => (
                    <option key={h.code} value={h.code}>{h.code} — {h.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-inkSecondary">ETF 코드</label>
                  <input
                    type="text"
                    value={form.etf_code}
                    onChange={(e) => handleEtfCodeChange(e.target.value)}
                    placeholder="069500"
                    list="etf-code-list"
                    className="rounded border border-border bg-background px-2 py-1.5 text-sm text-ink"
                  />
                  <datalist id="etf-code-list">
                    {etfList.map((e) => (
                      <option key={e.code} value={e.code}>{e.name}</option>
                    ))}
                  </datalist>
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
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-inkSecondary">비중 이전 (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={form.weight_before}
                onChange={(e) => handleChange("weight_before", parseFloat(e.target.value) || 0)}
                className="rounded border border-border bg-background px-2 py-1.5 text-sm text-ink"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-inkSecondary">비중 이후 (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={form.weight_after}
                onChange={(e) => handleChange("weight_after", parseFloat(e.target.value) || 0)}
                className="rounded border border-border bg-background px-2 py-1.5 text-sm text-ink"
              />
            </div>
          </div>

          {latestPrice > 0 && (
            <div className="rounded border border-border bg-surfaceMuted p-3 space-y-2">
              <p className="text-xs font-semibold text-inkSecondary">역산 계산기 — 목표 비중 → 필요 수량</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-inkSecondary">총자산 (원)</label>
                  <input
                    type="number"
                    min={0}
                    step={1000000}
                    value={calcTotalAssets || ""}
                    onChange={(e) => setCalcTotalAssets(parseFloat(e.target.value) || 0)}
                    placeholder="100000000"
                    className="rounded border border-border bg-background px-2 py-1.5 text-sm text-ink"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-inkSecondary">목표 비중 (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={calcTargetWeight || ""}
                    onChange={(e) => setCalcTargetWeight(parseFloat(e.target.value) || 0)}
                    placeholder="20"
                    className="rounded border border-border bg-background px-2 py-1.5 text-sm text-ink"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-inkSecondary">필요 수량 (주)</label>
                  <div className="rounded border border-border bg-background px-2 py-1.5 text-sm font-semibold text-ink">
                    {calcNeededQty !== null ? calcNeededQty.toLocaleString("ko-KR") : "—"}
                  </div>
                  {calcNeededQty !== null && latestPrice > 0 && (
                    <p className="text-xs text-inkMuted">
                      현재가 {latestPrice.toLocaleString("ko-KR")}원 기준
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-inkSecondary">매수단가 (원)</label>
              <input
                type="number"
                min={0}
                step={1}
                value={form.price ?? ""}
                onChange={(e) => {
                  const p = parseFloat(e.target.value) || null;
                  const q = form.quantity ?? null;
                  setForm((prev) => ({
                    ...prev,
                    price: p,
                    amount: p && q ? Math.round(p * q) : null,
                  }));
                }}
                placeholder="50000"
                className="rounded border border-border bg-background px-2 py-1.5 text-sm text-ink"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-inkSecondary">수량 (주)</label>
              <input
                type="number"
                min={0}
                step={1}
                value={form.quantity ?? ""}
                onChange={(e) => {
                  const q = parseFloat(e.target.value) || null;
                  const p = form.price ?? null;
                  setForm((prev) => ({
                    ...prev,
                    quantity: q,
                    amount: p && q ? Math.round(p * q) : null,
                  }));
                }}
                placeholder="100"
                className="rounded border border-border bg-background px-2 py-1.5 text-sm text-ink"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-inkSecondary">거래금액 (원)</label>
              <input
                type="number"
                value={form.amount ?? ""}
                readOnly
                className="rounded border border-border bg-background px-2 py-1.5 text-sm text-inkSecondary"
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

          <div className="flex flex-col gap-1">
            <label className="text-xs text-inkSecondary">전략 체크리스트</label>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {STRATEGY_OPTIONS.map((opt) => (
                <label key={opt} className="flex items-center gap-2 text-xs text-ink cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.strategy_checklist.includes(opt)}
                    onChange={(e) => {
                      setForm((prev) => ({
                        ...prev,
                        strategy_checklist: e.target.checked
                          ? [...prev.strategy_checklist, opt]
                          : prev.strategy_checklist.filter((s) => s !== opt),
                      }));
                    }}
                    className="accent-indigo-700"
                  />
                  {opt}
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={isPending}
              className="rounded bg-indigo-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {isPending ? "저장 중…" : editId !== null ? "수정 저장" : "기록 저장"}
            </button>
            {isError && (
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
                  {["날짜", "구분", "ETF 코드", "ETF 명", "비중 전", "비중 후", "수량", "단가", "이유", ""].map((h, i) => (
                    <th key={i} className="px-3 py-2 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((row, idx) => (
                  <Fragment key={row.id}>
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
                      <td className="px-3 py-2 tabular-nums">
                        {row.quantity != null ? row.quantity.toLocaleString("ko-KR") : "—"}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {row.price != null ? row.price.toLocaleString("ko-KR") : "—"}
                      </td>
                      <td className="max-w-xs truncate px-3 py-2">{row.reason}</td>
                      <td className="px-3 py-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleEditClick(row)}
                          className="mr-2 text-xs text-indigo-700 hover:underline"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleDelete(row.id)}
                          disabled={deleteTrade.isPending}
                          className="text-xs text-red-600 hover:underline disabled:opacity-50"
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                    {expandedIdx === idx && (row.note || (row.strategy_checklist && row.strategy_checklist.length > 0) || row.amount != null) && (
                      <tr className="border-t border-border bg-surfaceMuted">
                        <td colSpan={10} className="px-3 py-2 text-xs text-inkSecondary space-y-1">
                          {row.note && <div>메모: {row.note}</div>}
                          {row.amount != null && <div>거래금액: {row.amount.toLocaleString("ko-KR")}원</div>}
                          {row.strategy_checklist && row.strategy_checklist.length > 0 && (
                            <div>전략: {row.strategy_checklist.join(", ")}</div>
                          )}
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
