"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = UsersPage;
const jsx_runtime_1 = require("react/jsx-runtime");
const prisma_1 = require("@/lib/prisma");
const UsersManager_1 = __importDefault(require("./UsersManager"));
const definitions_1 = require("@/lib/attendants/definitions");
async function UsersPage() {
    const attendants = await prisma_1.prisma.user.findMany({
        where: { role: { in: ["ATTENDANT", "SUPERVISOR"] } },
        orderBy: [{ attendantCategory: "asc" }, { name: "asc" }],
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            attendantCategory: true,
            isActive: true,
            createdAt: true,
            categoryAssignments: { select: { category: true } },
        },
    });
    const prepared = attendants.map(({ categoryAssignments, createdAt, ...rest }) => ({
        ...rest,
        createdAt: createdAt.toISOString(),
        // ensure attendantCategory is a string for the client component
        attendantCategory: rest.attendantCategory ?? "",
        categories: categoryAssignments.map((c) => c.category),
    }));
    return ((0, jsx_runtime_1.jsxs)("div", { className: "mx-auto max-w-6xl space-y-8 p-8 text-slate-100", children: [(0, jsx_runtime_1.jsxs)("header", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-3xl font-semibold", children: "Attendants & Categories" }), (0, jsx_runtime_1.jsx)("p", { className: "text-slate-300", children: "Assign each attendant to the categories that match their day-to-day responsibilities." }), (0, jsx_runtime_1.jsx)("div", { className: "flex flex-wrap gap-3 text-sm text-slate-400", children: definitions_1.attendantCategoryDefinitions.map((cat) => ((0, jsx_runtime_1.jsxs)("span", { className: "rounded-full border border-white/10 px-3 py-1", children: [(0, jsx_runtime_1.jsx)("span", { className: "font-medium text-white", children: cat.label }), (0, jsx_runtime_1.jsx)("span", { className: "mx-2 text-slate-500", children: "-" }), cat.description] }, cat.id))) })] }), (0, jsx_runtime_1.jsx)(UsersManager_1.default, { initial: prepared })] }));
}
