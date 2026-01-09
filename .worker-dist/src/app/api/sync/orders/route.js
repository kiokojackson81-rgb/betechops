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
exports.POST = POST;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const api_1 = require("@/lib/api");
const jumia_1 = require("@/lib/jumia");
const kilimall_1 = require("@/lib/connectors/kilimall");
const secure_json_1 = require("@/lib/crypto/secure-json");
async function POST(request) {
    const auth = await (0, api_1.requireRole)('ADMIN');
    if (!auth.ok)
        return auth.res;
    const url = new URL(request.url);
    const simulate = url.searchParams.get('simulate') === 'true';
    const shops = await prisma_1.prisma.shop.findMany();
    if (simulate) {
        return server_1.NextResponse.json({ shops: shops.map((s) => ({ id: s.id, name: s.name, platform: s.platform, hasCredentials: Boolean(s.credentialsEncrypted) })) });
    }
    const results = {};
    const errMessage = (e) => (e instanceof Error ? e.message : String(e));
    const { upsertNormalizedOrder } = await Promise.resolve().then(() => __importStar(require('@/lib/sync/upsertOrder')));
    for (const s of shops) {
        try {
            if (s.platform === 'JUMIA') {
                const orders = await (0, jumia_1.fetchOrdersForShop)(s.id);
                const saved = [];
                for (const o of orders) {
                    const r = await upsertNormalizedOrder(o).catch((e) => ({ error: errMessage(e) }));
                    saved.push(r);
                }
                results[s.id] = { count: orders.length, savedCount: saved.filter(x => !(x?.error)).length };
            }
            else if (s.platform === 'KILIMALL') {
                if (s.credentialsEncrypted) {
                    const creds = (0, secure_json_1.decryptJson)(s.credentialsEncrypted);
                    const credObj = creds;
                    const items = (await (0, kilimall_1.fetchOrders)({ appId: credObj?.storeId || credObj?.appId, appSecret: credObj?.appSecret || credObj?.app_secret, apiBase: credObj?.apiBase }, { since: undefined }));
                    const saved = [];
                    for (const o of items) {
                        const norm = (await Promise.resolve().then(() => __importStar(require('@/lib/connectors/normalize')))).normalizeFromKilimall(o, s.id);
                        const r = await upsertNormalizedOrder(norm).catch((e) => ({ error: errMessage(e) }));
                        saved.push(r);
                    }
                    results[s.id] = { count: items.length, savedCount: saved.filter(x => !(x?.error)).length };
                }
                else {
                    results[s.id] = { error: 'no credentials' };
                }
            }
        }
        catch (e) {
            results[s.id] = { error: errMessage(e) };
        }
    }
    return server_1.NextResponse.json({ results });
}
