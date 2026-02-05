"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.default = Page;
const jsx_runtime_1 = require("react/jsx-runtime");
const prisma_1 = require("@/lib/prisma");
const receiptTemplate_1 = __importDefault(require("@/app/templates/receiptTemplate"));
const branding_1 = require("@/lib/branding");
const buildSnapshot_1 = require("@/app/receipts/buildSnapshot");
const ReceiptToolbar_1 = __importDefault(require("./ReceiptToolbar"));
exports.dynamic = "force-dynamic";
async function Page({ params }) {
    const { id } = params;
    const receipt = await prisma_1.prisma.receipt.findUnique({
        where: { id },
        include: {
            order: {
                include: {
                    items: { include: { product: { select: { id: true, name: true } } } },
                    attendant: { select: { id: true, name: true } },
                    layawayPlan: { include: { payments: true } },
                },
            },
            issuedBy: { select: { id: true, name: true, email: true } },
        },
    });
    if (!receipt) {
        return (0, jsx_runtime_1.jsx)("div", { children: "Receipt not found" });
    }
    const snapshot = (0, buildSnapshot_1.buildReceiptSnapshot)(receipt);
    const branding = await (0, branding_1.getBranding)();
    // buildReceiptSnapshot returns a typed object; cast to `any` so we can spread it
    // and inject `branding` without a type error during the Next.js build.
    const html = (0, receiptTemplate_1.default)({ ...snapshot, branding }, { hideStamp: false, hideItemWarrantySummary: true });
    // Render the template HTML directly into the page so it behaves like the printable route.
    return ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(ReceiptToolbar_1.default, { receiptId: id }), (0, jsx_runtime_1.jsx)("div", { dangerouslySetInnerHTML: { __html: html } })] }));
}
