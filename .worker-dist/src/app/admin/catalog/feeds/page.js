"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.default = FeedsConsolePage;
const jsx_runtime_1 = require("react/jsx-runtime");
exports.dynamic = "force-dynamic";
const EndpointConsole_1 = __importDefault(require("@/app/admin/_components/jumia/EndpointConsole"));
const FeedLookup_1 = __importDefault(require("@/app/admin/_components/FeedLookup"));
const ENDPOINTS = [
    { label: "Create Products", path: "/feeds/products/create" },
    { label: "Update Products", path: "/feeds/products/update" },
    { label: "Update Price", path: "/feeds/products/price" },
    { label: "Update Stock", path: "/feeds/products/stock" },
    { label: "Update Status", path: "/feeds/products/status" },
    { label: "Get Feed by ID", path: "/feeds/{id}" },
];
function FeedsConsolePage() {
    return ((0, jsx_runtime_1.jsxs)("div", { className: "p-6 space-y-4", children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-2xl font-semibold", children: "Products Feeds Console" }), (0, jsx_runtime_1.jsx)(FeedLookup_1.default, {}), (0, jsx_runtime_1.jsxs)("p", { className: "text-sm text-slate-400", children: ["Use this console to call Jumia Products feeds. Pick the shop, endpoint, and supply payload or query params. For GET /feeds/", '{', "id", '}', ", set the endpoint to /feeds/your-feed-id and use the Query box if needed."] }), (0, jsx_runtime_1.jsx)(EndpointConsole_1.default, { endpoints: ENDPOINTS }), (0, jsx_runtime_1.jsxs)("div", { className: "text-xs text-slate-400", children: [(0, jsx_runtime_1.jsx)("p", { children: "Tips:" }), (0, jsx_runtime_1.jsxs)("ul", { className: "list-disc ml-5 space-y-1", children: [(0, jsx_runtime_1.jsx)("li", { children: "Start with up to 1000 items per feed as per vendor guidance." }), (0, jsx_runtime_1.jsxs)("li", { children: ["For create/update, include ", (0, jsx_runtime_1.jsx)("code", { children: "shopId" }), " and ", (0, jsx_runtime_1.jsx)("code", { children: "products[]" }), ". For price/stock/status, payload contains ", (0, jsx_runtime_1.jsx)("code", { children: "products[]" }), "."] }), (0, jsx_runtime_1.jsxs)("li", { children: ["After posting a feed, use its returned ", (0, jsx_runtime_1.jsx)("code", { children: "feedId" }), " with GET /feeds/", '{', "id", '}', " to monitor progress."] })] })] })] }));
}
