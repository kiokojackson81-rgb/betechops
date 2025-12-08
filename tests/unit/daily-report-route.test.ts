/**
 * @jest-environment node
 */

jest.mock("@/lib/api", () => ({
  requireRole: jest.fn(),
  getActorId: jest.fn(),
}));

jest.mock("@/lib/prisma", () => {
  const dailyReport = {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  };
  const dailySale = {
    createMany: jest.fn(),
    deleteMany: jest.fn(),
  };
  const commissionLedger = {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  };
  const client = {
    dailyReport,
    dailySale,
    commissionLedger,
  };
  return {
    prisma: {
      ...client,
      $transaction: jest.fn(async (cb: any) => cb(client)),
    },
  };
});

jest.mock("@/lib/marketingPeriodTotals", () => ({
  recomputeMarketingCommissionLedger: jest.fn().mockResolvedValue({
    updated: true,
    commission: 0,
    totals: {
      totalSales: 0,
      totalProfit: 0,
      totalReceipts: 0,
      totalItems: 0,
      totalNewProducts: 0,
      totalEditedProducts: 0,
      totalCopiedProducts: 0,
      walkInsServed: 0,
      walkInsPurchased: 0,
      paymentStats: {
        totalSalesMpesa: 0,
        totalSalesCash: 0,
        countMpesaReceipts: 0,
        countCashReceipts: 0,
      },
    },
    period: {
      key: "period",
      label: "label",
      start: new Date(),
      end: new Date(),
    },
    ledgerId: null,
  }),
}));

import { POST } from "@/app/api/daily-report/route";
import { requireRole, getActorId } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const mockedRequireRole = requireRole as jest.MockedFunction<typeof requireRole>;
const mockedGetActorId = getActorId as jest.MockedFunction<typeof getActorId>;
const mockedDailyReportCreate = prisma.dailyReport.create as jest.Mock;
const mockedDailyReportFindFirst = prisma.dailyReport.findFirst as jest.Mock;
const mockedDailySaleCreateMany = prisma.dailySale.createMany as jest.Mock;

describe("POST /api/daily-report", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRequireRole.mockResolvedValue({ ok: true, role: "ATTENDANT", session: {} as any });
    mockedGetActorId.mockResolvedValue("user-123");
    mockedDailyReportCreate.mockResolvedValue({ id: "rep-1" });
    mockedDailySaleCreateMany.mockResolvedValue({ count: 0 });
    mockedDailyReportFindFirst.mockResolvedValue(null);
  });

  it("persists numeric metrics into dedicated columns", async () => {
    const payload = {
      date: "2025-12-01",
      day: "Monday",
      productsCount: 2,
      totalSales: 1000,
      newProducts: 5,
      productsEdited: 3,
      copiesUploaded: 4,
      walkInServed: 7,
      purchasesMade: 2,
      liveSessionsCount: 1,
      commissionEarned: 350.5,
      confirmedCompetitiveness: true,
      concerns: "Need more stock",
      marketEngagement: { communications: { repliedFbComments: true } },
      tasks: {
        sales: [],
        metrics: {
          newProducts: 5,
          productsEdited: 3,
          copiesUploaded: 4,
          walkInServed: 7,
          purchasesMade: 2,
          liveSessionsCount: 1,
          commissionEarned: 350.5,
          confirmedCompetitiveness: true,
          concerns: "Need more stock",
          marketEngagement: { communications: { repliedFbComments: true } },
        },
      },
    };

    const res = await POST(
      new Request("http://localhost/api/daily-report", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    );

    expect(res.status).toBe(201);
    expect(mockedDailySaleCreateMany).not.toHaveBeenCalled();
    expect(mockedDailyReportCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        newProducts: 5,
        productsEdited: 3,
        copiesUploaded: 4,
        walkInServed: 7,
        purchasesMade: 2,
        liveSessionsCount: 1,
        commissionEarned: 350.5,
        confirmedCompetitiveness: true,
        marketEngagement: payload.marketEngagement,
        concerns: payload.concerns,
      }),
    });
  });

  it("does not treat total sales as profit when profit is missing", async () => {
    const payload = {
      date: "2025-12-01",
      day: "Tuesday",
      productsCount: 1,
      totalSales: 2500,
      tasks: {
        sales: [],
      },
    };

    const res = await POST(
      new Request("http://localhost/api/daily-report", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    );

    expect(res.status).toBe(201);
    const lastCall = mockedDailyReportCreate.mock.calls[mockedDailyReportCreate.mock.calls.length - 1];
    const createPayload = lastCall?.[0];
    expect(createPayload?.data?.tasks?.metrics?.totalProfit).toBeUndefined();
  });
});
