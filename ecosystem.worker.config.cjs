module.exports = {
  apps: [
    {
      name: 'pod-retry',
      // Entry should point to compiled worker script under .worker-dist when built
      script: '.worker-dist/scripts/pod-retry-worker.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production',
        // How often the worker ticks to scan for retries (ms)
        POD_RETRY_INTERVAL_MS: '60000',
        // Retry/backoff env defaults (override in deployment env)
        CHATRACE_RETRY_BASE_SECONDS: process.env.CHATRACE_RETRY_BASE_SECONDS || '60',
        CHATRACE_RETRY_MAX_ATTEMPTS: process.env.CHATRACE_RETRY_MAX_ATTEMPTS || '5',
        CHATRACE_RETRY_LOCK_TTL_SECONDS: process.env.CHATRACE_RETRY_LOCK_TTL_SECONDS || '300'
      }
    }
  ]
};

