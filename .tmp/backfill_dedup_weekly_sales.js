const { PrismaClient, Platform, WeeklySaleSource, WeeklySaleStatus } = require('@prisma/client');
const prisma = new PrismaClient();

const WINDOW_DAYS = 28;

async function resolveShop(row) {
  const payload = row.rawPayload ?? {};
  const shopName = payload.shopName ?? null;
  const shopSid = payload.shopSid ?? payload.shopId ?? null;
  if (shopName) {
    const shop = await prisma.shop.findFirst({
      where: { platform: Platform.JUMIA, name: String(shopName) },
    });
    if (shop) return shop;
  }
  if (shopSid) {
    const shop = await prisma.shop.findFirst({
      where: { platform: Platform.JUMIA, jumiaShopSid: String(shopSid) },
    });
    if (shop) return shop;
  }
  if (row.account) {
    const shop = row.account.jumiaShopSid
      ? await prisma.shop.findFirst({
          where: { platform: Platform.JUMIA, jumiaShopSid: row.account.jumiaShopSid },
        })
      : null;
    if (shop) return shop;
  }
  if (row.accountId) {
    const fallbackAccount = await prisma.marketplaceAccount.findUnique({
      where: { id: row.accountId },
    });
    if (fallbackAccount?.jumiaShopSid) {
      const shop = await prisma.shop.findFirst({
        where: { platform: Platform.JUMIA, jumiaShopSid: fallbackAccount.jumiaShopSid },
      });
      if (shop) return shop;
    }
  }
  return null;
}

async function main() {
  const since = new Date();
  since.setDate(since.getDate() - WINDOW_DAYS);
  since.setHours(0, 0, 0, 0);
  console.log(`Backfilling WeeklySale rows for ${WINDOW_DAYS} days starting ${since.toISOString().slice(0, 10)}`);

  const rows = await prisma.marketplacePayoutWeek.findMany({
    where: {
      weekStart: {
        gte: since,
      },
    },
    include: { account: true },
    orderBy: { weekStart: 'asc' },
  });
  console.log('Payout rows fetched:', rows.length);

  const entries = new Map();
  const skipped = [];
  for (const row of rows) {
    const amount = Number(row.payoutAmount ?? row.grossSales ?? 0);
    if (Number.isNaN(amount)) continue;
    const shop = await resolveShop(row);
    if (!shop) {
      skipped.push({
        statement: row.statementNumber,
        weekStart: row.weekStart?.toISOString(),
        reason: 'no-shop',
      });
      continue;
    }
    const key = `${shop.id}::${row.weekStart?.toISOString()}::${row.weekEnd?.toISOString()}`;
    const existing = entries.get(key);
    if (existing) {
      existing.amount += amount;
      existing.rows += 1;
      existing.statements.push(row.statementNumber);
    } else {
      entries.set(key, {
        shopId: shop.id,
        weekStart: row.weekStart,
        weekEnd: row.weekEnd,
        amount,
        rows: 1,
        statements: [row.statementNumber],
      });
    }
  }

  console.log('WeeklySale entries to upsert:', entries.size);

  let inserted = 0;
  let updated = 0;
  let manual = 0;

  for (const entry of entries.values()) {
    const where = {
      shopId_platform_weekStart_weekEnd: {
        shopId: entry.shopId,
        platform: Platform.JUMIA,
        weekStart: entry.weekStart,
        weekEnd: entry.weekEnd,
      },
    };
    const existing = await prisma.weeklySale.findUnique({ where });
    if (existing && existing.source === WeeklySaleSource.MANUAL) {
      manual += 1;
      console.log(
        "Skipping manual WeeklySale",
        entry.shopId,
        entry.weekStart.toISOString(),
        entry.weekEnd.toISOString()
      );
      continue;
    }
    await prisma.weeklySale.upsert({
      where,
      create: {
        shopId: entry.shopId,
        platform: Platform.JUMIA,
        weekStart: entry.weekStart,
        weekEnd: entry.weekEnd,
        amount: entry.amount,
        userId: null,
        status: WeeklySaleStatus.PENDING,
        source: WeeklySaleSource.AUTOMATIC,
        createdBy: null,
      },
      update: {
        amount: entry.amount,
        status: WeeklySaleStatus.PENDING,
        source: WeeklySaleSource.AUTOMATIC,
      },
    });
    if (existing) {
      updated += 1;
    } else {
      inserted += 1;
    }
    console.log(`Upserted WeeklySale for shop ${entry.shopId} amount ${entry.amount.toFixed(2)} rows ${entry.rows}`);
  }

  console.log("Backfill summary:", { inserted, updated, manual, skipped: skipped.length });
  if (skipped.length) {
    console.log("Skipped statements:", skipped);
  }
}

main()
  .catch((err) => {
    console.error("Backfill failed", err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
