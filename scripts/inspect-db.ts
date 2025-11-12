import { PrismaClient } from '@prisma/client';

async function main() {
  const url = process.argv[2] || process.env.DATABASE_URL || '';
  if (!url) {
    console.error('[inspect-db] Missing DATABASE_URL (or pass URL as first arg)');
    process.exit(1);
  }
  const u = new URL(url);
  const host = u.host;
  const db = (u.pathname || '').replace(/^\//, '') || '(unknown)';
  const schema = (u.searchParams.get('schema') || 'public');
  console.log(`[inspect-db] host=${host} db=${db} schema=${schema}`);

  const prisma = new PrismaClient({ log: ['warn','error'] });
  try {
    const who = await prisma.$queryRaw<Array<{ current_user: string; current_database: string }>>`SELECT current_user, current_database()`;
    console.log('[inspect-db] current_user/db:', who[0]);

    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = ${schema}
      ORDER BY table_name
    `;
    console.log(`[inspect-db] tables in ${schema}:`, tables.map(t => t.table_name));

    const shopCols = await prisma.$queryRaw<Array<{ column_name: string; data_type: string; udt_name: string }>>`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_schema = ${schema} AND table_name = 'Shop'
      ORDER BY ordinal_position
    `;
    console.log('[inspect-db] Shop columns:', shopCols);

    const enums = await prisma.$queryRaw<Array<{ typname: string }>>`
      SELECT t.typname
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = ${schema} AND t.typtype = 'e'
      ORDER BY t.typname
    `;
    console.log(`[inspect-db] enums in ${schema}:`, enums.map(e => e.typname));

    const platformExists = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = ${schema} AND t.typname = 'Platform'
      ) AS exists
    `;
    console.log('[inspect-db] public."Platform" exists:', platformExists[0]?.exists === true);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
