"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const api_1 = require("@/lib/api");
const auth_1 = require("@/lib/auth");
const tradingPeriod_1 = require("@/lib/tradingPeriod");
const marketingReport_1 = require("@/lib/marketingReport");
const zod_1 = require("zod");
const RestoreSchema = zod_1.z.object({
    actionLogId: zod_1.z.string(),
    force: zod_1.z.boolean().optional(),
    confirmToken: zod_1.z.string().optional(),
});
async function POST(req) {
    const authz = await (0, api_1.requireRole)("ADMIN");
    if (!authz.ok)
        return authz.res;
    let body;
    try {
        body = await req.json();
    }
    catch (e) {
        return server_1.NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    let parsed;
    try {
        parsed = RestoreSchema.parse(body);
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError)
            return server_1.NextResponse.json({ error: "Validation failed", details: err.errors }, { status: 400 });
        return server_1.NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    try {
        const { actionLogId, force, confirmToken } = parsed;
        const log = await prisma_1.prisma.actionLog.findUnique({ where: { id: actionLogId } });
        if (!log)
            return server_1.NextResponse.json({ error: "ActionLog not found" }, { status: 404 });
        if (!log.before)
            return server_1.NextResponse.json({ error: "No before snapshot available to restore" }, { status: 400 });
        // Ensure it's a wipe record
        if (log.entity !== "MarketingDailyEntry" || log.action !== "WIPE_RECEIPTS") {
            return server_1.NextResponse.json({ error: "ActionLog is not a wipe of marketing receipts" }, { status: 400 });
        }
        // Prevent repeated restores: if original log.after has 'restored' flag and force not set, fail
        const alreadyRestored = log.after?.restored;
        if (alreadyRestored && !force) {
            return server_1.NextResponse.json({ error: "This action log was already restored" }, { status: 409 });
        }
        const entryId = log.entityId;
        const currentEntry = await prisma_1.prisma.marketingDailyEntry.findUnique({ where: { id: entryId }, include: { receipts: true } });
        if (!currentEntry)
            return server_1.NextResponse.json({ error: "Marketing entry not found" }, { status: 404 });
        if ((currentEntry.receipts || []).length > 0 && !force) {
            return server_1.NextResponse.json({ error: "Entry already has receipts; pass force=true to override" }, { status: 409 });
        }
        // If caller requested a forced restore, require a valid confirmation token.
        if (force) {
            if (!confirmToken)
                return server_1.NextResponse.json({ error: "confirmToken required for force restore" }, { status: 400 });
            // validate confirmation token exists, is for this wipe, not expired and not consumed
            const actorId = await (0, api_1.getActorId)();
            const now = new Date();
            const confirmLog = await prisma_1.prisma.actionLog.findFirst({
                where: {
                    action: 'REQUEST_RESTORE_CONFIRM',
                    actorId: actorId || undefined,
                },
                orderBy: { createdAt: 'desc' },
            });
            if (!confirmLog)
                return server_1.NextResponse.json({ error: 'No restore confirmation found; request a confirmation token first' }, { status: 403 });
            const after = confirmLog.after || {};
            if (after.consumed)
                return server_1.NextResponse.json({ error: 'Confirmation token already used' }, { status: 409 });
            if (after.expiresAt && new Date(after.expiresAt) < now)
                return server_1.NextResponse.json({ error: 'Confirmation token expired' }, { status: 410 });
            if (after.originalWipeId !== actionLogId)
                return server_1.NextResponse.json({ error: 'Confirmation token not valid for this wipe' }, { status: 403 });
            if (after.token !== confirmToken)
                return server_1.NextResponse.json({ error: 'Invalid confirmation token' }, { status: 403 });
            // mark confirmation consumed
            try {
                await prisma_1.prisma.actionLog.update({ where: { id: confirmLog.id }, data: { after: { ...(confirmLog.after || {}), consumed: true } } });
            }
            catch (e) {
                console.warn('failed to mark confirmation as consumed', e);
            }
        }
        // Parse before snapshot — it's stored as JSON in actionLog.before
        const before = log.before;
        const receipts = Array.isArray(before.receipts) ? before.receipts : [];
        // Capture current state for audit
        const beforeSnapshot = currentEntry;
        // Insert receipts and items
        for (const r of receipts) {
            const created = await prisma_1.prisma.marketingReceipt.create({
                data: {
                    dailyEntryId: entryId,
                    receiptNumber: r.receiptNumber || null,
                    sellingTotal: Number(r.sellingTotal) || 0,
                    paymentMethod: (r.paymentMethod === "CASH" ? "CASH" : "MPESA"),
                    items: {
                        create: Array.isArray(r.items)
                            ? r.items.map((it) => ({ productName: String(it.productName || ""), buyingPrice: Number(it.buyingPrice) || 0 }))
                            : [],
                    },
                },
            });
        }
        // Recompute totals
        const entryWithReceipts = await prisma_1.prisma.marketingDailyEntry.findUnique({ where: { id: entryId }, include: { receipts: { include: { items: true } } } });
        if (!entryWithReceipts)
            return server_1.NextResponse.json({ error: "Entry disappeared during restore" }, { status: 500 });
        const totalSales = entryWithReceipts.receipts.reduce((s, r) => s + (r.sellingTotal || 0), 0);
        const totalProfit = entryWithReceipts.receipts.reduce((s, r) => s + ((r.sellingTotal || 0) - (r.items?.reduce((is, it) => is + (it.buyingPrice || 0), 0) || 0)), 0);
        await prisma_1.prisma.marketingDailyEntry.update({ where: { id: entryId }, data: { totalSales, totalProfit } });
        const restored = await prisma_1.prisma.marketingDailyEntry.findUnique({ where: { id: entryId }, include: { receipts: { include: { items: true } } } });
        // Audit the restore: create a RESTORE_RECEIPTS actionLog and then mark the original log as restored
        let restoreLog = null;
        try {
            const actorId = await (0, api_1.getActorId)();
            const session = await (0, auth_1.auth)();
            const actorEmail = session?.user?.email || "";
            // include a reference back to the original wipe so we can list restores by wipe
            const afterWithRef = { ...restored, originalWipeId: actionLogId };
            restoreLog = await prisma_1.prisma.actionLog.create({ data: { actorId: actorId || "", entity: "MarketingDailyEntry", entityId: entryId, action: "RESTORE_RECEIPTS", before: beforeSnapshot, after: afterWithRef } });
            // Mark original actionLog as restored (best-effort)
            try {
                const mergedAfter = { ...(log.after || {}), restored: true, restoredAt: new Date(), restoredBy: restoreLog.id };
                await prisma_1.prisma.actionLog.update({ where: { id: actionLogId }, data: { after: mergedAfter } });
            }
            catch (e) {
                console.warn("failed to mark original actionLog as restored", e);
            }
        }
        catch (e) {
            console.warn("failed to write actionLog for restore", e);
        }
        // Return restored entry and period report
        const period = (0, tradingPeriod_1.getTradingPeriodFor)(restored.date);
        const report = await (0, marketingReport_1.getMarketingReport)({ tradingPeriodKey: period.key });
        return server_1.NextResponse.json({ restored: true, entry: restored, report }, { status: 200 });
    }
    catch (err) {
        console.error("restore failed", err);
        return server_1.NextResponse.json({ error: err instanceof Error ? err.message : "restore failed" }, { status: 500 });
    }
}
