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

function parseDate(s) {
  if (!s) return null;
  return new Date(s + 'T00:00:00Z');
}

async function main() {
  const jsonPath = path.resolve(process.cwd(), '.tmp', 'jumia_statements_2026-01-05_2026-01-11.json');
  if (!fs.existsSync(jsonPath)) {
    console.error('Vendor JSON not found at', jsonPath);
    process.exit(2);
  }
  const vendor = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const vendorStatements = vendor.statements || [];

  // canonical week start provided by user: 2026-01-05 (Monday)
  const canonicalWeekStart = new Date('2026-01-05T00:00:00Z');
  const canonicalWeekEnd = new Date(canonicalWeekStart.getTime() + 7 * 24 * 3600 * 1000);

  // tolerance window similar to export script (36h)
  const tolMs = 36 * 3600 * 1000;
  const windowStart = new Date(canonicalWeekStart.getTime() - tolMs);
  const windowEnd = new Date(canonicalWeekStart.getTime() + tolMs);

  // fetch DB rows overlapping that weekStart tolerance
  const dbRows = await prisma.marketplacePayoutWeek.findMany({
    where: {
      AND: [
        { weekStart: { gte: windowStart } },
        { weekStart: { lt: windowEnd } },
        { account: { platform: 'JUMIA' } },
      ],
    },
    select: { id: true, accountId: true, statementNumber: true, payoutAmount: true, grossSales: true, currency: true, rawPayload: true },
  });

  function findDbForStatement(st) {
    if (!st.statementNumber) return null;
    const byStmt = dbRows.find(r => r.statementNumber === st.statementNumber);
    if (byStmt) return byStmt;
    // fallback: match by shopSid in rawPayload
    return dbRows.find(r => r.rawPayload && (r.rawPayload.shopSid === st.shopSid || (r.rawPayload.shopSid && r.rawPayload.shopSid === st.raw && r.rawPayload.shopSid)) );
  }

  console.log('Vendor statements fetched:', vendorStatements.length);
  console.log('DB MarketplacePayoutWeek rows found for week window:', dbRows.length);
  console.log('');
  console.log('AccountName, StatementNumber, VendorAmount, VendorCurrency, DB_payoutAmount, DB_currency, MatchStatus');
  for (const st of vendorStatements) {
    const db = findDbForStatement(st);
    const vendorAmt = st.amount != null ? st.amount.toFixed(2) : '';
    const vendorCur = st.raw && st.raw.payout && st.raw.payout.currency ? st.raw.payout.currency : '';
    const dbAmt = db && db.payoutAmount != null ? Number(db.payoutAmount).toFixed(2) : '';
    const dbCur = db && db.currency ? db.currency : '';
    let status = '';
    if (!db) status = 'MISSING_IN_DB';
    else if (Number(dbAmt) !== Number(vendorAmt)) status = 'DIFFERENT_AMT';
    else if (dbCur && vendorCur && dbCur !== vendorCur) status = 'CURRENCY_MISMATCH';
    else status = 'OK';

    console.log([st.accountName || '', st.statementNumber || '', vendorAmt, vendorCur, dbAmt, dbCur, status].join(', '));
  }

  // print any DB rows not matched by vendor
  const unmatchedDb = dbRows.filter(r => !vendorStatements.find(s => s.statementNumber === r.statementNumber));
  if (unmatchedDb.length) {
    console.log('\nDB rows in week window not present in vendor fetch:');
    for (const r of unmatchedDb) {
      console.log([r.accountId, r.statementNumber, r.payoutAmount != null ? Number(r.payoutAmount).toFixed(2) : '', r.currency || ''].join(', '));
    }
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  try { await prisma.$disconnect(); } catch (e2) {}
  process.exit(1);
});
