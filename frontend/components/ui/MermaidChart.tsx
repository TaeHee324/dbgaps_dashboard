"use client";

import { useEffect, useId, useRef } from "react";

export function MermaidChart({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const uid = useId().replace(/:/g, "");
  const id = `mermaid-${uid}`;

  useEffect(() => {
    let cancelled = false;
    async function render() {
      const mermaid = (await import("mermaid")).default;
      mermaid.initialize({ startOnLoad: false, theme: "neutral" });
      if (cancelled || !ref.current) return;
      try {
        const { svg } = await mermaid.render(id, chart);
        if (!cancelled && ref.current) ref.current.innerHTML = svg;
      } catch {
        if (!cancelled && ref.current) {
          ref.current.textContent = chart;
        }
      }
    }
    render();
    return () => { cancelled = true; };
  }, [chart, id]);

  return <div ref={ref} className="my-4 overflow-x-auto" />;
}
