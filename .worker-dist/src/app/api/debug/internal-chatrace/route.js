"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const chatraceInternalFixed_1 = require("@/lib/chatraceInternalFixed");
async function GET() {
    const result = await (0, chatraceInternalFixed_1.pushInternalReceiptAlert)({
        requestId: "debug",
        receiptNumber: "DEBUG-000",
        amount: "0",
        paymentMethod: "DEBUG",
        createdBy: "Debug User",
        itemsText: "1) Widget x1",
        receiptLink: "https://ops.betech.co.ke/receipts/debug",
    });
    return server_1.NextResponse.json({ ok: result.ok, debug: result.debug });
}
