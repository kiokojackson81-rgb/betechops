"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AdminAttendantsPage;
const jsx_runtime_1 = require("react/jsx-runtime");
const prisma_1 = require("@/lib/prisma");
const AttendantsClient_1 = __importDefault(require("./AttendantsClient"));
const getLandingPage_1 = require("@/lib/getLandingPage");
async function AdminAttendantsPage() {
    let attendantsRaw = [];
    try {
        attendantsRaw = await prisma_1.prisma.user.findMany({
            where: { role: { in: ["ATTENDANT", "SUPERVISOR"] } },
            orderBy: [{ attendantCategory: "asc" }, { name: "asc" }],
            select: {
                id: true,
                name: true,
                email: true,
                attendantCategory: true,
                isActive: true,
                createdAt: true,
            },
        });
    }
    catch (err) {
        // Log full error server-side so host logs capture stack and details.
        // Keep the client-facing response safe in production but show details in dev.
        // This prevents the Server Component render from throwing an uncaught error
        // and gives a clearer failure UI for operators to act on.
        // eslint-disable-next-line no-console
        console.error("AdminAttendantsPage: failed to query attendants:", err);
        if (process.env.NODE_ENV !== "production") {
            // In development/staging show the error to aid debugging
            return ((0, jsx_runtime_1.jsxs)("div", { className: "p-6", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-semibold text-rose-400", children: "Failed to load attendants (dev)" }), (0, jsx_runtime_1.jsx)("pre", { className: "mt-2 text-xs text-slate-200 whitespace-pre-wrap", children: String(err) })] }));
        }
        return ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-100", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-semibold", children: "Unable to load attendants" }), (0, jsx_runtime_1.jsx)("p", { className: "mt-2 text-sm", children: "The attendants table could not be queried. Check database connectivity and migrations, then retry." })] }));
    }
    const prepared = attendantsRaw.map((a) => ({
        ...a,
        createdAt: a.createdAt.toISOString(),
        categoryLabel: (0, getLandingPage_1.getCategoryLabel)(a.attendantCategory),
    }));
    return (0, jsx_runtime_1.jsx)(AttendantsClient_1.default, { attendants: prepared });
}
