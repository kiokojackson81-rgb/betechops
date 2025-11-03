import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { prisma } from '../src/lib/prisma';

type ShopSeed = {
  name: string;
  platform?: string;
  active?: boolean;
  credentials?: {
    apiBase?: string;
    tokenUrl?: string;
    clientId: string;
    refreshToken: string;
  };
};

function loadSeeds(fileArg?: string): ShopSeed[] {
  const defaultPath = path.resolve(process.cwd(), fileArg || 'shops.secrets.json');
  const fallbackPath = path.resolve(process.cwd(), 'shops.local.json');
  const file = fs.existsSync(defaultPath) ? defaultPath : fallbackPath;
  const text = fs.readFileSync(file, 'utf-8');
  const json = JSON.parse(text);
  if (Array.isArray(json)) return json as ShopSeed[];
  if (Array.isArray(json.shops)) return json.shops as ShopSeed[];
  throw new Error(`Invalid seed file format at ${file}: expected array or { shops: [] }`);
}

async function upsertJumiaAccount(name: string, clientId: string, refreshToken: string) {
  // Prefer matching by clientId; update refreshToken and label if found
  const existing = await prisma.jumiaAccount.findFirst({ where: { clientId } });
  if (existing) {
    await prisma.jumiaAccount.update({ where: { id: existing.id }, data: { label: name, refreshToken } });
    return { action: 'updated', id: existing.id } as const;
  }
  const created = await prisma.jumiaAccount.create({ data: { label: name, clientId, refreshToken } });
  return { action: 'created', id: created.id } as const;
}

async function main() {
  const fileArg = process.argv[2];
  const seeds = loadSeeds(fileArg);
  const results: Array<{ name: string; action: string; id: string }> = [];
  for (const s of seeds) {
    if ((s.platform && s.platform.toUpperCase() !== 'JUMIA') || !s.credentials) continue;
    const { clientId, refreshToken } = s.credentials as Required<ShopSeed['credentials']>;
    if (!clientId || !refreshToken) {
      console.warn(`Skipping ${s.name}: missing clientId/refreshToken`);
      continue;
    }
    const r = await upsertJumiaAccount(s.name, clientId, refreshToken);
    results.push({ name: s.name, action: r.action, id: r.id });
    console.log(`${r.action.toUpperCase()}: ${s.name} (accountId=${r.id})`);
  }
  console.log('\nJumia accounts seed complete:', results);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    return prisma.$disconnect().then(() => process.exit(1));
  });
