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
    if (!(j === null || j === void 0 ? void 0 : j.access_token))
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
    catch (_a) { }
    return { status: r.status, body: json || text };
}
async function run() {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    const file = process.argv[2] || 'shops.secrets.json';
    const buf = fs.readFileSync(file, 'utf8');
    const j = JSON.parse(buf);
    const list = ((j === null || j === void 0 ? void 0 : j.shops) || []).filter(s => String(s.platform).toUpperCase() === 'JUMIA');
    for (const s of list) {
        const name = s.name;
        const apiBase = ((_a = s.credentials) === null || _a === void 0 ? void 0 : _a.apiBase) || 'https://vendor-api.jumia.com';
        const tokenUrl = ((_b = s.credentials) === null || _b === void 0 ? void 0 : _b.tokenUrl) || 'https://vendor-api.jumia.com/token';
        const clientId = (_c = s.credentials) === null || _c === void 0 ? void 0 : _c.clientId;
        const refreshToken = (_d = s.credentials) === null || _d === void 0 ? void 0 : _d.refreshToken;
        try {
            const token = await mintAccessToken(tokenUrl, clientId, refreshToken);
            const shops = await call(apiBase, '/shops', token);
            const shops2 = await call(apiBase, '/shops-of-master-shop', token);
            const orders = await call(apiBase, '/orders?size=1', token);
            const shopsCount = Array.isArray((_e = shops.body) === null || _e === void 0 ? void 0 : _e.shops) ? shops.body.shops.length : Array.isArray(shops.body) ? shops.body.length : 0;
            const shops2Count = Array.isArray((_f = shops2.body) === null || _f === void 0 ? void 0 : _f.shops) ? shops2.body.shops.length : Array.isArray(shops2.body) ? shops2.body.length : 0;
            const ordersCount = Array.isArray((_g = orders.body) === null || _g === void 0 ? void 0 : _g.orders) ? orders.body.orders.length : Array.isArray((_h = orders.body) === null || _h === void 0 ? void 0 : _h.items) ? orders.body.items.length : Array.isArray((_j = orders.body) === null || _j === void 0 ? void 0 : _j.data) ? orders.body.data.length : 0;
            console.log(`OK ${name}: shops=${shopsCount} shops-of-master=${shops2Count} orders(size=1)=${ordersCount}`);
        }
        catch (e) {
            console.log(`FAIL ${name}: ${(e === null || e === void 0 ? void 0 : e.message) || e}`);
        }
    }
}
run();
