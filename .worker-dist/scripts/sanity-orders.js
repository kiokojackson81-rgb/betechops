"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const jumia_1 = require("../src/lib/jumia");
const kilimall_1 = require("../src/lib/connectors/kilimall");
const secure_json_1 = require("../src/lib/crypto/secure-json");
const prisma = new client_1.PrismaClient();
async function sanityShopByName(name) {
    const shop = await prisma.shop.findFirst({ where: { name }, select: { id: true, name: true, platform: true, credentialsEncrypted: true } });
    if (!shop)
        throw new Error(`shop not found: ${name}`);
    if (shop.platform === "JUMIA") {
        const items = await (0, jumia_1.fetchOrdersForShop)(shop.id).catch((e) => { throw new Error(`Jumia fetch failed for ${name}: ${String(e instanceof Error ? e.message : e)}`); });
        return { name, platform: shop.platform, count: items.length, sample: items[0] ? { id: items[0].id, status: items[0].status } : null };
    }
    if (shop.platform === "KILIMALL") {
        if (!shop.credentialsEncrypted)
            return { name, platform: shop.platform, error: "missing credentials" };
        const creds = (0, secure_json_1.decryptJson)(shop.credentialsEncrypted);
        const appId = (creds === null || creds === void 0 ? void 0 : creds.storeId) || (creds === null || creds === void 0 ? void 0 : creds.appId);
        const appSecret = (creds === null || creds === void 0 ? void 0 : creds.appSecret) || (creds === null || creds === void 0 ? void 0 : creds.app_secret);
        const apiBase = (creds === null || creds === void 0 ? void 0 : creds.apiBase) || "https://openapi.kilimall.co.ke";
        const items = await (0, kilimall_1.fetchOrders)({ appId, appSecret, apiBase }, { since: undefined }).catch((e) => { throw new Error(`Kilimall fetch failed for ${name}: ${String(e instanceof Error ? e.message : e)}`); });
        return { name, platform: shop.platform, count: items.length, sample: items[0] ? { id: items[0].id, status: items[0].status } : null };
    }
    return { name, platform: shop.platform, error: "unsupported platform" };
}
async function main() {
    const targets = [
        "Betech store", // Jumia
        "Jm Collection Kilimall", // Kilimall
    ];
    const out = [];
    for (const t of targets) {
        try {
            out.push(await sanityShopByName(t));
        }
        catch (e) {
            out.push({ name: t, error: String(e instanceof Error ? e.message : e) });
        }
    }
    console.log(JSON.stringify({ ok: true, results: out }, null, 2));
}
main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect().finally(() => process.exit(1)); });
