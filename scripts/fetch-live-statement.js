try { require('dotenv').config(); } catch {}
const path = require('path');
// Map `@/...` imports used inside .worker-dist to .worker-dist/src/...
{
  const Module = require('module');
  const origResolve = Module._resolveFilename;
  Module._resolveFilename = function (request, parent, isMain, options) {
    if (typeof request === 'string' && request.startsWith('@/')) {
      const mapped = path.resolve(__dirname, '..', '.worker-dist', 'src', request.slice(2));
      return origResolve.call(this, mapped, parent, isMain, options);
    }
    return origResolve.call(this, request, parent, isMain, options);
  };
}
const prisma = require('../.worker-dist/src/lib/prisma').prisma;
const jumia = require('../.worker-dist/src/lib/jumia');

(async () => {
  try {
    const arg = process.argv[2];
    if (!arg) {
      console.error('Usage: node scripts/fetch-live-statement.js <statementNumber|shopSid> [dayYYYY-MM-DD]');
      process.exit(2);
    }

    const maybeStmt = arg.match(/^PS\d/); // statement numbers start PS
    const day = process.argv[3];

    let shop = null;
    if (maybeStmt) {
      // find local DB row first to get shopSid
      const row = await prisma.marketplacePayoutWeek.findFirst({ where: { statementNumber: arg } });
      if (!row) {
        console.error('No local payoutweek row found for', arg);
        process.exit(2);
      }
      // find shop by shopSid in rawPayload if present
      const shopSid = (row.rawPayload && row.rawPayload.shopSid) || null;
      if (!shopSid) {
        console.error('No shopSid in local row rawPayload for', arg);
        process.exit(2);
      }
      shop = await prisma.shop.findFirst({ where: { jumiaShopSid: shopSid } });
      if (!shop) {
        console.error('No Shop record found for shopSid', shopSid);
        process.exit(2);
      }
    } else {
      // treat arg as shopSid
      shop = await prisma.shop.findFirst({ where: { jumiaShopSid: arg } });
      if (!shop) {
        console.error('No Shop record found for jumiaShopSid', arg);
        process.exit(2);
      }
    }

    console.log('Found shop id:', shop.id, 'name:', shop.name, 'jumiaShopSid:', shop.jumiaShopSid);

    // If shop has no embedded credentials, try to attach per-account JumiaAccount creds
    if (!shop.credentialsEncrypted && !shop.apiConfig) {
      try {
        const acct = await prisma.marketplaceAccount.findUnique({ where: { id: shop.id === null ? undefined : undefined } });
      } catch (e) {
        // ignore — we'll try to resolve via associated marketplace account by statement row below
      }
    }

    // Special handling: when we were invoked with a statement number, use the DB row's account to pick per-account creds
    if (/^PS\d/.test(process.argv[2])) {
      try {
        const stmt = await prisma.marketplacePayoutWeek.findFirst({ where: { statementNumber: process.argv[2] } });
        if (stmt) {
          const ma = await prisma.marketplaceAccount.findUnique({ where: { id: stmt.accountId } });
          if (ma) {
            const jm = await prisma.jumiaAccount.findFirst({ where: { clientId: ma.jumiaShopSid } });
            if (jm && (!shop.credentialsEncrypted && !shop.apiConfig)) {
              // attach apiConfig so loadShopAuthById picks it up
              await prisma.shop.update({ where: { id: shop.id }, data: { apiConfig: { clientId: jm.clientId, refreshToken: jm.refreshToken } } });
              // reload shop
              shop = await prisma.shop.findUnique({ where: { id: shop.id } });
              console.log('Attached JumiaAccount creds to shop from JumiaAccount', jm.id);
            }
          }
        }
      } catch (e) {
        // continue without per-account creds
      }
    }

    const res = await jumia.fetchPayoutsForShop(shop.id, day ? { day } : undefined);
    console.log('Vendor response keys:', Object.keys(res));
    // try to extract statements list
    const statements = res?.statements || res?.data?.statements || res?.data || res;
    console.log('Statements count (raw):', Array.isArray(statements) ? statements.length : 'unknown');

    if (Array.isArray(statements)) {
      for (const s of statements) {
        if (s.statementNumber && (s.statementNumber === arg || arg === shop.jumiaShopSid)) {
          console.log('Matched statement:', JSON.stringify(s, null, 2));
        }
      }
    } else {
      console.log('Full response:', JSON.stringify(res, null, 2));
    }

    await prisma.$disconnect();
    process.exit(0);
  } catch (err) {
    console.error(err);
    try { await prisma.$disconnect(); } catch {}
    process.exit(1);
  }
})();
