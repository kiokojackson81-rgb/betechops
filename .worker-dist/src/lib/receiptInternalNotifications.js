"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSiteUrl = getSiteUrl;
exports.notifyInternalReceipt = notifyInternalReceipt;
const crypto_1 = require("crypto");
const prisma_1 = require("@/lib/prisma");
const receiptExtract_1 = require("@/lib/receiptExtract");
const chatraceInternalFixed_1 = require("@/lib/chatraceInternalFixed");
function getSiteUrl() {
    return process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'https://ops.betech.co.ke';
}
async function notifyInternalReceipt(receiptId, docType, requestId, receiptUrl) {
    if (docType && docType !== 'RECEIPT')
        return;
    if (requestId) {
        console.info(`[receiptSender][${requestId}] INTERNAL:begin`);
    }
    const receipt = await prisma_1.prisma.receipt.findUnique({
        where: { id: receiptId },
        include: {
            issuedBy: { select: { name: true, email: true } },
            order: {
                select: {
                    orderNumber: true,
                    attendant: { select: { name: true } },
                },
            },
        },
    });
    if (!receipt)
        return;
    const receiptNumberValue = (typeof receipt.totals === 'object' && receipt.totals
        ? receipt.totals.receiptNumber
        : null) ||
        (typeof receipt.data === 'object' && receipt.data
            ? receipt.data.receiptNumber
            : null) ||
        receipt.order?.orderNumber;
    const receiptNumber = String(receiptNumberValue || receipt.orderId || receipt.id);
    const snapshot = typeof receipt.data === 'object' && receipt.data
        ? { ...receipt.data }
        : { order: receipt.order, totals: receipt.totals };
    if (!snapshot.attendantName) {
        snapshot.attendantName =
            receipt.order?.attendant?.name ??
                receipt.issuedBy?.name ??
                receipt.issuedBy?.email ??
                '(unknown)';
    }
    const amountKES = (0, receiptExtract_1.extractReceiptTotalKES)(receipt);
    const invoiceAmount = Number.isFinite(amountKES) ? amountKES : 0;
    const paymentMethod = String((typeof receipt.data === 'object' && receipt.data
        ? receipt.data.paymentMethod
        : null) ||
        (typeof receipt.totals === 'object' && receipt.totals
            ? receipt.totals.paymentMethod
            : null) ||
        '')
        .trim();
    const staffName = receipt.issuedBy?.name || receipt.issuedBy?.email || '(unknown)';
    const itemsShort = (0, receiptExtract_1.extractItemsShort)(receipt);
    const baseUrl = getSiteUrl().replace(/\/$/, '');
    const receiptLink = `${baseUrl}/receipts/${receipt.id}`;
    const rid = requestId || (0, crypto_1.randomUUID)();
    if (requestId) {
        console.info(`[receiptSender][${requestId}] INTERNAL:begin`);
    }
    const receiptLinkSafe = (receiptUrl && receiptUrl.trim()) || receiptLink;
    console.info('[receipts][internal] attempting push', { receiptId, rid });
    const result = await (0, chatraceInternalFixed_1.pushInternalReceiptAlert)({
        requestId: rid,
        receiptNumber,
        amount: String(Math.round(invoiceAmount)),
        paymentMethod,
        createdBy: snapshot.attendantName ?? '(unknown)',
        itemsText: itemsShort,
        receiptLink: receiptLinkSafe,
        receiptPdfUrl: receiptUrl ?? null,
    });
    console.info('[receipts][internal] push result', {
        ok: result?.ok,
        rid: result?.debug?.rid ?? null,
        enabled: result?.debug?.enabled ?? null,
        env: result?.debug?.env ?? null,
        status: result?.debug?.steps?.createOrUpdate?.status ?? null,
        stepOk: result?.debug?.steps?.createOrUpdate?.ok ?? null,
        snippet: result?.debug?.steps?.createOrUpdate?.bodySnippet ?? null,
        json: result?.debug?.steps?.createOrUpdate?.json ?? null,
        rawHead: result?.debug?.steps?.createOrUpdate?.raw
            ? result.debug.steps.createOrUpdate.raw.length > 400
                ? result.debug.steps.createOrUpdate.raw.slice(0, 400)
                : result.debug.steps.createOrUpdate.raw
            : null,
    });
    if (!result?.ok) {
        try {
            console.error('[receipts][internal] push failed', result?.debug ?? result);
        }
        catch (logErr) {
            console.error('[receipts][internal] push failed (unable to serialize debug)', logErr);
        }
    }
    if (requestId) {
        console.info(`[receiptSender][${requestId}] INTERNAL:ok`);
    }
}
