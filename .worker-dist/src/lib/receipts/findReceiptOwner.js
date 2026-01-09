"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findReceiptOwner = findReceiptOwner;
const receiptKey_1 = require("@/lib/receiptKey");
async function findReceiptOwner(client, receiptKeyRaw) {
    const receiptKey = (0, receiptKey_1.buildReceiptKey)(receiptKeyRaw);
    if (!receiptKey)
        return null;
    // POS: try to find Order by orderNumber and its Receipt
    try {
        if (client.order) {
            const order = await client.order.findUnique({ where: { orderNumber: receiptKey }, include: { receipt: true } });
            if (order) {
                if (order.receipt) {
                    return { source: "POS", id: order.receipt.id, createdAt: order.receipt.createdAt, ownerUserId: order.attendantId ?? null };
                }
                // if order exists but no receipt row, return order as owner
                return { source: "POS", id: order.id, createdAt: order.createdAt, ownerUserId: order.attendantId ?? null };
            }
        }
    }
    catch (err) {
        // ignore and continue
    }
    // Marketing receipts
    try {
        if (client.marketingReceipt) {
            const m = await client.marketingReceipt.findFirst({
                where: { OR: [{ receiptKey }, { receiptNumber: receiptKey }] },
                include: { dailyEntry: { select: { submittedById: true } } },
            });
            if (m)
                return { source: "MARKETING", id: m.id, createdAt: m.createdAt, ownerUserId: m.dailyEntry?.submittedById ?? null };
        }
    }
    catch (err) { }
    // Support receipts
    try {
        if (client.supportReceipt) {
            const s = await client.supportReceipt.findFirst({
                where: { OR: [{ receiptKey }, { receiptNumber: receiptKey }] },
                include: { dailyEntry: { select: { submittedById: true } } },
            });
            if (s)
                return { source: "SUPPORT", id: s.id, createdAt: s.createdAt, ownerUserId: s.dailyEntry?.submittedById ?? null };
        }
    }
    catch (err) { }
    return null;
}
exports.default = findReceiptOwner;
