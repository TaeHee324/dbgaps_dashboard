"use client";

type PieSlice = { label: string; value: number; color: string };

type PieChartProps = { data: PieSlice[]; size?: number };

const DEFAULT_COLORS = [
  "#3F2EE0",
  "#6B5EF8",
  "#9B8FFA",
  "#C4BBFC",
  "#0F7A3D",
  "#1DA85A",
  "#64C88A",
  "#A8E4C0",
  "#0B1B2C",
  "#46586B",
];

export function PieChart({ data, size = 200 }: PieChartProps) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;

  let cumAngle = -Math.PI / 2;
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.4;

  const slices = data.map((d, i) => {
    const color = d.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length];
    const angle = (d.value / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(cumAngle);
    const y1 = cy + r * Math.sin(cumAngle);
    cumAngle += angle;
    const x2 = cx + r * Math.cos(cumAngle);
    const y2 = cy + r * Math.sin(cumAngle);
    const largeArc = angle > Math.PI ? 1 : 0;
    return { ...d, color, x1, y1, x2, y2, largeArc };
  });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map((s, i) => (
          <path
            key={i}
            d={`M ${cx} ${cy} L ${s.x1} ${s.y1} A ${r} ${r} 0 ${s.largeArc} 1 ${s.x2} ${s.y2} Z`}
            fill={s.color}
            stroke="#fff"
            strokeWidth={1.5}
          />
        ))}
      </svg>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          fontSize: 11,
          fontFamily: "JetBrains Mono, monospace",
        }}
      >
        {data.map((d, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: d.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length],
                flexShrink: 0,
              }}
            />
            <span style={{ color: "#46586B" }}>{d.label}</span>
            <span
              style={{
                color: "#0B1B2C",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {(d.value * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
