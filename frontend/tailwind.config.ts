import type { Config } from "tailwindcss";

const config: Config = {
  theme: {
    extend: {
      colors: {
        background: "#F3F5F8",
        surface: "#FFFFFF",
        surfaceMuted: "#F7F9FC",
        surfaceCream: "#FFF8ED",
        ink: "#0B1B2C",
        inkSecondary: "#46586B",
        inkMuted: "#8595A6",
        inkFaint: "#B6C1CC",
        border: "#E4E9EF",
        borderLight: "#EFF2F6",
        borderStrong: "#CFD7E0",
        primary: "#3F2EE0",
        primaryPressed: "#3325BC",
        primarySoft: "#EEEBFE",
        success: "#0F7A3D",
        successSoft: "#E4F3EA",
        warning: "#A86A0A",
        warningSoft: "#FEF3C7",
        danger: "#A4232B",
        dangerSoft: "#F6E5E6",
        navy: "#0B1B2C",
        indigo: "#3F2EE0",
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
        panel: "0 1px 0 rgba(11,27,44,.04), 0 1px 2px rgba(11,27,44,.04)",
        elevated: "0 8px 24px rgba(11,27,44,.08)",
      },
      fontFamily: {
        sans: [
          "Pretendard Variable",
          "Pretendard",
          "-apple-system",
          "BlinkMacSystemFont",
          "Apple SD Gothic Neo",
          "Segoe UI",
          "sans-serif",
        ],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
        numeric: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      fontVariantNumeric: {
        tabular: "tabular-nums",
      },
    },
  },
};

export default config;
