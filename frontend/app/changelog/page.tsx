"use client";

import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api";

type ChangelogEntry = {
  hash: string;
  date: string;
  subject: string;
  body: string;
  type: string;
};

const TYPE_STYLES: Record<string, string> = {
  feat: "bg-primarySoft text-primary",
  fix: "bg-dangerSoft text-danger",
  chore: "bg-surfaceMuted text-inkSecondary",
  docs: "bg-surfaceMuted text-inkSecondary",
  refactor: "bg-warningSoft text-warning",
  style: "bg-surfaceMuted text-inkSecondary",
  test: "bg-successSoft text-success",
  update: "bg-surfaceMuted text-inkSecondary",
};

export default function ChangelogPage() {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const { data: entries = [], isLoading, isError } = useQuery({
    queryKey: ["update-log"],
    queryFn: () => get<ChangelogEntry[]>("/api/update-log"),
  });

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-ink">업데이트 로그</h1>

      {isLoading && (
        <p className="text-sm text-inkSecondary">불러오는 중...</p>
      )}
      {isError && (
        <p className="text-sm text-inkSecondary">
          업데이트 로그를 불러올 수 없습니다. 서버를 확인하세요.
        </p>
      )}

      {!isLoading && !isError && entries.length === 0 && (
        <p className="text-sm text-inkSecondary">업데이트 기록 없음</p>
      )}

      {entries.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surfaceMuted text-xs text-inkSecondary">
              <tr>
                {["날짜", "타입", "내용", "커밋", ""].map((h, i) => (
                  <th key={i} className="px-3 py-2 text-left font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, idx) => (
                <Fragment key={entry.hash + idx}>
                  <tr
                    onClick={() =>
                      setExpandedIdx(expandedIdx === idx ? null : idx)
                    }
                    className="cursor-pointer border-t border-border hover:bg-surfaceMuted"
                  >
                    <td className="px-3 py-2 tabular-nums text-inkSecondary whitespace-nowrap">
                      {entry.date}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${TYPE_STYLES[entry.type] ?? TYPE_STYLES.update}`}
                      >
                        {entry.type}
                      </span>
                    </td>
                    <td className="max-w-xs truncate px-3 py-2 text-ink">
                      {entry.subject}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-inkMuted">
                      {entry.hash}
                    </td>
                    <td className="px-3 py-2 text-xs text-inkMuted">
                      {entry.body ? "▼" : ""}
                    </td>
                  </tr>
                  {expandedIdx === idx && entry.body && (
                    <tr className="border-t border-border bg-surfaceMuted">
                      <td
                        colSpan={5}
                        className="whitespace-pre-wrap px-3 py-2 text-xs text-inkSecondary"
                      >
                        {entry.body}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
