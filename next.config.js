/** @type {import('next').NextConfig} */
const nextConfig = {
  // Skip ESLint during build to avoid CI failures from lint-only errors
  // (useful while migrating or when the linter is strict on the build runner).
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Primary key used by Next 16+ to avoid bundling server packages
  serverExternalPackages: ["pino", "thread-stream", "pino-pretty"],

  // Older Next versions (and guidance) used this experimental key — include it
  // so older Next builds (e.g., 15.x) pick it up too.
  experimental: {
    serverComponentsExternalPackages: ["pino", "thread-stream", "pino-pretty"],
  },

  // Fallback: mark as externals at webpack level on server builds to be extra-safe.
  webpack: (config, { isServer }) => {
    if (isServer) {
      const externals = Array.isArray(config.externals) ? config.externals : [];
      config.externals = [
        ...externals,
        'pino',
        'pino-pretty',
        'thread-stream',
      ];
    }
    return config;
  },
};

module.exports = nextConfig;
