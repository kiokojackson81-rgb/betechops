#!/usr/bin/env node
// Small CommonJS runner that loads ts-node and tsconfig-paths, then runs the TypeScript backfill module.
require('ts-node/register');
require('tsconfig-paths/register');
(async () => {
  try {
    const mod = require('./backfill-weekly-sales.ts');
    const backfill = mod.backfillWeeklySales;
    if (typeof backfill !== 'function') {
      console.error('backfillWeeklySales not found in module');
      process.exit(2);
    }
    const lookbackDays = Number(process.env.WEEKLY_SALES_BACKFILL_LOOKBACK_DAYS ?? 28);
    const result = await backfill({ lookbackDays });
    console.log('[run-backfill-cjs] Backfill result:', result);
    process.exit(0);
  } catch (err) {
    console.error('[run-backfill-cjs] Failed:', err);
    process.exit(1);
  }
})();
