module.exports = {
  apps: [
    {
      name: 'jumia-sync-worker',
      script: 'node',
  args: '.worker-dist/scripts/jumia-sync-worker.js',
      env: {
        NODE_ENV: 'production',
        // Built worker runs as plain Node.js script from .worker-dist
        // Provide real values at deploy time or via PM2 ecosystem file overrides
        // DATABASE_URL: 'postgres://user:pass@host:5432/dbname',
        // JUMIA_CLIENT_ID: '...'
        // JUMIA_REFRESH_TOKEN: '...'
        // Optional tuning
        // JUMIA_WORKER_INTERVAL_MS: '15000'
      }
    }
  ]
};
