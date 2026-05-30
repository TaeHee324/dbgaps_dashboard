"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { MermaidChart } from "./MermaidChart";

const mdComponents: Components = {
  code({ className, children }) {
    const lang = /language-(\w+)/.exec(className ?? "")?.[1];
    if (lang === "mermaid") {
      return <MermaidChart chart={String(children).replace(/\n$/, "")} />;
    }
    return (
      <code className={`${className ?? ""} rounded bg-slate-100 px-1 py-0.5 text-sm font-mono`}>
        {children}
      </code>
    );
  },
  pre({ children }) {
    return <pre className="overflow-x-auto rounded bg-slate-100 p-3 text-sm">{children}</pre>;
  },
  img(props) {
    return (
      <img
        src={props.src}
        alt={props.alt ?? ""}
        className="my-3 max-w-full rounded border border-slate-200"
      />
    );
  },
};

export function MarkdownDoc({ content }: { content: string }) {
  return (
    <div className="prose prose-sm max-w-none prose-headings:text-slate-900 prose-p:text-slate-800 prose-li:text-slate-800 prose-table:w-full prose-th:bg-slate-50 prose-th:border-slate-200 prose-td:border-slate-200 prose-strong:text-slate-900">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={mdComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
