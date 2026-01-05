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
  const orders = [];
  let nextToken = null;
  do {
    const url = new URL('/orders', apiBase);
    url.searchParams.set('createdAfter', createdAfter);
    url.searchParams.set('createdBefore', createdBefore);
    url.searchParams.set('size', '200');
    if (nextToken) url.searchParams.set('token', nextToken);
    const res = await fetch(url.toString(), { headers: { Authorization: authHeader } });
    if (!res.ok) throw new Error(`Failed to fetch orders (${res.status})`);
    const data = await res.json();
    if (data.orders?.length) orders.push(...data.orders);
    nextToken = data.nextToken ?? null;
    if (data.isLastPage) break;
  } while (nextToken);
  return orders;
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
    const creds = await prisma.$queryRaw`SELECT id, scope, "clientId", "apiSecret", "refreshToken", "apiBase" FROM "ApiCredential" WHERE scope LIKE 'MARKETPLACE_ACCOUNT:%' AND lower("apiBase") LIKE '%jumia%' ORDER BY "updatedAt" DESC`;
    if (!creds.length) {
      console.log('No per-account Jumia ApiCredential rows found');
      process.exit(0);
    }
    const createdBefore = new Date().toISOString().split('T')[0];
    const createdAfter = dateNDaysAgo(7); // last 7 days
    for (const c of creds) {
      console.log('Syncing for', c.scope);
      let accessToken;
      try {
        accessToken = await refreshToken(c.apiBase || 'https://vendor-api.jumia.com', c.clientId, c.refreshToken, c.apiSecret);
      } catch (err) {
        console.error('Failed to refresh token for', c.scope, err.message || err);
        continue;
      }
      const auth = `Bearer ${accessToken}`;
      let orders;
      try {
        orders = await fetchOrders(c.apiBase || 'https://vendor-api.jumia.com', auth, createdAfter, createdBefore);
      } catch (err) {
        console.error('Failed to fetch orders for', c.scope, err.message || err);
        continue;
      }
      console.log('Fetched orders:', orders.length);
      // Map marketplaceAccount scope to accountId
      const accountId = c.scope.replace('MARKETPLACE_ACCOUNT:', '');
      // Find MarketplaceAccount by jumiaShopSid matching clientId (clientId is shopSid)
      const account = await prisma.marketplaceAccount.findFirst({ where: { jumiaShopSid: c.clientId } });
      const acctId = account ? account.id : null;
      let ordersProcessed = 0;
      let itemsProcessed = 0;
      let upsertsSucceeded = 0;
      let upsertsFailed = 0;
      for (const order of orders.slice(0, 500)) { // limit to 500 per account to be safe
        try {
          ordersProcessed++;
          const items = await fetchOrderItems(c.apiBase || 'https://vendor-api.jumia.com', auth, order.id);
          console.log(`Order ${order.id} (${order.number ?? ''}) returned ${items.length} items`);
          if (!items.length) continue;
          for (const item of items) {
            itemsProcessed++;
            const sellingPriceLocal = Number(item.paidPriceLocal ?? item.itemPriceLocal ?? 0);
            const statusStr = typeof item.status === 'string' ? item.status : String(item.status ?? '');
            const isReturnedFlag = statusStr.startsWith('RETURN') || statusStr === 'FAILED';
            const rawItem = item;
            const feeVal = Number((rawItem?.seller_fee?.amount ?? rawItem?.seller_fee_amount ?? 0) || 0);
            const shippingVal = Number((rawItem?.shipping_fee?.amount ?? rawItem?.shipping_fee_amount ?? 0) || 0);
            try {
              await prisma.marketplaceOrder.upsert({
                where: { id: item.id },
                create: {
                  id: item.id,
                  accountId: acctId || undefined,
                  platform: 'JUMIA',
                  orderId: String(order.number ?? order.id),
                  orderItemId: item.id,
                  status: item.status,
                  orderedAt: new Date(order.createdAt),
                  productName: item.product?.name ?? 'Unknown product',
                  productUrl: item.product?.sellerSku ? `https://www.jumia.co.ke/${item.product.sellerSku}` : undefined,
                  sellingPrice: sellingPriceLocal,
                  currency: item.country?.currencyCode ?? 'KES',
                  isReturned: isReturnedFlag,
                  sellerFee: feeVal,
                  shippingFee: shippingVal,
                  rawPayload: item,
                },
                update: {
                  status: item.status,
                  sellingPrice: sellingPriceLocal,
                  currency: item.country?.currencyCode ?? 'KES',
                  isReturned: isReturnedFlag,
                  sellerFee: feeVal,
                  shippingFee: shippingVal,
                  profit: isReturnedFlag ? 0 : undefined,
                  rawPayload: item,
                },
              });
              upsertsSucceeded++;
            } catch (err) {
              upsertsFailed++;
              console.error('Upsert failed for item', item.id, 'order', order.id, err.message || err);
            }
          }
        } catch (err) {
          console.error('Failed processing order', order.id, err.message || err);
        }
      }
      console.log(`Account ${c.scope} summary: orders=${ordersProcessed} items=${itemsProcessed} upserts_ok=${upsertsSucceeded} upserts_fail=${upsertsFailed}`);
    }
    console.log('Local sync completed');
  } catch (err) {
    console.error('Sync failed', err);
  } finally {
    await prisma.$disconnect();
  }
})();
