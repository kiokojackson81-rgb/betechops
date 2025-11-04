import { PrismaClient, Platform } from '@prisma/client';

const prisma = new PrismaClient();

type Args = {
  platform?: Platform;
  format?: 'csv' | 'json';
  names?: string[]; // filter by names (contains-insensitive)
  exact?: boolean; // exact match when names provided
};

function parseArgs(): Args {
  const out: Args = {};
  for (const raw of process.argv.slice(2)) {
    const [k, v] = raw.includes('=') ? (raw.split('=') as [string, string]) : [raw, ''];
    const key = k.replace(/^--/, '').toLowerCase();
    if (key === 'platform' && (v === 'JUMIA' || v === 'KILIMALL')) out.platform = v as Platform;
    else if (key === 'format' && (v === 'csv' || v === 'json')) out.format = v;
    else if (key === 'names') out.names = v.split(',').map((s) => s.trim()).filter(Boolean);
    else if (key === 'exact') out.exact = v === '' ? true : v === '1' || v.toLowerCase() === 'true';
  }
  if (!out.platform) out.platform = 'JUMIA';
  if (!out.format) out.format = 'csv';
  return out;
}

async function main() {
  const args = parseArgs();
  const where: any = { }; // Prisma.ShopWhereInput
  if (args.platform) where.platform = args.platform;
  if (args.names && args.names.length) {
    where.OR = args.names.map((n) => (
      args.exact
        ? { name: { equals: n, mode: 'insensitive' } }
        : { name: { contains: n, mode: 'insensitive' } }
    ));
  }

  const shops = await prisma.shop.findMany({
    where,
    select: { id: true, name: true, platform: true, isActive: true },
    orderBy: { name: 'asc' },
  });

  if (args.format === 'json') {
    console.log(JSON.stringify({ platform: args.platform, count: shops.length, shops }, null, 2));
    return;
  }

  // CSV output
  console.log('platform,name,id,isActive');
  for (const s of shops) {
    const name = (s.name || '').replaceAll('"', '""');
    console.log(`${s.platform},"${name}",${s.id},${s.isActive ? 'true' : 'false'}`);
  }
}

main().finally(async () => {
  try { await prisma.$disconnect(); } catch {}
});
