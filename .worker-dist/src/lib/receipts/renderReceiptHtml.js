"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderReceiptHtml = renderReceiptHtml;
const receiptTemplate_1 = __importDefault(require("@/app/templates/receiptTemplate"));
const branding_1 = require("@/lib/branding");
async function renderReceiptHtml(snapshot, opts) {
    const branding = await (0, branding_1.getBranding)();
    return (0, receiptTemplate_1.default)({ ...snapshot, branding }, { hideStamp: opts?.hideStamp ?? false, hideItemWarrantySummary: true });
}
exports.default = renderReceiptHtml;
