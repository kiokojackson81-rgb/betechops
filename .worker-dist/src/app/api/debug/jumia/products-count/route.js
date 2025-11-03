"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const jumia_1 = require("@/lib/jumia");
function extractTotal(obj) {
    if (!obj || typeof obj !== 'object')
        return null;
    const keys = new Set(['total', 'totalCount', 'count', 'total_items', 'totalItems', 'recordsTotal', 'totalElements']);
    const q = [obj];
    const seen = new Set();
    while (q.length) {
        const cur = q.shift();
        if (!cur || typeof cur !== 'object')
            continue;
        if (seen.has(cur))
            continue;
        seen.add(cur);
        for (const [k, v] of Object.entries(cur)) {
            if (typeof v === 'number' && keys.has(k))
                return v;
            if (v && typeof v === 'object')
                q.push(v);
        }
    }
    return null;
}
async function GET(req) {
    const url = new URL(req.url);
    const shopName = url.searchParams.get('shopName') || url.searchParams.get('name') || '';
    const shopId = url.searchParams.get('shopId') || '';
    const sidsQ = url.searchParams.get('sids') || '';
    const all = url.searchParams.get('all') === 'true';
    const force = url.searchParams.get('force') === 'true';
    const timeMs = Math.min(120000, Math.max(5000, Number(url.searchParams.get('timeMs') || 45000)));
    const size = Math.min(500, Math.max(1, Number(url.searchParams.get('size') || 200)));
    try {
        // Special case: aggregate across all shops when no identifiers are passed or all=true
        if ((all || (!shopName && !shopId && !sidsQ))) {
            // Fetch shops and compute totals concurrently with a soft cap
            const shops = await (0, jumia_1.getShops)().catch(() => []);
            const list = Array.isArray(shops) ? shops : [];
            const results = await Promise.all(list.map(async (s) => {
                try {
                    const totals = await (0, jumia_1.getCatalogProductTotals)(String(s.id || s.shopId || ''));
                    return { id: String(s.id || s.shopId || ''), name: String(s.name || s.shopName || ''), total: totals.total, approx: totals.approx };
                }
                catch (_a) {
                    return { id: String(s.id || s.shopId || ''), name: String(s.name || s.shopName || ''), total: 0, approx: true, error: 'fetch_failed' };
                }
            }));
            const totalAll = results.reduce((acc, r) => acc + (Number(r.total) || 0), 0);
            return server_1.NextResponse.json({ ok: true, by: 'all', shops: results, totalAll, approx: results.some(r => r.approx) });
        }
        // Resolve SID(s)
        let sids = undefined;
        let matchedName = undefined;
        if (sidsQ) {
            sids = sidsQ.split(',').map((s) => s.trim()).filter(Boolean);
        }
        else if (shopName) {
            const shops = await (0, jumia_1.getShopsOfMasterShop)().catch(() => []);
            const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
            const target = norm(shopName);
            let best = null;
            let bestScore = -1;
            for (const sh of (Array.isArray(shops) ? shops : [])) {
                const nm = String((sh === null || sh === void 0 ? void 0 : sh.name) || (sh === null || sh === void 0 ? void 0 : sh.shopName) || (sh === null || sh === void 0 ? void 0 : sh.label) || '').trim();
                const sid = String((sh === null || sh === void 0 ? void 0 : sh.sid) || (sh === null || sh === void 0 ? void 0 : sh.id) || (sh === null || sh === void 0 ? void 0 : sh.shopId) || '') || '';
                if (!nm || !sid)
                    continue;
                const score = nm.toLowerCase().includes(target) ? 2 : (target.includes(nm.toLowerCase()) ? 1 : 0);
                if (score > bestScore) {
                    bestScore = score;
                    best = { sid, name: nm };
                }
            }
            if (best) {
                sids = [best.sid];
                matchedName = best.name;
            }
        }
        // If shopId was provided, try to use per-shop credentials by hitting the shop-specific param to vendor
        // However, vendor supports sids filter; prefer that when we have SID.
        // Choose auth: if a Prisma shopId is provided (no sids), use that shop's credentials; otherwise default
        const shopAuth = shopId && !sidsQ ? await (0, jumia_1.loadShopAuthById)(shopId).catch(() => (0, jumia_1.loadDefaultShopAuth)().catch(() => undefined)) : await (0, jumia_1.loadDefaultShopAuth)().catch(() => undefined);
        // Fast-path: ask for one item and read the total from response metadata
        const params = new URLSearchParams();
        params.set('size', '1');
        if (sids && sids.length)
            params.set('sids', sids.join(','));
        // Do NOT pass our internal Prisma shopId as vendor query param; rely on per-shop auth when shopId is present
        const first = await (0, jumia_1.jumiaFetch)(`/catalog/products?${params.toString()}`, shopAuth ? { shopAuth } : {}).catch(() => null);
        const hinted = extractTotal(first);
        if (typeof hinted === 'number' && hinted >= 0) {
            return server_1.NextResponse.json({ ok: true, by: (sids === null || sids === void 0 ? void 0 : sids.length) ? 'sid' : (shopId ? 'shopId' : (shopName ? 'shopName' : 'default')), shop: matchedName ? { name: matchedName, sid: sids === null || sids === void 0 ? void 0 : sids[0] } : undefined, total: hinted, approx: false, source: 'metadata' });
        }
        // Fallback: paginate with a time cap
        const byStatus = {};
        let total = 0;
        const t0 = Date.now();
        let token = '';
        // pull pages via the vendor pagination mechanics using token/nextToken heuristic
        while (true) {
            const qp = new URLSearchParams();
            qp.set('size', String(size));
            if (sids && sids.length)
                qp.set('sids', sids.join(','));
            // Do NOT include Prisma shopId as vendor filter; auth already scopes to shop when needed
            if (token)
                qp.set('token', token);
            const page = await (0, jumia_1.jumiaFetch)(`/catalog/products?${qp.toString()}`, shopAuth ? { shopAuth } : {});
            const arr = Array.isArray(page === null || page === void 0 ? void 0 : page.products) ? page.products : Array.isArray(page === null || page === void 0 ? void 0 : page.items) ? page.items : Array.isArray(page === null || page === void 0 ? void 0 : page.data) ? page.data : [];
            for (const it of arr) {
                total += 1;
                const st = String((it === null || it === void 0 ? void 0 : it.status) || (it === null || it === void 0 ? void 0 : it.itemStatus) || 'unknown').toLowerCase();
                byStatus[st] = (byStatus[st] || 0) + 1;
            }
            token = String((page === null || page === void 0 ? void 0 : page.nextToken) || (page === null || page === void 0 ? void 0 : page.token) || (page === null || page === void 0 ? void 0 : page.next) || '');
            if (!token || Date.now() - t0 > timeMs)
                break;
        }
        const approx = Date.now() - t0 > timeMs;
        return server_1.NextResponse.json({ ok: true, by: (sids === null || sids === void 0 ? void 0 : sids.length) ? 'sid' : (shopId ? 'shopId' : (shopName ? 'shopName' : 'default')), shop: matchedName ? { name: matchedName, sid: sids === null || sids === void 0 ? void 0 : sids[0] } : undefined, total, approx, byStatus, source: 'scan' });
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return server_1.NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}
