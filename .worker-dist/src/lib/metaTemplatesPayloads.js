"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCustomerReceiptPayload = buildCustomerReceiptPayload;
exports.buildAdminDailySummaryPayload = buildAdminDailySummaryPayload;
exports.buildSupportAcknowledgementPayload = buildSupportAcknowledgementPayload;
exports.buildReceiptReminderPayload = buildReceiptReminderPayload;
/**
 * Helpers to build Graph API `messages` payloads for the approved templates.
 * These produce ready-to-send JSON bodies (not the HTTP headers).
 */
function buildCustomerReceiptPayload(toPhone, data) {
    return {
        messaging_product: 'whatsapp',
        to: toPhone,
        type: 'template',
        template: {
            name: 'customer_receipt',
            language: { code: 'en_US' },
            components: [
                {
                    type: 'body',
                    parameters: [
                        { type: 'text', text: String(data.customerName ?? '') },
                        { type: 'text', text: String(data.receiptNumber ?? '') },
                        { type: 'text', text: String(data.total ?? '') },
                        { type: 'text', text: String(data.itemsCount ?? '') },
                        { type: 'text', text: String(data.paymentMethod ?? '') },
                        { type: 'text', text: String(data.companyName ?? '') },
                    ],
                },
            ],
        },
    };
}
function buildAdminDailySummaryPayload(toPhone, data) {
    return {
        messaging_product: 'whatsapp',
        to: toPhone,
        type: 'template',
        template: {
            name: 'admin_daily_summary',
            language: { code: 'en_US' },
            components: [
                {
                    type: 'body',
                    parameters: [
                        { type: 'text', text: String(data.attendantName ?? '') },
                        { type: 'text', text: String(data.date ?? '') },
                        { type: 'text', text: String(data.totalSales ?? '') },
                        { type: 'text', text: String(data.totalProfit ?? '') },
                        { type: 'text', text: String(data.totalReceipts ?? '') },
                        { type: 'text', text: String(data.totalItems ?? '') },
                    ],
                },
            ],
        },
    };
}
function buildSupportAcknowledgementPayload(toPhone, data) {
    return {
        messaging_product: 'whatsapp',
        to: toPhone,
        type: 'template',
        template: {
            name: 'support_acknowledgement',
            language: { code: 'en_US' },
            components: [
                {
                    type: 'body',
                    parameters: [
                        { type: 'text', text: String(data.attendantName ?? '') },
                        { type: 'text', text: String(data.date ?? '') },
                        { type: 'text', text: String(data.totalSales ?? '') },
                        { type: 'text', text: String(data.totalReceipts ?? '') },
                    ],
                },
            ],
        },
    };
}
function buildReceiptReminderPayload(toPhone, data) {
    return {
        messaging_product: 'whatsapp',
        to: toPhone,
        type: 'template',
        template: {
            name: 'receipt_reminder',
            language: { code: 'en_US' },
            components: [
                {
                    type: 'body',
                    parameters: [
                        { type: 'text', text: String(data.customerName ?? '') },
                        { type: 'text', text: String(data.receiptNumber ?? '') },
                    ],
                },
            ],
        },
    };
}
exports.default = {
    buildCustomerReceiptPayload,
    buildAdminDailySummaryPayload,
    buildSupportAcknowledgementPayload,
    buildReceiptReminderPayload,
};
