type StatusBarProps = {
  date: string;
};

export function StatusBar({ date }: StatusBarProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "3px 8px",
          border: "1px solid #E4E9EF",
          borderRadius: 999,
          fontSize: 11,
          color: "#46586B",
          fontFamily: "JetBrains Mono, monospace",
          background: "#FFFFFF",
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "#0F7A3D",
            boxShadow: "0 0 0 3px rgba(15,122,61,.12)",
            flexShrink: 0,
          }}
        />
        LIVE · KRX 정규장
      </span>

      {date && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "3px 8px",
            border: "1px solid #E4E9EF",
            borderRadius: 999,
            fontSize: 11,
            color: "#46586B",
            fontFamily: "JetBrains Mono, monospace",
            background: "#FFFFFF",
          }}
        >
          AS-OF&nbsp;
          <span style={{ color: "#0B1B2C", fontWeight: 500 }}>{date}</span>
        </span>
      )}
    </div>
  );
}
