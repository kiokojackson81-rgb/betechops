import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const accountId = process.argv.find(a => a.startsWith('--accountId='))?.split('=')[1] || 'ff8e0bd3-8b24-40d6-af27-64d55a87c041';
  const statement = process.argv.find(a => a.startsWith('--statement='))?.split('=')[1] || 'PS251229KE12DBU';
  const amountArg = process.argv.find(a => a.startsWith('--amount='))?.split('=')[1] || '424086.62';
  const startArg = process.argv.find(a => a.startsWith('--start='))?.split('=')[1] || '2025-12-29';
  const endArg = process.argv.find(a => a.startsWith('--end='))?.split('=')[1] || '2026-01-04';
  const amount = Number(amountArg);
  const weekStart = new Date(startArg + 'T00:00:00');
  const weekEnd = new Date(endArg + 'T23:59:59.999');

  const acct = await prisma.marketplaceAccount.findUnique({ where: { id: accountId } });
  const rawPayload: any = { shopSid: acct?.jumiaShopSid ?? null, name: acct?.displayName ?? null };

  const res = await prisma.marketplacePayoutWeek.upsert({
    where: { accountId_statementNumber: { accountId, statementNumber: statement } },
    create: {
      accountId,
      statementNumber: statement,
      weekStart,
      weekEnd,
      grossSales: amount,
      payoutAmount: amount,
      currency: 'KES',
      isPaid: false,
      rawPayload: rawPayload as any,
    },
    update: {
      grossSales: amount,
      payoutAmount: amount,
      isPaid: false,
      rawPayload: rawPayload as any,
    },
  });
  console.log('Upserted row id:', res.id, 'statementNumber:', res.statementNumber, 'accountId:', res.accountId);
}

main().catch(e => { console.error(e); process.exit(1); });
