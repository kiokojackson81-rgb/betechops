"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
exports.PATCH = PATCH;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const api_1 = require("@/lib/api");
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
                    items: true,
                    attendant: { select: { id: true, name: true, email: true } },
                    layawayPlan: { include: { payments: true } },
                },
            },
            issuedBy: { select: { id: true, name: true, email: true } },
        },
    });
    if (!receipt)
        return server_1.NextResponse.json({ error: "Not found" }, { status: 404 });
    return server_1.NextResponse.json({ receipt });
}
async function PATCH(req, context) {
    const guard = await (0, api_1.requireRole)(["ADMIN"]);
    if (!guard.ok)
        return guard.res;
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
            await tx.orderItem.deleteMany({ where: { orderId: existing.orderId } });
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
                await tx.orderItem.create({
                    data: {
                        orderId: existing.orderId,
                        productId: product.id,
                        quantity: Number(it.quantity || 1),
                        sellingPrice: Number(it.unitPrice || it.sellingPrice || 0) || 0,
                        serial: it.serial ?? null,
                        warranty: it.warranty ?? null,
                    },
                });
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
            }
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
            return updatedReceipt;
        });
        return server_1.NextResponse.json({ ok: true, receipt: updated });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to update receipt";
        return server_1.NextResponse.json({ error: msg }, { status: 500 });
    }
}
