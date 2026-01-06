import { pathToFileURL } from 'url';

async function main() {
  // Import prisma and patch write methods to be no-ops that log
  const prismaModule = await import('../src/lib/prisma.ts');
  const prisma = prismaModule.prisma as any;

  const writeOps = ['create', 'update', 'upsert', 'delete', 'deleteMany', 'updateMany'];

  for (const key of Object.keys(prisma)) {
    try {
      const val = prisma[key];
      if (val && typeof val === 'object') {
        for (const op of writeOps) {
          if (typeof val[op] === 'function') {
            val[op] = async function (...args: any[]) {
              console.log('[DRY-RUN] prisma.', key, '.', op, JSON.stringify(args[0] ?? args));
              // Return a plausible minimal object
              return args[0]?.create ?? args[0]?.data ?? {};
            };
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }

  // Keep $transaction but ensure model methods are patched
  try {
    const onlineSync = await import('../src/lib/jobs/onlineSync.ts');
    if (typeof onlineSync.syncOnlineMarketplaceData !== 'function') {
      console.error('syncOnlineMarketplaceData not exported from onlineSync');
      return;
    }

    console.log('[DRY-RUN] Starting syncOnlineMarketplaceData (lookbackDays=7) with Prisma write proxies');
    await onlineSync.syncOnlineMarketplaceData({ lookbackDays: 7 });
    console.log('[DRY-RUN] syncOnlineMarketplaceData finished');
  } catch (e: any) {
    console.error('[DRY-RUN] sync failed or network calls failed:', e?.message ?? e);
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

main().catch((e) => {
  console.error('sync_dry_run failed:', e);
  process.exit(1);
});
