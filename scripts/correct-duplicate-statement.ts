import 'tsconfig-paths/register';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const stmtNumber = process.argv[2] || 'PS251229KE12DWN';
  const rows = await prisma.marketplacePayoutWeek.findMany({ where: { statementNumber: stmtNumber } });
  if (rows.length <= 1) {
    console.log('No duplicates found.');
    await prisma.$disconnect();
    return;
  }
  const shopSid = (rows[0].rawPayload as any)?.shopSid ?? null;
  if (!shopSid) {
    console.error('No shopSid found; abort');
    await prisma.$disconnect();
    return;
  }
  const mapped = await prisma.marketplaceAccount.findFirst({ where: { jumiaShopSid: shopSid } });
  if (!mapped) {
    console.error('No marketplaceAccount mapped for shopSid', shopSid);
    await prisma.$disconnect();
    return;
  }

  await prisma.$executeRaw`CREATE TABLE IF NOT EXISTS marketplace_payout_corrections (id TEXT PRIMARY KEY DEFAULT gen_random_uuid(), statement_number TEXT NOT NULL, old_account_id TEXT, new_account_id TEXT, action TEXT NOT NULL, metadata TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT now())`;

  const targetExisting = await prisma.marketplacePayoutWeek.findUnique({ where: { accountId_statementNumber: { accountId: mapped.id, statementNumber: stmtNumber } } });
  if (targetExisting) {
    console.log('Target account already has a row. Keeping', targetExisting.id);
    for (const r of rows) {
      if (r.id === targetExisting.id) continue;
      await prisma.$executeRaw`INSERT INTO marketplace_payout_corrections(statement_number, old_account_id, new_account_id, action, metadata) VALUES (${stmtNumber}, ${r.accountId}, ${mapped.id}, 'DELETE_DUPLICATE', ${JSON.stringify(r)})`;
      await prisma.marketplacePayoutWeek.delete({ where: { id: r.id } });
      console.log('Deleted duplicate row', r.id);
    }
    await prisma.$disconnect();
    return;
  }

  const [keep, ...others] = rows;
  if (keep.accountId !== mapped.id) {
    await prisma.$executeRaw`INSERT INTO marketplace_payout_corrections(statement_number, old_account_id, new_account_id, action, metadata) VALUES (${stmtNumber}, ${keep.accountId}, ${mapped.id}, 'UPDATE_KEEP', ${JSON.stringify(keep)})`;
    await prisma.marketplacePayoutWeek.update({ where: { id: keep.id }, data: { accountId: mapped.id } });
    console.log('Updated keeper row', keep.id, '->', mapped.id);
  }
  for (const r of others) {
    await prisma.$executeRaw`INSERT INTO marketplace_payout_corrections(statement_number, old_account_id, new_account_id, action, metadata) VALUES (${stmtNumber}, ${r.accountId}, ${mapped.id}, 'DELETE_DUPLICATE', ${JSON.stringify(r)})`;
    await prisma.marketplacePayoutWeek.delete({ where: { id: r.id } });
    console.log('Deleted duplicate row', r.id, 'oldAccount', r.accountId);
  }

  console.log('Correction complete.');
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
