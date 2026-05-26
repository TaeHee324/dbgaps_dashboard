"use client";

import { useEffect, useRef } from "react";
import type { IChartApi, SeriesMarker, Time } from "lightweight-charts";

type TradeMarker = {
  date: string;
  action: string;
  etf_name: string;
};

type NavChartProps = {
  data: { time: string; value: number }[];
  tradeMarkers?: TradeMarker[];
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
    scaleMargins: { top: 0.1, bottom: 0.1 },
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

export function NavChart({ data, tradeMarkers = [] }: NavChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) {
      return;
    }

    let chart: IChartApi | null = null;
    let cancelled = false;

    async function mountChart() {
      const {
        createChart,
        createSeriesMarkers,
        ColorType,
        LineSeries,
      } = await import("lightweight-charts");

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
        height: 320,
      });

      const lineSeries = chart.addSeries(LineSeries, {
        color: "#533AFD",
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      });

      lineSeries.setData(data);

      if (tradeMarkers.length > 0) {
        const markers: SeriesMarker<Time>[] = tradeMarkers.map((marker) => {
          const isSell = marker.action === "매도";

          return {
            time: marker.date,
            position: isSell ? "aboveBar" : "belowBar",
            shape: isSell ? "arrowDown" : "arrowUp",
            color: isSell ? "#DC2626" : "#16A34A",
            text: `${marker.action} ${marker.etf_name}`,
          };
        });

        createSeriesMarkers(lineSeries, markers);
      }

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
  }, [data, tradeMarkers]);

  if (data.length === 0) {
    return (
      <div className="flex h-80 items-center justify-center rounded-md border border-border bg-surface text-sm text-inkMuted">
        데이터 없음
      </div>
    );
  }

  return <div ref={containerRef} className="h-80 w-full" />;
}
