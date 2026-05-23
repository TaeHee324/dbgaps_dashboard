"use client";

import { useEffect, useRef } from "react";
import type { IChartApi } from "lightweight-charts";

type DrawdownChartProps = {
  data: { time: string; value: number }[];
};

const chartOptions = {
  layout: {
    textColor: "#64748B",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  },
  grid: {
    vertLines: { color: "#F1F5F9" },
    horzLines: { color: "#F1F5F9" },
  },
  rightPriceScale: {
    borderColor: "#E2E8F0",
  },
  timeScale: {
    borderColor: "#E2E8F0",
    timeVisible: false,
  },
  crosshair: {
    vertLine: { color: "#94A3B8" },
    horzLine: { color: "#94A3B8" },
  },
};

export function DrawdownChart({ data }: DrawdownChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) {
      return;
    }

    let chart: IChartApi | null = null;
    let cancelled = false;

    async function mountChart() {
      const { AreaSeries, ColorType, createChart } = await import("lightweight-charts");

      if (!containerRef.current || cancelled) {
        return;
      }

      chart = createChart(containerRef.current, {
        ...chartOptions,
        layout: {
          ...chartOptions.layout,
          background: { type: ColorType.Solid, color: "#FFFFFF" },
        },
        width: containerRef.current.clientWidth,
        height: 280,
      });

      const areaSeries = chart.addSeries(AreaSeries, {
        topColor: "rgba(220, 38, 38, 0.1)",
        bottomColor: "rgba(220, 38, 38, 0.0)",
        lineColor: "#DC2626",
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      });

      areaSeries.setData(data);
      chart.timeScale().fitContent();
    }

    mountChart();

    const resizeObserver = new ResizeObserver(() => {
      if (chart && containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      cancelled = true;
      resizeObserver.disconnect();
      chart?.remove();
    };
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-md border border-border bg-surface text-sm text-inkMuted">
        데이터 없음
      </div>
    );
  }

  return <div ref={containerRef} className="h-72 w-full" />;
}
