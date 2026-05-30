"use client";

import { useState, useEffect } from "react";
import { useReports, useReportDetail, useStrategyDocs, useStrategyDoc } from "@/lib/hooks/dashboard";
import { MarkdownDoc } from "@/components/ui/MarkdownDoc";

type SelectedDoc =
  | { type: "report"; filename: string }
  | { type: "strategy"; slug: string };

export default function ReportPage() {
  const [selected, setSelected] = useState<SelectedDoc | null>(null);

  const { data: reports = [] } = useReports();
  const { data: strategyDocs = [] } = useStrategyDocs();

  // 초기 선택: 전략 문서 첫 번째
  useEffect(() => {
    if (selected) return;
    if (strategyDocs.length > 0) {
      setSelected({ type: "strategy", slug: strategyDocs[0].slug });
    } else if (reports.length > 0) {
      setSelected({ type: "report", filename: reports[0].filename });
    }
  }, [strategyDocs, reports, selected]);

  const reportFilename = selected?.type === "report" ? selected.filename : "";
  const strategySlug = selected?.type === "strategy" ? selected.slug : "";

  const { data: reportDetail } = useReportDetail(reportFilename);
  const { data: strategyDetail } = useStrategyDoc(strategySlug);

  const activeContent: string | null =
    selected?.type === "strategy"
      ? (strategyDetail?.content ?? null)
      : (reportDetail?.content ?? null);

  const activeLabel: string =
    selected?.type === "strategy"
      ? (strategyDocs.find((d) => d.slug === strategySlug)?.title ?? "")
      : (reports.find((r) => r.filename === reportFilename)?.period ?? "");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-ink">운용보고서</h1>

      <div className="flex flex-col rounded-lg border border-border bg-surface lg:grid lg:grid-cols-[200px_1fr]">
        {/* 좌측 탭 패널 */}
        <div className="border-b border-border lg:border-b-0 lg:border-r">
          {/* 전략 문서 섹션 */}
          {strategyDocs.length > 0 && (
            <>
              <div className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-inkSecondary">
                전략 문서
              </div>
              <ul className="pb-1">
                {strategyDocs.map((doc) => {
                  const active = selected?.type === "strategy" && selected.slug === doc.slug;
                  return (
                    <li key={doc.slug}>
                      <button
                        onClick={() => setSelected({ type: "strategy", slug: doc.slug })}
                        className={[
                          "w-full px-4 py-2.5 text-left text-sm transition-colors",
                          active
                            ? "border-l-2 border-primary bg-primary/5 font-medium text-ink"
                            : "border-l-2 border-transparent text-inkSecondary hover:bg-surfaceMuted hover:text-ink",
                        ].join(" ")}
                      >
                        {doc.title}
                      </button>
                    </li>
                  );
                })}
              </ul>
              {reports.length > 0 && <div className="mx-4 border-t border-border" />}
            </>
          )}

          {/* 월별 운용 보고서 섹션 */}
          {reports.length > 0 && (
            <>
              <div className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-inkSecondary">
                월별 운용 보고서
              </div>
              <ul className="py-1">
                {reports.map((item) => {
                  const active = selected?.type === "report" && selected.filename === item.filename;
                  return (
                    <li key={item.filename}>
                      <button
                        onClick={() => setSelected({ type: "report", filename: item.filename })}
                        className={[
                          "w-full px-4 py-2.5 text-left text-sm transition-colors",
                          active
                            ? "border-l-2 border-primary bg-primary/5 font-medium text-ink"
                            : "border-l-2 border-transparent text-inkSecondary hover:bg-surfaceMuted hover:text-ink",
                        ].join(" ")}
                      >
                        {item.period}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {strategyDocs.length === 0 && reports.length === 0 && (
            <p className="px-4 py-6 text-sm text-inkSecondary">문서 없음</p>
          )}
        </div>

        {/* 우측 콘텐츠 패널 */}
        <div className="p-5">
          {activeContent ? (
            <>
              <p className="mb-4 text-xs text-inkSecondary">{activeLabel}</p>
              <MarkdownDoc content={activeContent} />
            </>
          ) : (
            <p className="text-sm text-inkSecondary">
              {selected ? "불러오는 중..." : "문서를 선택하세요."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
