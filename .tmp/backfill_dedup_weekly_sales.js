const { PrismaClient, Platform } = require('@prisma/client');
const prisma = new PrismaClient();

function parseArg(idx, def) { return process.argv[idx] || def; }
function toISODate(d){ return new Date(d).toISOString().slice(0,10); }
function startOfMonday(d){ const dt = new Date(d); dt.setHours(0,0,0,0); const day=dt.getDay(); const diff = day===0?-6:1-day; dt.setDate(dt.getDate()+diff); dt.setHours(0,0,0,0); return dt; }

(async ()=>{
  try{
    const startArg = parseArg(2,'2025-12-29');
    const endArg = parseArg(3,'2026-01-04');
    const start = new Date(startArg+'T00:00:00');
    const end = new Date(endArg+'T23:59:59.999');
    console.log('Backfill period:', startArg, '->', endArg);

    const rows = await prisma.marketplacePayoutWeek.findMany({ where: { AND: [{ weekStart: { lte: end } }, { weekEnd: { gte: start } }] }, orderBy: { accountId: 'asc' } });
    console.log('Found payout rows:', rows.length);

    // Group by statementNumber + weekStartISO
    const groups = new Map();
    for (const r of rows) {
      const stmt = r.statementNumber ?? r.id;
      const wk = toISODate(r.weekStart ?? r.weekEnd ?? new Date());
      const key = `${stmt}::${wk}`;
      const arr = groups.get(key) || [];
      arr.push(r);
      groups.set(key, arr);
    }

    console.log('Statement groups:', groups.size);

    const perShop = new Map();
    const unmapped = [];
    for (const [k, arr] of groups) {
      // Prefer any row that contains rawPayload.shopSid
      const withSid = arr.find(x => x.rawPayload && (x.rawPayload.shopSid || x.rawPayload.shopSid === 0));
      const preferred = withSid || arr[0];

      let shopSid = preferred.rawPayload?.shopSid ?? null;
      if (!shopSid) {
        // Fallback: try use the stored accountId's marketplaceAccount jumiaShopSid if present
        try {
          const fallbackAcct = await prisma.marketplaceAccount.findUnique({ where: { id: preferred.accountId } });
          if (fallbackAcct && fallbackAcct.jumiaShopSid) shopSid = fallbackAcct.jumiaShopSid;
        } catch (e) {
          // ignore
        }
      }

      if (!shopSid) {
        unmapped.push({ statement: preferred.statementNumber, reason: 'no_shopSid_in_payload_and_no_account_jumiaShopSid', amount: Number(preferred.payoutAmount ?? preferred.grossSales ?? 0) });
        continue;
      }

      // Find canonical MarketplaceAccount by jumiaShopSid
      const account = await prisma.marketplaceAccount.findFirst({ where: { jumiaShopSid: String(shopSid), platform: 'JUMIA', isActive: true } });
      if (!account) {
        unmapped.push({ statement: preferred.statementNumber, shopSid, reason: 'no_marketplaceAccount_for_shopSid', amount: Number(preferred.payoutAmount ?? preferred.grossSales ?? 0) });
        continue;
      }

      // Find or create a Shop record for this marketplace account (we do not rely on displayName for attribution)
      let shop = await prisma.shop.findFirst({ where: { platform: 'JUMIA', name: account.displayName } });
      if (!shop) {
        shop = await prisma.shop.create({ data: { name: account.displayName || account.id, platform: 'JUMIA', isActive: true } });
      }

      const shopKey = shop.id;
      const amt = Number(preferred.payoutAmount ?? preferred.grossSales ?? 0);
      const wkStart = startOfMonday(preferred.weekStart ?? preferred.weekEnd ?? new Date());
      const wkEnd = new Date(wkStart.getTime()); wkEnd.setDate(wkStart.getDate()+6); wkEnd.setHours(23,59,59,999);

      const entry = perShop.get(shopKey) || { shopId: shopKey, weekStart: wkStart, weekEnd: wkEnd, amount: 0, rows: 0, stmtKeys: [] };
      entry.amount += amt;
      entry.rows += 1;
      entry.stmtKeys.push(k);
      perShop.set(shopKey, entry);
    }

    console.log('Mapped shops to upsert:', perShop.size, 'unmapped statements:', unmapped.length);

    for (const [shopId, entry] of perShop) {
      try {
        const up = await prisma.weeklySale.upsert({ where: { shopId_platform_weekStart_weekEnd: { shopId: entry.shopId, platform: Platform.JUMIA, weekStart: entry.weekStart, weekEnd: entry.weekEnd } }, create: { shopId: entry.shopId, platform: Platform.JUMIA, weekStart: entry.weekStart, weekEnd: entry.weekEnd, amount: entry.amount, userId: null, status: 'PENDING', source: 'AUTOMATIC', createdBy: null }, update: { amount: entry.amount } });
        console.log('Upserted WeeklySale for shop', shopId, 'amount', entry.amount.toFixed(2), 'rows', entry.rows);
      } catch (err) {
        console.error('Failed upsert WeeklySale for shop', shopId, err.message||err);
      }
    }

    if (unmapped.length) {
      console.log('Unmapped statements (skipped):');
      for (const u of unmapped) console.log(u);
    }

    // Summary totals
    const totalDeduped = Array.from(perShop.values()).reduce((s,e)=>s+e.amount,0);
    console.log('Total deduped amount upserted into WeeklySale rows:', totalDeduped.toFixed(2));

    console.log('Backfill complete');
  } catch (err) {
    console.error('Backfill failed', err);
  } finally {
    await prisma.$disconnect();
  }
})();
