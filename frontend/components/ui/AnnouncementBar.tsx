"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { get } from "@/lib/api";

type ChangelogEntry = {
  hash: string;
  date: string;
  subject: string;
  body: string;
  type: string;
};

const STORAGE_KEY = "dbgaps_last_seen_changelog";
const SHOW_TYPES = new Set(["feat", "fix", "refactor"]);

function stripTypePrefix(subject: string): string {
  return subject.replace(/^[a-z]+(\([^)]+\))?:\s*/i, "");
}

export function AnnouncementBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [targetEntry, setTargetEntry] = useState<ChangelogEntry | null>(null);

  const { data: entries = [] } = useQuery<ChangelogEntry[]>({
    queryKey: ["update-log"],
    queryFn: () => get<ChangelogEntry[]>("/api/update-log"),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (entries.length === 0) return;
    const latest = entries.find((e) => SHOW_TYPES.has(e.type)) ?? null;
    if (!latest) return;

    const lastSeen = localStorage.getItem(STORAGE_KEY);
    if (lastSeen !== latest.hash) {
      setTargetEntry(latest);
      setVisible(true);
    }
  }, [entries]);

  function dismiss() {
    if (targetEntry) localStorage.setItem(STORAGE_KEY, targetEntry.hash);
    setVisible(false);
  }

  function handleLinkClick() {
    dismiss();
    router.push("/changelog");
  }

  if (!visible || !targetEntry || pathname === "/changelog") return null;

  const displaySubject = stripTypePrefix(targetEntry.subject);

  return (
    <div
      className="-mx-5 -mt-6 mb-5 sm:-mx-8 lg:-mx-8 lg:-mt-6"
      style={{ borderLeft: "3px solid #3F2EE0" }}
    >
      <div
        className="flex items-center gap-3 bg-primarySoft px-4 py-2.5"
      >
        {/* 타입 배지 */}
        <span className="shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold bg-primary text-white font-mono">
          {targetEntry.type}
        </span>

        {/* 날짜 (모바일 숨김) */}
        <span className="hidden shrink-0 tabular-nums text-xs text-inkSecondary sm:inline">
          {targetEntry.date}
        </span>

        {/* subject */}
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-primary">
          {displaySubject}
        </span>

        {/* 업데이트 로그 링크 */}
        <button
          onClick={handleLinkClick}
          className="shrink-0 text-xs font-medium text-primary underline-offset-2 hover:underline"
        >
          업데이트 로그 →
        </button>

        {/* 닫기 */}
        <button
          onClick={dismiss}
          aria-label="닫기"
          className="shrink-0 text-inkSecondary hover:text-ink"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
