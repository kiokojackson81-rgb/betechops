import type { NextConfig } from "next";

const externalPackages = ["pino", "thread-stream", "pino-pretty"];

const nextConfig: NextConfig = {
  serverExternalPackages: externalPackages,
  // Turbopack is now the default in Next 16. Provide an explicit (even if empty)
  // config so builds that still rely on legacy webpack hooks don't error out.
  turbopack: {},
};

export default nextConfig;
