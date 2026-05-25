"use client";

import { useMemo } from "react";
import { useLiveHoldings, type LiveHolding } from "@/lib/hooks/dashboard";
import { PieChart } from "@/components/charts/PieChart";

const PANEL_STYLE: React.CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid #E4E9EF",
  borderRadius: 6,
  boxShadow: "0 1px 0 rgba(11,27,44,.04), 0 1px 2px rgba(11,27,44,.04)",
};

const PANEL_HEAD_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "10px 14px",
  borderBottom: "1px solid #E4E9EF",
};

function PanelTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={PANEL_HEAD_STYLE}>
      <div
        style={{
          fontSize: 12.5,
          fontWeight: 700,
          letterSpacing: "-0.005em",
          color: "#0B1B2C",
        }}
      >
        {title}
      </div>
      {sub && (
        <div
          style={{
            fontSize: 11,
            color: "#8595A6",
            fontFamily: "JetBrains Mono, monospace",
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

const RISK_COLORS: Record<string, string> = {
  위험: "#A4232B",
  안전: "#0F7A3D",
};
const RISK_DEFAULT_COLOR = "#8595A6";

const ASSET_CLASS_PALETTE = [
  "#3F2EE0",
  "#0F7A3D",
  "#F59E0B",
  "#0B1B2C",
  "#6B5EF8",
  "#1DA85A",
  "#64C88A",
  "#8595A6",
];

function aggregateByKey(
  holdings: LiveHolding[],
  keyFn: (h: LiveHolding) => string,
  colorFn: (label: string, idx: number) => string,
): { label: string; value: number; color: string }[] {
  const map = new Map<string, number>();
  for (const h of holdings) {
    const key = keyFn(h);
    map.set(key, (map.get(key) ?? 0) + h.current_weight);
  }
  return Array.from(map.entries()).map(([label, value], idx) => ({
    label,
    value,
    color: colorFn(label, idx),
  }));
}

const subHeadStyle: React.CSSProperties = {
  fontSize: 11.5,
  fontWeight: 700,
  color: "#0B1B2C",
  fontFamily: "JetBrains Mono, monospace",
  marginBottom: 8,
};

export function HoldingsCompositionPanel() {
  const { data: holdings, isLoading, isError } = useLiveHoldings();

  const riskData = useMemo(() => {
    if (!holdings || holdings.length === 0) return [];
    return aggregateByKey(
      holdings,
      (h) => h.risk_type,
      (label) => RISK_COLORS[label] ?? RISK_DEFAULT_COLOR,
    );
  }, [holdings]);

  const assetData = useMemo(() => {
    if (!holdings || holdings.length === 0) return [];
    return aggregateByKey(
      holdings,
      (h) => h.asset_class,
      (_label, idx) => ASSET_CLASS_PALETTE[idx % ASSET_CLASS_PALETTE.length],
    );
  }, [holdings]);

  const isEmpty = isLoading || isError || !holdings || holdings.length === 0;

  return (
    <div style={PANEL_STYLE}>
      <PanelTitle title="포트폴리오 구성" />
      <div style={{ padding: "12px 14px" }}>
        {isEmpty ? (
          <div
            style={{
              fontSize: 12,
              fontFamily: "JetBrains Mono, monospace",
              color: "#8595A6",
            }}
          >
            보유 종목 없음
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            {/* 위험구분 */}
            <div>
              <div style={subHeadStyle}>위험구분</div>
              <PieChart data={riskData} size={160} />
            </div>

            {/* 자산구분 */}
            <div>
              <div style={subHeadStyle}>자산구분</div>
              <PieChart data={assetData} size={160} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import React from "react";
