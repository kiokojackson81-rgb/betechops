import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Do not bundle these packages into server bundles — load from Node at runtime
  serverExternalPackages: ["pino", "thread-stream", "pino-pretty"],
};

export default nextConfig;
