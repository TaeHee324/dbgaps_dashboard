import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Providers } from "./providers";

const navigation = [
  { href: "/", label: "홈" },
  { href: "/operations", label: "운용현황" },
  { href: "/portfolio", label: "ETF 포트폴리오" },
  { href: "/comparison", label: "포트폴리오 비교" },
  { href: "/trades", label: "매매일지" },
  { href: "/research", label: "리서치" },
  { href: "/rules", label: "대회 룰" },
  { href: "/market", label: "시황" },
  { href: "/report", label: "운용보고서" },
  { href: "/changelog", label: "업데이트 로그" },
];

export const metadata: Metadata = {
  title: "DBGAPS",
  description: "Internal ETF portfolio operations dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css"
        />
      </head>
      <body className="min-h-screen bg-background text-ink antialiased">
        <Providers>
          <div className="min-h-screen lg:flex">
            <aside
              className="border-b border-border bg-surface lg:fixed lg:inset-y-0 lg:left-0 lg:w-56 lg:border-b-0 lg:border-r"
              style={{ boxShadow: "1px 0 0 #E4E9EF" }}
            >
              <div className="flex h-full flex-col gap-0 px-0 py-0">
                {/* Brand */}
                <div className="border-b border-border px-4 py-4">
                  <div className="flex items-center gap-2.5">
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 5,
                        background: "linear-gradient(135deg, #0B1B2C 0%, #1f3852 100%)",
                        display: "grid",
                        placeItems: "center",
                        color: "#fff",
                        fontFamily: "JetBrains Mono, monospace",
                        fontWeight: 600,
                        fontSize: 11,
                        letterSpacing: ".02em",
                        flexShrink: 0,
                      }}
                    >
                      D
                    </div>
                    <div style={{ lineHeight: 1.2 }}>
                      <div className="text-sm font-bold tracking-tight text-ink">DBGAPS</div>
                      <div
                        className="text-inkMuted"
                        style={{
                          fontSize: 10,
                          fontFamily: "JetBrains Mono, monospace",
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                        }}
                      >
                        KR Multi-Asset
                      </div>
                    </div>
                  </div>
                </div>

                {/* Navigation */}
                <nav
                  aria-label="주요 화면"
                  className="flex gap-0.5 overflow-x-auto p-2 lg:flex-col lg:overflow-visible"
                >
                  {navigation.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="whitespace-nowrap rounded px-3 py-2 text-xs font-medium text-inkSecondary transition-colors hover:bg-surfaceMuted hover:text-ink"
                      style={{ letterSpacing: "-0.003em" }}
                    >
                      {item.label}
                    </Link>
                  ))}
                </nav>
              </div>
            </aside>

            <main className="min-h-screen flex-1 px-5 py-6 sm:px-8 lg:ml-56 lg:px-8 lg:py-6">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
