const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TARGET_ORDERS = {
  '334438657': '2025-12-22',
  '387184857': '2025-12-30',
  '324493957': '2025-12-29',
  '341421457': '2025-12-16',
  '316373957': '2025-12-29',
  '347253657': '2025-12-24',
  '395431957': '2025-12-29',
  '322443657': '2025-12-24',
  '315725857': '2026-01-02',
  '386657957': '2025-12-28',
  '327444857': '2025-12-29',
  '348566857': '2025-12-31',
  '352217657': '2025-12-23',
  '378448957': '2025-12-27',
  '358633257': '2025-12-20',
  '345817657': '2025-12-23',
  '343617257': '2025-12-19',
  '332251657': '2025-12-24',
  '312932657': '2025-12-21',
  '317455257': '2025-12-19',
};

function dateAddDays(d, days) {
  const dt = new Date(d);
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().split('T')[0];
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
    const account = await prisma.marketplaceAccount.findFirst({ where: { displayName: 'Hitech Power' } });
    if (!account) {
      console.error('MarketplaceAccount Hitech Power not found');
      process.exit(1);
    }
    console.log('Found account', account.id, 'shopSid', account.jumiaShopSid);

    const cred = await prisma.apiCredential.findFirst({ where: { clientId: account.jumiaShopSid } });
    if (!cred) {
      console.error('ApiCredential for Hitech Power not found');
      process.exit(1);
    }
    console.log('Using credential', cred.id);

    const apiBase = cred.apiBase || 'https://vendor-api.jumia.com';
    const token = await refreshToken(apiBase, cred.clientId, cred.refreshToken, cred.apiSecret);
    const auth = `Bearer ${token}`;

    let totalItems = 0;
    let totalUpserts = 0;

    for (const [orderNumber, dateStr] of Object.entries(TARGET_ORDERS)) {
      const createdAfter = dateAddDays(dateStr, -1);
      const createdBefore = dateAddDays(dateStr, 1);
      console.log(`Checking order ${orderNumber} window ${createdAfter}..${createdBefore}`);
      let orders;
      try {
        orders = await fetchOrders(apiBase, auth, createdAfter, createdBefore);
      } catch (err) {
        console.error('fetchOrders failed for', orderNumber, err.message || err);
        continue;
      }
      const matched = orders.filter(o => String(o.number ?? o.id) === String(orderNumber));
      console.log('orders fetched', orders.length, 'matched', matched.length);
      if (!matched.length) continue;
      for (const order of matched) {
        try {
          const items = await fetchOrderItems(apiBase, auth, order.id);
          console.log('order', orderNumber, 'items', items.length);
          if (!items.length) continue;
          for (const item of items) {
            totalItems++;
            try {
              await prisma.marketplaceOrder.upsert({
                where: { id: item.id },
                create: {
                  id: item.id,
                  accountId: account.id,
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
              console.log('upserted item', item.id);
            } catch (err) {
              console.error('upsert failed for item', item.id, err.message || err);
            }
          }
        } catch (err) {
          console.error('fetchOrderItems failed for', order.id, err.message || err);
        }
      }
    }

    console.log('Done totalItems', totalItems, 'upserts', totalUpserts);
  } catch (err) {
    console.error('Failed', err);
  } finally {
    await prisma.$disconnect();
  }
})();
