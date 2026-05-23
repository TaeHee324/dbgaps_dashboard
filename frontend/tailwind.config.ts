import type { Config } from "tailwindcss";

const config: Config = {
  theme: {
    extend: {
      colors: {
        background: "#F8FAFC",
        surface: "#FFFFFF",
        surfaceMuted: "#F6F9FC",
        surfaceCream: "#FFF8ED",
        ink: "#0D253D",
        inkSecondary: "#64748B",
        inkMuted: "#94A3B8",
        border: "#E2E8F0",
        primary: "#533AFD",
        primaryPressed: "#4434D4",
        primarySoft: "#EEF2FF",
        success: "#16A34A",
        successSoft: "#DCFCE7",
        warning: "#D97706",
        warningSoft: "#FEF3C7",
        danger: "#DC2626",
        dangerSoft: "#FEE2E2",
        navy: "#0D253D",
        indigo: "#533AFD",
      },
      borderRadius: {
        xs: "4px",
        sm: "6px",
        md: "8px",
        lg: "12px",
        pill: "9999px",
      },
      spacing: {
        xxs: "2px",
        xs: "4px",
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "24px",
        xxl: "32px",
      },
      boxShadow: {
        panel: "0 1px 2px rgba(15, 23, 42, 0.06)",
        elevated: "0 8px 24px rgba(15, 23, 42, 0.08)",
      },
      fontFamily: {
        sans: [
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
        mono: ["SFMono-Regular", "Consolas", "Liberation Mono", "monospace"],
        numeric: [
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
      },
      fontVariantNumeric: {
        tabular: "tabular-nums",
      },
    },
  },
};

export default config;
