import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { ACCENT_COOKIE, asAccent, asTheme, THEME_COOKIE } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Tracker", template: "%s · Tracker" },
  description: "What should your next rupee go toward? A personal planning tool.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const theme = asTheme(store.get(THEME_COOKIE)?.value);
  const accent = asAccent(store.get(ACCENT_COOKIE)?.value);
  return (
    <html
      lang="en-IN"
      data-theme={theme}
      data-accent={accent}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
