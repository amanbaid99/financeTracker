import type { NextConfig } from "next";

// Every page in this app is per-user and private, so pages render per request.
// Cache Components stays off to keep data loading simple.
const nextConfig: NextConfig = {
  // On Vercel, /api/cas_parse is the Python function in api/. Locally (and in
  // e2e tests) it's served by scripts/cas_dev_server.py when this is set.
  // Pages from earlier versions. A Home Screen app can still open these
  // (iPhone remembers its installed start URL), so keep aliases working.
  async redirects() {
    const old = [
      "/dashboard",
      "/budget",
      "/holdings",
      "/details",
      "/month",
      "/update",
      "/onboarding",
    ];
    return [
      { source: "/radar/:path*", destination: "/assets", permanent: false },
      { source: "/assets/net-worth/:path*", destination: "/assets", permanent: false },
      // 16 Nov 2026: Portfolio became Assets and Roadmap joined Your plan.
      // 17 Nov 2026: Liabilities was removed; loans live in goals, cards
      // are back at /cards and Covered till salary is under Goals.
      { source: "/portfolio", destination: "/assets", permanent: false },
      {
        source: "/portfolio/:rest*",
        destination: "/assets/:rest*",
        permanent: false,
      },
      {
        source: "/liabilities/cards",
        destination: "/cards",
        permanent: false,
      },
      {
        source: "/liabilities/salary",
        destination: "/goals/salary",
        permanent: false,
      },
      { source: "/liabilities", destination: "/goals", permanent: false },
      {
        source: "/goals/runway",
        destination: "/goals/salary",
        permanent: false,
      },
      { source: "/goals/roadmap", destination: "/goals/plan", permanent: false },
      // Home returned on 18 Nov 2026 at /today.
      ...[...old, "/home", "/overview"].flatMap((p) => [
        { source: p, destination: ["/home", "/overview", "/dashboard"].includes(p) ? "/today" : "/goals", permanent: false },
        { source: `${p}/:rest*`, destination: ["/home", "/overview", "/dashboard"].includes(p) ? "/today" : "/goals", permanent: false },
      ]),
    ];
  },
  async headers() {
    return [
      {
        // Always check for a new service worker, so updates reach the app.
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
        ],
      },
    ];
  },
  async rewrites() {
    const dev = process.env.CAS_PARSER_DEV_URL;
    return dev
      ? ["/api/cas_parse", "/api/pdf_text"].map((p) => ({
          source: p,
          destination: `${dev}${p}`,
        }))
      : [];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
