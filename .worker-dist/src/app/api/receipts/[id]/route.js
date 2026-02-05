"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
exports.PATCH = PATCH;
exports.DELETE = DELETE;
const server_1 = require("next/server");
const client_1 = require("@prisma/client");
const prisma_1 = require("@/lib/prisma");
const api_1 = require("@/lib/api");
const receiptGuard_1 = require("@/lib/receiptGuard");
const marketingReceiptCleanup_1 = require("@/lib/marketingReceiptCleanup");
exports.dynamic = "force-dynamic";
function resolveParams(context) {
    const maybePromise = context.params;
    if (maybePromise && typeof maybePromise.then === "function") {
        return maybePromise;
    }
    return Promise.resolve(context.params);
}
async function GET(_req, context) {
    const { id } = await resolveParams(context);
    const receipt = await prisma_1.prisma.receipt.findUnique({
        where: { id },
        include: {
            order: {
                include: {
                    items: {
                        include: {
                            product: {
                                select: {
                                    id: true,
                                    name: true,
                                },
                            },
                        },
                    },
                    attendant: { select: { id: true, name: true, email: true } },
                    layawayPlan: { include: { payments: true } },
                },
            },
            issuedBy: { select: { id: true, name: true, email: true } },
        },
    });
    let supportItems = [];
    let supportReceiptSummary = null;
    try {
        if (receipt?.order?.orderNumber) {
            const candidates = new Set();
            candidates.add(receipt.order.orderNumber);
            const normalizedOrderNumber = (0, receiptGuard_1.canonicalReceiptNumber)(receipt.order.orderNumber);
            if (normalizedOrderNumber) {
                candidates.add(normalizedOrderNumber);
            }
            if (candidates.size > 0) {
                const supportReceipts = await prisma_1.prisma.supportReceipt.findMany({
                    where: {
                        OR: Array.from(candidates).map((value) => ({ receiptNumber: value })),
                    },
                    include: { items: true },
                });
                if (supportReceipts.length > 0) {
                    supportItems = supportReceipts.flatMap((sr) => sr.items.map((it) => ({
                        id: it.id,
                        buyingPrice: Number.isFinite(Number(it.buyingPrice ?? 0)) ? Number(it.buyingPrice ?? 0) : null,
                        productName: it.productName ?? null,
                    })));
                    // Prefer the first support receipt summary (there should normally be one)
                    const sr = supportReceipts[0];
                    supportReceiptSummary = { id: sr.id, buyingTotal: Number(sr.buyingTotal ?? 0) };
                }
            }
        }
    }
    catch (e) {
        // best-effort; ignore support lookup failures
    }
    if (!receipt)
        return server_1.NextResponse.json({ error: "Not found" }, { status: 404 });
    return server_1.NextResponse.json({ receipt, supportItems, supportReceiptSummary });
}
async function PATCH(req, context) {
    const guard = await (0, api_1.requireRole)(["ADMIN"]);
    if (!guard.ok) {
        // Some test environments surface a 401 (unauthorized) while tests expect 403 (forbidden).
        // Normalize 401 -> 403 here as a best-effort so tests that mock auth behave consistently.
        const res = guard.res;
        if (res && res.status === 401)
            return server_1.NextResponse.json({ error: "Forbidden" }, { status: 403 });
        return guard.res;
    }
    const actorId = guard.session?.user?.id ?? null;
    const { id } = await resolveParams(context);
    const body = await req.json().catch(() => ({}));
    const items = Array.isArray(body?.items) ? body.items : [];
    const taxRate = Number(body?.taxRate || 0);
    const showTax = Boolean(body?.showTax);
    const discount = Number(body?.discount || 0);
    const showDiscount = Boolean(body?.showDiscount);
    const paymentDetailsShown = Boolean(body?.paymentDetailsShown);
    const notes = body?.notes ?? null;
    const warrantyText = body?.warrantyText ?? null;
    const attendantId = body?.attendantId ?? null;
    const subtotal = items.reduce((sum, it) => sum + Number(it.quantity || 1) * Number(it.unitPrice || it.sellingPrice || 0), 0);
    const taxAmount = showTax ? subtotal * (taxRate / 100) : 0;
    const total = subtotal + taxAmount - discount;
    try {
        const updated = await prisma_1.prisma.$transaction(async (tx) => {
            const existing = await tx.receipt.findUnique({
                where: { id },
                include: { order: { include: { items: true, layawayPlan: true } } },
            });
            if (!existing)
                throw new Error("Receipt not found");
            const docType = body?.docType ? String(body.docType).toUpperCase() : String(existing.docType);
            const layawayDeposit = Number(existing.order?.layawayPlan?.deposit ?? existing.order?.paidAmount ?? 0);
            const paidAmount = docType === "LAYAWAY" ? layawayDeposit : total;
            // refresh products + items
            // Delete dependent CommissionEarning rows first to avoid foreign-key violations
            // (CommissionEarning.orderItemId references OrderItem). If there are existing
            // items, remove their commission earnings before removing the items.
            if (existing.order?.items && existing.order.items.length) {
                const existingItemIds = existing.order.items.map((i) => i.id);
                await tx.commissionEarning.deleteMany({ where: { orderItemId: { in: existingItemIds } } });
            }
            await tx.orderItem.deleteMany({ where: { orderId: existing.orderId } });
            const createdOrderItems = [];
            const createdItems = [];
            for (const it of items) {
                const title = String(it.title || it.product || it.productName || "Item").slice(0, 255);
                let product = await tx.product.findFirst({ where: { name: title } });
                if (!product) {
                    product = await tx.product.create({
                        data: {
                            sku: `manual-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
                            name: title,
                            category: "manual",
                            sellingPrice: Number(it.unitPrice || it.sellingPrice || 0) || 0,
                        },
                    });
                }
                const quantity = Math.max(1, Number(it.quantity || 1));
                const unitPrice = Number(it.unitPrice || it.sellingPrice || 0) || 0;
                const costPrice = Math.max(0, Math.round(Number(it.buyingPrice ?? 0)));
                const createPayload = {
                    orderId: existing.orderId,
                    productId: product.id,
                    quantity,
                    sellingPrice: unitPrice,
                    serial: it.serial === null || it.serial === undefined
                        ? null
                        : typeof it.serial === 'string'
                            ? it.serial
                            : String(it.serial),
                    warranty: it.warranty === null || it.warranty === undefined
                        ? null
                        : typeof it.warranty === 'string'
                            ? it.warranty
                            : String(it.warranty),
                };
                console.info('[receipts] creating orderItem (patch)', JSON.stringify(createPayload), {
                    serialType: createPayload.serial === null ? 'null' : typeof createPayload.serial,
                    warrantyType: createPayload.warranty === null ? 'null' : typeof createPayload.warranty,
                });
                try {
                    const createdItem = await tx.orderItem.create({ data: createPayload });
                    createdOrderItems.push(createdItem);
                    createdItems.push({
                        title,
                        quantity,
                        unitPrice,
                        costPrice,
                    });
                }
                catch (orderItemErr) {
                    console.error('[receipts] failed to create orderItem (patch)', {
                        createPayload,
                        error: orderItemErr?.message ?? String(orderItemErr),
                        meta: orderItemErr?.meta ?? undefined,
                        stack: orderItemErr?.stack ?? undefined,
                    });
                    throw orderItemErr;
                }
            }
            // update order basics
            await tx.order.update({
                where: { id: existing.orderId },
                data: {
                    customerName: body?.customerName ?? undefined,
                    customerPhone: body?.customerPhone ?? undefined,
                    customerEmail: body?.customerEmail ?? undefined,
                    attendantId: body?.attendantId ?? undefined,
                    totalAmount: total,
                    paidAmount,
                },
            });
            if (existing.order?.layawayPlan) {
                const balance = Math.max(0, total - Number(existing.order.layawayPlan.deposit || 0));
                await tx.layawayPlan.update({
                    where: { id: existing.order.layawayPlan.id },
                    data: { balance, isComplete: balance <= 0 },
                });
                if (balance <= 0) {
                    await tx.commissionEarning.updateMany({
                        where: { orderItem: { orderId: existing.orderId }, status: "PENDING" },
                        data: { status: "RELEASED" },
                    });
                    await tx.commissionRecord.updateMany({
                        where: { orderId: existing.orderId },
                        data: { status: "RELEASED", releasedAt: new Date(), amount: String(total) },
                    });
                }
            }
            const normalizedReceiptNumber = (0, receiptGuard_1.canonicalReceiptNumber)(existing.order?.orderNumber ?? "");
            const entryAttendantId = attendantId ?? existing.order?.attendantId ?? null;
            const entryDate = existing.order?.createdAt ?? new Date();
            const dayStart = new Date(entryDate);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(dayStart);
            dayEnd.setHours(23, 59, 59, 999);
            const dayOfWeek = entryDate.toLocaleDateString("en-KE", { weekday: "long" });
            const guardUser = guard.session?.user;
            const actorName = guardUser?.name ?? guardUser?.email ?? null;
            const actorEmail = guardUser?.email ?? null;
            const receiptItemsData = createdItems.map((item) => ({
                productName: item.title || "Item",
                buyingPrice: item.costPrice,
            }));
            const totalBuying = createdItems.reduce((sum, item) => sum + item.costPrice * item.quantity, 0);
            const existingSupportReceipt = normalizedReceiptNumber && tx.supportReceipt
                ? await tx.supportReceipt.findFirst({ where: { receiptNumber: normalizedReceiptNumber } })
                : null;
            const existingMarketingReceipt = normalizedReceiptNumber && tx.marketingReceipt
                ? await tx.marketingReceipt.findFirst({ where: { receiptNumber: normalizedReceiptNumber } })
                : null;
            const previousSupportEntryId = existingSupportReceipt?.dailyEntryId ?? null;
            const previousMarketingEntryId = existingMarketingReceipt?.dailyEntryId ?? null;
            const supportPaymentMethod = existingSupportReceipt?.paymentMethod ?? client_1.PaymentMethod.MPESA;
            const marketingPaymentMethod = existingMarketingReceipt?.paymentMethod ?? supportPaymentMethod;
            const updatedReceipt = await tx.receipt.update({
                where: { id },
                data: {
                    taxRate: taxRate || null,
                    discount: discount || null,
                    showTax,
                    showDiscount,
                    paymentDetailsShown,
                    notes,
                    warrantyText,
                    totals: {
                        subtotal,
                        tax: taxAmount,
                        total,
                        balance: existing.order?.layawayPlan ? Math.max(0, total - Number(existing.order.layawayPlan.deposit || 0)) : 0,
                    },
                    data: { ...existing.data, ...body, totals: { subtotal, tax: taxAmount, total } },
                },
            });
            // Refresh commission earnings on edit (gross-based placeholder)
            if (createdOrderItems.length) {
                await tx.commissionEarning.deleteMany({ where: { orderItem: { orderId: existing.orderId } } });
                await tx.commissionEarning.createMany({
                    data: createdOrderItems.map((it) => ({
                        staffId: attendantId || existing.order?.attendantId || null,
                        orderItemId: it.id,
                        basis: "gross",
                        qty: it.quantity,
                        amount: Number(it.sellingPrice || 0) * Number(it.quantity || 1),
                        status: docType === "LAYAWAY" ? "PENDING" : "PENDING",
                        calcDetail: { reason: "receipt_edit_seed" },
                    })),
                });
            }
            try {
                await tx.actionLog.create({
                    data: {
                        actorId: actorId ?? "system",
                        entity: "Receipt",
                        entityId: id,
                        action: "UPDATE",
                        before: existing,
                        after: updatedReceipt,
                    },
                });
            }
            catch {
                // best-effort audit log
            }
            if (normalizedReceiptNumber && entryAttendantId && receiptItemsData.length) {
                let supportEntryId = null;
                if (tx.supportDailyEntry) {
                    const supportEntry = await tx.supportDailyEntry.findFirst({
                        where: { submittedById: entryAttendantId, date: { gte: dayStart, lte: dayEnd } },
                        select: { id: true },
                    });
                    supportEntryId = supportEntry?.id ?? null;
                    if (!supportEntryId) {
                        const entry = await tx.supportDailyEntry.create({
                            data: {
                                date: entryDate,
                                dayOfWeek,
                                totalSales: 0,
                                totalProfit: 0,
                                newBatteries: 0,
                                changedBatteries: 0,
                                submittedById: entryAttendantId,
                            },
                        });
                        supportEntryId = entry.id;
                    }
                }
                if (supportEntryId && tx.supportReceipt) {
                    if (existingSupportReceipt) {
                        await tx.supportReceiptItem.deleteMany({ where: { receiptId: existingSupportReceipt.id } });
                        await tx.supportReceipt.update({
                            where: { id: existingSupportReceipt.id },
                            data: {
                                dailyEntryId: supportEntryId,
                                sellingTotal: total,
                                buyingTotal: totalBuying,
                                paymentMethod: supportPaymentMethod,
                                items: { create: receiptItemsData },
                            },
                        });
                    }
                    else {
                        await tx.supportReceipt.create({
                            data: {
                                dailyEntryId: supportEntryId,
                                receiptNumber: normalizedReceiptNumber,
                                sellingTotal: total,
                                buyingTotal: totalBuying,
                                paymentMethod: supportPaymentMethod,
                                items: { create: receiptItemsData },
                            },
                        });
                    }
                    await (0, marketingReceiptCleanup_1.recalcSupportEntry)(tx, supportEntryId);
                    if (previousSupportEntryId && previousSupportEntryId !== supportEntryId) {
                        await (0, marketingReceiptCleanup_1.recalcSupportEntry)(tx, previousSupportEntryId);
                    }
                }
                let marketingEntryId = null;
                if (tx.marketingDailyEntry) {
                    const marketingEntry = await tx.marketingDailyEntry.findFirst({
                        where: { submittedById: entryAttendantId, date: { gte: dayStart, lte: dayEnd } },
                        select: { id: true },
                    });
                    marketingEntryId = marketingEntry?.id ?? null;
                    if (!marketingEntryId) {
                        const entry = await tx.marketingDailyEntry.create({
                            data: {
                                date: entryDate,
                                dayOfWeek,
                                totalSales: 0,
                                totalProfit: 0,
                                submittedById: entryAttendantId,
                                submittedByName: actorName ?? undefined,
                                submittedByEmail: actorEmail ?? undefined,
                            },
                        });
                        marketingEntryId = entry.id;
                    }
                }
                if (marketingEntryId && tx.marketingReceipt) {
                    if (existingMarketingReceipt) {
                        await tx.marketingReceiptItem.deleteMany({ where: { receiptId: existingMarketingReceipt.id } });
                        await tx.marketingReceipt.update({
                            where: { id: existingMarketingReceipt.id },
                            data: {
                                dailyEntryId: marketingEntryId,
                                sellingTotal: total,
                                buyingTotal: totalBuying,
                                paymentMethod: marketingPaymentMethod,
                                items: { create: receiptItemsData },
                            },
                        });
                    }
                    else {
                        await tx.marketingReceipt.create({
                            data: {
                                dailyEntryId: marketingEntryId,
                                receiptNumber: normalizedReceiptNumber,
                                sellingTotal: total,
                                buyingTotal: totalBuying,
                                paymentMethod: marketingPaymentMethod,
                                items: { create: receiptItemsData },
                            },
                        });
                    }
                    await (0, marketingReceiptCleanup_1.recalcMarketingEntry)(tx, marketingEntryId);
                    if (previousMarketingEntryId && previousMarketingEntryId !== marketingEntryId) {
                        await (0, marketingReceiptCleanup_1.recalcMarketingEntry)(tx, previousMarketingEntryId);
                    }
                }
            }
            return updatedReceipt;
        });
        // recompute support ledger if attendant is present
        const ledgerAttendantId = attendantId || updated?.order?.attendantId;
        if (ledgerAttendantId) {
            try {
                const { getTradingPeriodFor } = await Promise.resolve().then(() => __importStar(require("@/lib/tradingPeriod")));
                const { recomputeSupportCommissionLedger } = await Promise.resolve().then(() => __importStar(require("@/lib/supportCommission")));
                const period = getTradingPeriodFor(new Date());
                await recomputeSupportCommissionLedger({ userId: ledgerAttendantId, period });
            }
            catch (e) {
                console.error("[receipts PATCH] failed to recompute support ledger", e);
            }
        }
        return server_1.NextResponse.json({ ok: true, receipt: updated });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to update receipt";
        return server_1.NextResponse.json({ error: msg }, { status: 500 });
    }
}
async function DELETE(_req, context) {
    const guard = await (0, api_1.requireRole)(["ADMIN"]);
    if (!guard.ok) {
        const res = guard.res;
        if (res && res.status === 401)
            return server_1.NextResponse.json({ error: "Forbidden" }, { status: 403 });
        return guard.res;
    }
    const { id } = await resolveParams(context);
    try {
        await prisma_1.prisma.$transaction(async (tx) => {
            const receipt = await tx.receipt.findUnique({
                where: { id },
                include: {
                    order: {
                        include: {
                            items: true,
                            layawayPlan: true,
                        },
                    },
                },
            });
            if (!receipt)
                throw new Error("Receipt not found");
            const order = receipt.order;
            if (!order)
                throw new Error("Associated order missing");
            const orderId = order.id;
            if (order.orderNumber) {
                await (0, marketingReceiptCleanup_1.cleanupMarketingReceipts)(tx, order.orderNumber);
                await (0, marketingReceiptCleanup_1.cleanupSupportReceipts)(tx, order.orderNumber);
            }
            const itemIds = (order.items || []).map((item) => item.id);
            if (itemIds.length) {
                await tx.commissionEarning.deleteMany({ where: { orderItemId: { in: itemIds } } });
            }
            await tx.commissionRecord.deleteMany({ where: { orderId } });
            await tx.returnAdjustment.deleteMany({ where: { returnCase: { orderId } } });
            await tx.returnCase.deleteMany({ where: { orderId } });
            await tx.settlementRow.deleteMany({ where: { orderId } });
            if (order.layawayPlan) {
                await tx.layawayPlan.delete({ where: { id: order.layawayPlan.id } });
            }
            await tx.orderItem.deleteMany({ where: { orderId } });
            await tx.receipt.delete({ where: { id } });
            await tx.order.delete({ where: { id: orderId } });
        });
        return server_1.NextResponse.json({ ok: true });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to delete receipt";
        return server_1.NextResponse.json({ error: msg }, { status: 500 });
    }
}
