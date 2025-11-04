"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncOrdersJob = syncOrdersJob;
exports.syncPayoutsJob = syncPayoutsJob;
exports.returnsSlaJob = returnsSlaJob;
exports.commissionCalcJob = commissionCalcJob;
exports.priceLearnerJob = priceLearnerJob;
const prisma_1 = require("@/lib/prisma");
const jumia_1 = require("@/lib/jumia");
const kilimall_1 = require("@/lib/connectors/kilimall");
const secure_json_1 = require("@/lib/crypto/secure-json");
async function syncOrdersJob() {
    const shops = await prisma_1.prisma.shop.findMany();
    const results = {};
    const errMessage = (e) => (e instanceof Error ? e.message : String(e));
    for (const s of shops) {
        try {
            if (s.platform === 'JUMIA') {
                const orders = await (0, jumia_1.fetchOrdersForShop)(s.id);
                results[s.id] = { count: orders.length };
            }
            else if (s.platform === 'KILIMALL') {
                if (s.credentialsEncrypted) {
                    const creds = (0, secure_json_1.decryptJson)(s.credentialsEncrypted);
                    const credObj = creds;
                    const items = await (0, kilimall_1.fetchOrders)({ appId: credObj?.storeId || credObj?.appId, appSecret: credObj?.appSecret || credObj?.app_secret, apiBase: credObj?.apiBase }, { since: undefined });
                    results[s.id] = { count: items.length };
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
    return results;
}
async function syncPayoutsJob(_opts) {
    const shops = await prisma_1.prisma.shop.findMany();
    const results = {};
    const errMessage = (e) => (e instanceof Error ? e.message : String(e));
    for (const s of shops) {
        try {
            if (s.platform === 'JUMIA') {
                await (0, jumia_1.fetchPayoutsForShop)(s.id, { day: _opts?.day });
                results[s.id] = { ok: true };
            }
            else if (s.platform === 'KILIMALL') {
                if (s.credentialsEncrypted) {
                    const creds = (0, secure_json_1.decryptJson)(s.credentialsEncrypted);
                    const credObj = creds;
                    await (0, kilimall_1.fetchPayouts)({ appId: credObj?.storeId || credObj?.appId, appSecret: credObj?.appSecret || credObj?.app_secret, apiBase: credObj?.apiBase }, { day: _opts?.day });
                    results[s.id] = { ok: true };
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
    return results;
}
async function returnsSlaJob() {
    // mark overdue returns and create penalty lines in CommissionLedger (minimal implementation)
    const now = new Date();
    const overdue = await prisma_1.prisma.returnCase.findMany({ where: { dueAt: { lt: now }, pickedAt: null } });
    for (const r of overdue) {
        await prisma_1.prisma.returnCase.update({ where: { id: r.id }, data: { status: 'OVERDUE' } });
        // TODO: compute penalty amount and append to CommissionLedger
    }
    return { processed: overdue.length };
}
async function commissionCalcJob() {
    // placeholder: recompute ledgers
    return { ok: true };
}
async function priceLearnerJob() {
    // placeholder: look for product cost patterns and mark LEARNED prices
    return { ok: true };
}
