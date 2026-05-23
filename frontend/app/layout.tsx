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
  { href: "/market", label: "시황" },
  { href: "/report", label: "운용보고서" },
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
      <body className="min-h-screen bg-background text-ink antialiased">
        <Providers>
          <div className="min-h-screen lg:flex">
            <aside className="border-b border-border bg-surface lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 lg:border-b-0 lg:border-r">
              <div className="flex h-full flex-col gap-6 px-5 py-5">
                <div>
                  <p className="text-sm font-semibold tracking-normal text-ink">
                    DBGAPS
                  </p>
                  <p className="mt-1 text-xs text-inkSecondary">
                    ETF 운용 대시보드
                  </p>
                </div>
                <nav aria-label="주요 화면" className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
                  {navigation.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-inkSecondary transition hover:bg-surfaceMuted hover:text-ink"
                    >
                      {item.label}
                    </Link>
                  ))}
                </nav>
              </div>
            </aside>
            <main className="min-h-screen flex-1 px-5 py-6 sm:px-8 lg:ml-64 lg:px-10">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
