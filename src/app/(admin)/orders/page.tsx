import React from 'react';
import AttendantHeader from '../_components/AttendantHeader';

type OrdersResult = { shops?: unknown[]; orders?: unknown[]; error?: string };

async function fetchOrdersAndKpis() {
  try {
    const [ordersRes, kpisRes] = await Promise.all([
      fetch('/api/orders/search', { cache: 'no-store' }),
      fetch('/api/metrics/kpis', { cache: 'no-store' }),
    ]);

    const orders = ordersRes.ok ? await ordersRes.json() : { shops: [], orders: [] };
    const kpis = kpisRes.ok ? await kpisRes.json() : { queued: 0, todayPacked: 0, rts: 0 };
    return {
      orders: orders as OrdersResult,
      kpis: kpis as { queued: number; todayPacked: number; rts: number; pendingSource?: string; pendingSnapshotWindowDays?: number },
    };
  } catch (err) {
    return { orders: { shops: [], orders: [] } as OrdersResult, kpis: { queued: 0, todayPacked: 0, rts: 0 }, error: String(err) };
  }
}

export default async function OrdersPage() {
  const { orders, kpis } = await fetchOrdersAndKpis();
  return (
    <main>
      <AttendantHeader />
      <div style={{ padding: 16 }}>
        <h3>Orders / Queues</h3>
        <p style={{ marginTop: 6, marginBottom: 6 }}>
          <strong>Pending orders:</strong> {kpis?.queued ?? 0}
          {kpis?.pendingSource && (kpis?.pendingSource === 'snapshot' || kpis?.pendingSource === 'snapshot-partial') ? (
            <span style={{ marginLeft: 8, color: '#6b7280' }}>
              (snapshot {String(kpis?.pendingSnapshotWindowDays ?? '?')}d)
            </span>
          ) : null}
        </p>
        <p>Shops assigned to you: {Array.isArray(orders.shops) ? orders.shops.length : 0}</p>
        <div>
          <pre style={{ background: '#f8fafc', padding: 12 }}>{JSON.stringify({ orders, kpis }, null, 2)}</pre>
        </div>
        <p style={{ color: '#6b7280' }}>TODO: implement orders table, filters, and actions (pack / rts / labels)</p>
      </div>
    </main>
  );
}
