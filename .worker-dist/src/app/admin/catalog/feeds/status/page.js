"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.default = StatusFeedPage;
const jsx_runtime_1 = require("react/jsx-runtime");
exports.dynamic = "force-dynamic";
const EndpointConsole_1 = __importDefault(require("@/app/admin/_components/jumia/EndpointConsole"));
const ENDPOINTS = [
    { label: "Update Status", path: "/feeds/products/status" },
    { label: "Update Stock", path: "/feeds/products/stock" },
    { label: "Update Price", path: "/feeds/products/price" },
];
function StatusFeedPage() {
    return ((0, jsx_runtime_1.jsxs)("div", { className: "p-6 space-y-4", children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-2xl font-semibold", children: "Status Update Feed" }), (0, jsx_runtime_1.jsxs)("p", { className: "text-sm text-slate-400", children: ["Post a Status Update feed to Jumia. Payload: ", (0, jsx_runtime_1.jsxs)("code", { children: ['{', " products: [...] ", '}', " "] })] }), (0, jsx_runtime_1.jsx)(EndpointConsole_1.default, { endpoints: ENDPOINTS })] }));
}
