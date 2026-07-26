jest.mock("server-only", () => ({}), { virtual: true });

jest.mock("@/lib/prisma", () => ({
  prisma: {
    receipt: { findMany: jest.fn() },
    supportReceipt: { findMany: jest.fn() },
    productCost: { findMany: jest.fn() },
    supportSale: { findMany: jest.fn() },
  },
}));

const { summarizePosReceiptsForPeriod } = require("@/lib/posReceiptSummary");
const { prisma } = require("@/lib/prisma");

describe("summarizePosReceiptsForPeriod", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.supportReceipt.findMany.mockResolvedValue([]);
    prisma.productCost.findMany.mockResolvedValue([]);
    prisma.supportSale.findMany.mockResolvedValue([]);
  });

  test("counts completed project receipts assigned via project handler staff id", async () => {
    prisma.receipt.findMany
      .mockResolvedValueOnce([
        {
          id: "receipt-1",
          createdAt: new Date("2026-07-25T09:00:00.000Z"),
          generatedAt: new Date("2026-07-25T09:00:00.000Z"),
          receiptNumber: "R-001",
          totals: { total: 250000, paymentMethod: "MPESA" },
          issuedById: "other-user",
          data: {
            customerType: "project",
            projectFlow: {
              isProject: true,
              stage: "COMPLETED_POSTED",
              paymentStatus: "FULLY_PAID",
              projectValue: 250000,
              totalPaidAmount: 250000,
              remainingAmount: 0,
              balanceAmount: 0,
              depositPendingAmount: 0,
              balancePendingAmount: 0,
              handlerStaffId: "jeniffer-id",
              updatedAt: "2026-07-25T13:36:00.000Z",
            },
          },
          order: {
            orderNumber: "R-001",
            totalAmount: 250000,
            attendantId: "different-attendant",
            paymentStatus: "PAID",
            items: [{ quantity: 1, orderCosts: [], profitSnapshots: [], product: null }],
          },
        },
      ])
      .mockResolvedValueOnce([]);

    const summary = await summarizePosReceiptsForPeriod({
      start: new Date("2026-07-25T00:00:00.000Z"),
      end: new Date("2026-08-24T23:59:59.999Z"),
      userId: "jeniffer-id",
      ownershipMode: "staffOnly",
    });

    expect(summary.totalSales).toBe(250000);
    expect(summary.totalReceipts).toBe(1);
    expect(summary.totalItems).toBe(1);
  });
});
