"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const secure_json_1 = require("../src/lib/crypto/secure-json");
const prisma = new client_1.PrismaClient();
async function mintAccessToken(tokenUrl, clientId, refreshToken) {
    const body = new URLSearchParams({ client_id: clientId, grant_type: "refresh_token", refresh_token: refreshToken });
    const r = await fetch(tokenUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
    if (!r.ok)
        throw new Error(`token exchange failed: ${r.status} ${await r.text().catch(() => "")}`);
    const j = (await r.json());
    if (!j.access_token)
        throw new Error("no access_token in response");
    return j.access_token;
}
async function pingJumiaShop(name) {
    var _a, _b, _c, _d, _e, _f;
    const shop = await prisma.shop.findFirst({ where: { name }, select: { id: true, name: true, credentialsEncrypted: true } });
    if (!shop)
        throw new Error(`shop not found: ${name}`);
    const creds = (0, secure_json_1.decryptJson)(shop.credentialsEncrypted);
    const apiBase = (creds === null || creds === void 0 ? void 0 : creds.apiBase) || (creds === null || creds === void 0 ? void 0 : creds.base_url) || "https://vendor-api.jumia.com";
    const tokenUrl = (creds === null || creds === void 0 ? void 0 : creds.tokenUrl) || "https://vendor-api.jumia.com/token";
    const clientId = String((creds === null || creds === void 0 ? void 0 : creds.clientId) || "");
    const refreshToken = String((creds === null || creds === void 0 ? void 0 : creds.refreshToken) || "");
    if (!clientId || !refreshToken)
        throw new Error("missing clientId/refreshToken");
    const accessToken = await mintAccessToken(tokenUrl, clientId, refreshToken);
    const today = new Date();
    const from = new Date(today.getTime() - 24 * 3600 * 1000).toISOString().slice(0, 10);
    const to = today.toISOString().slice(0, 10);
    const url = `${apiBase.replace(/\/+$/, '')}/orders?createdAfter=${from}&createdBefore=${to}&size=1`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
    const text = await r.text().catch(() => "");
    const ct = r.headers.get("content-type") || "";
    let parsed = null;
    if (ct.includes("json")) {
        try {
            parsed = JSON.parse(text);
        }
        catch (_g) { }
    }
    const count = Array.isArray(parsed === null || parsed === void 0 ? void 0 : parsed.orders) ? parsed.orders.length : Array.isArray(parsed === null || parsed === void 0 ? void 0 : parsed.items) ? parsed.items.length : Array.isArray(parsed === null || parsed === void 0 ? void 0 : parsed.data) ? parsed.data.length : 0;
    return { id: shop.id, name: shop.name, httpStatus: r.status, count, sampleId: count > 0 ? (((_b = (_a = parsed.orders) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.id) || ((_d = (_c = parsed.items) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.id) || ((_f = (_e = parsed.data) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.id)) : null };
}
async function main() {
    // Accept names as CLI args: node ping-jumia.ts "Shop A" "Shop B" ...
    const argv = process.argv.slice(2).filter(Boolean);
    const targets = argv.length ? argv : [
        "Betech store",
        "LabTech Kenya",
        "Hitech Power",
        "Sky Store Ke",
        "Maxton Enterprise",
        "JUDE COLLECTIONS",
        "Betech Solar Solution",
    ];
    const out = [];
    for (const t of targets) {
        try {
            out.push(await pingJumiaShop(t));
        }
        catch (e) {
            out.push({ name: t, error: String(e instanceof Error ? e.message : e) });
        }
    }
    console.log(JSON.stringify({ ok: true, results: out }, null, 2));
}
main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect().finally(() => process.exit(1)); });
