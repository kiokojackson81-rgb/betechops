import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

function toMonday(d: Date) {
  const dt = new Date(d);
  dt.setHours(0, 0, 0, 0);
  const day = dt.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  dt.setDate(dt.getDate() + diff);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

async function main() {
  console.log('Normalizing WeeklySale week bounds for platform JUMIA');
  const rows = await prisma.weeklySale.findMany({ where: { platform: 'JUMIA' } });
  console.log('Found', rows.length, 'JUMIA WeeklySale rows');
  let merged = 0;
  let updated = 0;

  for (const r of rows) {
    const currentStart = new Date(r.weekStart);
    const expectedStart = toMonday(currentStart);
    if (expectedStart.getTime() === currentStart.setHours(0,0,0,0)) continue; // already aligned

    const expectedEnd = new Date(expectedStart.getTime());
    expectedEnd.setDate(expectedStart.getDate() + 6);
    expectedEnd.setHours(23,59,59,999);

    // Check if target key exists
    const exists = await prisma.weeklySale.findFirst({ where: { shopId: r.shopId, platform: r.platform, weekStart: expectedStart, weekEnd: expectedEnd } });
    if (exists) {
      // Merge amounts into exists, then delete old
      await prisma.weeklySale.update({ where: { id: exists.id }, data: { amount: (Number(exists.amount ?? 0) + Number(r.amount ?? 0)) } });
      await prisma.weeklySale.delete({ where: { id: r.id } });
      merged++;
      console.log('Merged', r.id, 'into', exists.id);
    } else {
      // Update the row to new bounds
      await prisma.weeklySale.update({ where: { id: r.id }, data: { weekStart: expectedStart, weekEnd: expectedEnd } });
      updated++;
      console.log('Updated', r.id, 'weekStart ->', expectedStart.toISOString().slice(0,10));
    }
  }

  console.log('Normalization complete:', updated, 'updated,', merged, 'merged');
}

main().catch(e=>{ console.error(e); process.exit(1); });
