"use client";

import { useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { useReports, useReportDetail } from "@/lib/hooks/dashboard";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const mdComponents: Components = {
  img(props) {
    const src = typeof props.src === "string" ? props.src : undefined;
    const resolvedSrc =
      src && (src.startsWith("./") || src.startsWith("../"))
        ? `${API_BASE}/api/report-image/${src.replace(/^\.\.?\//u, "")}`
        : src;
    return (
      <img
        src={resolvedSrc}
        alt={props.alt ?? ""}
        className="max-w-full rounded border border-border"
      />
    );
  },
};

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
              <div className="prose prose-sm max-w-none prose-table:w-full prose-img:rounded prose-headings:text-ink prose-p:text-ink prose-li:text-ink prose-th:bg-surfaceMuted prose-td:border-border prose-th:border-border">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw]}
                  components={mdComponents}
                >
                  {report.content}
                </ReactMarkdown>
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
