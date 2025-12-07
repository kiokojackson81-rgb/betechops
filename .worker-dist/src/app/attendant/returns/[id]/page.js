"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Page;
const jsx_runtime_1 = require("react/jsx-runtime");
const ReturnPickForm_1 = __importDefault(require("./_components/ReturnPickForm"));
const prisma_1 = require("@/lib/prisma");
async function Page({ params }) {
    const { id } = await params;
    const ret = await prisma_1.prisma.returnCase.findUnique({ where: { id }, include: { evidence: true, order: true } });
    if (!ret)
        return (0, jsx_runtime_1.jsx)("div", { className: "p-6", children: "Return not found" });
    return ((0, jsx_runtime_1.jsxs)("div", { className: "p-6 space-y-4", children: [(0, jsx_runtime_1.jsxs)("h1", { className: "text-lg font-bold", children: ["Return ", ret.id] }), (0, jsx_runtime_1.jsxs)("div", { children: ["Order: ", ret.orderId] }), (0, jsx_runtime_1.jsxs)("div", { children: ["Status: ", ret.status] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h3", { className: "font-semibold", children: "Upload pickup evidence" }), (0, jsx_runtime_1.jsx)(ReturnPickForm_1.default, { id: id, shopId: ret.shopId })] })] }));
}
