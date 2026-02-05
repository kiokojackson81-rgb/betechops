import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  const rows = await prisma.apiCredential.findMany({ orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }], take: 50 });
  for (const r of rows) {
    console.log(`id=${r.id} scope=${r.scope} clientId=${r.clientId ? r.clientId.slice(0,6) + '...' : '<null>'} issuer=${r.issuer ?? '<null>'} base=${r.apiBase ?? '<null>'} refresh=${r.refreshToken ? 'yes' : 'no'} updatedAt=${r.updatedAt}`);
  }
  if (rows.length === 0) console.log('No ApiCredential rows found');
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });

