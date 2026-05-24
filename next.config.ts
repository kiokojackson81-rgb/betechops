import path from "node:path";
import type { NextConfig } from "next";

const externalPackages = ["pino", "thread-stream", "pino-pretty"];

const nextConfig: NextConfig & { outputFileTracingRoot?: string; outputFileTracingIncludes?: Record<string, string[]> } = {
  serverExternalPackages: externalPackages,
  outputFileTracingRoot: path.join(__dirname),
  outputFileTracingIncludes: {
    "/*": ["./node_modules/@sparticuz/chromium/**"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.public.blob.vercel-storage.com",
      },
      {
        protocol: "https",
        hostname: "blob.vercel-storage.com",
      },
    ],
  },
  // Turbopack is now the default in Next 16. Provide an explicit (even if empty)
  // config so builds that still rely on legacy webpack hooks don't error out.
  turbopack: {},
};

export default nextConfig;
