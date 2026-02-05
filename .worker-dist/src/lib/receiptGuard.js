"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canonicalReceiptNumber = canonicalReceiptNumber;
exports.findReceiptOwner = findReceiptOwner;
exports.buildDuplicateMessage = buildDuplicateMessage;
const prisma_1 = require("@/lib/prisma");
const receiptKey_1 = require("@/lib/receiptKey");
function canonicalReceiptNumber(receiptNumber) {
    return (0, receiptKey_1.normalizeReceiptNumber)(receiptNumber ?? undefined);
}
async function findReceiptOwner(receiptNumber) {
    const rk = (0, receiptKey_1.buildReceiptKey)(receiptNumber ?? undefined);
    if (!rk)
        return null;
    // Precedence: POS > MARKETING > SUPPORT
    try {
        if (prisma_1.prisma.order) {
            const order = await prisma_1.prisma.order.findUnique({ where: { orderNumber: rk }, include: { receipt: true } });
            if (order && order.receipt)
                return { type: "pos", id: order.receipt.id, ref: order.orderNumber, createdAt: order.receipt.createdAt, ownerUserId: order.attendantId ?? null };
        }
    }
    catch (e) { }
    try {
        if (prisma_1.prisma.marketingReceipt) {
            const m = await prisma_1.prisma.marketingReceipt.findFirst({ where: { OR: [{ receiptKey: rk }, { receiptNumber: rk }] }, include: { dailyEntry: { select: { submittedById: true } } } });
            if (m)
                return { type: "marketing", id: m.id, entryId: m.dailyEntryId, createdAt: m.createdAt, ownerUserId: m.dailyEntry?.submittedById ?? null };
        }
    }
    catch (e) { }
    try {
        if (prisma_1.prisma.supportReceipt) {
            const s = await prisma_1.prisma.supportReceipt.findFirst({ where: { OR: [{ receiptKey: rk }, { receiptNumber: rk }] }, include: { dailyEntry: { select: { submittedById: true } } } });
            if (s)
                return { type: "support", id: s.id, entryId: s.dailyEntryId, createdAt: s.createdAt, ownerUserId: s.dailyEntry?.submittedById ?? null };
        }
    }
    catch (e) { }
    return null;
}
function buildDuplicateMessage(receiptNumber, owner) {
    if (!owner)
        return "Receipt already exists";
    switch (owner.type) {
        case "pos":
            return `Receipt ${receiptNumber} already exists (POS order ${owner.ref ?? owner.id})`;
        case "marketing":
            return `Receipt ${receiptNumber} already exists (marketing entry ${owner.entryId ?? owner.id})`;
        case "support":
            return `Receipt ${receiptNumber} already exists (support entry ${owner.entryId ?? owner.id})`;
        default:
            return `Receipt ${receiptNumber} already exists`;
    }
}
