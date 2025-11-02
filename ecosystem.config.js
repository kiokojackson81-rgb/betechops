module.exports = {
  apps: [
    {
      name: 'jumia-sync-worker',
      script: 'node',
  args: 'scripts/jumia-sync-worker.js',
      env: {
        NODE_ENV: 'production',
        // Use a worker-specific tsconfig so ts-node resolves modules in CJS mode
        TS_NODE_PROJECT: 'tsconfig.worker.json',
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
