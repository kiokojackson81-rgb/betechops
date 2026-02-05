try {
  require('tsconfig-paths').register();
} catch (e) {}
const { syncOnlineMarketplaceData } = require('../src/lib/jobs/onlineSync');

function parseArgDate(name: string) {
  const arg = process.argv.find((a) => a.startsWith(`${name}=`)) || process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!arg) return null;
  const v = arg.split('=')[1];
  return v ? new Date(v + 'T00:00:00') : null;
}

(async () => {
  try {
    const periodStart = parseArgDate('start') || parseArgDate('--start');
    const periodEnd = parseArgDate('end') || parseArgDate('--end');
    console.log('Running syncOnlineMarketplaceData for period', periodStart, '->', periodEnd);
    await syncOnlineMarketplaceData({ periodStart, periodEnd });
    console.log('syncOnlineMarketplaceData complete');
    process.exit(0);
  } catch (err) {
    console.error('sync failed', err);
    process.exit(1);
  }
})();
