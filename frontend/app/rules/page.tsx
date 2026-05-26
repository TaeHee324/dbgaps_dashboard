"use client";

import { useQuery } from "@tanstack/react-query";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

const mdComponents: Components = {
  h1(props) {
    return (
      <h1 className="mb-4 mt-8 text-xl font-semibold text-ink first:mt-0" {...props} />
    );
  },
  h2(props) {
    return (
      <h2 className="mb-3 mt-6 border-b border-border pb-1.5 text-base font-semibold text-ink" {...props} />
    );
  },
  h3(props) {
    return (
      <h3 className="mb-2 mt-5 text-sm font-semibold text-ink" {...props} />
    );
  },
  p(props) {
    return <p className="mb-3 text-sm leading-relaxed text-ink" {...props} />;
  },
  ul(props) {
    return <ul className="mb-3 list-disc pl-5 text-sm text-ink" {...props} />;
  },
  ol(props) {
    return <ol className="mb-3 list-decimal pl-5 text-sm text-ink" {...props} />;
  },
  li(props) {
    return <li className="mb-1 leading-relaxed text-ink" {...props} />;
  },
  blockquote(props) {
    return (
      <blockquote
        className="my-3 border-l-4 border-primary bg-primarySoft px-4 py-2 text-sm text-ink"
        {...props}
      />
    );
  },
  code(props) {
    const { children, className } = props;
    const isBlock = className?.includes("language-");
    if (isBlock) {
      return (
        <pre className="my-3 overflow-x-auto rounded bg-surfaceMuted p-3 font-mono text-xs text-ink">
          <code>{children}</code>
        </pre>
      );
    }
    return (
      <code className="rounded bg-surfaceMuted px-1 py-0.5 font-mono text-xs text-ink">
        {children}
      </code>
    );
  },
  table(props) {
    return (
      <div className="my-4 overflow-x-auto">
        <table
          className="w-full border-collapse text-sm"
          {...props}
        />
      </div>
    );
  },
  thead(props) {
    return <thead className="bg-surfaceMuted text-xs text-inkSecondary" {...props} />;
  },
  th(props) {
    return (
      <th
        className="border border-border px-3 py-2 text-left font-medium"
        {...props}
      />
    );
  },
  td(props) {
    return (
      <td className="border border-border px-3 py-2 tabular-nums text-ink" {...props} />
    );
  },
  tr(props) {
    return <tr className="even:bg-surfaceMuted/40" {...props} />;
  },
  strong(props) {
    return <strong className="font-semibold text-ink" {...props} />;
  },
  a(props) {
    return (
      <a
        className="text-primary underline underline-offset-2 hover:opacity-80"
        {...props}
      />
    );
  },
};

export default function RulesPage() {
  const { data, isLoading, isError } = useQuery<{ content?: string; error?: string }>({
    queryKey: ["rules-content"],
    queryFn: () =>
      fetch("/api/rules-content").then((res) => {
        if (!res.ok) throw new Error("fetch failed");
        return res.json() as Promise<{ content?: string; error?: string }>;
      }),
    staleTime: Infinity,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-ink">대회 룰</h1>

      {isLoading && (
        <div className="rounded-md border border-border bg-surface px-6 py-12 text-center">
          <p className="text-sm text-inkSecondary">불러오는 중...</p>
        </div>
      )}

      {isError && (
        <div className="rounded-md border border-border bg-surface px-6 py-12 text-center">
          <p className="text-sm text-inkSecondary">
            규칙 파일을 불러올 수 없습니다. 서버를 확인하세요.
          </p>
        </div>
      )}

      {data?.error && (
        <div className="rounded-md border border-border bg-surface px-6 py-12 text-center">
          <p className="text-sm text-inkSecondary">{data.error}</p>
        </div>
      )}

      {data?.content && (
        <div className="rounded-lg border border-border bg-surface p-6">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
            components={mdComponents}
          >
            {data.content}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}
