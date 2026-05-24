"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { useReports, useReportDetail } from "@/lib/hooks/dashboard";

export default function ReportPage() {
  const [selectedFilename, setSelectedFilename] = useState("");
  const { data: reports = [] } = useReports();
  const { data: report } = useReportDetail(selectedFilename);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-ink">운용보고서</h1>

      {selectedFilename ? (
        <div className="space-y-4">
          <button
            onClick={() => setSelectedFilename("")}
            className="text-sm text-primary hover:underline"
          >
            ← 목록으로
          </button>
          {report ? (
            <section className="rounded-lg border border-border bg-surface p-5">
              <p className="mb-4 text-xs text-inkSecondary">{report.filename}</p>
              <div className="space-y-2 text-sm leading-relaxed text-ink [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_p]:text-sm [&_ul]:list-disc [&_ul]:pl-5">
                <ReactMarkdown>{report.content}</ReactMarkdown>
              </div>
            </section>
          ) : (
            <p className="text-sm text-inkSecondary">보고서를 불러오는 중...</p>
          )}
        </div>
      ) : (
        <>
          {reports.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {reports.map((item) => (
                <div
                  key={item.filename}
                  onClick={() => setSelectedFilename(item.filename)}
                  className="rounded-lg border border-border bg-surface p-5 cursor-pointer hover:bg-surfaceMuted"
                >
                  <p className="text-sm font-semibold text-ink">{item.period}</p>
                  <p className="mt-1 text-xs text-inkSecondary">{item.title}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-inkSecondary">
              보고서 없음. 엔진 실행 후 output/report_*.md가 생성되면 표시됩니다.
            </p>
          )}
        </>
      )}
    </div>
  );
}
