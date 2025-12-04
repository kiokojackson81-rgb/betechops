/**
 * @jest-environment node
 */

jest.mock("@/lib/api", () => ({
  requireRole: jest.fn(),
  getActorId: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    dailyReport: {
      create: jest.fn(),
    },
    dailySale: {
      createMany: jest.fn(),
    },
  },
}));

import { POST } from "@/app/api/daily-report/route";
import { requireRole, getActorId } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const mockedRequireRole = requireRole as jest.MockedFunction<typeof requireRole>;
const mockedGetActorId = getActorId as jest.MockedFunction<typeof getActorId>;
const mockedDailyReportCreate = prisma.dailyReport.create as jest.Mock;
const mockedDailySaleCreateMany = prisma.dailySale.createMany as jest.Mock;

describe("POST /api/daily-report", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRequireRole.mockResolvedValue({ ok: true, role: "ATTENDANT", session: {} as any });
    mockedGetActorId.mockResolvedValue("user-123");
    mockedDailyReportCreate.mockResolvedValue({ id: "rep-1" });
    mockedDailySaleCreateMany.mockResolvedValue({ count: 0 });
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
});
