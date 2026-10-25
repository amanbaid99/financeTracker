import type { NextConfig } from "next";

// Every page in this app is per-user and private, so pages render per request.
// Cache Components stays off to keep data loading simple.
const nextConfig: NextConfig = {
  // On Vercel, /api/cas_parse is the Python function in api/. Locally (and in
  // e2e tests) it's served by scripts/cas_dev_server.py when this is set.
  async rewrites() {
    const dev = process.env.CAS_PARSER_DEV_URL;
    return dev
      ? [{ source: "/api/cas_parse", destination: `${dev}/api/cas_parse` }]
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
