"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const api_1 = require("@/lib/api");
const jumia_1 = require("@/lib/jumia");
const secure_json_1 = require("@/lib/crypto/secure-json");
const kilimall_1 = require("@/lib/connectors/kilimall");
async function POST(request) {
    const auth = await (0, api_1.requireRole)('ADMIN');
    if (!auth.ok)
        return auth.res;
    const url = new URL(request.url);
    const day = url.searchParams.get('day') || undefined;
    const shops = await prisma_1.prisma.shop.findMany();
    const results = {};
    const errMessage = (e) => (e instanceof Error ? e.message : String(e));
    for (const s of shops) {
        try {
            if (s.platform === 'JUMIA') {
                const payouts = await (0, jumia_1.fetchPayoutsForShop)(s.id, { day });
                results[s.id] = { ok: true, payoutsCount: Array.isArray(payouts) ? payouts.length : 1 };
            }
            else if (s.platform === 'KILIMALL') {
                if (s.credentialsEncrypted) {
                    const creds = (0, secure_json_1.decryptJson)(s.credentialsEncrypted);
                    const credObj = creds;
                    const j = await (0, kilimall_1.fetchPayouts)({ appId: (credObj === null || credObj === void 0 ? void 0 : credObj.storeId) || (credObj === null || credObj === void 0 ? void 0 : credObj.appId), appSecret: (credObj === null || credObj === void 0 ? void 0 : credObj.appSecret) || (credObj === null || credObj === void 0 ? void 0 : credObj.app_secret), apiBase: credObj === null || credObj === void 0 ? void 0 : credObj.apiBase }, { day });
                    results[s.id] = { ok: true, payload: j };
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
