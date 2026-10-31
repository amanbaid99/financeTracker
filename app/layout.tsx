import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import {
  ACCENT_COOKIE,
  asAccent,
  asTheme,
  AUTO_THEME_SCRIPT,
  THEME_COOKIE,
} from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Tracker", template: "%s · Tracker" },
  description:
    "What should your next rupee go toward? A personal planning tool.",
  robots: { index: false, follow: false },
  applicationName: "Tracker",
  appleWebApp: { capable: true, title: "Tracker", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#15803d",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const store = await cookies();
  const theme = asTheme(store.get(THEME_COOKIE)?.value);
  const accent = asAccent(store.get(ACCENT_COOKIE)?.value);
  return (
    <html
      lang="en-IN"
      // "auto" is resolved to white or black by the script below, so the
      // attribute can differ from the server's on first load.
      data-theme={theme === "auto" ? "white" : theme}
      data-theme-pref={theme}
      data-accent={accent}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: AUTO_THEME_SCRIPT }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
