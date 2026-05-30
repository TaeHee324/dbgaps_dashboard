"use client";

import { useEffect, useMemo, useRef } from "react";
import type { IChartApi } from "lightweight-charts";

type ComparisonChartProps = {
  series: Record<string, { time: string; value: number }[]>;
  yPadding?: number; // 0~1, default 0.01
  height?: number;
};

const palette = ["#533AFD", "#0EA5E9", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];

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

export function ComparisonChart({ series, yPadding = 0.01, height = 320 }: ComparisonChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const entries = useMemo(
    () => Object.entries(series).filter(([, data]) => data.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(series), yPadding, height],
  );

  useEffect(() => {
    if (!containerRef.current || entries.length === 0) {
      return;
    }

    let chart: IChartApi | null = null;
    let cancelled = false;

    async function mountChart() {
      const { ColorType, createChart, LineSeries } = await import("lightweight-charts");

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
        height,
      });

      // y축 범위 계산: 전체 데이터 최솟값 * (1-padding) ~ 최댓값 * (1+padding)
      const allValues = entries.flatMap(([, pts]) => pts.map((p) => p.value));
      const minVal = allValues.length > 0 ? Math.min(...allValues) : 0;
      const maxVal = allValues.length > 0 ? Math.max(...allValues) : 0;
      const yMin = minVal >= 0 ? minVal * (1 - yPadding) : minVal * (1 + yPadding);
      const yMax = maxVal >= 0 ? maxVal * (1 + yPadding) : maxVal * (1 - yPadding);

      entries.forEach(([name, points], index) => {
        const lineSeries = chart?.addSeries(LineSeries, {
          color: palette[index % palette.length],
          lineWidth: 2,
          title: name,
          priceLineVisible: false,
          lastValueVisible: false,
          autoscaleInfoProvider: () => ({
            priceRange: { minValue: yMin, maxValue: yMax },
            margins: { above: 0, below: 0 },
          }),
        });

        lineSeries?.setData(points);
      });

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);

  if (entries.length === 0) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center rounded-md border border-border bg-surface text-sm text-inkMuted"
      >
        데이터 없음
      </div>
    );
  }

  return <div ref={containerRef} style={{ height }} className="w-full" />;
}
