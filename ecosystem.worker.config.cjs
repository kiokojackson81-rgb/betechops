module.exports = {
  apps: [
    {
      name: 'jumia-sync',
  // Use the entry wrapper to enable undici keep-alive and dotenv early
  script: '.worker-dist/scripts/jumia-sync-worker.entry.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        // Fast ticks for near-real-time (2s). Tune to your vendor rate limits.
        JUMIA_WORKER_INTERVAL_MS: '2000',
        // Incremental refresh cadence (2s)
        JUMIA_WORKER_INCREMENTAL_EVERY_MS: '2000',
        // Run the heavy 7-day pending sweep less often to reduce vendor load (e.g., 30s)
        JUMIA_WORKER_PENDING_EVERY_MS: '30000',
        // Fast incremental lookback days (small window for instant updates)
        JUMIA_WORKER_INCREMENTAL_LOOKBACK_DAYS: '3',
        // Periodic deep backfill interval (e.g., every 15 minutes)
        JUMIA_WORKER_INCREMENTAL_DEEP_EVERY_MS: '900000',
        // Deep backfill window (used by job default JUMIA_SYNC_LOOKBACK_DAYS when unset)
        JUMIA_SYNC_LOOKBACK_DAYS: '120'
        // Add DATABASE_URL, REDIS_URL, and any vendor auth envs here or in PM2 ecosystem-level env
      }
    }
  ]
};
