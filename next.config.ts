import type { NextConfig } from "next";

// Every page in this app is per-user and private, so pages render per request.
// Cache Components stays off to keep data loading simple.
const nextConfig: NextConfig = {
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
