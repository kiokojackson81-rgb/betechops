import fs from 'fs';

async function main() {
  const { prisma } = await import('../src/lib/prisma.ts');
  // Load missing accounts from previous reports
  let missing = [] as any[];
  try {
    const raw = fs.readFileSync('.tmp/auto_mapping_results.json', 'utf8');
    const parsed = JSON.parse(raw);
    missing = parsed.skipped ?? [];
  } catch {
    try {
      const raw2 = fs.readFileSync('.tmp/missing_shops_report.json', 'utf8');
      const parsed2 = JSON.parse(raw2);
      missing = parsed2.missing ?? parsed2.proposals ?? [];
    } catch {
      // fallback: no missing
    }
  }

  const proposals: any[] = [];

  for (const m of missing) {
    const accountId = m.accountId;
    const jumiaShopSid = m.jumiaShopSid;
    const frag = (jumiaShopSid || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toLowerCase();
    const account = await prisma.marketplaceAccount.findUnique({ where: { id: accountId } });
    const displayName = account?.displayName ?? null;

    const candidates: any[] = [];

    if (jumiaShopSid) {
      // look for shop records where jumiaShopSid contains the fragment
      const bySid = await prisma.shop.findMany({ where: { jumiaShopSid: { contains: frag } }, take: 10 });
      bySid.forEach((s) => candidates.push({ method: 'jumiaSid-contains-frag', shop: s }));
    }

    // loosen name token matching
    if (displayName) {
      const tokens = String(displayName).split(/\s+/).map((t) => t.replace(/[^a-zA-Z0-9]/g, '')).filter((t) => t.length >= 3);
      for (const t of tokens.slice(0, 3)) {
        const byName = await prisma.shop.findMany({ where: { name: { contains: t, mode: 'insensitive' } }, take: 10 });
        byName.forEach((s) => candidates.push({ method: `name-contains-${t}`, shop: s }));
      }
    }

    // fuzzy compare shop.name vs displayName using substring overlap
    const shopsAll = await prisma.shop.findMany({ take: 200 });
    const normalizedDisplay = (displayName ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ');
    for (const s of shopsAll) {
      const normName = (s.name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ');
      const words = normalizedDisplay.split(/\s+/).filter(Boolean);
      const overlap = words.filter((w) => normName.includes(w)).length;
      if (overlap >= Math.max(1, Math.floor(words.length / 2))) {
        candidates.push({ method: 'fuzzy-name-overlap', shop: s, overlap });
      }
    }

    // dedupe candidates by shop.id
    const uniq = new Map<string, any>();
    for (const c of candidates) {
      if (!c.shop || !c.shop.id) continue;
      if (!uniq.has(c.shop.id)) uniq.set(c.shop.id, { shop: c.shop, methods: [c.method], meta: c.overlap ? { overlap: c.overlap } : {} });
      else uniq.get(c.shop.id).methods.push(c.method);
    }

    const candList = Array.from(uniq.values()).map((v) => ({ shop: v.shop, methods: v.methods, meta: v.meta }));
    proposals.push({ accountId, jumiaShopSid, displayName, candidates: candList });
  }

  fs.mkdirSync('.tmp', { recursive: true });
  fs.writeFileSync('.tmp/auto_mapping_second_pass.json', JSON.stringify({ proposals }, null, 2));
  console.log(`Wrote .tmp/auto_mapping_second_pass.json — proposals: ${proposals.length}`);
  await prisma.$disconnect().catch(() => undefined);
}

main().catch((e) => {
  console.error('auto_map_second_pass failed:', e);
  process.exit(1);
});
