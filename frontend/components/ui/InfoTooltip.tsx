type InfoTooltipProps = {
  label: string;
  text: string;
  align?: "left" | "right";
};

const C = {
  ink: "#0D253D",
  inkSecondary: "#64748B",
  inkMuted: "#94A3B8",
  border: "#E2E8F0",
  surface: "#FFFFFF",
  surfaceMuted: "#F6F9FC",
} as const;

export function InfoTooltip({ label, text, align = "left" }: InfoTooltipProps) {
  return (
    <span className="info-tooltip">
      <button
        type="button"
        aria-label={`${label} 설명`}
        className="info-tooltip-trigger"
      >
        i
      </button>
      <span
        role="tooltip"
        className={`info-tooltip-popover ${align === "right" ? "info-tooltip-popover-right" : ""}`}
      >
        <strong>{label}</strong>
        <span>{text}</span>
      </span>
      <style jsx>{`
        .info-tooltip {
          position: relative;
          display: inline-flex;
          align-items: center;
          flex: 0 0 auto;
          overflow: visible;
        }

        .info-tooltip-trigger {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 16px;
          height: 16px;
          padding: 0;
          border: 1px solid ${C.border};
          border-radius: 999px;
          background: ${C.surface};
          color: ${C.inkSecondary};
          font-family: JetBrains Mono, monospace;
          font-size: 10px;
          font-weight: 700;
          line-height: 1;
          cursor: help;
        }

        .info-tooltip-trigger:hover,
        .info-tooltip-trigger:focus-visible {
          border-color: ${C.inkMuted};
          color: ${C.ink};
          outline: none;
        }

        .info-tooltip-popover {
          position: absolute;
          left: 0;
          top: 22px;
          z-index: 50;
          width: min(280px, calc(100vw - 32px));
          padding: 9px 10px;
          border: 1px solid ${C.border};
          border-radius: 6px;
          background: ${C.surface};
          color: ${C.ink};
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.1);
          font-size: 11.5px;
          font-weight: 500;
          line-height: 1.45;
          letter-spacing: 0;
          text-transform: none;
          white-space: normal;
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
          transform: translateY(-2px);
          transition: opacity 0.12s ease, transform 0.12s ease, visibility 0.12s ease;
        }

        .info-tooltip-popover-right {
          right: 0;
          left: auto;
        }

        .info-tooltip-popover strong {
          display: block;
          margin-bottom: 4px;
          color: ${C.ink};
          font-size: 11.5px;
          font-weight: 700;
        }

        .info-tooltip:hover .info-tooltip-popover,
        .info-tooltip:focus-within .info-tooltip-popover {
          opacity: 1;
          visibility: visible;
          transform: translateY(0);
        }
      `}</style>
    </span>
  );
}
