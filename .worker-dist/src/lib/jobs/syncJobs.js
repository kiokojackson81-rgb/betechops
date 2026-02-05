"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncOrdersJob = syncOrdersJob;
exports.syncPayoutsJob = syncPayoutsJob;
exports.returnsSlaJob = returnsSlaJob;
exports.commissionCalcJob = commissionCalcJob;
exports.priceLearnerJob = priceLearnerJob;
exports.onlineOpsSyncJob = onlineOpsSyncJob;
const prisma_1 = require("@/lib/prisma");
const jumia_1 = require("@/lib/jumia");
const kilimall_1 = require("@/lib/connectors/kilimall");
const secure_json_1 = require("@/lib/crypto/secure-json");
const onlineSync_1 = require("@/lib/jobs/onlineSync");
const tradingPeriod_1 = require("@/lib/tradingPeriod");
const weeklySales_1 = require("@/lib/weeklySales");
const client_1 = require("@prisma/client");
async function syncOrdersJob() {
    const shops = await prisma_1.prisma.shop.findMany();
    const results = {};
    const errMessage = (e) => (e instanceof Error ? e.message : String(e));
    for (const s of shops) {
        try {
            if (s.platform === 'JUMIA') {
                if (s.disableAutoSync) {
                    results[s.id] = { skipped: true };
                    continue;
                }
                const orders = await (0, jumia_1.fetchOrdersForShop)(s.id);
                results[s.id] = { count: orders.length };
            }
            else if (s.platform === 'KILIMALL') {
                // Kilimall shops are tracked manually and never auto-synced.
                results[s.id] = { skipped: true };
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
    const marketplaceOverdue = await prisma_1.prisma.marketplaceReturn.findMany({
        where: { status: 'WAITING_AT_HUB', dueAt: { lt: now }, attendantId: { not: null } },
    });
    const period = (0, tradingPeriod_1.getTradingPeriodFor)(now);
    for (const entry of marketplaceOverdue) {
        await prisma_1.prisma.marketplaceReturn.update({
            where: { id: entry.id },
            data: { status: 'CHARGED_TO_ATTENDANT' },
        });
        if (entry.attendantId) {
            await prisma_1.prisma.attendantPayrollAdjustment.create({
                data: {
                    attendantId: entry.attendantId,
                    periodKey: period.key,
                    periodLabel: period.label,
                    adjustmentType: 'DISCIPLINE',
                    label: `Return not picked (${entry.orderItemId})`,
                    amount: Math.round(Number(entry.expectedAmount ?? 0)),
                    adjustmentKind: 'DEDUCTION',
                    createdById: entry.attendantId,
                },
            });
        }
    }
    return { processed: overdue.length, marketplaceProcessed: marketplaceOverdue.length };
}
async function commissionCalcJob() {
    const period = (0, tradingPeriod_1.getTradingPeriodFor)(new Date());
    const distinctUsers = await prisma_1.prisma.weeklySale.findMany({
        where: {
            userId: { not: null },
            status: client_1.WeeklySaleStatus.APPROVED,
            AND: [{ weekEnd: { gte: period.start } }, { weekStart: { lte: period.end } }],
        },
        select: { userId: true },
        distinct: ['userId'],
    });
    const processed = [];
    const errors = [];
    for (const entry of distinctUsers) {
        const uid = entry.userId;
        if (!uid)
            continue;
        try {
            const result = await (0, weeklySales_1.recomputeWeeklySalesCommission)({ userId: uid, period });
            processed.push({ userId: uid, payout: result.payout, totalSales: result.totalSales, updated: result.updated });
        }
        catch (err) {
            errors.push({ userId: uid, error: err instanceof Error ? err.message : String(err) });
        }
    }
    return {
        period: period.key,
        processed: processed.length,
        results: processed,
        errors,
    };
}
async function priceLearnerJob() {
    // placeholder: look for product cost patterns and mark LEARNED prices
    return { ok: true };
}
async function onlineOpsSyncJob() {
    await (0, onlineSync_1.syncOnlineMarketplaceData)();
    return { ok: true };
}
