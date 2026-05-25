"use client";

import { useState, useEffect } from "react";
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

  useEffect(() => {
    if (reports.length > 0 && !selectedFilename) {
      setSelectedFilename(reports[0].filename);
    }
  }, [reports, selectedFilename]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-ink">운용보고서</h1>

      {reports.length === 0 ? (
        <div className="rounded-md border border-border bg-surface px-6 py-12 text-center">
          <p className="text-sm text-inkSecondary">
            보고서가 없습니다. 엔진 실행 후 output/report_*.md가 생성되면 표시됩니다.
          </p>
        </div>
      ) : (
        <div className="flex flex-col rounded-lg border border-border bg-surface lg:grid lg:grid-cols-[200px_1fr]">
          {/* 좌측 탭 패널 */}
          <div className="border-b border-border lg:border-b-0 lg:border-r">
            <ul className="py-1">
              {reports.map((item) => (
                <li key={item.filename}>
                  <button
                    onClick={() => setSelectedFilename(item.filename)}
                    className={[
                      "w-full px-4 py-2.5 text-left text-sm transition-colors",
                      selectedFilename === item.filename
                        ? "border-l-2 border-primary bg-primary/5 font-medium text-ink"
                        : "border-l-2 border-transparent text-inkSecondary hover:bg-surfaceMuted hover:text-ink",
                    ].join(" ")}
                  >
                    {item.period}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* 우측 콘텐츠 패널 */}
          <div className="p-5">
            {report ? (
              <>
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
              </>
            ) : (
              <p className="text-sm text-inkSecondary">보고서를 불러오는 중...</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
