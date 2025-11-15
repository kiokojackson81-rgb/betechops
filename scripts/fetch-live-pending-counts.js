const fs = require('fs');
// Use global fetch available in recent Node versions
const fetch = global.fetch;
const { zonedTimeToUtc } = require('date-fns-tz');
const { addDays, format } = require('date-fns');

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

async function countPendingForShop(shop, windowDays = 30) {
  const apiBase = shop.credentials?.apiBase || 'https://vendor-api.jumia.com';
  const tokenUrl = shop.credentials?.tokenUrl || 'https://vendor-api.jumia.com/token';
  const clientId = shop.credentials?.clientId;
  const refreshToken = shop.credentials?.refreshToken;
  if (!clientId || !refreshToken) {
    console.log(`Missing creds for shop ${shop.name} (${shop.id})`);
    return null;
  }
  const token = await mintAccessToken(tokenUrl, clientId, refreshToken);
  const now = new Date();
  const start = zonedTimeToUtc(addDays(now, -windowDays), 'Africa/Nairobi');
  const updatedAfter = format(start, 'yyyy-MM-dd HH:mm:ss');
  const updatedBefore = format(now, 'yyyy-MM-dd HH:mm:ss');
  let nextToken = undefined;
  let pages = 0;
  let orders = 0;
  const PAGE_SIZE = 100;
  const MAX_PAGES = 2000;
  const seen = new Set();
  do {
    const path = `/orders?status=PENDING&shopId=${encodeURIComponent(shop.id)}&updatedAfter=${encodeURIComponent(updatedAfter)}&updatedBefore=${encodeURIComponent(updatedBefore)}&size=${PAGE_SIZE}${nextToken ? `&token=${encodeURIComponent(nextToken)}` : ''}&sort=ASC`;
    const res = await call(apiBase, path, token);
    if (!res || res.status >= 400) {
      console.error(`API error for shop ${shop.name}: status=${res?.status} body=${JSON.stringify(res?.body).slice(0,200)}`);
      break;
    }
    const body = res.body || {};
    const list = Array.isArray(body.orders) ? body.orders : Array.isArray(body.items) ? body.items : Array.isArray(body.data) ? body.data : [];
    orders += list.length;
    pages += 1;
    const nxt = body?.nextToken ?? null;
    const lastFlag = body?.isLastPage === true;
    if (lastFlag) break;
    if (!nxt || typeof nxt !== 'string' || !nxt.trim()) break;
    if (seen.has(String(nxt))) break;
    seen.add(String(nxt));
    nextToken = String(nxt);
  } while (nextToken && pages < MAX_PAGES);
  return { shopId: shop.id, shopName: shop.name, pages, orders };
}

async function main() {
  const file = process.argv[2] || 'shops.secrets.json';
  const buf = fs.readFileSync(file, 'utf8');
  const j = JSON.parse(buf);
  const list = (j?.shops || []).filter(s => String(s.platform).toUpperCase() === 'JUMIA');
  const windowDays = Number(process.argv[3] || 30);
  const results = [];
  for (const s of list) {
    try {
      process.stdout.write(`Checking account ${s.name}... `);
      const apiBase = s.credentials?.apiBase || 'https://vendor-api.jumia.com';
      const tokenUrl = s.credentials?.tokenUrl || 'https://vendor-api.jumia.com/token';
      const token = await mintAccessToken(tokenUrl, s.credentials?.clientId, s.credentials?.refreshToken);
      // Discover shops for this account
      const shopsRes = await call(apiBase, '/shops', token);
      const shops = Array.isArray(shopsRes.body?.shops) ? shopsRes.body.shops : Array.isArray(shopsRes.body) ? shopsRes.body : [];
      if (!shops || !shops.length) {
        // try alternate endpoint
        const alt = await call(apiBase, '/shops-of-master-shop', token);
        const shops2 = Array.isArray(alt.body?.shops) ? alt.body.shops : Array.isArray(alt.body) ? alt.body : [];
        if (shops2 && shops2.length) shops.push(...shops2);
      }
      if (!shops.length) {
        console.log('no remote shops');
        continue;
      }
      console.log(`found ${shops.length} remote shop(s)`);
      for (const remoteShop of shops) {
        const shopId = remoteShop?.id || remoteShop?.shopId || remoteShop?.sid || remoteShop?.shop_id;
        if (!shopId) continue;
        const shopName = remoteShop?.name || remoteShop?.label || s.name;
        process.stdout.write(`  - shop ${shopName} (${shopId})... `);
        try {
          const res = await countPendingForShop({ id: shopId, name: shopName, credentials: s.credentials }, windowDays);
          if (res) {
            console.log(`OK orders=${res.orders} pages=${res.pages}`);
            results.push(res);
          } else {
            console.log('SKIP');
          }
        } catch (e) {
          console.log(`ERROR ${e?.message || e}`);
        }
      }
    } catch (e) {
      console.log(`ERROR ${e?.message || e}`);
    }
  }
  console.log('\nLive vendor counts:');
  results.forEach(r => console.log(`- ${r.shopName} (${r.shopId}): ${r.orders}`));
}

main().catch(e => { console.error(e); process.exit(1); });
