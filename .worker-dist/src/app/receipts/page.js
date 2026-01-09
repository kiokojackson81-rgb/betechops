"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.default = ReceiptsPage;
const jsx_runtime_1 = require("react/jsx-runtime");
const ReceiptsPageClient_1 = __importDefault(require("./ReceiptsPageClient"));
const abs_url_1 = require("@/lib/abs-url");
exports.dynamic = "force-dynamic";
async function ReceiptsPage({ searchParams }) {
    try {
        const apiUrl = await (0, abs_url_1.absUrl)("/api/receipts");
        // If the page was opened with an attendantId query param, forward it
        const params = { includeItems: "true" };
        const attendantId = searchParams && typeof searchParams.attendantId === "string" ? searchParams.attendantId : undefined;
        if (attendantId)
            params.attendantId = attendantId;
        const res = await fetch((0, abs_url_1.withParams)(apiUrl, params), { cache: "no-store" });
        const data = await res.json().catch(() => ({ receipts: [] }));
        return ((0, jsx_runtime_1.jsx)("div", { className: "min-h-screen bg-slate-950 text-slate-100 p-4", children: (0, jsx_runtime_1.jsx)(ReceiptsPageClient_1.default, { initial: data.receipts || [] }) }));
    }
    catch (e) {
        return (0, jsx_runtime_1.jsx)("div", { className: "p-4", children: "Failed to load receipts" });
    }
}
