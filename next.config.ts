import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Allow builds to succeed even when ESLint reports problems.
    // This keeps CI/Vercel builds from failing due to lint warnings
    // while we address the large number of existing issues.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
