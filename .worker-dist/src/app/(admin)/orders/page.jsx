"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = OrdersPage;
const react_1 = __importDefault(require("react"));
const AttendantHeader_1 = __importDefault(require("../_components/AttendantHeader"));
async function fetchOrdersAndKpis() {
    try {
        const [ordersRes, kpisRes] = await Promise.all([
            fetch('/api/orders/search', { cache: 'no-store' }),
            fetch('/api/metrics/kpis', { cache: 'no-store' }),
        ]);
        const orders = ordersRes.ok ? await ordersRes.json() : { shops: [], orders: [] };
        const kpis = kpisRes.ok ? await kpisRes.json() : { queued: 0, todayPacked: 0, rts: 0 };
        return { orders: orders, kpis: kpis };
    }
    catch (err) {
        return { orders: { shops: [], orders: [] }, kpis: { queued: 0, todayPacked: 0, rts: 0 }, error: String(err) };
    }
}
async function OrdersPage() {
    var _a;
    const { orders, kpis } = await fetchOrdersAndKpis();
    return (<main>
      <AttendantHeader_1.default />
      <div style={{ padding: 16 }}>
        <h3>Orders / Queues</h3>
        <p style={{ marginTop: 6, marginBottom: 6 }}><strong>Pending orders:</strong> {(_a = kpis === null || kpis === void 0 ? void 0 : kpis.queued) !== null && _a !== void 0 ? _a : 0}</p>
        <p>Shops assigned to you: {Array.isArray(orders.shops) ? orders.shops.length : 0}</p>
        <div>
          <pre style={{ background: '#f8fafc', padding: 12 }}>{JSON.stringify({ orders, kpis }, null, 2)}</pre>
        </div>
        <p style={{ color: '#6b7280' }}>TODO: implement orders table, filters, and actions (pack / rts / labels)</p>
      </div>
    </main>);
}
