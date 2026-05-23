"use client";

import ReactMarkdown from "react-markdown";
import { useReport } from "@/lib/hooks/dashboard";

export default function ReportPage() {
  const { data: report } = useReport();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-ink">운용보고서</h1>
      {report ? (
        <section className="rounded-lg border border-border bg-surface p-5">
          <p className="mb-4 text-xs text-inkSecondary">{report.filename}</p>
          <div className="space-y-2 text-sm leading-relaxed text-ink [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_p]:text-sm [&_ul]:list-disc [&_ul]:pl-5">
            <ReactMarkdown>{report.content}</ReactMarkdown>
          </div>
        </section>
      ) : (
        <p className="text-sm text-inkSecondary">
          보고서 없음. 엔진 실행 후 output/report_*.md가 생성되면 표시됩니다.
        </p>
      )}
    </div>
  );
}
