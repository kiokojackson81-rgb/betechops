"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.default = CreateProductsFeedPage;
const jsx_runtime_1 = require("react/jsx-runtime");
exports.dynamic = "force-dynamic";
const EndpointConsole_1 = __importDefault(require("@/app/admin/_components/jumia/EndpointConsole"));
const ENDPOINTS = [
    { label: "Create Products", path: "/feeds/products/create" },
    { label: "Update Products", path: "/feeds/products/update" },
    { label: "Update Price", path: "/feeds/products/price" },
    { label: "Update Stock", path: "/feeds/products/stock" },
    { label: "Update Status", path: "/feeds/products/status" },
];
function CreateProductsFeedPage() {
    return ((0, jsx_runtime_1.jsxs)("div", { className: "p-6 space-y-4", children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-2xl font-semibold", children: "Create Products Feed" }), (0, jsx_runtime_1.jsxs)("p", { className: "text-sm text-slate-400", children: ["Post a Products Creation feed to Jumia. Include ", (0, jsx_runtime_1.jsx)("code", { children: "shopId" }), " and ", (0, jsx_runtime_1.jsx)("code", { children: "products[]" }), " in the payload."] }), (0, jsx_runtime_1.jsx)(EndpointConsole_1.default, { endpoints: ENDPOINTS })] }));
}
