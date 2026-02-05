import fs from 'fs';

async function main() {
  const apply = process.env.APPLY === 'true' || process.env.APPLY === '1';
  const data = JSON.parse(fs.readFileSync('.tmp/proposed_shop_mappings.json', 'utf8'));
  const { prisma } = await import('../src/lib/prisma.ts');

  const results: any[] = [];
  for (const p of data.proposals) {
    if (!p.candidates || p.candidates.length === 0) continue;
    const candidate = p.candidates[0];
    if (!candidate.shop || !candidate.shop.id) continue;
    const shopId = candidate.shop.id;
    const jumiaShopSid = p.jumiaShopSid;
    const accountId = p.accountId;

    const existingShop = await prisma.shop.findUnique({ where: { id: shopId } });
    const shopHasSid = existingShop?.jumiaShopSid;

    const action = {
      accountId,
      shopId,
      jumiaShopSid,
      existingShopHasSid: !!shopHasSid,
      willApply: apply && !shopHasSid,
    };
    results.push(action);

    if (apply && !shopHasSid) {
      await prisma.shop.update({ where: { id: shopId }, data: { jumiaShopSid } });
    }
  }

  fs.writeFileSync('.tmp/mapping_apply_report.json', JSON.stringify({ applied: apply, results }, null, 2));
  console.log(`Wrote .tmp/mapping_apply_report.json — applied=${apply}`);
  await prisma.$disconnect().catch(() => undefined);
}

main().catch((e) => {
  console.error('apply_proposed_mappings failed:', e);
  process.exit(1);
});
