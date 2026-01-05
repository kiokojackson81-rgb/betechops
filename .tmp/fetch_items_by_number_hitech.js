const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TARGET_ORDER_NUMBERS = [
  '334438657','387184857','324493957','341421457','316373957','347253657','395431957','322443657','315725857','386657957','327444857','348566857','352217657','378448957','358633257','345817657','343617257','332251657','312932657','317455257'
];

async function refreshToken(apiBase, clientId, refreshToken, clientSecret) {
  const url = new URL('/token', apiBase).toString();
  const params = new URLSearchParams({ client_id: clientId, grant_type: 'refresh_token', refresh_token: refreshToken });
  if (clientSecret) params.set('client_secret', clientSecret);
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params });
  if (!res.ok) throw new Error(`token refresh failed (${res.status})`);
  return (await res.json()).access_token;
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

    for (const onum of TARGET_ORDER_NUMBERS) {
      try {
        console.log('Querying items with order number:', onum);
        const items = await fetchOrderItems(apiBase, auth, onum);
        console.log(`Order ${onum} returned ${items.length} items`);
        if (items.length) console.dir(items.slice(0,2), { depth: null });
      } catch (err) {
        console.error('fetchOrderItems failed for', onum, err.message || err);
      }
    }
  } catch (err) {
    console.error('Failed', err);
  } finally {
    await prisma.$disconnect();
  }
})();
