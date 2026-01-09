"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const receiptKey_1 = require("@/lib/receiptKey");
const findReceiptOwner_1 = __importDefault(require("@/lib/receipts/findReceiptOwner"));
async function GET(request) {
    try {
        const url = new URL(request.url);
        const receiptNumber = url.searchParams.get("receiptNumber") || url.searchParams.get("receipt") || "";
        if (!receiptNumber)
            return server_1.NextResponse.json({ error: "receiptNumber query param required" }, { status: 400 });
        const receiptKey = (0, receiptKey_1.buildReceiptKey)(receiptNumber);
        if (!receiptKey)
            return server_1.NextResponse.json({ error: "invalid receiptNumber" }, { status: 400 });
        // query all matching rows
        const rows = { pos: [], marketing: [], support: [] };
        // POS: try orders + receipts
        try {
            if (prisma_1.prisma.order) {
                const orders = await prisma_1.prisma.order.findMany({ where: { orderNumber: receiptKey }, include: { receipt: true } });
                for (const o of orders) {
                    rows.pos.push({ id: o.id, orderNumber: o.orderNumber, receipt: o.receipt ?? null, attendantId: o.attendantId ?? null, createdAt: o.createdAt });
                }
            }
        }
        catch (err) {
            // ignore
        }
        // Marketing receipts
        try {
            if (prisma_1.prisma.marketingReceipt) {
                const m = await prisma_1.prisma.marketingReceipt.findMany({ where: { OR: [{ receiptKey }, { receiptNumber: receiptKey }] }, include: { dailyEntry: true } });
                for (const r of m)
                    rows.marketing.push({ id: r.id, receiptNumber: r.receiptNumber, receiptKey: r.receiptKey, sellingTotal: r.sellingTotal, paymentMethod: r.paymentMethod, createdAt: r.createdAt, submittedById: r.dailyEntry?.submittedById ?? null, dailyEntryId: r.dailyEntryId });
            }
        }
        catch (err) { }
        // Support receipts
        try {
            if (prisma_1.prisma.supportReceipt) {
                const s = await prisma_1.prisma.supportReceipt.findMany({ where: { OR: [{ receiptKey }, { receiptNumber: receiptKey }] }, include: { dailyEntry: true } });
                for (const r of s)
                    rows.support.push({ id: r.id, receiptNumber: r.receiptNumber, receiptKey: r.receiptKey, sellingTotal: r.sellingTotal, paymentMethod: r.paymentMethod, createdAt: r.createdAt, submittedById: r.dailyEntry?.submittedById ?? null, dailyEntryId: r.dailyEntryId });
            }
        }
        catch (err) { }
        const owner = await (0, findReceiptOwner_1.default)(prisma_1.prisma, receiptKey);
        return server_1.NextResponse.json({ receiptNumber, receiptKey, owner, rows }, { status: 200 });
    }
    catch (err) {
        console.error("[debug/receipt-owner]", err);
        return server_1.NextResponse.json({ error: String(err) }, { status: 500 });
    }
}
exports.dynamic = "force-dynamic";
