const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TARGET_ORDER_NUMBERS = new Set([
  '334438657','387184857','324493957','341421457','316373957','347253657','395431957','322443657','315725857','386657957','327444857','348566857','352217657','378448957','358633257','345817657','343617257','332251657','312932657','317455257'
]);

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
    // date range from user
    const createdAfter = '2025-12-01';
    const createdBefore = '2026-12-31';

    const creds = await prisma.$queryRaw`SELECT id, scope, "clientId", "apiSecret", "refreshToken", "apiBase" FROM "ApiCredential" WHERE scope LIKE 'MARKETPLACE_ACCOUNT:%' AND lower("apiBase") LIKE '%jumia%' ORDER BY "updatedAt" DESC`;
    if (!creds.length) {
      console.log('No per-account Jumia ApiCredential rows found');
      process.exit(0);
    }

    let totalMatchedOrders = 0;
    let totalItems = 0;
    let totalUpserts = 0;

    for (const c of creds) {
      console.log('Checking account', c.scope);
      let token;
      try {
        token = await refreshToken(c.apiBase || 'https://vendor-api.jumia.com', c.clientId, c.refreshToken, c.apiSecret);
      } catch (err) {
        console.error('token refresh failed for', c.scope, err.message || err);
        continue;
      }
      const auth = `Bearer ${token}`;
      let orders;
      try {
        orders = await fetchOrders(c.apiBase || 'https://vendor-api.jumia.com', auth, createdAfter, createdBefore);
      } catch (err) {
        console.error('fetchOrders failed for', c.scope, err.message || err);
        continue;
      }

      // filter orders by number
      const matched = orders.filter(o => TARGET_ORDER_NUMBERS.has(String(o.number ?? o.id)));
      console.log(`Account ${c.scope} fetched ${orders.length} orders, matched ${matched.length} target orders`);
      totalMatchedOrders += matched.length;

      // find account mapping
      const account = await prisma.marketplaceAccount.findFirst({ where: { jumiaShopSid: c.clientId } });
      const acctId = account ? account.id : null;

      for (const order of matched) {
        try {
          const items = await fetchOrderItems(c.apiBase || 'https://vendor-api.jumia.com', auth, order.id);
          console.log(`Order ${order.number ?? order.id} returned ${items.length} items`);
          if (!items.length) continue;
          for (const item of items) {
            totalItems++;
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
                  sellingPrice: Number(item.paidPriceLocal ?? item.itemPriceLocal ?? 0),
                  currency: item.country?.currencyCode ?? 'KES',
                  isReturned: false,
                  sellerFee: Number((item?.seller_fee?.amount ?? item?.seller_fee_amount ?? 0) || 0),
                  shippingFee: Number((item?.shipping_fee?.amount ?? item?.shipping_fee_amount ?? 0) || 0),
                  rawPayload: item,
                },
                update: {
                  status: item.status,
                  sellingPrice: Number(item.paidPriceLocal ?? item.itemPriceLocal ?? 0),
                  sellerFee: Number((item?.seller_fee?.amount ?? item?.seller_fee_amount ?? 0) || 0),
                  shippingFee: Number((item?.shipping_fee?.amount ?? item?.shipping_fee_amount ?? 0) || 0),
                  rawPayload: item,
                },
              });
              totalUpserts++;
            } catch (err) {
              console.error('upsert failed for item', item.id, err.message || err);
            }
          }
        } catch (err) {
          console.error('fetchOrderItems failed for', order.id, err.message || err);
        }
      }
    }

    console.log('Done. matchedOrders:', totalMatchedOrders, 'items:', totalItems, 'upserts:', totalUpserts);
  } catch (err) {
    console.error('Failed', err);
  } finally {
    await prisma.$disconnect();
  }
})();
