"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const branding_1 = require("@/lib/branding");
const receiptTemplate_1 = __importDefault(require("@/app/templates/receiptTemplate"));
const buildSnapshot_1 = require("@/app/receipts/buildSnapshot");
exports.dynamic = 'force-dynamic';
async function GET(req) {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id)
        return server_1.NextResponse.json({ error: 'missing id' }, { status: 400 });
    const receipt = await prisma_1.prisma.receipt.findUnique({ where: { id }, include: { order: { include: { items: true, attendant: true } }, issuedBy: true } });
    if (!receipt)
        return server_1.NextResponse.json({ error: 'receipt not found' }, { status: 404 });
    const snapshot = (0, buildSnapshot_1.buildReceiptSnapshot)(receipt);
    const branding = await (0, branding_1.getBranding)();
    const html = (0, receiptTemplate_1.default)({ ...snapshot, branding }, { hideStamp: false });
    return new server_1.NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
