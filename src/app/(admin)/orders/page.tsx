import React from 'react';
import AttendantHeader from '../_components/AttendantHeader';

async function fetchOrders() {
  try {
    const res = await fetch('/api/orders/search', { cache: 'no-store' });
    return res.ok ? await res.json() : { shops: [], orders: [] };
  } catch (err) {
    return { shops: [], orders: [], error: String(err) };
  }
}

export default async function OrdersPage() {
  const data = await fetchOrders();
  return (
    <main>
      <AttendantHeader />
      <div style={{ padding: 16 }}>
        <h3>Orders / Queues (stub)</h3>
        <p>Shops assigned to you: {Array.isArray(data.shops) ? data.shops.length : 0}</p>
        <div>
          <pre style={{ background: '#f8fafc', padding: 12 }}>{JSON.stringify(data, null, 2)}</pre>
        </div>
        <p style={{ color: '#6b7280' }}>TODO: implement orders table, filters, and actions (pack / rts / labels)</p>
      </div>
    </main>
  );
}
