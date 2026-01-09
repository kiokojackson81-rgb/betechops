"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateRandomId = generateRandomId;
exports.generateReceiptSerial = generateReceiptSerial;
function generateRandomId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
function generateReceiptSerial(prefix = "R") {
    return `${prefix}-${generateRandomId()}`;
}
