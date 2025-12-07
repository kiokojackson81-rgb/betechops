"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.default = ReceiptsPage;
const jsx_runtime_1 = require("react/jsx-runtime");
const ReceiptsAdminClient_1 = __importDefault(require("./list/ReceiptsAdminClient"));
const abs_url_1 = require("@/lib/abs-url");
exports.dynamic = "force-dynamic";
async function ReceiptsPage() {
    try {
        const apiUrl = await (0, abs_url_1.absUrl)('/api/receipts/list');
        const res = await fetch((0, abs_url_1.withParams)(apiUrl, { includeItems: true }), { cache: "no-store" });
        const data = await res.json().catch(() => ({ receipts: [] }));
        return ((0, jsx_runtime_1.jsxs)("div", { className: "p-4", children: [(0, jsx_runtime_1.jsx)("h1", { className: "mb-2 text-2xl font-semibold", children: "Receipts" }), (0, jsx_runtime_1.jsx)("p", { className: "mb-4 text-sm text-slate-600", children: "Search by date, phone, name or reference. Expand rows to view serials and warranties." }), (0, jsx_runtime_1.jsx)(ReceiptsAdminClient_1.default, { initial: data.receipts || [], allowEdit: false })] }));
    }
    catch (e) {
        // keep minimal output to the page; server logs will contain details
        return (0, jsx_runtime_1.jsx)("div", { className: "p-4", children: "Failed to load receipts" });
    }
}
