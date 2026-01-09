async function main() {
  const id = process.argv[2] ?? 'cmk2lb4x80003v52kn2utsj8o';
  const amount = Number(process.argv[3] ?? '171407.13');
  const { prisma } = await import('../src/lib/prisma.ts');

  const before = await prisma.marketplacePayoutWeek.findUnique({ where: { id } });
  if (!before) {
    console.error('Row not found', id);
    process.exit(2);
  }
  console.log('Before:', { id: before.id, statementNumber: before.statementNumber, payoutAmount: before.payoutAmount, grossSales: before.grossSales, weekStart: before.weekStart });

  await prisma.marketplacePayoutWeek.update({ where: { id }, data: { payoutAmount: amount, grossSales: amount, currency: 'LOCAL' } });

  const after = await prisma.marketplacePayoutWeek.findUnique({ where: { id } });
  console.log('After:', { id: after?.id, payoutAmount: after?.payoutAmount, grossSales: after?.grossSales });

  const fs = await import('fs');
  fs.writeFileSync('.tmp/jude_update_result.json', JSON.stringify({ id, before, after, appliedAt: new Date().toISOString() }, null, 2));

  await prisma.$disconnect().catch(() => undefined);
}

main().catch((e) => { console.error('update failed', e); process.exit(1); });
