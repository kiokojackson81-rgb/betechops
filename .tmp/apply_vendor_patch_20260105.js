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

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');

function parseDate(s) { if (!s) return null; return new Date(s + 'T00:00:00Z'); }

async function main() {
  const jsonPath = path.resolve(process.cwd(), '.tmp', 'jumia_statements_2026-01-05_2026-01-11.json');
  if (!fs.existsSync(jsonPath)) {
    console.error('Vendor JSON not found at', jsonPath);
    process.exit(2);
  }
  const vendor = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const vendorStatements = vendor.statements || [];

  console.log((APPLY ? 'APPLY MODE: Will perform writes.' : 'DRY RUN: No writes. Use --apply to apply changes.'));
  console.log('Found vendor statements:', vendorStatements.length);

  for (const st of vendorStatements) {
    // resolve the actual MarketplaceAccount id to use
    let mappedAccountId = st.accountId;
    const tryById = await prisma.marketplaceAccount.findUnique({ where: { id: st.accountId } }).catch(()=>null);
    if (!tryById) {
      const shopSid = st.shopSid || (st.raw && st.raw.shopSid) || null;
      if (shopSid) {
        const byShop = await prisma.marketplaceAccount.findFirst({ where: { jumiaShopSid: shopSid, platform: 'JUMIA' } }).catch(()=>null);
        if (byShop) mappedAccountId = byShop.id;
      }
    }

    const key = { accountId: mappedAccountId, statementNumber: st.statementNumber };
    const existing = await prisma.marketplacePayoutWeek.findUnique({ where: { accountId_statementNumber: key } }).catch(()=>null);

    const weekStart = parseDate(st.weekStart || (st.raw && st.raw.weekStart));
    const weekEnd = weekStart ? new Date(weekStart.getTime() + 7 * 24 * 3600 * 1000) : null;
    const amt = st.amount != null ? Number(st.amount) : 0;
    const currency = (st.raw && st.raw.payout && st.raw.payout.currency) ? st.raw.payout.currency : 'KES';

    if (!existing) {
      console.log(`INSERT -> ${st.accountName} ${st.statementNumber} : ${amt.toFixed(2)} ${currency} (no existing row) using accountId ${mappedAccountId}`);
      if (APPLY) {
        await prisma.marketplacePayoutWeek.create({ data: {
          accountId: mappedAccountId,
          statementNumber: st.statementNumber,
          weekStart: weekStart || new Date(),
          weekEnd: weekEnd || new Date(Date.now()+7*24*3600*1000),
          grossSales: amt,
          payoutAmount: amt,
          currency,
          isPaid: Boolean(st.raw && st.raw.paid),
          rawPayload: st.raw || st,
        }});
      }
    } else {
      const existingAmt = Number(existing.payoutAmount || 0);
      if (existingAmt === amt && (existing.currency || 'KES') === currency) {
        console.log(`SKIP  -> ${st.accountName} ${st.statementNumber} : already ${amt.toFixed(2)} ${currency}`);
      } else {
        console.log(`UPDATE -> ${st.accountName} ${st.statementNumber} : ${existingAmt.toFixed(2)} -> ${amt.toFixed(2)} ${currency}`);
        if (APPLY) {
          await prisma.marketplacePayoutWeek.update({ where: { accountId_statementNumber: key }, data: {
            payoutAmount: amt,
            grossSales: amt,
            currency,
            isPaid: Boolean(st.raw && st.raw.paid),
            rawPayload: st.raw || st,
          }});
        }
      }
    }
  }

  // report DB rows in window not present in vendor
  const tolMs = 36 * 3600 * 1000;
  const canonicalWeekStart = new Date('2026-01-05T00:00:00Z');
  const windowStart = new Date(canonicalWeekStart.getTime() - tolMs);
  const windowEnd = new Date(canonicalWeekStart.getTime() + tolMs);
  const dbRows = await prisma.marketplacePayoutWeek.findMany({ where: { AND: [ { weekStart: { gte: windowStart } }, { weekStart: { lt: windowEnd } } ] }, select: { accountId: true, statementNumber: true, payoutAmount: true } });
  const vendorStmtSet = new Set(vendorStatements.map(s=>s.statementNumber));
  const extras = dbRows.filter(r=>!vendorStmtSet.has(r.statementNumber));
  if (extras.length) {
    console.log('\nDB rows in week window not in vendor fetch:');
    for (const e of extras) console.log(`  ${e.accountId}, ${e.statementNumber}, ${e.payoutAmount != null ? Number(e.payoutAmount).toFixed(2) : 'NULL'}`);
  }

  await prisma.$disconnect();
}

main().catch(async (e)=>{
  console.error(e);
  try { await prisma.$disconnect(); } catch(e){ }
  process.exit(1);
});
