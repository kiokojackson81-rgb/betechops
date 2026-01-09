"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildReceiptSnapshot = buildReceiptSnapshot;
function buildReceiptSnapshot(receipt) {
    const order = receipt.order || {};
    const data = receipt.data;
    const dataIsObject = data !== null && typeof data === 'object' && !Array.isArray(data);
    const dataAny = dataIsObject ? data : undefined;
    // Prefer order.items (joined via Prisma). If not present, fall back to
    // items stored inside `receipt.data.items` (used by some flows).
    const rawItems = (order.items && order.items.length)
        ? order.items
        : Array.isArray(dataAny?.items)
            ? dataAny?.items
            : [];
    const items = rawItems.map((it) => ({
        title: (it.product && it.product.name) || it.title || it.productName || it.name || '',
        quantity: it.quantity ?? 1,
        unitPrice: it.sellingPrice ?? it.unitPrice ?? it.price ?? 0,
        serial: it.serial ?? '',
        warranty: it.warranty ?? '',
    }));
    const dataHasNotes = dataAny !== undefined && typeof dataAny.notes === 'string';
    const notesFromData = dataHasNotes ? dataAny?.notes : undefined;
    const paymentBreakdown = (dataIsObject ? dataAny?.paymentBreakdown : undefined) || {};
    const paymentDetailsShown = typeof receipt.paymentDetailsShown === 'boolean'
        ? receipt.paymentDetailsShown
        : typeof dataAny?.paymentDetailsShown === 'boolean'
            ? dataAny?.paymentDetailsShown
            : false;
    const warrantyText = receipt.warrantyText ||
        (typeof (dataAny?.globalWarranty ?? dataAny?.warrantyText) === 'string'
            ? (dataAny?.globalWarranty ?? dataAny?.warrantyText)
            : '') ||
        '';
    const serialNumber = receipt.order?.orderNumber ||
        order.orderNumber ||
        (dataIsObject ? dataAny?.orderRef : undefined) ||
        '';
    return {
        order,
        items,
        totals: receipt.totals ?? {},
        notes: receipt.notes ?? notesFromData ?? '',
        // include customer phone and discount for templates and downstream
        phone: order.customerPhone || (dataIsObject ? dataAny?.customerPhone : undefined) || '',
        discount: Number(receipt.discount ?? (dataIsObject ? dataAny?.discount : undefined) ?? 0),
        showDiscount: Boolean((receipt.showDiscount ?? (dataIsObject ? dataAny?.showDiscount : undefined)) || Number(receipt.discount ?? 0) > 0),
        generatedAt: receipt.generatedAt ? receipt.generatedAt.toISOString() : new Date().toISOString(),
        customerName: order.customerName || '',
        attendantName: receipt.issuedBy?.name || order?.attendant?.name || '',
        issuedByName: receipt.issuedBy?.name || '',
        paymentMethod: (dataIsObject ? dataAny?.paymentMethod : undefined) ||
            receipt.paymentMethod ||
            '',
        deliveryAddress: order.metadata?.deliveryAddress ||
            (dataIsObject ? dataAny?.deliveryAddress : undefined) ||
            '',
        paymentBreakdown: {
            cash: typeof paymentBreakdown.cash === 'number' ? paymentBreakdown.cash : 0,
            mpesa: typeof paymentBreakdown.mpesa === 'number' ? paymentBreakdown.mpesa : 0,
            reference: typeof paymentBreakdown.reference === 'string'
                ? paymentBreakdown.reference
                : typeof paymentBreakdown.mpesaReference === 'string'
                    ? paymentBreakdown.mpesaReference
                    : '',
        },
        paymentDetailsShown,
        warrantyText,
        serialNumber,
    };
}
