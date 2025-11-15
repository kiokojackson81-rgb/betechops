"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const api_1 = require("@/lib/api");
exports.dynamic = 'force-dynamic';
async function GET() {
    const auth = await (0, api_1.requireRole)('ADMIN');
    if (!auth.ok)
        return auth.res;
    try {
        const url = process.env.DATABASE_URL || '';
        const u = url ? new URL(url) : null;
        const host = u?.host ?? '(unknown)';
        const db = u ? (u.pathname || '').replace(/^\//, '') : '(unknown)';
        const schema = u?.searchParams.get('schema') || 'public';
        const who = await prisma_1.prisma.$queryRaw `SELECT current_user, current_database()`;
        const tables = await prisma_1.prisma.$queryRaw `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = ${schema}
      ORDER BY table_name
    `;
        const shopCols = await prisma_1.prisma.$queryRaw `
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_schema = ${schema} AND table_name = 'Shop'
      ORDER BY ordinal_position
    `;
        const enums = await prisma_1.prisma.$queryRaw `
      SELECT t.typname
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = ${schema} AND t.typtype = 'e'
      ORDER BY t.typname
    `;
        const platformExists = await prisma_1.prisma.$queryRaw `
      SELECT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = ${schema} AND t.typname = 'Platform'
      ) AS exists
    `;
        return server_1.NextResponse.json({
            host,
            database: db,
            schema,
            current: who[0],
            tables: tables.map(t => t.table_name),
            shopColumns: shopCols,
            enums: enums.map(e => e.typname),
            platformEnumExists: platformExists[0]?.exists === true,
        });
    }
    catch (e) {
        const msg = typeof e === 'object' && e !== null && 'message' in e ? String(e.message) : String(e ?? 'Server error');
        return server_1.NextResponse.json({ error: msg }, { status: 500 });
    }
}
