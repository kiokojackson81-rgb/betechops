try {
  require('tsconfig-paths').register();
} catch (e) {
  // optional
}
const { syncOnlineMarketplaceData } = require('../src/lib/jobs/onlineSync');

(async () => {
  try {
    console.log('Running syncOnlineMarketplaceData once (lookbackDays=30)');
    await syncOnlineMarketplaceData({ lookbackDays: 30 });
    console.log('syncOnlineMarketplaceData complete');
    process.exit(0);
  } catch (err) {
    console.error('sync failed', err);
    process.exit(1);
  }
})();
