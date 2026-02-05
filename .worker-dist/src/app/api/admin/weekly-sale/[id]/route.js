"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.PATCH = PATCH;
exports.DELETE = DELETE;
const server_1 = require("next/server");
const client_1 = require("@prisma/client");
const prisma_1 = require("@/lib/prisma");
const api_1 = require("@/lib/api");
const weeklySales_1 = require("@/lib/weeklySales");
const tradingPeriod_1 = require("@/lib/tradingPeriod");
exports.dynamic = "force-dynamic";
async function resolveParams(context) {
    const maybePromise = context.params;
    if (maybePromise && typeof maybePromise.then === "function") {
        return maybePromise;
    }
    return context.params;
}
async function PATCH(req, context) {
    const auth = await (0, api_1.requireRole)("ADMIN");
    if (!auth.ok)
        return auth.res;
    const { id } = await resolveParams(context);
    const body = (await req.json().catch(() => null));
    if (!body)
        return server_1.NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    const updates = {};
    if (body.amount !== undefined) {
        const nextAmount = typeof body.amount === "string" ? Number(body.amount) : body.amount;
        if (typeof nextAmount !== "number" || Number.isNaN(nextAmount)) {
            return server_1.NextResponse.json({ error: "Invalid amount" }, { status: 400 });
        }
        updates.amount = nextAmount;
    }
    if (body.status) {
        const nextStatus = body.status.toUpperCase();
        if (!Object.values(client_1.WeeklySaleStatus).includes(nextStatus)) {
            return server_1.NextResponse.json({ error: "Invalid status" }, { status: 400 });
        }
        updates.status = nextStatus;
        const approverId = auth.session?.user?.id ?? null;
        // Prisma generated types expect relation updates via the `approved` relation.
        if (nextStatus === client_1.WeeklySaleStatus.APPROVED && approverId) {
            // connect the approver user
            updates.approved = { connect: { id: approverId } };
        }
        else {
            // disconnect any existing approver when not approved
            updates.approved = { disconnect: true };
        }
    }
    if (!Object.keys(updates).length) {
        return server_1.NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }
    const sale = await prisma_1.prisma.weeklySale.update({
        where: { id },
        data: updates,
        include: {
            shop: { select: { id: true, name: true, platform: true } },
            user: { select: { id: true, name: true, email: true } },
            approved: { select: { id: true, name: true, email: true } },
        },
    });
    // Automatically recompute the online commission ledger when manual totals change
    if (sale.userId && sale.source === client_1.WeeklySaleSource.MANUAL) {
        const shouldRecompute = updates.status === client_1.WeeklySaleStatus.APPROVED ||
            updates.amount !== undefined ||
            updates.status === client_1.WeeklySaleStatus.PENDING;
        if (shouldRecompute) {
            try {
                const period = (0, tradingPeriod_1.getTradingPeriodFor)(sale.weekStart);
                await (0, weeklySales_1.recomputeWeeklySalesCommission)({ userId: sale.userId, period });
            }
            catch (err) {
                console.error("[weekly-sale][id] recompute failed", err);
            }
        }
    }
    return server_1.NextResponse.json(sale);
}
async function DELETE(_req, context) {
    const auth = await (0, api_1.requireRole)("ADMIN");
    if (!auth.ok)
        return auth.res;
    const { id } = await resolveParams(context);
    const sale = await prisma_1.prisma.weeklySale.findUnique({
        where: { id },
        select: { id: true, source: true, status: true },
    });
    if (!sale)
        return server_1.NextResponse.json({ error: "Not found" }, { status: 404 });
    if (sale.source !== client_1.WeeklySaleSource.MANUAL || sale.status !== client_1.WeeklySaleStatus.PENDING) {
        return server_1.NextResponse.json({ error: "Only pending manual entries can be deleted" }, { status: 400 });
    }
    await prisma_1.prisma.weeklySale.delete({ where: { id } });
    return server_1.NextResponse.json({ success: true });
}
