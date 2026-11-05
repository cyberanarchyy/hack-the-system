import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // /admin lists events at request time, so ship the event files with it.
  outputFileTracingIncludes: {
    "/admin": ["./content/events/**/*.md"],
  },
  experimental: {
    // Posters are resized in the browser before upload, so each body stays
    // well under this (and Vercel's ~4.5MB ceiling).
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
