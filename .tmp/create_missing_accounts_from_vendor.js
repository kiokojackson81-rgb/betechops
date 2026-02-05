require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Set DATABASE_URL env var');
  process.exit(2);
}

const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

async function main() {
  const jsonPath = path.resolve(process.cwd(), '.tmp', 'jumia_statements_2026-01-05_2026-01-11.json');
  if (!fs.existsSync(jsonPath)) {
    console.error('Vendor JSON not found at', jsonPath);
    process.exit(2);
  }
  const vendor = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const vendorStatements = vendor.statements || [];

  for (const st of vendorStatements) {
    const acctId = st.accountId;
    if (!acctId) continue;
    const existing = await prisma.marketplaceAccount.findUnique({ where: { id: acctId } }).catch(()=>null);
    if (existing) {
      console.log('EXISTS', acctId, existing.displayName);
      continue;
    }
    // try find by jumiaShopSid
    const shopSid = st.shopSid || (st.raw && st.raw.shopSid) || null;
    if (shopSid) {
      const byShop = await prisma.marketplaceAccount.findFirst({ where: { jumiaShopSid: shopSid, platform: 'JUMIA' } }).catch(()=>null);
      if (byShop) {
        console.log('FOUND_BY_SHOP', acctId, 'maps to existing account', byShop.id, byShop.displayName);
        continue;
      }
    }

    const displayName = st.accountName || 'JUMIA Account';
    const countryCode = 'KE';
    console.log('CREATING account', acctId, displayName, 'shopSid=', shopSid);
    await prisma.marketplaceAccount.create({ data: {
      id: acctId,
      platform: 'JUMIA',
      displayName,
      countryCode,
      jumiaShopSid: shopSid,
    }}).catch(e=>{ console.error('CREATE_ERROR', acctId, e.message); });
  }

  await prisma.$disconnect();
}

main().catch(async (e)=>{
  console.error(e);
  try { await prisma.$disconnect(); } catch(e){}
  process.exit(1);
});
