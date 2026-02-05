require('dotenv').config();
const { PrismaClient, Platform, WeeklySaleSource, WeeklySaleStatus } = require('@prisma/client');
const prisma = new PrismaClient();

const WINDOW_DAYS = 28;

async function resolveShop(row) {
  const payload = row.rawPayload ?? {};
  const shopName = payload.shopName ?? null;
  const shopSid = payload.shopSid ?? payload.shopId ?? null;
  if (shopName) {
    const shop = await prisma.shop.findFirst({ where: { platform: Platform.JUMIA, name: String(shopName) } });
    if (shop) return shop;
  }
  if (shopSid) {
    const shop = await prisma.shop.findFirst({ where: { platform: Platform.JUMIA, jumiaShopSid: String(shopSid) } });
    if (shop) return shop;
  }
  if (row.account) {
    const shop = row.account.jumiaShopSid
      ? await prisma.shop.findFirst({ where: { platform: Platform.JUMIA, jumiaShopSid: row.account.jumiaShopSid } })
      : null;
    if (shop) return shop;
  }
  if (row.accountId) {
    const fallbackAccount = await prisma.marketplaceAccount.findUnique({ where: { id: row.accountId } });
    if (fallbackAccount?.jumiaShopSid) {
      const shop = await prisma.shop.findFirst({ where: { platform: Platform.JUMIA, jumiaShopSid: fallbackAccount.jumiaShopSid } });
      if (shop) return shop;
    }
  }
  return null;
}

async function main() {
  const since = new Date();
  since.setDate(since.getDate() - WINDOW_DAYS);
  since.setHours(0,0,0,0);
  console.log(`Safe backfill WeeklySale rows for ${WINDOW_DAYS} days starting ${since.toISOString().slice(0,10)}`);

  const rows = await prisma.marketplacePayoutWeek.findMany({ where: { weekStart: { gte: since } }, include: { account: true }, orderBy: { weekStart: 'asc' } });
  console.log('Payout rows fetched:', rows.length);

  const entries = new Map();
  for (const row of rows) {
    const amount = Number(row.payoutAmount ?? row.grossSales ?? 0);
    if (Number.isNaN(amount)) continue;
    const shop = await resolveShop(row);
    if (!shop) continue;
    const key = `${shop.id}::${row.weekStart?.toISOString()}::${row.weekEnd?.toISOString()}`;
    const existing = entries.get(key);
    if (existing) { existing.amount += amount; existing.rows += 1; existing.statements.push(row.statementNumber); }
    else entries.set(key, { shopId: shop.id, weekStart: row.weekStart, weekEnd: row.weekEnd, amount, rows: 1, statements: [row.statementNumber] });
  }

  console.log('WeeklySale entries to ensure:', entries.size);
  let created = 0, updated = 0, skippedManual = 0;
  for (const entry of entries.values()) {
    // use findFirst to avoid enum comparisons on platform
    const existing = await prisma.weeklySale.findFirst({ where: { shopId: entry.shopId, weekStart: entry.weekStart, weekEnd: entry.weekEnd } });
    if (existing) {
      const isManual = existing.source === WeeklySaleSource.MANUAL || existing.createdBy !== null || existing.userId !== null || existing.approvedBy !== null;
      if (isManual) { skippedManual += 1; continue; }
      await prisma.weeklySale.update({ where: { id: existing.id }, data: { amount: entry.amount, status: WeeklySaleStatus.PENDING, source: WeeklySaleSource.AUTOMATIC } });
      updated += 1;
      console.log('Updated WeeklySale', existing.id, entry.amount.toFixed(2));
    } else {
      await prisma.weeklySale.create({ data: { shopId: entry.shopId, platform: Platform.JUMIA, weekStart: entry.weekStart, weekEnd: entry.weekEnd, amount: entry.amount, userId: null, status: WeeklySaleStatus.PENDING, source: WeeklySaleSource.AUTOMATIC, createdBy: null } });
      created += 1;
      console.log('Created WeeklySale for shop', entry.shopId, entry.amount.toFixed(2));
    }
  }

  console.log('Safe backfill summary', { created, updated, skippedManual });
  await prisma.$disconnect();
}

main().catch(async (e)=>{ console.error('failed', e); try{ await prisma.$disconnect(); }catch(_){}; process.exit(1); });
