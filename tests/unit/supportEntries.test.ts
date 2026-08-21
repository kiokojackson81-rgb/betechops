import { jest } from "@jest/globals";

jest.mock("server-only", () => ({}), { virtual: true });

import { prisma } from "@/lib/prisma";
import { getSupportPeriodAggregates } from "@/lib/supportEntries";

const period = {
  start: new Date("2026-07-25T00:00:00.000Z"),
  end: new Date("2026-08-24T23:59:59.999Z"),
} as any;

afterEach(() => {
  jest.restoreAllMocks();
});

test("uses a complete support receipt instead of its item-level pricing rows", async () => {
  jest.spyOn(prisma.receipt, "findMany" as any).mockResolvedValue([] as any);
  jest.spyOn(prisma.supportReceipt, "findMany" as any).mockResolvedValue([
    { receiptNumber: "BETECH-100", receiptKey: null },
  ] as any);
  jest.spyOn(prisma.supportDailyEntry, "findMany" as any).mockResolvedValue([
    {
      id: "entry-1",
      date: new Date("2026-08-01T10:00:00.000Z"),
      newBatteries: 0,
      changedBatteries: 0,
      receipts: [
        {
          id: "receipt-1",
          receiptNumber: "BETECH-100",
          receiptKey: null,
          sellingTotal: 10_000,
          buyingTotal: 7_000,
          paymentMethod: "MPESA",
          items: [{ id: "item-1", buyingPrice: 7_000 }],
        },
      ],
      sales: [
        {
          id: "sale-1",
          receiptNumber: "BETECH-100",
          sellingPrice: 4_000,
          buyingPrice: 3_000,
          itemsCount: 1,
          paymentMethod: "MPESA",
        },
      ],
    },
  ] as any);

  const { aggregates } = await getSupportPeriodAggregates({ userId: "support-1", period });

  expect(aggregates).toMatchObject({
    totalSales: 10_000,
    totalProfit: 3_000,
    totalReceipts: 1,
    totalItems: 1,
  });
});

test("does not let a loss-making receipt reduce commissionable profit", async () => {
  jest.spyOn(prisma.receipt, "findMany" as any).mockResolvedValue([] as any);
  jest.spyOn(prisma.supportDailyEntry, "findMany" as any).mockResolvedValue([
    {
      id: "entry-1",
      date: new Date("2026-08-01T10:00:00.000Z"),
      newBatteries: 0,
      changedBatteries: 0,
      receipts: [
        {
          id: "receipt-1",
          receiptNumber: "BETECH-LOSS",
          receiptKey: null,
          sellingTotal: 5_000,
          buyingTotal: 6_000,
          paymentMethod: "CASH",
          items: [{ id: "item-1", buyingPrice: 6_000 }],
        },
      ],
      sales: [],
    },
  ] as any);

  const { aggregates } = await getSupportPeriodAggregates({ userId: "support-1", period });

  expect(aggregates.totalProfit).toBe(0);
});
