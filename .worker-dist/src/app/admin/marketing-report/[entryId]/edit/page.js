"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.default = EditDayPage;
const jsx_runtime_1 = require("react/jsx-runtime");
const EditDayClient_1 = __importDefault(require("@/app/admin/marketing-report/EditDayClient"));
const auth_1 = require("@/lib/auth");
const prisma_1 = require("@/lib/prisma");
const navigation_1 = require("next/navigation");
exports.dynamic = "force-dynamic";
async function EditDayPage({ params }) {
    // Defensively resolve params if hosting provides them as a Promise.
    let resolvedParams = params;
    if (resolvedParams && typeof resolvedParams.then === "function") {
        try {
            resolvedParams = await resolvedParams;
        }
        catch (e) {
            // eslint-disable-next-line no-console
            console.error("[admin/marketing-report] failed to resolve params", { err: e });
            resolvedParams = null;
        }
    }
    const entryId = resolvedParams?.entryId;
    if (!entryId)
        return null;
    // server-side guard: only ADMIN may access this page
    const session = await (0, auth_1.auth)();
    const role = session?.user?.role;
    if (role !== "ADMIN")
        return (0, navigation_1.redirect)("/not-authorized");
    const entry = await prisma_1.prisma.marketingDailyEntry.findUnique({
        where: { id: entryId },
        include: { receipts: { include: { items: true } } },
    });
    if (!entry)
        return (0, navigation_1.notFound)();
    const payload = {
        id: entry.id,
        date: entry.date.toISOString(),
        receipts: entry.receipts.map((r) => ({
            id: r.id,
            receiptNumber: r.receiptNumber ?? "",
            sellingTotal: Number(r.sellingTotal) || 0,
            paymentMethod: r.paymentMethod,
            items: r.items.map((it) => ({
                id: it.id,
                productName: it.productName || "",
                buyingPrice: Number(it.buyingPrice) || 0,
            })),
        })),
    };
    const formattedDate = entry.date.toISOString().split("T")[0];
    return ((0, jsx_runtime_1.jsxs)("div", { className: "mx-auto max-w-4xl p-6 text-slate-100", children: [(0, jsx_runtime_1.jsxs)("h1", { className: "text-2xl font-semibold mb-4", children: ["Edit marketing entry - ", formattedDate] }), (0, jsx_runtime_1.jsx)(EditDayClient_1.default, { initialData: payload })] }));
}
