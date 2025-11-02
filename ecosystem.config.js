module.exports = {
  apps: [
    {
      name: 'jumia-sync-worker',
      script: 'node',
  args: '-r ts-node/register scripts/jumia-sync-worker.ts',
      env: {
        NODE_ENV: 'production',
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
