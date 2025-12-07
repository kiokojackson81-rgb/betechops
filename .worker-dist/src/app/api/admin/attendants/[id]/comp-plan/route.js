"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.PUT = PUT;
const server_1 = require("next/server");
const api_1 = require("@/lib/api");
const prisma_1 = require("@/lib/prisma");
exports.dynamic = "force-dynamic";
async function PUT(req, ctx) {
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
    const { baseSalary, frequency, defaultChamaDeduction, defaultOtherDeduction, defaultTransportAllowance, notes, } = body || {};
    if (typeof baseSalary !== "number")
        return server_1.NextResponse.json({ error: "baseSalary required" }, { status: 400 });
    try {
        const plan = await prisma_1.prisma.attendantCompPlan.upsert({
            where: { attendantId },
            create: {
                attendantId,
                baseSalary: Math.max(0, Math.trunc(baseSalary)),
                frequency: frequency || "PERIOD",
                defaultChamaDeduction: defaultChamaDeduction ?? null,
                defaultOtherDeduction: defaultOtherDeduction ?? null,
                defaultTransportAllowance: defaultTransportAllowance ?? null,
                notes: notes ?? null,
            },
            update: {
                baseSalary: Math.max(0, Math.trunc(baseSalary)),
                frequency: frequency || "PERIOD",
                defaultChamaDeduction: defaultChamaDeduction ?? null,
                defaultOtherDeduction: defaultOtherDeduction ?? null,
                defaultTransportAllowance: defaultTransportAllowance ?? null,
                notes: notes ?? null,
            },
        });
        return server_1.NextResponse.json({ plan });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to save comp plan";
        return server_1.NextResponse.json({ error: msg }, { status: 500 });
    }
}
