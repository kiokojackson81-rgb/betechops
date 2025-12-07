"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
exports.POST = POST;
exports.DELETE = DELETE;
const server_1 = require("next/server");
const api_1 = require("@/lib/api");
const prisma_1 = require("@/lib/prisma");
exports.dynamic = "force-dynamic";
async function GET(req, ctx) {
    const auth = await (0, api_1.requireRole)("ADMIN");
    if (!auth.ok)
        return auth.res;
    const params = (ctx && (ctx.params || ctx)) || {};
    const attendantId = params.id;
    const url = new URL(req.url);
    const periodKey = url.searchParams.get("periodKey") || undefined;
    try {
        const where = { attendantId };
        if (periodKey)
            where.periodKey = periodKey;
        const rows = await prisma_1.prisma.attendantPayrollAdjustment.findMany({ where, orderBy: { createdAt: "desc" } });
        return server_1.NextResponse.json({ rows });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to fetch adjustments";
        return server_1.NextResponse.json({ error: msg }, { status: 500 });
    }
}
async function POST(req, ctx) {
    const auth = await (0, api_1.requireRole)("ADMIN");
    if (!auth.ok)
        return auth.res;
    const params = (ctx && (ctx.params || ctx)) || {};
    const attendantId = params.id;
    let body;
    try {
        body = await req.json();
    }
    catch {
        return server_1.NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const { periodKey, periodLabel, adjustmentType, label, amount } = body || {};
    if (!periodKey || typeof adjustmentType !== "string" || !label || typeof amount !== "number") {
        return server_1.NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    try {
        const created = await prisma_1.prisma.attendantPayrollAdjustment.create({
            data: {
                attendantId,
                periodKey,
                periodLabel: periodLabel ?? periodKey,
                adjustmentType: adjustmentType,
                label,
                amount: Math.trunc(Math.max(0, amount)),
                createdById: auth.session?.user?.id ?? "",
            },
        });
        return server_1.NextResponse.json({ created });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to create adjustment";
        return server_1.NextResponse.json({ error: msg }, { status: 500 });
    }
}
async function DELETE(req, ctx) {
    const auth = await (0, api_1.requireRole)("ADMIN");
    if (!auth.ok)
        return auth.res;
    const params = (ctx && (ctx.params || ctx)) || {};
    const attendantId = params.id;
    const url = new URL(req.url);
    const adjustmentId = url.searchParams.get("adjustmentId");
    if (!adjustmentId)
        return server_1.NextResponse.json({ error: "adjustmentId required" }, { status: 400 });
    try {
        const row = await prisma_1.prisma.attendantPayrollAdjustment.findUnique({ where: { id: adjustmentId } });
        if (!row)
            return server_1.NextResponse.json({ error: "Not found" }, { status: 404 });
        if (row.attendantId !== attendantId)
            return server_1.NextResponse.json({ error: "Mismatched attendant" }, { status: 403 });
        await prisma_1.prisma.attendantPayrollAdjustment.delete({ where: { id: adjustmentId } });
        return server_1.NextResponse.json({ ok: true });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to delete";
        return server_1.NextResponse.json({ error: msg }, { status: 500 });
    }
}
