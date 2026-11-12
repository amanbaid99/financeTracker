import type { NextConfig } from "next";

// Every page in this app is per-user and private, so pages render per request.
// Cache Components stays off to keep data loading simple.
const nextConfig: NextConfig = {
  // On Vercel, /api/cas_parse is the Python function in api/. Locally (and in
  // e2e tests) it's served by scripts/cas_dev_server.py when this is set.
  // Pages from earlier versions. A Home Screen app can still open these
  // (iPhone remembers the start page it was added with), so send them to Goals.
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
      // Home (/overview) was removed on 8 Nov 2026; Goals is the start page.
      ...[...old, "/home", "/overview"].flatMap((p) => [
        { source: p, destination: "/goals", permanent: false },
        { source: `${p}/:rest*`, destination: "/goals", permanent: false },
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
