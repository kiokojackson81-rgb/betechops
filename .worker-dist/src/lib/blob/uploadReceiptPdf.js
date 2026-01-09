"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadReceiptPdfToBlob = uploadReceiptPdfToBlob;
const blob_1 = require("@vercel/blob");
async function uploadReceiptPdfToBlob(opts) {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
        throw new Error("Missing BLOB_READ_WRITE_TOKEN");
    }
    // include timestamp prefix and keep random suffix to ensure uniqueness
    const pathname = `receipts/${opts.receiptId}/${opts.kind}-${Date.now()}.pdf`;
    const blob = await (0, blob_1.put)(pathname, opts.buffer, {
        access: "public",
        contentType: "application/pdf",
        addRandomSuffix: true,
        token,
    });
    return { url: blob.url, key: blob.pathname };
}
