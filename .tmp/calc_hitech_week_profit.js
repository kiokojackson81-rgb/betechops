const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CREATED_AFTER = '2025-12-29';
const CREATED_BEFORE = '2026-01-05';

async function refreshToken(apiBase, clientId, refreshToken, clientSecret) {
  const url = new URL('/token', apiBase).toString();
  const params = new URLSearchParams({ client_id: clientId, grant_type: 'refresh_token', refresh_token: refreshToken });
  if (clientSecret) params.set('client_secret', clientSecret);
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params });
  if (!res.ok) throw new Error(`token refresh failed (${res.status})`);
  return (await res.json()).access_token;
}

async function fetchPayoutStatement(apiBase, authHeader, createdAfter, createdBefore, shopId) {
  const url = new URL('/payout-statement', apiBase);
  url.searchParams.set('createdAfter', createdAfter);
  url.searchParams.set('createdBefore', createdBefore);
  if (shopId) url.searchParams.set('shopId', shopId);
  const res = await fetch(url.toString(), { headers: { Authorization: authHeader } });
  if (!res.ok) throw new Error(`Failed to fetch payout-statement (${res.status})`);
  return await res.json();
}

async function fetchOrdersDelivered(apiBase, authHeader, createdAfter, createdBefore, shopId) {
  const orders = [];
  let nextToken = null;
  do {
    const url = new URL('/orders', apiBase);
    url.searchParams.set('createdAfter', createdAfter);
    url.searchParams.set('createdBefore', createdBefore);
    url.searchParams.set('status', 'DELIVERED');
    url.searchParams.set('size', '200');
    if (shopId) url.searchParams.set('shopId', shopId);
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

(async () => {
  try {
    const account = await prisma.marketplaceAccount.findFirst({ where: { displayName: 'Hitech Power' } });
    if (!account) {
      console.error('MarketplaceAccount "Hitech Power" not found. Listing first 10 accounts:');
      const some = await prisma.marketplaceAccount.findMany({ take: 10 });
      console.dir(some, { depth: 1 });
      return process.exit(1);
    }

    const cred = await prisma.apiCredential.findFirst({ where: { clientId: account.jumiaShopSid } })
      || await prisma.apiCredential.findFirst({ where: { scope: { contains: `MARKETPLACE_ACCOUNT:${account.id}` } } });
    if (!cred) throw new Error('ApiCredential for shop not found');

    const apiBase = cred.apiBase || 'https://vendor-api.jumia.com';
    const token = await refreshToken(apiBase, cred.clientId, cred.refreshToken, cred.apiSecret);
    const auth = `Bearer ${token}`;

    console.log('Fetching payout-statement for', CREATED_AFTER, '->', CREATED_BEFORE);
    let statement;
    try {
      statement = await fetchPayoutStatement(apiBase, auth, CREATED_AFTER, CREATED_BEFORE, account.jumiaShopSid);
    } catch (err) {
      console.error('payout-statement fetch failed:', err.message || err);
    }

    console.log('Fetching delivered orders for period');
    let orders = [];
    try {
      orders = await fetchOrdersDelivered(apiBase, auth, CREATED_AFTER, CREATED_BEFORE, account.jumiaShopSid);
    } catch (err) {
      console.error('orders fetch failed:', err.message || err);
    }

    console.log('Delivered orders count:', orders.length);

    const orderNumbers = orders.map(o => String(o.number ?? o.id));

    // Find matching MarketplaceOrder rows with buyingPrice
    const found = await prisma.marketplaceOrder.findMany({
      where: { accountId: account.id, orderId: { in: orderNumbers } },
      select: { orderId: true, buyingPrice: true }
    });

    const sumBuying = found.reduce((s, r) => s + (r.buyingPrice ?? 0), 0);
    const missingCount = orders.length - found.length;

    console.log('\nStatement (raw):');
    console.dir(statement, { depth: 2 });

    const itemRevenue = Number(statement?.itemRevenue ?? 0);
    const feesTotal = Number(statement?.feesTotal ?? 0);
    const shipmentFee = Number((statement?.shipmentFee ?? 0) + (statement?.shipmentFeeCredit ?? 0));
    const otherRevenueTotal = Number(statement?.otherRevenueTotal ?? 0);
    const payoutAmount = Number(statement?.payout?.amount ?? statement?.payoutAmount ?? 0);

    const netRevenue = itemRevenue - feesTotal - shipmentFee - otherRevenueTotal;

    console.log('\nComputed totals:');
    console.log('itemRevenue:', itemRevenue);
    console.log('feesTotal:', feesTotal);
    console.log('shipmentFee (incl credits):', shipmentFee);
    console.log('otherRevenueTotal:', otherRevenueTotal);
    console.log('payoutAmount:', payoutAmount);
    console.log('netRevenue (itemRevenue - fees - shipment - other):', netRevenue);

    console.log('\nBuying price summary from DB:');
    console.log('found marketplaceOrder rows with buyingPrice:', found.length);
    console.log('sum of buyingPrice found:', sumBuying);
    console.log('missing buyingPrice count (orders without marketplaceOrder):', missingCount);

    const profit_by_payout = payoutAmount - sumBuying;
    const profit_by_netRevenue = netRevenue - sumBuying;

    console.log('\nProfit estimates:');
    console.log('profit (payoutAmount - sumBuyingPrices):', profit_by_payout);
    console.log('profit (netRevenue - sumBuyingPrices):', profit_by_netRevenue);

    if (missingCount > 0) {
      console.log('\nNote: Some delivered orders are missing local buying prices.');
      console.log('You can either: (1) enter buying prices for the missing orders in the DB, or (2) request item-level payloads from Jumia (but /orders/items may not be available).');
    }

    console.log('\nDone.');
  } catch (err) {
    console.error('Failed', err);
  } finally {
    await prisma.$disconnect();
  }
})();
