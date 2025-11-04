"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
async function tableExists(name) {
    try {
        const r = await prisma_1.prisma.$queryRawUnsafe(`select exists (
         select 1 from information_schema.tables
         where table_schema = 'public' and table_name = $1
       ) as exists`, name);
        return Boolean(r?.[0]?.exists);
    }
    catch {
        return false;
    }
}
async function columnExists(table, column) {
    try {
        const r = await prisma_1.prisma.$queryRawUnsafe(`select exists (
         select 1 from information_schema.columns
         where table_schema = 'public' and table_name = $1 and column_name = $2
       ) as exists`, table, column);
        return Boolean(r?.[0]?.exists);
    }
    catch {
        return false;
    }
}
async function GET() {
    try {
        // quick ping
        await prisma_1.prisma.$queryRawUnsafe("select 1");
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return server_1.NextResponse.json({ ok: true, dbOk: false, error: msg });
    }
    const criticalTables = [
        "User",
        "Shop",
        "ApiCredential",
        "JumiaAccount",
        "JumiaShop",
        "JumiaOrder",
        "ShopAssignment",
    ];
    const checks = {};
    for (const t of criticalTables)
        checks[t] = await tableExists(t);
    // a couple of expected columns
    const columns = {
        "Shop.platform": await columnExists("Shop", "platform"),
        "ApiCredential.refreshToken": await columnExists("ApiCredential", "refreshToken"),
        "JumiaShop.accountId": await columnExists("JumiaShop", "accountId"),
    };
    return server_1.NextResponse.json({ ok: true, dbOk: true, tables: checks, columns, timestamp: new Date().toISOString() });
}
