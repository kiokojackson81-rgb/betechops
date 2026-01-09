// Run the built worker's onlineSync function from .worker-dist (CJS)
const path = require('path');
(async () => {
  try {
    const modPath = path.join(__dirname, '..', '.worker-dist', 'src', 'lib', 'jobs', 'onlineSync.js');
    const onlineSync = require(modPath);
    if (typeof onlineSync.syncOnlineMarketplaceData !== 'function') {
      console.error('syncOnlineMarketplaceData not exported from built module');
      process.exit(2);
    }
    console.log('Invoking built syncOnlineMarketplaceData(lookbackDays=90)');
    await onlineSync.syncOnlineMarketplaceData({ lookbackDays: 90 });
    console.log('Built sync finished');
    process.exit(0);
  } catch (e) {
    console.error('built sync failed', e);
    process.exit(1);
  }
})();
