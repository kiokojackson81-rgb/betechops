const path = require('path');
try {
  const tsconfigPaths = require('tsconfig-paths');
  tsconfigPaths.register({
    baseUrl: path.join(__dirname, '..', '.worker-dist'),
    paths: { '@/*': ['src/*'] },
  });
} catch (e) {
  // ignore
}
(async () => {
  try {
    const modPath = path.join(__dirname, '..', '.worker-dist', 'src', 'lib', 'jobs', 'onlineSync.js');
    const onlineSync = require(modPath);
    if (typeof onlineSync.syncOnlineMarketplaceData !== 'function') {
      console.error('syncOnlineMarketplaceData not exported from built module');
      process.exit(2);
    }
    console.log('Invoking built syncOnlineMarketplaceData(lookbackDays=90)');
    const res = await onlineSync.syncOnlineMarketplaceData({ lookbackDays: 90 });
    console.log('Built sync result (truncated):', JSON.stringify(res).slice(0, 1000));
    process.exit(0);
  } catch (e) {
    console.error('built sync failed', e);
    process.exit(1);
  }
})();
