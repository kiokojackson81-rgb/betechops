"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Page;
const jsx_runtime_1 = require("react/jsx-runtime");
const abs_url_1 = require("@/lib/abs-url");
const ApiCredentialsManager_1 = __importDefault(require("./_components/ApiCredentialsManager"));
const AdminShopsClient_1 = __importDefault(require("./_components/AdminShopsClient"));
const SyncedShopsList_1 = __importDefault(require("./_components/SyncedShopsList"));
const prisma_1 = require("@/lib/prisma");
async function Page() {
    let shops = [];
    let syncedShops = [];
    try {
        shops = await prisma_1.prisma.shop.findMany({ orderBy: { createdAt: 'desc' }, include: { userAssignments: { include: { user: true } } } });
    }
    catch (e) {
        // Do not throw — render a friendly inline message so the admin layout stays usable
        // This protects against transient DB/network issues or when migrations are not applied.
        // The full error will be in server logs.
        console.error('Admin shops page prisma error:', e);
        return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-4 p-6", children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-xl font-bold", children: "Shops" }), (0, jsx_runtime_1.jsxs)("div", { className: "p-4 border rounded bg-yellow-900/10", children: [(0, jsx_runtime_1.jsx)("h2", { className: "font-semibold", children: "Database unavailable" }), (0, jsx_runtime_1.jsxs)("p", { className: "text-slate-300 mt-2", children: ["The application cannot reach the database or required migrations are not applied. Please check your", (0, jsx_runtime_1.jsx)("span", { className: "font-medium", children: " Database URL " }), " and run Prisma migrations. See Admin \u2192 Health Checks for details."] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4 p-4 border rounded", children: [(0, jsx_runtime_1.jsx)("h2", { className: "font-semibold", children: "API Credentials" }), (0, jsx_runtime_1.jsx)(ApiCredentialsManager_1.default, {})] })] }));
    }
    try {
        syncedShops = await prisma_1.prisma.jumiaShop.findMany({
            select: {
                id: true,
                name: true,
                account: { select: { label: true } },
                lastOrdersUpdatedBefore: true,
                updatedAt: true,
            },
            orderBy: { name: 'asc' },
        });
    }
    catch (error) {
        console.error('Admin shops page jumiaShop error:', error);
        syncedShops = [];
    }
    // Server-side fallback: if no shops returned (fresh prod DB, stale ISR), try API fetch
    if (!shops || shops.length === 0) {
        try {
            const url = await (0, abs_url_1.absUrl)('/api/shops');
            const r = await fetch(url, { cache: 'no-store' });
            if (r.ok) {
                const list = await r.json();
                if (Array.isArray(list) && list.length) {
                    shops = list.map((s) => ({ id: String(s.id), name: String(s.name ?? ''), platform: s.platform ?? undefined }));
                }
            }
        }
        catch {
            // ignore
        }
    }
    return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-4 p-6", children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-xl font-bold", children: "Shops" }), (0, jsx_runtime_1.jsx)("div", { children: (0, jsx_runtime_1.jsx)(AdminShopsClient_1.default, { initial: shops.map(s => ({ id: s.id, name: s.name, platform: s.platform ?? undefined, assignedUser: s.userAssignments?.[0]?.user ? { id: s.userAssignments[0].user.id, label: (s.userAssignments[0].user.name ?? s.userAssignments[0].user.email) ?? '', roleAtShop: s.userAssignments?.[0]?.roleAtShop ?? undefined } : undefined })) }) }), syncedShops.length > 0 && ((0, jsx_runtime_1.jsxs)("div", { className: "mt-4 p-4 border rounded", children: [(0, jsx_runtime_1.jsx)("h2", { className: "font-semibold", children: "Synced Jumia Shops" }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-400 mt-1", children: "These entries come from the new Jumia account directory and are read-only today." }), (0, jsx_runtime_1.jsx)("div", { className: "mt-3", children: (0, jsx_runtime_1.jsx)(SyncedShopsList_1.default, { shops: syncedShops.map((shop) => ({
                                id: shop.id,
                                name: shop.name,
                                accountLabel: shop.account?.label ?? null,
                                lastOrdersUpdatedBefore: shop.lastOrdersUpdatedBefore ? shop.lastOrdersUpdatedBefore.toISOString() : null,
                                updatedAt: shop.updatedAt ? shop.updatedAt.toISOString() : null,
                            })) }) })] })), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4 p-4 border rounded", children: [(0, jsx_runtime_1.jsx)("h2", { className: "font-semibold", children: "API Credentials" }), (0, jsx_runtime_1.jsx)(ApiCredentialsManager_1.default, {})] })] }));
}
