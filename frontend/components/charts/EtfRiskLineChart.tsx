"use client";

import { useEffect, useRef } from "react";
import type { IChartApi } from "lightweight-charts";

type EtfRiskLineChartProps = {
  data: { time: string; value: number }[];
  mode: "price" | "return" | "drawdown";
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
    scaleMargins: { top: 0.12, bottom: 0.12 },
    autoScale: true,
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

export function EtfRiskLineChart({ data, mode }: EtfRiskLineChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    let chart: IChartApi | null = null;
    let cancelled = false;

    async function mountChart() {
      const { AreaSeries, ColorType, LineSeries, createChart } = await import("lightweight-charts");

      if (!containerRef.current || cancelled) return;

      chart = createChart(containerRef.current, {
        ...chartOptions,
        layout: {
          ...chartOptions.layout,
          background: { type: ColorType.Solid, color: "#FFFFFF" },
        },
        width: containerRef.current.clientWidth,
        height: 300,
      });

      const isDrawdown = mode === "drawdown";
      const series = chart.addSeries(isDrawdown ? AreaSeries : LineSeries, {
        color: isDrawdown ? "#DC2626" : "#533AFD",
        lineColor: isDrawdown ? "#DC2626" : undefined,
        topColor: isDrawdown ? "rgba(220, 38, 38, 0.12)" : undefined,
        bottomColor: isDrawdown ? "rgba(220, 38, 38, 0.00)" : undefined,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        priceFormat:
          mode === "price"
            ? { type: "price", precision: 0, minMove: 1 }
            : {
                type: "custom",
                formatter: (value: number) => `${value.toFixed(1)}%`,
              },
      });

      series.setData(data);
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
  }, [data, mode]);

  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded-md border border-border bg-surface text-sm text-inkMuted">
        가격 이력 없음
      </div>
    );
  }

  return <div ref={containerRef} className="h-[300px] w-full" />;
}
