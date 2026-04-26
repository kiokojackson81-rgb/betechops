import { jest } from '@jest/globals';

jest.mock('@/lib/auth', () => ({
  requireAttendant: jest.fn(async () => ({ ok: true, user: { id: 'viewer-1' } })),
}));

jest.mock('@/lib/resolveTargetUser', () => ({
  resolveTargetUserId: jest.fn(async () => ({
    resolvedUserId: 'att-1',
    canImpersonate: false,
    actingAsSelf: true,
  })),
  composeIdentityResponse: jest.fn((meta: unknown, data: unknown) => ({ ...(data as object), _identity: meta })),
}));

jest.mock('@/lib/onlineOpsWeeks', () => ({
  getOnlineOpsWindowForTradingPeriod: jest.fn((period: any) => ({
    key: period.key,
    label: period.label,
    start: period.start,
    end: period.end,
  })),
}));

jest.mock('@/lib/marketplaceAccountShopResolve', () => ({
  resolveShopIdsForMarketplaceAccount: jest.fn(async () => ['shop-1']),
}));

jest.mock('@/lib/posReceiptSummary', () => ({
  summarizePosReceiptsForPeriod: jest.fn(async () => ({
    totalSales: 35_700,
    totalProfit: 0,
    totalReceipts: 3,
    totalItems: 3,
  })),
}));

jest.mock('@/lib/commission', () => ({
  getOrCreateCommissionPeriod: jest.fn(async () => ({
    period: { id: 'cp-1' },
    tiers: [
      { minSales: 1_000_000, maxSales: 2_000_000, payoutFlat: 10_000 },
      { minSales: 2_000_000, maxSales: 3_000_000, payoutFlat: 25_000 },
      { minSales: 3_000_000, maxSales: 4_000_000, payoutFlat: 45_000 },
    ],
    tradingPeriod: null,
  })),
  computeSalesCommissionFromTiers: jest.fn(),
  computeProductCommissions: jest.fn(() => ({
    newProductCommission: 0,
    copiedCommission: 0,
    editedCommission: 0,
  })),
}));

jest.mock('@/lib/prisma', () => {
  const userFindUnique = jest.fn(async () => ({
    email: 'stephen@betech.co.ke',
    attendantCategory: 'JUMIA_KILIMALL_OPS',
  }));

  return {
    prisma: {
      user: { findUnique: userFindUnique },
      marketplaceAccountAssignment: {
        findMany: jest.fn(async () => [
          {
            id: 'assign-1',
            accountId: 'acct-1',
            attendantId: 'att-1',
            role: 'OWNER',
            startsAt: new Date('2026-03-25T00:00:00.000Z'),
            endsAt: null,
            createdAt: new Date('2026-03-25T00:00:00.000Z'),
            updatedAt: new Date('2026-03-25T00:00:00.000Z'),
          },
        ]),
      },
      marketplaceAccount: {
        findMany: jest.fn(async () => [
          {
            id: 'acct-1',
            platform: 'JUMIA',
            displayName: 'Betech Store',
            countryCode: 'KE',
            currency: 'KES',
            jumiaShopSid: 'shop-1',
            kilimallShopCode: null,
            isActive: true,
          },
        ]),
      },
      weeklySale: {
        findMany: jest.fn(async () => [
          {
            shopId: 'shop-1',
            amount: 2_357_566,
            weekStart: new Date('2026-03-25T00:00:00.000Z'),
            weekEnd: new Date('2026-04-24T23:59:59.999Z'),
            platform: 'JUMIA',
            status: 'APPROVED',
          },
        ]),
      },
      attendantCompPlan: {
        findUnique: jest.fn(async () => ({
          attendantId: 'att-1',
          baseSalary: 40_000,
          defaultTransportAllowance: 0,
        })),
      },
      attendantPayrollAdjustment: {
        findMany: jest.fn(async () => [
          {
            id: 'adj-1',
            label: 'Chama',
            amount: 7_000,
            adjustmentType: 'CHAMA',
            adjustmentKind: 'DEDUCTION',
            createdAt: new Date('2026-04-20T00:00:00.000Z'),
          },
          {
            id: 'adj-2',
            label: 'Chama',
            amount: -35_000,
            adjustmentType: 'CHAMA',
            adjustmentKind: 'ADDITION',
            createdAt: new Date('2026-04-21T00:00:00.000Z'),
          },
        ]),
      },
      marketplaceReturn: { findMany: jest.fn(async () => []) },
      commissionLedger: {
        findUnique: jest.fn(async () => null),
        findFirst: jest.fn(async () => null),
      },
      receipt: {
        findMany: jest.fn(async () => [
          {
            receiptNumber: 'BETECH20260401-001',
            generatedAt: new Date('2026-04-01T10:00:00.000Z'),
            createdAt: new Date('2026-04-01T10:00:00.000Z'),
            totals: { total: 35_700 },
            data: {},
            order: {
              orderNumber: 'BETECH20260401-001',
              paymentStatus: 'PAID',
              totalAmount: 35_700,
              attendantId: 'att-1',
            },
          },
        ]),
      },
      supportReceipt: {
        findMany: jest.fn(async () => [
          {
            receiptNumber: 'BETECH20260401-001',
            receiptKey: '2026-04-01:BETECH20260401-001',
            buyingTotal: 25_630,
            items: [],
          },
        ]),
      },
      marketplaceProfitEntry: {
        findFirst: jest.fn(async () => {
          throw new Error('missing table');
        }),
      },
    },
  };
});

import { GET as getOnlineSummary } from '../../src/app/api/online/summary/route';
import { getOnlineEarningsSummary } from '@/lib/onlineOps';

describe('online archived period regression', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('online summary route keeps archived quick stats totals', async () => {
    const req = {
      url: 'http://localhost/api/online/summary?periodKey=2026-03-25_2026-04-24',
    } as Request;

    const res = await getOnlineSummary(req);
    expect((res as any).status ?? 200).toBe(200);
    const body = await (res as Response).json();

    expect(body.directReceipts.totalSales).toBe(35_700);
    expect(body.directReceipts.totalProfit).toBe(10_070);
    expect(body.marketplace.marketplaceSalesOnly).toBe(2_357_566);
    expect(body.marketplace.toNextTier).toBe(642_434);
    expect(body.totals.commission).toBe(26_007);
    expect(body.commissions.direct).toBe(1_007);
    expect(body.commissions.marketplaceCombined).toBe(25_000);
    expect(body.commissions.total).toBe(26_007);
  });

  test('online earnings summary keeps archived pay breakdown', async () => {
    const summary = await getOnlineEarningsSummary('att-1', {
      period: {
        key: '2026-03-25_2026-04-24',
        label: 'Mar 25, 2026 – Apr 24, 2026',
        start: new Date('2026-03-25T00:00:00.000Z'),
        end: new Date('2026-04-24T23:59:59.999Z'),
      },
    });

    expect(summary.directProfit).toBe(10_070);
    expect(summary.directCommission).toBe(1_007);
    expect(summary.commissionMarketplaceJumia).toBe(25_000);
    expect(summary.marketplaceSales).toBe(2_357_566);
    expect(summary.commissionTotal).toBe(26_007);
    expect(summary.netPay).toBe(94_007);
    expect(summary.adjustmentEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Chama', amount: 7_000, adjustmentKind: 'DEDUCTION' }),
        expect.objectContaining({ label: 'Chama', amount: -35_000, adjustmentKind: 'ADDITION' }),
      ]),
    );
  });
});
