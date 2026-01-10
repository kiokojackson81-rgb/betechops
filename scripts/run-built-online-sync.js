// Runs the built worker-dist online sync function (CJS) to avoid TS import issues.
try { require('dotenv').config(); } catch {}
(function registerPaths() {
  try {
    const tsconfigPaths = require('tsconfig-paths');
    tsconfigPaths.register({
      baseUrl: '.worker-dist',
      paths: {
        '@/*': ['src/*'],
      },
    });
  } catch (e) {
    try { require('tsconfig-paths/register'); } catch {}
  }
})();
(async () => {
  try {
    const onlineSync = require('../.worker-dist/src/lib/jobs/onlineSync');
    if (typeof onlineSync.syncOnlineMarketplaceData !== 'function') {
      console.error('syncOnlineMarketplaceData not found in built module');
      process.exit(2);
    }
    console.log('[run-built-online-sync] starting sync...');
    const res = await onlineSync.syncOnlineMarketplaceData({ lookbackDays: Number(process.env.JUMIA_MARKETPLACE_SYNC_LOOKBACK_DAYS ?? 30) });
    console.log('[run-built-online-sync] result:', JSON.stringify(res, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('[run-built-online-sync] failed', err);
    process.exit(1);
  }
})();
