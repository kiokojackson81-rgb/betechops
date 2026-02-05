"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const jumia_1 = require("@/lib/jumia");
async function handle(request) {
    const url = new URL(request.url);
    const statement = url.searchParams.get("statement");
    const shopSid = url.searchParams.get("shopSid");
    const day = url.searchParams.get("day");
    if (!statement && !shopSid) {
        return server_1.NextResponse.json({ ok: false, error: "provide statement or shopSid query param" }, { status: 400 });
    }
    try {
        let targetShopId = null;
        if (statement) {
            const row = await prisma_1.prisma.marketplacePayoutWeek.findFirst({ where: { statementNumber: statement } });
            if (!row)
                return server_1.NextResponse.json({ ok: false, error: "no DB row for statement" }, { status: 404 });
            const sid = row.rawPayload?.shopSid ?? null;
            if (!sid)
                return server_1.NextResponse.json({ ok: false, error: "no shopSid in DB rawPayload" }, { status: 404 });
            const shop = await prisma_1.prisma.shop.findFirst({ where: { jumiaShopSid: sid } });
            if (!shop)
                return server_1.NextResponse.json({ ok: false, error: "no Shop record for shopSid" }, { status: 404 });
            targetShopId = shop.id;
        }
        else if (shopSid) {
            const shop = await prisma_1.prisma.shop.findFirst({ where: { jumiaShopSid: shopSid } });
            if (!shop)
                return server_1.NextResponse.json({ ok: false, error: "no Shop record for shopSid" }, { status: 404 });
            targetShopId = shop.id;
        }
        // Fetch vendor payouts for that shop (optionally filter by day)
        const vendorResp = await (0, jumia_1.fetchPayoutsForShop)(targetShopId, day ? { day } : undefined);
        const statements = vendorResp?.statements ?? vendorResp?.data?.statements ?? vendorResp?.data ?? vendorResp;
        let matched = null;
        if (Array.isArray(statements)) {
            if (statement)
                matched = statements.find((s) => s.statementNumber === statement) ?? null;
            if (!matched)
                matched = statements[0] ?? null;
        }
        else {
            matched = statements;
        }
        const vendorAmount = matched?.payout?.amount ?? matched?.closingBalance ?? null;
        const dbRow = statement
            ? await prisma_1.prisma.marketplacePayoutWeek.findFirst({ where: { statementNumber: statement } })
            : null;
        const dbAmount = dbRow ? Number(dbRow.payoutAmount ?? dbRow.grossSales ?? 0) : null;
        const delta = vendorAmount != null && dbAmount != null ? Number(vendorAmount) - Number(dbAmount) : null;
        return server_1.NextResponse.json({ ok: true, statement: statement ?? matched?.statementNumber, vendor: { amount: vendorAmount, raw: matched }, db: { amount: dbAmount, raw: dbRow?.rawPayload ?? null }, delta });
    }
    catch (err) {
        console.error('[api.jumia.reconcile-statement] failed', err);
        return server_1.NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
}
async function GET(request) {
    return handle(request);
}
async function POST(request) {
    return handle(request);
}
