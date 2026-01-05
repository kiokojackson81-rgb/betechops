const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TARGET_ORDER_NUMBER = '334438657';
const CREATED_AFTER = '2025-12-20';
const CREATED_BEFORE = '2025-12-24';

async function refreshToken(apiBase, clientId, refreshToken, clientSecret) {
  const url = new URL('/token', apiBase).toString();
  const params = new URLSearchParams({ client_id: clientId, grant_type: 'refresh_token', refresh_token: refreshToken });
  if (clientSecret) params.set('client_secret', clientSecret);
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params });
  if (!res.ok) throw new Error(`token refresh failed (${res.status})`);
  return (await res.json()).access_token;
}

async function fetchOrders(apiBase, authHeader, createdAfter, createdBefore) {
  const url = new URL('/orders', apiBase);
  url.searchParams.set('createdAfter', createdAfter);
  url.searchParams.set('createdBefore', createdBefore);
  url.searchParams.set('status', 'DELIVERED');
  url.searchParams.set('size', '200');
  const res = await fetch(url.toString(), { headers: { Authorization: authHeader } });
  if (!res.ok) throw new Error(`Failed to fetch orders (${res.status})`);
  const data = await res.json();
  return data.orders ?? [];
}

async function fetchOrderItemsNoParams(apiBase, authHeader, orderId) {
  const url = new URL('/orders/items', apiBase);
  url.searchParams.set('orderId', orderId);
  const res = await fetch(url.toString(), { headers: { Authorization: authHeader } });
  if (!res.ok) throw new Error(`Failed to fetch order items (${res.status})`);
  const data = await res.json();
  return data.items ?? [];
}

(async () => {
  try {
    const account = await prisma.marketplaceAccount.findFirst({ where: { displayName: 'Hitech Power' } });
    if (!account) throw new Error('MarketplaceAccount Hitech Power not found');
    console.log('ShopSid:', account.jumiaShopSid);

    const cred = await prisma.apiCredential.findFirst({ where: { clientId: account.jumiaShopSid } });
    if (!cred) throw new Error('ApiCredential for Hitech Power not found');
    const apiBase = cred.apiBase || 'https://vendor-api.jumia.com';

    const token = await refreshToken(apiBase, cred.clientId, cred.refreshToken, cred.apiSecret);
    const auth = `Bearer ${token}`;

    const orders = await fetchOrders(apiBase, auth, CREATED_AFTER, CREATED_BEFORE);
    console.log('fetched orders count:', orders.length);
    const matched = orders.find(o => String(o.number ?? o.id) === TARGET_ORDER_NUMBER);
    if (!matched) {
      console.log('Order number not found in /orders response');
      console.log('Sample orders numbers:', orders.slice(0,5).map(o => ({ id: o.id, number: o.number })));
      return;
    }
    console.log('matched id:', matched.id);

    try {
      const items = await fetchOrderItemsNoParams(apiBase, auth, matched.id);
      console.log('items count for UUID (no params):', items.length);
      if (items.length) console.dir(items, { depth: null });
    } catch (err) {
      console.error('fetchOrderItems (no params) error:', err.message || err);
    }
  } catch (err) {
    console.error('Failed', err.message || err);
  } finally {
    await prisma.$disconnect();
  }
})();
