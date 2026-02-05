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
    // Optionally call the admin refresh endpoint to update materialized data / UI
    try {
      const autoRefresh = String(process.env.AUTO_REFRESH_ADMIN || '').toLowerCase();
      if (autoRefresh === '1' || autoRefresh === 'true') {
        const day = process.env.ADMIN_REFRESH_DAY || new Date().toISOString().slice(0, 10);
        const adminUrl = process.env.ADMIN_REFRESH_URL || `http://localhost:3000/api/admin/online/sync-now?day=${day}`;
        console.log('[run-built-online-sync] AUTO_REFRESH_ADMIN enabled — POST', adminUrl);
        try {
          const fetchFn = globalThis.fetch || require('node-fetch');
          const r = await fetchFn(adminUrl, { method: 'POST' });
          try {
            const j = await r.json().catch(() => null);
            console.log('[run-built-online-sync] admin refresh response', r.status, j);
          } catch (e) {
            console.log('[run-built-online-sync] admin refresh completed', r.status);
          }
        } catch (e) {
          console.warn('[run-built-online-sync] admin refresh failed', e && e.message ? e.message : e);
        }
      }
    } catch (e) {
      console.warn('[run-built-online-sync] admin refresh check failed', e && e.message ? e.message : e);
    }
    process.exit(0);
  } catch (err) {
    console.error('[run-built-online-sync] failed', err);
    process.exit(1);
  }
})();
