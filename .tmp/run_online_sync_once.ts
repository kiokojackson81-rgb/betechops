try {
  const tsconfigPaths = require('tsconfig-paths');
  const path = require('path');
  tsconfigPaths.register({ baseUrl: path.join(__dirname, '..'), paths: { '@/*': ['src/*'] } });
} catch (e) {
  // optional
}
const { syncOnlineMarketplaceData } = require('../src/lib/jobs/onlineSync');

(async () => {
  try {
    const lookback = Number.parseInt(process.argv[2] || process.env.JUMIA_MARKETPLACE_SYNC_LOOKBACK_DAYS || '30', 10) || 30;
    console.log(`Running syncOnlineMarketplaceData once (lookbackDays=${lookback})`);
    await syncOnlineMarketplaceData({ lookbackDays: lookback });
    console.log('syncOnlineMarketplaceData complete');
    process.exit(0);
  } catch (err) {
    console.error('sync failed', err);
    process.exit(1);
  }
})();
