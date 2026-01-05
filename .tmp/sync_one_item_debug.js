const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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
  url.searchParams.set('size', '1');
  const res = await fetch(url.toString(), { headers: { Authorization: authHeader } });
  if (!res.ok) throw new Error(`Failed to fetch orders (${res.status})`);
  const data = await res.json();
  return data.orders ?? [];
}

async function fetchOrderItems(apiBase, authHeader, orderId) {
  const url = new URL('/orders/items', apiBase);
  url.searchParams.set('orderId', orderId);
  const res = await fetch(url.toString(), { headers: { Authorization: authHeader } });
  if (!res.ok) throw new Error(`Failed to fetch order items (${res.status})`);
  const data = await res.json();
  return data.items ?? [];
}

(async () => {
  try {
    const cred = await prisma.$queryRaw`SELECT id, scope, "clientId", "apiSecret", "refreshToken", "apiBase" FROM "ApiCredential" WHERE scope LIKE 'MARKETPLACE_ACCOUNT:%' AND lower("apiBase") LIKE '%jumia%' ORDER BY "updatedAt" DESC LIMIT 1`;
    if (!cred.length) {
      console.error('no credential');
      process.exit(1);
    }
    const c = cred[0];
    console.log('using credential', c.scope, 'clientId', c.clientId);
    const createdBefore = new Date().toISOString().split('T')[0];
    const createdAfter = new Date(Date.now() - 30*24*3600*1000).toISOString().split('T')[0];
    const token = await refreshToken(c.apiBase || 'https://vendor-api.jumia.com', c.clientId, c.refreshToken, c.apiSecret);
    console.log('got token (len):', String(token).length);
    const auth = `Bearer ${token}`;
    const orders = await fetchOrders(c.apiBase || 'https://vendor-api.jumia.com', auth, createdAfter, createdBefore);
    console.log('orders fetched count:', orders.length, 'sample id:', orders[0]?.id);
    if (!orders.length) return;
    const order = orders[0];
    const items = await fetchOrderItems(c.apiBase || 'https://vendor-api.jumia.com', auth, order.id);
    console.log('items fetched count:', items.length, 'sample item id:', items[0]?.id);
    if (!items.length) return;
    const item = items[0];
    const sellingPriceLocal = Number(item.paidPriceLocal ?? item.itemPriceLocal ?? 0);
    const feeVal = Number((item?.seller_fee?.amount ?? item?.seller_fee_amount ?? 0) || 0);
    const shippingVal = Number((item?.shipping_fee?.amount ?? item?.shipping_fee_amount ?? 0) || 0);
    console.log({ sellingPriceLocal, feeVal, shippingVal });

    const account = await prisma.marketplaceAccount.findFirst({ where: { jumiaShopSid: c.clientId } });
    console.log('matched account:', !!account, account?.id);
    try {
      const upsert = await prisma.marketplaceOrder.upsert({
        where: { id: item.id },
        create: {
          id: item.id,
          accountId: account ? account.id : undefined,
          platform: 'JUMIA',
          orderId: String(order.number ?? order.id),
          orderItemId: item.id,
          status: item.status,
          orderedAt: new Date(order.createdAt),
          productName: item.product?.name ?? 'Unknown product',
          sellingPrice: sellingPriceLocal,
          currency: item.country?.currencyCode ?? 'KES',
          isReturned: false,
          sellerFee: feeVal,
          shippingFee: shippingVal,
          rawPayload: item,
        },
        update: {
          status: item.status,
          sellingPrice: sellingPriceLocal,
          sellerFee: feeVal,
          shippingFee: shippingVal,
          rawPayload: item,
        },
      });
      console.log('upsert result id:', upsert.id);
    } catch (err) {
      console.error('upsert error:', err);
    }
  } catch (err) {
    console.error('failed', err);
  } finally {
    await prisma.$disconnect();
  }
})();
