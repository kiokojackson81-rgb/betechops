import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireRole('ADMIN');
  if (!auth.ok) return auth.res;

  try {
    const url = process.env.DATABASE_URL || '';
    const u = url ? new URL(url) : null;
    const host = u?.host ?? '(unknown)';
    const db = u ? (u.pathname || '').replace(/^\//, '') : '(unknown)';
    const schema = u?.searchParams.get('schema') || 'public';

    const who = await prisma.$queryRaw<Array<{ current_user: string; current_database: string }>>`SELECT current_user, current_database()`;
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = ${schema}
      ORDER BY table_name
    `;
    const shopCols = await prisma.$queryRaw<Array<{ column_name: string; data_type: string; udt_name: string }>>`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_schema = ${schema} AND table_name = 'Shop'
      ORDER BY ordinal_position
    `;
    const enums = await prisma.$queryRaw<Array<{ typname: string }>>`
      SELECT t.typname
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = ${schema} AND t.typtype = 'e'
      ORDER BY t.typname
    `;
    const platformExists = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = ${schema} AND t.typname = 'Platform'
      ) AS exists
    `;

    return NextResponse.json({
      host,
      database: db,
      schema,
      current: who[0],
      tables: tables.map(t => t.table_name),
      shopColumns: shopCols,
      enums: enums.map(e => e.typname),
      platformEnumExists: platformExists[0]?.exists === true,
    });
  } catch (e) {
    const msg = typeof e === 'object' && e !== null && 'message' in e ? String((e as any).message) : String(e ?? 'Server error');
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
