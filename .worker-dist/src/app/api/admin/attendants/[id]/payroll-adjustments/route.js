"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
exports.POST = POST;
exports.DELETE = DELETE;
const server_1 = require("next/server");
const api_1 = require("@/lib/api");
const prisma_1 = require("@/lib/prisma");
const payrollPeriodKey_1 = require("@/lib/payrollPeriodKey");
exports.dynamic = "force-dynamic";
async function GET(req, ctx) {
    const auth = await (0, api_1.requireRole)("ADMIN");
    if (!auth.ok)
        return auth.res;
    const params = (ctx && (ctx.params || ctx)) || {};
    const paramsId = params.id;
    const url = new URL(req.url);
    const urlPathSegments = url.pathname.split('/').filter(Boolean);
    const pathAttendantId = (() => {
        const idx = urlPathSegments.findIndex((s) => s === 'attendants');
        return idx >= 0 && urlPathSegments.length > idx + 1 ? urlPathSegments[idx + 1] : undefined;
    })();
    const queryAttendantId = url.searchParams.get('attendantId') || undefined;
    const attendantId = paramsId ?? queryAttendantId ?? pathAttendantId;
    const periodKey = url.searchParams.get("periodKey") || undefined;
    // TEMP LOGGING: record incoming request for staging diagnostics
    try {
        console.info('[payroll-adjustments][req][GET]', {
            url: req.url,
            paramsId,
            queryAttendantId,
            pathAttendantId,
            attendantId,
            periodKey,
            ts: new Date().toISOString(),
        });
    }
    catch { }
    try {
        const where = { attendantId };
        if (periodKey) {
            const variants = (0, payrollPeriodKey_1.getPeriodKeyVariants)(periodKey);
            where.periodKey = { in: variants.length ? variants : [periodKey] };
        }
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
    let body;
    try {
        body = await req.json();
    }
    catch {
        return server_1.NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const bodyAttendantId = body?.attendantId;
    const paramsId = params.id ?? undefined;
    const url = new URL(req.url);
    const urlPathSegments = url.pathname.split('/').filter(Boolean);
    const pathAttendantId = (() => {
        const idx = urlPathSegments.findIndex((s) => s === 'attendants');
        return idx >= 0 && urlPathSegments.length > idx + 1 ? urlPathSegments[idx + 1] : undefined;
    })();
    const queryAttendantId = url.searchParams.get('attendantId') || undefined;
    const attendantId = paramsId ?? bodyAttendantId ?? queryAttendantId ?? pathAttendantId;
    // TEMP LOGGING: record incoming request body and derived attendantId
    try {
        const bodySnippet = JSON.stringify(body || {}).slice(0, 2000);
        console.info('[payroll-adjustments][req][POST]', {
            url: req.url,
            paramsId,
            bodySnippet,
            queryAttendantId,
            pathAttendantId,
            attendantId,
            ts: new Date().toISOString(),
        });
    }
    catch { }
    const { periodKey, periodLabel, adjustmentType, label, amount, adjustmentKind } = body || {};
    if (!periodKey || typeof adjustmentType !== "string" || !label || typeof amount !== "number") {
        return server_1.NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    if (!attendantId)
        return server_1.NextResponse.json({ error: "attendantId required" }, { status: 400 });
    try {
        const kindCandidate = String(adjustmentKind ?? "DEDUCTION").toUpperCase();
        const kind = kindCandidate === "ADDITION" ? "ADDITION" : "DEDUCTION";
        const created = await prisma_1.prisma.attendantPayrollAdjustment.create({
            data: {
                attendantId,
                periodKey,
                periodLabel: periodLabel ?? periodKey,
                adjustmentType: adjustmentType,
                label,
                amount: Math.trunc(Math.max(0, amount)),
                adjustmentKind: kind,
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
    const url = new URL(req.url);
    const paramsId = params.id;
    // read optional body (may be empty for DELETE)
    let body = null;
    try {
        body = await req.json();
    }
    catch {
        body = null;
    }
    const urlPathSegments = url.pathname.split('/').filter(Boolean);
    const pathAttendantId = (() => {
        const idx = urlPathSegments.findIndex((s) => s === 'attendants');
        return idx >= 0 && urlPathSegments.length > idx + 1 ? urlPathSegments[idx + 1] : undefined;
    })();
    const queryAttendantId = url.searchParams.get("attendantId") || undefined;
    const bodyAttendantId = body?.attendantId;
    const attendantId = paramsId ?? bodyAttendantId ?? queryAttendantId ?? pathAttendantId;
    const adjustmentId = url.searchParams.get("adjustmentId");
    if (!adjustmentId)
        return server_1.NextResponse.json({ error: "adjustmentId required" }, { status: 400 });
    if (!attendantId)
        return server_1.NextResponse.json({ error: "attendantId required" }, { status: 400 });
    // TEMP LOGGING: record incoming DELETE request context for staging
    try {
        const bodySnippet = body ? JSON.stringify(body).slice(0, 2000) : null;
        console.info('[payroll-adjustments][req][DELETE]', {
            url: req.url,
            paramsId,
            bodySnippet,
            queryAttendantId,
            pathAttendantId,
            attendantId,
            adjustmentId,
            ts: new Date().toISOString(),
        });
    }
    catch { }
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
