const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

function loadCsvMap(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const txt = fs.readFileSync(filePath, 'utf8');
  const lines = txt.split(/\r?\n/).filter(Boolean);
  const map = {};
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const cols = line.split(',').map(s => s.replace(/^"|"$/g, '').trim());
    if (cols.length >= 2) {
      const name = cols[0];
      const shopId = cols[1];
      map[shopId] = name;
    }
  }
  return map;
}

(async () => {
  try {
    const csvPath = path.resolve(process.cwd(), 'jumia_shop_ids.csv');
    const nameMap = loadCsvMap(csvPath);

    // find distinct shopSids present in payout rows
    const rows = await prisma.marketplacePayoutWeek.findMany({ select: { rawPayload: true } });
    const sids = new Set();
    for (const r of rows) {
      const sid = r.rawPayload?.shopSid ?? null;
      if (sid) sids.add(sid);
    }

    const created = [];
    for (const sid of sids) {
      const exists = await prisma.marketplaceAccount.findFirst({ where: { jumiaShopSid: sid } });
      if (exists) continue;
      const displayName = nameMap[sid] ?? `Jumia Shop ${sid.slice(0, 8)}`;
      const acct = await prisma.marketplaceAccount.create({ data: { displayName, jumiaShopSid: sid, platform: 'JUMIA', isActive: true, countryCode: 'KE' } });
      created.push({ id: acct.id, sid, displayName });
      console.log('Created MarketplaceAccount:', acct.id, sid, displayName);
    }

    if (created.length === 0) {
      console.log('No missing marketplace accounts found.');
    } else {
      console.log('Created', created.length, 'marketplaceAccount(s).');
    }

    await prisma.$disconnect();
  } catch (err) {
    console.error('Failed to create accounts', err);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
