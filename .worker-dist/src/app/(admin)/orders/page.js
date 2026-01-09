"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = OrdersPage;
const jsx_runtime_1 = require("react/jsx-runtime");
const AttendantHeader_1 = __importDefault(require("../_components/AttendantHeader"));
async function fetchOrdersAndKpis() {
    try {
        const [ordersRes, kpisRes] = await Promise.all([
            fetch('/api/orders/search', { cache: 'no-store' }),
            fetch('/api/metrics/kpis', { cache: 'no-store' }),
        ]);
        const orders = ordersRes.ok ? await ordersRes.json() : { shops: [], orders: [] };
        const kpis = kpisRes.ok ? (await kpisRes.json()) : { queued: 0, todayPacked: 0, rts: 0 };
        return {
            orders: orders,
            kpis,
        };
    }
    catch (err) {
        return { orders: { shops: [], orders: [] }, kpis: { queued: 0, todayPacked: 0, rts: 0 }, error: String(err) };
    }
}
async function OrdersPage() {
    const { orders, kpis } = await fetchOrdersAndKpis();
    return ((0, jsx_runtime_1.jsxs)("main", { children: [(0, jsx_runtime_1.jsx)(AttendantHeader_1.default, {}), (0, jsx_runtime_1.jsxs)("div", { style: { padding: 16 }, children: [(0, jsx_runtime_1.jsx)("h3", { children: "Orders / Queues" }), (0, jsx_runtime_1.jsxs)("p", { style: { marginTop: 6, marginBottom: 6 }, children: [(0, jsx_runtime_1.jsx)("strong", { children: "Pending orders:" }), " ", kpis?.queued ?? 0, kpis?.pendingSource ? ((0, jsx_runtime_1.jsx)("span", { style: { marginLeft: 8, color: '#6b7280' }, children: kpis.pendingSource === 'live' ? `(live 7d)` : kpis.pendingSource === 'db' ? `(db 7d)` : kpis.pendingSource.startsWith('snapshot') ? `(snapshot ${String(kpis?.pendingSnapshotWindowDays ?? '?')}d)` : '' })) : null] }), (0, jsx_runtime_1.jsxs)("p", { children: ["Shops assigned to you: ", Array.isArray(orders.shops) ? orders.shops.length : 0] }), (0, jsx_runtime_1.jsx)("div", { children: (0, jsx_runtime_1.jsx)("pre", { style: { background: '#f8fafc', padding: 12 }, children: JSON.stringify({ orders, kpis }, null, 2) }) }), (0, jsx_runtime_1.jsx)("p", { style: { color: '#6b7280' }, children: "TODO: implement orders table, filters, and actions (pack / rts / labels)" })] })] }));
}
