"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { NavChart } from "@/components/charts/NavChart";
import { RuleBadge } from "@/components/ui/RuleBadge";
import { get } from "@/lib/api";
import { PortfolioHolding } from "@/lib/hooks/dashboard";
import {
  useBacktest,
  useDeletePortfolio,
  useEtfList,
  useEtfPrices,
  usePortfolioList,
  useUpsertPortfolio,
} from "@/lib/hooks/portfolio";

type PortfolioRow = { code: string; weight: number };
type PeriodKey = "1M" | "3M" | "6M" | "1Y" | "전체";

const PERIODS: PeriodKey[] = ["1M", "3M", "6M", "1Y", "전체"];

function getPeriodCutoff(period: PeriodKey, lastDate: string): string | null {
  if (period === "전체") return null;
  const d = new Date(lastDate);
  if (period === "1M") d.setMonth(d.getMonth() - 1);
  else if (period === "3M") d.setMonth(d.getMonth() - 3);
  else if (period === "6M") d.setMonth(d.getMonth() - 6);
  else if (period === "1Y") d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

function fmt(value: number, type: "pct" | "dec") {
  if (!Number.isFinite(value)) return "-";
  return type === "pct" ? `${(value * 100).toFixed(1)}%` : value.toFixed(2);
}

export default function PortfolioPage() {
  const queryClient = useQueryClient();

  // ETF 탐색 state
  const [search, setSearch] = useState("");
  const [selectedCode, setSelectedCode] = useState("");
  const [selectedName, setSelectedName] = useState("");
  const [chartPeriod, setChartPeriod] = useState<PeriodKey>("1Y");

  // 포트폴리오 구성 state
  const [portfolioRows, setPortfolioRows] = useState<PortfolioRow[]>([
    { code: "", weight: 0 },
  ]);
  const [loadName, setLoadName] = useState("");
  const [saveName, setSaveName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState("");

  // 데이터 hooks
  const { data: etfList = [] } = useEtfList();
  const { data: rawPrices = [] } = useEtfPrices(selectedCode);
  const { data: portfolioList = [] } = usePortfolioList();
  const { data: portfolioDetail } = useQuery({
    queryKey: ["portfolio-detail", loadName],
    queryFn: () => get<PortfolioHolding[]>(`/api/portfolios/${encodeURIComponent(loadName)}`),
    enabled: !!loadName,
  });

  const backtestMutation = useBacktest();
  const upsertMutation = useUpsertPortfolio();
  const deleteMutation = useDeletePortfolio();

  // ETF 목록 필터
  const filteredEtfs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return etfList;
    return etfList.filter(
      (e) =>
        e.code.toLowerCase().includes(q) ||
        e.name.toLowerCase().includes(q),
    );
  }, [etfList, search]);

  // 주가 차트 데이터 슬라이스
  const chartData = useMemo(() => {
    if (rawPrices.length === 0) return [];
    const lastDate = rawPrices[rawPrices.length - 1].date;
    const cutoff = getPeriodCutoff(chartPeriod, lastDate);
    const sliced = cutoff
      ? rawPrices.filter((p) => p.date >= cutoff)
      : rawPrices;
    return sliced.map((p) => ({ time: p.date, value: p.close }));
  }, [rawPrices, chartPeriod]);

  // ETF KPI 계산
  const etfKpi = useMemo(() => {
    if (chartData.length < 2) return null;
    const first = chartData[0].value;
    const last = chartData[chartData.length - 1].value;
    const high = Math.max(...chartData.map((d) => d.value));
    const low = Math.min(...chartData.map((d) => d.value));
    return { periodReturn: (last - first) / first, current: last, high, low };
  }, [chartData]);

  // 비중 계산
  const validRows = portfolioRows.filter((r) => r.code.trim());
  const totalWeight = Math.round(validRows.reduce((s, r) => s + r.weight, 0) * 100) / 100;
  const weightOverflow = totalWeight > 100;

  // 행 조작
  function addRow() {
    setPortfolioRows((prev) => [...prev, { code: "", weight: 0 }]);
  }

  function removeRow(i: number) {
    setPortfolioRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateRowCode(i: number, value: string) {
    setPortfolioRows((prev) =>
      prev.map((r, idx) => (idx === i ? { ...r, code: value } : r)),
    );
  }

  function updateRowWeight(i: number, value: number) {
    setPortfolioRows((prev) =>
      prev.map((r, idx) => (idx === i ? { ...r, weight: value } : r)),
    );
  }

  // 포트폴리오 불러오기
  function handleLoad() {
    if (portfolioDetail && portfolioDetail.length > 0) {
      setPortfolioRows(portfolioDetail.map((h) => ({ code: h.code, weight: Math.round(h.weight * 10000) / 100 })));
    }
  }

  // 백테스트 실행
  function handleRunBacktest() {
    if (validRows.length === 0) return;
    backtestMutation.mutate({
      holdings: validRows.map((r) => ({ code: r.code, weight: r.weight / 100 })),
    });
  }

  // 저장
  function handleSave() {
    if (!saveName.trim() || validRows.length === 0) return;
    upsertMutation.mutate(
      { name: saveName.trim(), holdings: validRows.map((r) => ({ code: r.code, weight: r.weight / 100 })) },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: ["portfolio-list"] });
          setSaveName("");
        },
      },
    );
  }

  // 삭제
  function handleDelete() {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget, {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ["portfolio-list"] });
        setDeleteTarget("");
      },
    });
  }

  const btResult = backtestMutation.data;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-ink">ETF 포트폴리오</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* 왼쪽: ETF 탐색 + 포트폴리오 구성 */}
        <div className="space-y-6 lg:col-span-2">
          {/* 섹션 1: ETF 탐색 */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-ink">ETF 탐색</h2>
            <input
              type="text"
              placeholder="코드 또는 ETF명 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-inkMuted focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <div className="h-64 overflow-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface">
                  <tr className="border-b border-border text-left">
                    <th className="px-3 py-2 text-xs font-medium text-inkSecondary">코드</th>
                    <th className="px-3 py-2 text-xs font-medium text-inkSecondary">ETF명</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEtfs.map((etf) => (
                    <tr
                      key={etf.code}
                      onClick={() => {
                        setSelectedCode(etf.code);
                        setSelectedName(etf.name);
                      }}
                      className={`cursor-pointer border-b border-border last:border-0 hover:bg-surfaceMuted ${selectedCode === etf.code ? "bg-primarySoft" : ""}`}
                    >
                      <td className="px-3 py-2 font-mono text-xs text-primary">{etf.code}</td>
                      <td className="px-3 py-2 text-xs text-ink">{etf.name}</td>
                    </tr>
                  ))}
                  {filteredEtfs.length === 0 && (
                    <tr>
                      <td colSpan={2} className="px-3 py-4 text-center text-xs text-inkMuted">
                        검색 결과 없음
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* 섹션 2: 포트폴리오 구성 */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-ink">포트폴리오 구성</h2>

            {/* 불러오기 */}
            {portfolioList.length > 0 && (
              <div className="flex gap-2">
                <select
                  value={loadName}
                  onChange={(e) => setLoadName(e.target.value)}
                  className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">포트폴리오 선택</option>
                  {portfolioList.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleLoad}
                  disabled={!loadName}
                  className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink hover:bg-surfaceMuted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  불러오기
                </button>
              </div>
            )}

            {/* 행 입력 */}
            <div className="space-y-2">
              {portfolioRows.map((row, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="코드 (예: 069500)"
                    value={row.code}
                    onChange={(e) => updateRowCode(i, e.target.value)}
                    className="flex-1 rounded-md border border-border bg-surface px-3 py-2 font-mono text-sm text-ink placeholder:text-inkMuted focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <input
                    type="number"
                    placeholder="비중 (%)"
                    value={row.weight}
                    min={0}
                    max={100}
                    step={1}
                    onChange={(e) =>
                      updateRowWeight(i, parseFloat(e.target.value) || 0)
                    }
                    className="w-24 rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  {portfolioRows.length > 1 && (
                    <button
                      onClick={() => removeRow(i)}
                      className="rounded-md border border-border px-3 py-2 text-xs text-inkSecondary hover:bg-surfaceMuted"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={addRow}
              className="text-sm text-primary hover:underline"
            >
              + 행 추가
            </button>

            {/* 비중 합계 */}
            <p
              className={`text-xs ${weightOverflow ? "font-medium text-danger" : "text-inkSecondary"}`}
            >
              비중 합계: {totalWeight.toFixed(1)}% / 100%
              {weightOverflow && " — 합계 초과"}
            </p>

            {/* 백테스트 실행 */}
            <button
              onClick={handleRunBacktest}
              disabled={validRows.length === 0 || backtestMutation.isPending}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primaryPressed disabled:cursor-not-allowed disabled:opacity-50"
            >
              {backtestMutation.isPending ? "백테스트 실행 중..." : "백테스트 실행"}
            </button>

            {backtestMutation.isError && (
              <p className="text-xs text-danger">
                백테스트 실패: {backtestMutation.error?.message}
              </p>
            )}
          </section>
        </div>

        {/* 오른쪽: 주가 차트 + 백테스트 결과 */}
        <div className="space-y-6 lg:col-span-3">
          {/* 주가 차트 */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-ink">
                주가 차트
                {selectedCode &&
                  ` — ${selectedName || selectedCode} (${selectedCode})`}
              </h2>
              <div className="flex gap-1">
                {PERIODS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setChartPeriod(p)}
                    className={`rounded-md px-2 py-1 text-xs font-medium transition ${
                      chartPeriod === p
                        ? "bg-primary text-white"
                        : "text-inkSecondary hover:bg-surfaceMuted"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <NavChart data={chartData} />

            {etfKpi && (
              <div className="grid grid-cols-4 gap-3">
                {[
                  {
                    label: "기간수익률",
                    value: `${(etfKpi.periodReturn * 100).toFixed(2)}%`,
                  },
                  {
                    label: "현재가",
                    value: `${etfKpi.current.toLocaleString("ko-KR")}원`,
                  },
                  {
                    label: "기간최고가",
                    value: `${etfKpi.high.toLocaleString("ko-KR")}원`,
                  },
                  {
                    label: "기간최저가",
                    value: `${etfKpi.low.toLocaleString("ko-KR")}원`,
                  },
                ].map((kpi) => (
                  <div
                    key={kpi.label}
                    className="rounded-md border border-border bg-surface px-3 py-2 shadow-panel"
                  >
                    <div className="text-xs text-inkSecondary">{kpi.label}</div>
                    <div className="mt-1 font-numeric text-sm font-semibold tabular-nums text-ink">
                      {kpi.value}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!selectedCode && (
              <p className="text-xs text-inkMuted">
                왼쪽 테이블에서 ETF를 선택하면 주가 차트가 표시됩니다.
              </p>
            )}
          </section>

          {/* 백테스트 결과 */}
          {btResult && (
            <section className="space-y-4 rounded-md border border-border bg-surface p-4">
              <h2 className="text-sm font-semibold text-ink">백테스트 결과</h2>

              {/* KPI 7개 */}
              <div className="grid grid-cols-7 gap-2">
                {(
                  [
                    { label: "누적수익률", key: "cumulative_return", type: "pct" },
                    { label: "CAGR", key: "cagr", type: "pct" },
                    { label: "MDD", key: "mdd", type: "pct" },
                    { label: "샤프", key: "sharpe", type: "dec" },
                    { label: "칼마", key: "calmar", type: "dec" },
                    { label: "알파", key: "alpha", type: "dec" },
                    { label: "베타", key: "beta", type: "dec" },
                  ] as const
                ).map((kpi) => (
                  <div
                    key={kpi.label}
                    className="rounded-md border border-border bg-background px-2 py-2 text-center"
                  >
                    <div className="text-xs text-inkSecondary">{kpi.label}</div>
                    <div className="mt-1 font-numeric text-xs font-semibold tabular-nums text-ink">
                      {fmt(btResult.summary[kpi.key], kpi.type)}
                    </div>
                  </div>
                ))}
              </div>

              {/* NAV 차트 */}
              <NavChart
                data={btResult.nav.map((p) => ({
                  time: p.date,
                  value: p.portfolio_value,
                }))}
              />

              {/* 규칙 체크 */}
              <div>
                <p className="mb-2 text-xs font-medium text-inkSecondary">규칙 체크</p>
                <RuleBadge rules={btResult.rules} />
              </div>

              {/* 포트폴리오 저장 */}
              <div className="border-t border-border pt-4">
                <p className="mb-2 text-xs font-semibold text-inkSecondary">포트폴리오 저장</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="이름 (예: my_portfolio)"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-ink placeholder:text-inkMuted focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <button
                    onClick={handleSave}
                    disabled={!saveName.trim() || upsertMutation.isPending}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primaryPressed disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    저장
                  </button>
                </div>
                {upsertMutation.isSuccess && (
                  <p className="mt-1 text-xs text-success">저장 완료</p>
                )}
                {upsertMutation.isError && (
                  <p className="mt-1 text-xs text-danger">
                    저장 실패: {upsertMutation.error?.message}
                  </p>
                )}
              </div>

              {/* 포트폴리오 삭제 */}
              {portfolioList.length > 0 && (
                <div className="border-t border-border pt-4">
                  <p className="mb-2 text-xs font-semibold text-inkSecondary">포트폴리오 삭제</p>
                  <div className="flex gap-2">
                    <select
                      value={deleteTarget}
                      onChange={(e) => setDeleteTarget(e.target.value)}
                      className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      <option value="">삭제할 포트폴리오 선택</option>
                      {portfolioList.map((p) => (
                        <option key={p.name} value={p.name}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleDelete}
                      disabled={!deleteTarget || deleteMutation.isPending}
                      className="rounded-md border border-danger px-4 py-2 text-sm font-medium text-danger hover:bg-dangerSoft disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      삭제
                    </button>
                  </div>
                  {deleteMutation.isSuccess && (
                    <p className="mt-1 text-xs text-success">삭제 완료</p>
                  )}
                  {deleteMutation.isError && (
                    <p className="mt-1 text-xs text-danger">
                      삭제 실패: {deleteMutation.error?.message}
                    </p>
                  )}
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
