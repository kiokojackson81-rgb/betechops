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
// @ts-nocheck
const globals_1 = require("@jest/globals");
// Mock dependencies used by getEarningsSummaryForUser
globals_1.jest.unstable_mockModule('@/lib/prisma', () => ({
    prisma: {
        profitSnapshot: { findMany: globals_1.jest.fn().mockResolvedValue([]) },
        dailyReport: { findMany: globals_1.jest.fn().mockResolvedValue([]) },
        attendantCompPlan: { findUnique: globals_1.jest.fn().mockResolvedValue(null) },
        attendantPayrollAdjustment: { findMany: globals_1.jest.fn().mockResolvedValue([]) },
        commissionLedger: { findUnique: globals_1.jest.fn().mockResolvedValue(null) },
        $queryRaw: globals_1.jest.fn().mockResolvedValue([]),
    },
}));
globals_1.jest.unstable_mockModule('@/lib/marketingPeriodTotals', () => ({
    summarizeMarketingReportsForPeriod: globals_1.jest.fn().mockResolvedValue({ totals: { totalSales: 0, totalProfit: 0, totalReceipts: 0, totalItems: 0, paymentStats: { totalSalesMpesa: 0, totalSalesCash: 0, countMpesaReceipts: 0, countCashReceipts: 0 } }, entryCount: 0, perReceipts: {} }),
}));
globals_1.jest.unstable_mockModule('@/lib/supportEntries', () => ({
    getSupportPeriodAggregates: globals_1.jest.fn().mockResolvedValue({ aggregates: {}, perReceipts: {} }),
}));
globals_1.jest.unstable_mockModule('@/lib/commission', () => ({
    getOrCreateCommissionPeriod: globals_1.jest.fn().mockResolvedValue({ period: { id: 'p' }, tiers: [], tradingPeriod: { start: new Date('2025-12-25T00:00:00Z'), end: new Date('2026-01-24T23:59:59.999Z'), key: '2025-12-24_2026-01-24' } }),
    computeSalesCommissionFromTiers: globals_1.jest.fn().mockReturnValue(0),
    computeProductCommissions: globals_1.jest.fn().mockReturnValue({ newProductCommission: 0, copiedCommission: 0, editedCommission: 0 }),
}));
const { getEarningsSummaryForUser } = await Promise.resolve().then(() => __importStar(require('../earningsSummary')));
const { prisma } = await Promise.resolve().then(() => __importStar(require('@/lib/prisma')));
describe('earningsSummary ledger lookup', () => {
    test('picks up ledger via detail.marketing.periodKey fallback', async () => {
        // Arrange: make $queryRaw return a ledger row with grossCommission
        const ledgerRow = [{ id: 'L1', grossCommission: '1380', netCommission: '1380', penalties: '0', detail: { marketing: { periodKey: '2025-12-24_2026-01-24', commission: 1380 } } }];
        prisma.$queryRaw.mockResolvedValueOnce(ledgerRow);
        // Act
        const summary = await getEarningsSummaryForUser({ userId: 'cmimxqfgo0004v5mc5pn1r486', asOf: new Date('2025-12-30T00:00:00Z') });
        // Assert
        expect(summary.commission).toBe(1380);
        expect(summary.ledger).not.toBeNull();
        expect(summary.ledger.grossCommission).toBe(1380);
    });
});
