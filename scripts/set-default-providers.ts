import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Map providers to JUMIA shop names. We include both exact names and common synonyms to improve matching.
const mappings: Array<{ providerId: string; label?: string; shopNames: string[] }> = [
  {
    providerId: 'KE-VDO-3PL-Lucytech BS-Station',
    label: 'Lucytech BS-Station',
    // JM group
    shopNames: [
      // Exact names observed in Admin panel
      'JM Latest Collections',
      'Maxton Enterprise',
      'Betech Solar Solution',
      // Synonyms/variants provided by user
      'JM',
      'MAXTON',
      'BETECH SOLAR SOLUTIONS',
    ],
  },
  {
    providerId: 'KE-VDO-3PL-Denfa Luthuli-Station',
    label: 'Denfa Luthuli-Station',
    // Denfa group
    shopNames: [
      // Exact names observed in Admin panel
      'Betech Store',
      'Hitech Power',
      'Sky Store Ke',
      'LabTech Kenya',
      // Synonyms/variants provided by user
      'Sky store',
      'Labtech',
    ],
  },
];

async function main() {
  // Load current defaults
  const row = await prisma.config.findUnique({ where: { key: 'jumia:shipper-defaults' } }).catch(() => null);
  const defaults = ((row?.json as any) || {}) as Record<string, { providerId: string; label?: string }>; // shopId -> default

  const results: Array<{ shopName: string; shopId?: string; providerId: string; label?: string; status: 'updated' | 'skipped' | 'not-found' }>
    = [];

  for (const map of mappings) {
    for (const name of map.shopNames) {
      // Try exact insensitive first, then contains as a fallback (JUMIA only)
      let shop = await prisma.shop.findFirst({ where: { platform: 'JUMIA', name: { equals: name, mode: 'insensitive' } }, select: { id: true, name: true } });
      if (!shop) {
        const matches = await prisma.shop.findMany({ where: { platform: 'JUMIA', name: { contains: name, mode: 'insensitive' } }, select: { id: true, name: true } });
        if (matches.length === 1) shop = matches[0];
        else if (matches.length > 1) {
          // pick exact case-insensitive if present; else first match
          shop = matches.find((m) => m.name.toLowerCase() === name.toLowerCase()) || matches[0];
        }
      }
      if (!shop) {
        results.push({ shopName: name, providerId: map.providerId, label: map.label, status: 'not-found' });
        continue;
      }
      defaults[shop.id] = { providerId: map.providerId, label: map.label };
      results.push({ shopName: shop.name, shopId: shop.id, providerId: map.providerId, label: map.label, status: 'updated' });
    }
  }

  await prisma.config.upsert({ where: { key: 'jumia:shipper-defaults' }, update: { json: defaults }, create: { key: 'jumia:shipper-defaults', json: defaults } });

  // eslint-disable-next-line no-console
  console.log('Set default providers summary:');
  for (const r of results) {
    console.log(`- ${r.shopName}${r.shopId ? ' (' + r.shopId + ')' : ''}: ${r.providerId} [${r.status}]`);
  }
}

await main().finally(async () => {
  try { await prisma.$disconnect(); } catch {}
});
