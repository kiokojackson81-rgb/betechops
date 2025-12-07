"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.default = AdminReceiptsPage;
const jsx_runtime_1 = require("react/jsx-runtime");
const ReceiptsAdminClient_1 = __importDefault(require("@/app/receipts/list/ReceiptsAdminClient"));
const abs_url_1 = require("@/lib/abs-url");
exports.dynamic = "force-dynamic";
async function AdminReceiptsPage() {
    try {
        const apiUrl = await (0, abs_url_1.absUrl)('/api/receipts/list');
        const res = await fetch((0, abs_url_1.withParams)(apiUrl, { includeItems: true }), { cache: "no-store" });
        const j = await res.json();
        const receipts = j.receipts || [];
        return ((0, jsx_runtime_1.jsxs)("div", { className: "mx-auto max-w-5xl p-4", children: [(0, jsx_runtime_1.jsx)("h1", { className: "mb-4 text-2xl font-semibold", children: "Admin - Receipts" }), (0, jsx_runtime_1.jsx)(ReceiptsAdminClient_1.default, { initial: receipts, allowEdit: true })] }));
    }
    catch (e) {
        console.error("Failed to load receipts for admin page", e);
        return (0, jsx_runtime_1.jsx)("div", { className: "p-4", children: "Failed to load receipts" });
    }
}
