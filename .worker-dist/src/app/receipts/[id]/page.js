"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.default = Page;
const jsx_runtime_1 = require("react/jsx-runtime");
const prisma_1 = require("@/lib/prisma");
const PrintControls_1 = __importDefault(require("./PrintControls"));
const buildSnapshot_1 = require("@/app/receipts/buildSnapshot");
const renderReceiptHtml_1 = __importDefault(require("@/lib/receipts/renderReceiptHtml"));
exports.dynamic = "force-dynamic";
async function Page({ params }) {
    // In some hosting/runtime environments `params` can be a Promise (e.g. when
    // edge/request context is provided lazily). Defensively await if needed.
    let resolvedParams = params;
    if (resolvedParams && typeof resolvedParams.then === "function") {
        try {
            resolvedParams = await resolvedParams;
        }
        catch (e) {
            // If awaiting params fails, log and treat as missing.
            // eslint-disable-next-line no-console
            console.error("[receipts page] failed to resolve params", { err: e });
            resolvedParams = null;
        }
    }
    const id = resolvedParams?.id;
    if (!id) {
        // Log diagnostic info to help identify why requests reach this page without an id.
        try {
            // Log resolved params and a small environment hint; avoid leaking sensitive headers.
            // eslint-disable-next-line no-console
            console.error("[receipts page] missing params.id", {
                params: resolvedParams ?? params ?? null,
                nodeEnv: process.env.NODE_ENV,
            });
        }
        catch (e) {
            // swallow logging errors
        }
        // Defensive: avoid throwing a Prisma validation error if params are missing.
        return (0, jsx_runtime_1.jsx)("div", { className: "p-4", children: "Invalid receipt identifier" });
    }
    let receipt = null;
    try {
        receipt = await prisma_1.prisma.receipt.findUnique({
            where: { id },
            include: {
                order: {
                    include: {
                        items: { include: { product: { select: { id: true, name: true } } } },
                        layawayPlan: { include: { payments: true } },
                        attendant: { select: { name: true } },
                    },
                },
                issuedBy: true,
            },
        });
    }
    catch (err) {
        // Catch and render a friendly message instead of allowing a server exception to surface.
        // Log the error server-side for diagnostics (kept minimal here).
        // eslint-disable-next-line no-console
        console.error("[receipts page] failed to load receipt", err);
        return (0, jsx_runtime_1.jsx)("div", { className: "p-4", children: "Failed to load receipt" });
    }
    if (!receipt)
        return (0, jsx_runtime_1.jsx)("div", { className: "p-4", children: "Receipt not found" });
    const snapshot = (0, buildSnapshot_1.buildReceiptSnapshot)(receipt);
    const html = await (0, renderReceiptHtml_1.default)(snapshot, { hideStamp: false });
    return ((0, jsx_runtime_1.jsxs)("div", { className: "mx-auto max-w-3xl bg-white p-6 text-black", children: [(0, jsx_runtime_1.jsx)(PrintControls_1.default, { receiptId: id }), (0, jsx_runtime_1.jsx)("div", { dangerouslySetInnerHTML: { __html: html } })] }));
}
