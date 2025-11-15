const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const { zonedTimeToUtc } = require('date-fns-tz');
const { addDays, format } = require('date-fns');
const prisma = new PrismaClient();

// Use global fetch
const fetch = global.fetch;

async function mintAccessToken(tokenUrl, clientId, refreshToken) {
  const body = new URLSearchParams({ client_id: clientId, grant_type: 'refresh_token', refresh_token: refreshToken });
  const r = await fetch(tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  if (!r.ok) throw new Error(`token exchange failed: ${r.status}`);
  const j = await r.json();
  if (!j?.access_token) throw new Error('no access_token in response');
  return j.access_token;
}

async function call(apiBase, path, token) {
  const url = `${apiBase.replace(/\/+$/,'')}${path.startsWith('/')?'':'/'}${path}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
  const j = await r.json().catch(() => null);
  return { status: r.status, body: j };
}

async function fetchOrdersForShop(apiBase, token, shopId, windowDays = 7) {
  const now = new Date();
  const start = zonedTimeToUtc(addDays(now, -windowDays), 'Africa/Nairobi');
  const updatedAfter = format(start, 'yyyy-MM-dd HH:mm:ss');
  const updatedBefore = format(now, 'yyyy-MM-dd HH:mm:ss');
  const PAGE_SIZE = 100;
  const MAX_PAGES = 2000;
  const ids = new Set();
  let nextToken = undefined;
  let pages = 0;
  const seen = new Set();
  do {
    const path = `/orders?status=PENDING&shopId=${encodeURIComponent(shopId)}&updatedAfter=${encodeURIComponent(updatedAfter)}&updatedBefore=${encodeURIComponent(updatedBefore)}&size=${PAGE_SIZE}${nextToken ? `&token=${encodeURIComponent(nextToken)}` : ''}&sort=ASC`;
    const res = await call(apiBase, path, token);
    if (!res || res.status >= 400) {
      console.error(`API error for shop ${shopId}: status=${res?.status} body=${JSON.stringify(res?.body).slice(0,200)}`);
      break;
    }
    const body = res.body || {};
    const list = Array.isArray(body.orders) ? body.orders : Array.isArray(body.items) ? body.items : Array.isArray(body.data) ? body.data : [];
    for (const o of list) {
      const id = String(o?.id ?? o?.orderId ?? o?.order_id ?? o?.order_id_v2 ?? '');
      if (id) ids.add(id);
    }
    pages += 1;
    const nxt = body?.nextToken ?? null;
    const lastFlag = body?.isLastPage === true;
    if (lastFlag) break;
    if (!nxt || typeof nxt !== 'string' || !nxt.trim()) break;
    if (seen.has(String(nxt))) break;
    seen.add(String(nxt));
    nextToken = String(nxt);
  } while (nextToken && pages < MAX_PAGES);
  return Array.from(ids);
}

async function fetchRemoteShops(apiBase, token) {
  const shopsRes = await call(apiBase, '/shops', token);
  let shops = Array.isArray(shopsRes.body?.shops) ? shopsRes.body.shops : Array.isArray(shopsRes.body) ? shopsRes.body : [];
  if (!shops || !shops.length) {
    const alt = await call(apiBase, '/shops-of-master-shop', token);
    const shops2 = Array.isArray(alt.body?.shops) ? alt.body.shops : Array.isArray(alt.body) ? alt.body : [];
    if (shops2 && shops2.length) shops = shops2;
  }
  return shops;
}

async function dbOrderIdsForShop(shopId, windowDays = 7) {
  const now = new Date();
  const windowStart = zonedTimeToUtc(addDays(now, -windowDays), 'Africa/Nairobi');
  const rows = await prisma.jumiaOrder.findMany({ where: {
    shopId: shopId,
    status: { in: ['PENDING'] },
    OR: [
      { updatedAtJumia: { gte: windowStart } },
      { createdAtJumia: { gte: windowStart } },
      { AND: [{ updatedAtJumia: null }, { createdAtJumia: null }, { updatedAt: { gte: windowStart } }] },
    ],
  }, select: { id: true } });
  return rows.map(r => r.id);
}

(async function main() {
  try {
    const file = process.argv[2] || 'shops.secrets.json';
    const windowDays = Number(process.argv[3] || 7);
    const buf = fs.readFileSync(file, 'utf8');
    const j = JSON.parse(buf);
    const accounts = (j?.shops || []).filter(s => String(s.platform).toUpperCase() === 'JUMIA');
    const summary = { totalVendor: 0, totalDb: 0, totalVendorOnly: 0, totalDbOnly: 0 };
    for (const account of accounts) {
      try {
        const token = await mintAccessToken(account.credentials?.tokenUrl || 'https://vendor-api.jumia.com/token', account.credentials?.clientId, account.credentials?.refreshToken);
        const remoteShops = await fetchRemoteShops(account.credentials?.apiBase || 'https://vendor-api.jumia.com', token);
        for (const rs of remoteShops) {
          const shopId = rs?.id || rs?.shopId || rs?.sid || rs?.shop_id;
          const shopName = rs?.name || rs?.label || account.name;
          if (!shopId) continue;
          console.log(`\n--- Shop ${shopName} (${shopId}) ---`);
          const vendorIds = await fetchOrdersForShop(account.credentials?.apiBase || 'https://vendor-api.jumia.com', token, shopId, windowDays);
          console.log(`Vendor pending count (${windowDays}d): ${vendorIds.length}`);
          const dbIds = await dbOrderIdsForShop(shopId, windowDays);
          console.log(`DB pending count (${windowDays}d): ${dbIds.length}`);
          const vendorSet = new Set(vendorIds);
          const dbSet = new Set(dbIds);
          const vendorOnly = vendorIds.filter(id => !dbSet.has(id));
          const dbOnly = dbIds.filter(id => !vendorSet.has(id));
          console.log(`Vendor-only (${vendorOnly.length}): ${vendorOnly.slice(0,20).join(', ')}`);
          console.log(`DB-only (${dbOnly.length}): ${dbOnly.slice(0,20).join(', ')}`);
          summary.totalVendor += vendorIds.length;
          summary.totalDb += dbIds.length;
          summary.totalVendorOnly += vendorOnly.length;
          summary.totalDbOnly += dbOnly.length;
        }
      } catch (e) {
        console.error('Account error', account.name, e.message || e);
      }
    }
    console.log('\n=== Summary across all shops ===');
    console.log(`Total vendor pending: ${summary.totalVendor}`);
    console.log(`Total DB pending: ${summary.totalDb}`);
    console.log(`Total vendor-only (in vendor, not in DB): ${summary.totalVendorOnly}`);
    console.log(`Total DB-only (in DB, not in vendor): ${summary.totalDbOnly}`);
  } catch (e) {
    console.error('Fatal', e);
  } finally {
    await prisma.$disconnect();
  }
})();
