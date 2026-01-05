const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function dateNDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

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
  url.searchParams.set('size', '200');
  const res = await fetch(url.toString(), { headers: { Authorization: authHeader } });
  if (!res.ok) throw new Error(`fetch orders failed (${res.status})`);
  const data = await res.json();
  return data.orders ?? [];
}

(async () => {
  try {
    const creds = await prisma.$queryRaw`SELECT id, scope, "clientId", "apiSecret", "refreshToken", "apiBase" FROM "ApiCredential" WHERE scope LIKE 'MARKETPLACE_ACCOUNT:%' AND lower("apiBase") LIKE '%jumia%' ORDER BY "updatedAt" DESC`;
    if (!creds.length) {
      console.log('No per-account Jumia ApiCredential rows found');
      process.exit(0);
    }
    const createdBefore = new Date().toISOString().split('T')[0];
    const createdAfter = dateNDaysAgo(30);
    for (const c of creds) {
      console.log('---');
      console.log('scope:', c.scope, 'apiBase:', c.apiBase);
      try {
        const token = await refreshToken(c.apiBase || 'https://vendor-api.jumia.com', c.clientId, c.refreshToken, c.apiSecret);
        const auth = `Bearer ${token}`;
        const orders = await fetchOrders(c.apiBase || 'https://vendor-api.jumia.com', auth, createdAfter, createdBefore);
        console.log('orders_count_sample:', orders.length);
        if (orders.length > 0) console.log('sample_order_ids:', orders.slice(0,5).map(o => o.id));
      } catch (err) {
        console.error('API check failed for', c.scope, err.message || err);
      }
    }
  } catch (err) {
    console.error('failed', err);
  } finally {
    await prisma.$disconnect();
  }
})();
