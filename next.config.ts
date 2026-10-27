import type { NextConfig } from "next";

// Every page in this app is per-user and private, so pages render per request.
// Cache Components stays off to keep data loading simple.
const nextConfig: NextConfig = {
  // On Vercel, /api/cas_parse is the Python function in api/. Locally (and in
  // e2e tests) it's served by scripts/cas_dev_server.py when this is set.
  // Pages from earlier versions. A Home Screen app can still open these
  // (iPhone remembers the start page it was added with), so send them to Goals.
  async redirects() {
    const old = ["/dashboard", "/budget", "/holdings", "/details", "/month", "/update", "/onboarding"];
    return old.flatMap((p) => [
      { source: p, destination: "/home", permanent: false },
      { source: `${p}/:rest*`, destination: "/home", permanent: false },
    ]);
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
