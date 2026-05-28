"use client";

import { useState, Fragment, useMemo, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTradeLog, usePortfolioEtfs, useLiveHoldings, useActualNav, type TradeLogEntry } from "@/lib/hooks/dashboard";
import { useEtfList, useEtfPrices, useUpdateActiveHolding } from "@/lib/hooks/portfolio";
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

function formatComma(n: number | null | undefined): string {
  if (n === null || n === undefined) return "";
  return n.toLocaleString("ko-KR");
}

function parseComma(s: string): number | null {
  const cleaned = s.replace(/,/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
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
  const { data: liveHoldings = [] } = useLiveHoldings();
  const addTrade = useAddTrade();
  const updateTrade = useUpdateTrade();
  const deleteTrade = useDeleteTrade();
  const updateActiveHolding = useUpdateActiveHolding();

  const [form, setForm] = useState<AddTradeRequest>(makeDefaultForm);
  const [editId, setEditId] = useState<number | null>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [calcTotalAssets, setCalcTotalAssets] = useState<number | null>(null);
  const [calcTargetWeight, setCalcTargetWeight] = useState<number>(0);
  // 사용자가 단가를 수동 수정했는지 추적
  const userEditedPrice = useRef(false);

  const { data: etfPrices = [] } = useEtfPrices(form.etf_code);
  const { data: actualNav = [] } = useActualNav();

  // 총자산 기본값: live holdings market_value 합산
  const liveNavTotal = useMemo(() => {
    if (!liveHoldings.length) return 0;
    return liveHoldings.reduce((acc, h) => acc + h.market_value, 0);
  }, [liveHoldings]);

  // 거래 날짜 기준 NAV (ffill 방식)
  const navOnDate = useMemo(() => {
    if (!actualNav.length || !form.date) return liveNavTotal;
    const candidates = actualNav.filter((p) => p.date <= form.date);
    if (!candidates.length) return liveNavTotal;
    return candidates[candidates.length - 1].portfolio_value;
  }, [actualNav, form.date, liveNavTotal]);

  // form.date 변경 시 calcTotalAssets를 navOnDate로 리셋
  useEffect(() => {
    if (navOnDate > 0) {
      setCalcTotalAssets(navOnDate);
    }
  }, [navOnDate]);

  // form.date 이하 가장 가까운 종가 (ffill 방식)
  const priceOnDate = useMemo(() => {
    if (!etfPrices.length || !form.date) return 0;
    const candidates = etfPrices.filter((p) => p.date <= form.date);
    if (!candidates.length) return 0;
    return candidates[candidates.length - 1].close;
  }, [etfPrices, form.date]);

  // ETF 선택 또는 날짜 변경 시 단가 자동 세팅 (사용자 수동 입력 시 덮어쓰지 않음)
  useEffect(() => {
    if (priceOnDate > 0 && !userEditedPrice.current) {
      setForm((prev) => ({ ...prev, price: priceOnDate }));
    }
  }, [priceOnDate]);

  const effectiveTotalAssets = calcTotalAssets ?? 0;

  // 현재 선택한 ETF의 보유 수량
  const currentHoldingQty = useMemo(() => {
    const h = liveHoldings.find((h) => h.code === form.etf_code);
    return h?.quantity ?? 0;
  }, [liveHoldings, form.etf_code]);

  // 역산 계산기: 목표비중 달성을 위한 필요 수량 (현재 보유량 차분 반영)
  const calcNeededQty = useMemo(() => {
    if (priceOnDate <= 0 || effectiveTotalAssets <= 0 || calcTargetWeight <= 0) return null;
    const targetValue = effectiveTotalAssets * (calcTargetWeight / 100);
    const currentValue = currentHoldingQty * priceOnDate;
    const diff = targetValue - currentValue;

    if (form.action === "매수" && diff > 0) {
      return Math.floor(diff / priceOnDate);
    } else if (form.action === "매도" && diff < 0) {
      return Math.floor(-diff / priceOnDate);
    } else if (form.action === "리밸런싱") {
      return Math.abs(diff) > priceOnDate ? Math.round(Math.abs(diff) / priceOnDate) : 0;
    }
    return 0;
  }, [priceOnDate, effectiveTotalAssets, calcTargetWeight, currentHoldingQty, form.action]);

  const sorted = [...tradeLog].sort((a, b) => b.date.localeCompare(a.date));

  // P&L 계산: 날짜 오름차순으로 순회하며 ETF별 평균단가 누적
  const pnlMap = (() => {
    const asc = [...tradeLog].sort((a, b) => a.date.localeCompare(b.date));
    // key: etf_code, value: { totalCost: number, totalQty: number }
    const costBasis: Record<string, { totalCost: number; totalQty: number }> = {};
    const result: Record<number, number | null> = {};

    for (const trade of asc) {
      if (trade.action === "매수" || trade.action === "리밸런싱") {
        if (trade.price != null && trade.quantity != null) {
          const prev = costBasis[trade.etf_code] ?? { totalCost: 0, totalQty: 0 };
          costBasis[trade.etf_code] = {
            totalCost: prev.totalCost + trade.price * trade.quantity,
            totalQty: prev.totalQty + trade.quantity,
          };
        }
        result[trade.id] = null; // 매수/리밸런싱은 P&L 없음
      } else if (trade.action === "매도") {
        if (trade.price != null && trade.quantity != null) {
          const basis = costBasis[trade.etf_code];
          if (basis && basis.totalQty > 0) {
            const avgCost = basis.totalCost / basis.totalQty;
            const pnl = (trade.price - avgCost) * trade.quantity;
            result[trade.id] = pnl;
            // 매도 후 cost basis 조정
            const newQty = basis.totalQty - trade.quantity;
            costBasis[trade.etf_code] = {
              totalCost: newQty > 0 ? avgCost * newQty : 0,
              totalQty: Math.max(0, newQty),
            };
          } else {
            result[trade.id] = null; // 매수 이력 없으면 계산 불가
          }
        } else {
          result[trade.id] = null; // price/quantity null이면 계산 불가
        }
      }
    }
    return result;
  })();

  function handleEditClick(row: TradeLogEntry) {
    setEditId(row.id);
    // 수정 시 기존 단가가 있으면 수동 입력으로 간주해 auto-fill 방지
    userEditedPrice.current = row.price != null;
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
    userEditedPrice.current = false; // ETF 변경 시 auto-fill 허용
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

    // active 포트폴리오 비중 자동 업데이트 (silent fail)
    if (calcTargetWeight > 0 && form.etf_code) {
      try {
        await updateActiveHolding.mutateAsync({
          code: form.etf_code,
          weight: calcTargetWeight / 100,
        });
      } catch {
        // 포트폴리오 업데이트 실패는 거래 저장에 영향 주지 않음
      }
    }

    setForm(makeDefaultForm());
    setEditId(null);
    userEditedPrice.current = false;
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
            onClick={() => { setEditId(null); setForm(makeDefaultForm()); userEditedPrice.current = false; }}
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

          {priceOnDate > 0 && (
            <div className="rounded border border-border bg-surfaceMuted p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-inkSecondary">역산 계산기 — 목표 비중 → 필요 수량</p>
                {priceOnDate > 0 && (
                  <p className="text-xs text-inkSecondary">
                    기준가: {priceOnDate.toLocaleString("ko-KR")}원 ({form.date} 종가)
                  </p>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-inkSecondary">총자산 (원)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatComma(calcTotalAssets)}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/,/g, "");
                      if (/^\d*$/.test(raw)) {
                        setCalcTotalAssets(raw === "" ? null : parseFloat(raw));
                      }
                    }}
                    placeholder="100,000,000"
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
                    {calcNeededQty === null
                      ? "—"
                      : calcNeededQty === 0
                      ? "필요 없음"
                      : calcNeededQty.toLocaleString("ko-KR")}
                  </div>
                  {calcNeededQty !== null && calcNeededQty > 0 && priceOnDate > 0 && (
                    <p className="text-xs text-inkMuted">
                      {form.date} 종가 {priceOnDate.toLocaleString("ko-KR")}원 기준
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-inkSecondary">{form.action === "매도" ? "매도단가(원)" : "매수단가(원)"}</label>
              <input
                type="text"
                inputMode="numeric"
                value={formatComma(form.price)}
                onChange={(e) => {
                  const raw = e.target.value.replace(/,/g, "");
                  if (!/^\d*$/.test(raw)) return;
                  userEditedPrice.current = true;
                  const p = raw === "" ? null : parseFloat(raw);
                  const q = form.quantity ?? null;
                  setForm((prev) => ({
                    ...prev,
                    price: p,
                    amount: p && q ? Math.round(p * q) : null,
                  }));
                }}
                placeholder="50,000"
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
              <div className="rounded border border-border bg-background px-2 py-1.5 text-sm text-inkSecondary">
                {form.amount != null ? formatComma(Math.round(form.amount)) : "—"}
              </div>
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
                  {["날짜", "구분", "ETF 코드", "ETF 명", "비중 전", "비중 후", "수량", "단가", "거래금액", "수익/손실", ""].map((h, i) => (
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
                      <td className="px-3 py-2 tabular-nums">
                        {row.quantity != null && row.price != null
                          ? Math.round(row.quantity * row.price).toLocaleString("ko-KR")
                          : "—"}
                      </td>
                      <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                        {row.action === "매도" ? (
                          pnlMap[row.id] != null ? (
                            <span className={pnlMap[row.id]! >= 0 ? "text-green-600" : "text-red-600"}>
                              {pnlMap[row.id]! >= 0
                                ? `+₩${Math.round(pnlMap[row.id]!).toLocaleString("ko-KR")}`
                                : `-₩${Math.round(Math.abs(pnlMap[row.id]!)).toLocaleString("ko-KR")}`}
                            </span>
                          ) : (
                            <span className="text-inkSecondary">—</span>
                          )
                        ) : (
                          <span className="text-inkSecondary">—</span>
                        )}
                      </td>
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
                    {expandedIdx === idx && (
                      <tr className="border-t border-border bg-surfaceMuted">
                        <td colSpan={11} className="px-3 py-2 text-xs text-inkSecondary space-y-1">
                          <div>이유: {row.reason && row.reason.trim() !== "" ? row.reason : "이유 없음"}</div>
                          {row.note && <div>메모: {row.note}</div>}
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
