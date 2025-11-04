"use strict";
// scripts/quick-jumia-check.js
const fs = require('fs');
async function mintAccessToken(tokenUrl, clientId, refreshToken) {
    const body = new URLSearchParams({ client_id: clientId, grant_type: 'refresh_token', refresh_token: refreshToken });
    const r = await fetch(tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    const text = await r.text().catch(() => '');
    if (!r.ok)
        throw new Error(`token exchange failed: ${r.status} ${text}`);
    const j = JSON.parse(text);
    if (!j?.access_token)
        throw new Error('no access_token in response');
    return j.access_token;
}
async function call(apiBase, path, token) {
    const url = `${apiBase.replace(/\/+$/, '')}${path.startsWith('/') ? '' : '/'}${path}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
    const text = await r.text().catch(() => '');
    let json = null;
    try {
        json = JSON.parse(text);
    }
    catch { }
    return { status: r.status, body: json || text };
}
async function run() {
    const file = process.argv[2] || 'shops.secrets.json';
    const buf = fs.readFileSync(file, 'utf8');
    const j = JSON.parse(buf);
    const list = (j?.shops || []).filter(s => String(s.platform).toUpperCase() === 'JUMIA');
    for (const s of list) {
        const name = s.name;
        const apiBase = s.credentials?.apiBase || 'https://vendor-api.jumia.com';
        const tokenUrl = s.credentials?.tokenUrl || 'https://vendor-api.jumia.com/token';
        const clientId = s.credentials?.clientId;
        const refreshToken = s.credentials?.refreshToken;
        try {
            const token = await mintAccessToken(tokenUrl, clientId, refreshToken);
            const shops = await call(apiBase, '/shops', token);
            const shops2 = await call(apiBase, '/shops-of-master-shop', token);
            const orders = await call(apiBase, '/orders?size=1', token);
            const shopsCount = Array.isArray(shops.body?.shops) ? shops.body.shops.length : Array.isArray(shops.body) ? shops.body.length : 0;
            const shops2Count = Array.isArray(shops2.body?.shops) ? shops2.body.shops.length : Array.isArray(shops2.body) ? shops2.body.length : 0;
            const ordersCount = Array.isArray(orders.body?.orders) ? orders.body.orders.length : Array.isArray(orders.body?.items) ? orders.body.items.length : Array.isArray(orders.body?.data) ? orders.body.data.length : 0;
            console.log(`OK ${name}: shops=${shopsCount} shops-of-master=${shops2Count} orders(size=1)=${ordersCount}`);
        }
        catch (e) {
            console.log(`FAIL ${name}: ${e?.message || e}`);
        }
    }
}
run();
