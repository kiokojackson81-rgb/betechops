"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const secure_json_1 = require("../src/lib/crypto/secure-json");
const prisma = new client_1.PrismaClient();
async function kmFetch(apiBase, appId, appSecret, path, payload) {
    // This mirrors src/lib/connectors/kilimall.ts signing
    const ts = Date.now();
    const body = JSON.stringify(payload !== null && payload !== void 0 ? payload : {});
    const s = await (await Promise.resolve().then(() => __importStar(require("crypto")))).createHash("md5").update(appSecret + body + String(ts)).digest("hex");
    const r = await fetch(`${apiBase}${path}`, { method: "POST", headers: { "Content-Type": "application/json", "X-App-Id": appId, "X-Timestamp": String(ts), "X-Sign": s }, body });
    if (!r.ok)
        throw new Error(`Kilimall ${path} ${r.status} ${await r.text().catch(() => "")}`);
    return r.json();
}
async function pingKilimallShop(name) {
    var _a, _b;
    const shop = await prisma.shop.findFirst({ where: { name }, select: { id: true, name: true, credentialsEncrypted: true } });
    if (!shop)
        throw new Error(`shop not found: ${name}`);
    const creds = (0, secure_json_1.decryptJson)(shop.credentialsEncrypted);
    const appId = String((creds === null || creds === void 0 ? void 0 : creds.storeId) || (creds === null || creds === void 0 ? void 0 : creds.appId) || "");
    const appSecret = String((creds === null || creds === void 0 ? void 0 : creds.appSecret) || (creds === null || creds === void 0 ? void 0 : creds.app_secret) || "");
    const apiBase = (creds === null || creds === void 0 ? void 0 : creds.apiBase) || "https://openapi.kilimall.co.ke";
    if (!appId || !appSecret)
        throw new Error(`missing appId/appSecret for ${name}`);
    // NOTE: Path '/orders/list' is our current placeholder; if you have the official endpoint, share it and I'll update.
    const res = await kmFetch(apiBase, appId, appSecret, "/orders/list", { since: undefined }).catch((e) => { throw new Error(String(e instanceof Error ? e.message : e)); });
    const arr = Array.isArray(res === null || res === void 0 ? void 0 : res.data) ? res.data : Array.isArray(res === null || res === void 0 ? void 0 : res.orders) ? res.orders : [];
    return { id: shop.id, name: shop.name, httpStatus: 200, count: arr.length, sampleId: (_b = (_a = arr[0]) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : null };
}
async function main() {
    const argv = process.argv.slice(2).filter(Boolean);
    const targets = argv.length ? argv : [
        "Jm Collection Kilimall",
        "Hitech Power Kilimall",
        "Hitech Access Kilimall",
        "Betech Solar Solutions Kilimall",
        "Betech Kilimall",
    ];
    const out = [];
    for (const t of targets) {
        try {
            out.push(await pingKilimallShop(t));
        }
        catch (e) {
            out.push({ name: t, error: String(e instanceof Error ? e.message : e) });
        }
    }
    console.log(JSON.stringify({ ok: true, results: out }, null, 2));
}
main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect().finally(() => process.exit(1)); });
