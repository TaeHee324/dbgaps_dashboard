"use client";

import { useState, useEffect } from "react";
import { useDocs, useDoc } from "@/lib/hooks/dashboard";
import { MarkdownDoc } from "@/components/ui/MarkdownDoc";

export default function ResearchPage() {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  const { data: docs = [] } = useDocs("research");
  const { data: detail } = useDoc("research", selectedSlug ?? "");

  useEffect(() => {
    if (selectedSlug) return;
    if (docs.length > 0) setSelectedSlug(docs[0].slug);
  }, [docs, selectedSlug]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-ink">리서치</h1>

      <div className="flex flex-col rounded-lg border border-border bg-surface lg:grid lg:grid-cols-[200px_1fr]">
        {/* 좌측 문서 목록 */}
        <div className="border-b border-border lg:border-b-0 lg:border-r">
          <div className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-inkSecondary">
            리서치 문서
          </div>
          {docs.length > 0 ? (
            <ul className="pb-2">
              {docs.map((doc) => {
                const active = selectedSlug === doc.slug;
                return (
                  <li key={doc.slug}>
                    <button
                      onClick={() => setSelectedSlug(doc.slug)}
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
          ) : (
            <p className="px-4 py-6 text-sm text-inkSecondary">문서 없음</p>
          )}
        </div>

        {/* 우측 콘텐츠 */}
        <div className="p-5">
          {detail?.content ? (
            <>
              {docs.find((d) => d.slug === selectedSlug)?.date && (
                <p className="mb-4 text-xs text-inkSecondary">
                  {docs.find((d) => d.slug === selectedSlug)?.date}
                </p>
              )}
              <MarkdownDoc content={detail.content} />
            </>
          ) : (
            <p className="text-sm text-inkSecondary">
              {selectedSlug ? "불러오는 중..." : "문서를 선택하세요."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
