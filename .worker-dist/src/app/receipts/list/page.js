"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.default = ReceiptsListPage;
const jsx_runtime_1 = require("react/jsx-runtime");
const ReceiptsAdminClient_1 = __importDefault(require("./ReceiptsAdminClient"));
const abs_url_1 = require("@/lib/abs-url");
exports.dynamic = "force-dynamic";
async function ReceiptsListPage() {
    try {
        const apiUrl = await (0, abs_url_1.absUrl)('/api/receipts/list');
        const res = await fetch((0, abs_url_1.withParams)(apiUrl, { includeItems: true }), { cache: "no-store" });
        const j = await res.json();
        const receipts = j.receipts || [];
        return ((0, jsx_runtime_1.jsxs)("div", { className: "p-4", children: [(0, jsx_runtime_1.jsx)("h1", { className: "mb-4 text-2xl font-semibold", children: "Receipts" }), (0, jsx_runtime_1.jsx)(ReceiptsAdminClient_1.default, { initial: receipts, allowEdit: true })] }));
    }
    catch (e) {
        return (0, jsx_runtime_1.jsx)("div", { className: "p-4", children: "Failed to load receipts" });
    }
}
