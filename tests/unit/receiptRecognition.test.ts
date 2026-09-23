jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("@/lib/prisma", () => ({ prisma: {
  receipt: { findMany: jest.fn() }, supportReceipt: { findMany: jest.fn() }, supportSale: { findMany: jest.fn() }, productCost: { findMany: jest.fn() }, commissionEarning: { findMany: jest.fn() },
} }));
import { prisma } from "@/lib/prisma";
import { getReceiptRecognitionDate } from "@/lib/receiptRecognition";
import { computeAdminReceiptSummary } from "@/lib/adminReceiptsSummary";
import { summarizePosReceiptsForPeriod } from "@/lib/posReceiptSummary";
import { getReleasedPosProductCommissionForStaffPeriod } from "@/lib/posProductCommission";
import { ledgerEntriesForRecognitionPeriod } from "@/lib/ledgerRecognition";
const yesterday = new Date("2026-09-21T10:00:00+03:00");
const today = new Date("2026-09-22T10:00:00+03:00");
const tomorrow = new Date("2026-09-23T10:00:00+03:00");
const range = (day: string) => ({ start: new Date(`${day}T00:00:00+03:00`), end: new Date(`${day}T23:59:59.999+03:00`) });
let receipt: any;
beforeEach(() => {
  jest.clearAllMocks();
  receipt = { id: "r", receiptNumber: "Betech-20260921-1", createdAt: yesterday, generatedAt: yesterday, totals: { total: 10000, buyingTotal: 6000, buyingPriceMode: "TOTAL" }, data: { paymentMethod: "MPESA", buyingPriceUpdatedAt: today.toISOString() }, order: { orderNumber: "Betech-20260921-1", attendantId: "staff", paymentStatus: "PAID", status: "COMPLETED", totalAmount: 10000, items: [{ quantity: 1, sellingPrice: 10000, orderCosts: [{ unitCost: 6000, createdAt: today }], product: {} }] } };
  (prisma.receipt.findMany as jest.Mock).mockImplementation(async () => [receipt]);
  (prisma.supportReceipt.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.supportSale.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.productCost.findMany as jest.Mock).mockResolvedValue([]);
});
test("ordinary sale and profit both move from creation day to pricing day in admin and staff reports", async () => {
  for (const summarize of [computeAdminReceiptSummary, summarizePosReceiptsForPeriod]) {
    const old = await summarize({ ...range("2026-09-21"), onlyPos: true, scope: "global" } as any);
    expect(old.totalSales).toBe(0); expect(old.totalProfit).toBe(0);
    const current = await summarize({ ...range("2026-09-22"), onlyPos: true, scope: "global" } as any);
    expect(current.totalSales).toBe(10000); expect(current.totalProfit).toBe(4000);
  }
});
test("POD financials stay on delivery day even if costs are entered the following day", async () => {
  receipt.data = { buyingPriceUpdatedAt: tomorrow.toISOString(), podDelivery: { status: "delivered", deliveredAt: today.toISOString() } };
  for (const day of ["2026-09-21", "2026-09-22", "2026-09-23"]) {
    const summary = await computeAdminReceiptSummary({ ...range(day), onlyPos: true, scope: "global" });
    expect(summary.totalSales).toBe(day === "2026-09-22" ? 10000 : 0);
    expect(summary.totalProfit).toBe(day === "2026-09-22" ? 4000 : 0);
  }
});
test.each(["pending", "delivery_failed"])("POD %s never recognizes a financial sale", status => {
  receipt.data.podDelivery = { status, deliveredAt: today.toISOString() };
  expect(getReceiptRecognitionDate(receipt)).toBeNull();
});
test("incomplete ordinary pricing never manufactures a sale", () => {
  receipt.totals = { total: 10000 };
  receipt.order.items[0].orderCosts = [];
  expect(getReceiptRecognitionDate(receipt)).toBeNull();
});
test("a correction does not move an already recognized receipt to another day", () => {
  receipt.data.financialRecognitionAt = today.toISOString();
  receipt.data.buyingPriceUpdatedAt = tomorrow.toISOString();
  expect(getReceiptRecognitionDate(receipt)).toEqual(today);
});
test("released product commission belongs to the receipt recognition day, not later approval day", async () => {
  (prisma.commissionEarning.findMany as jest.Mock).mockResolvedValue([{ amount: 200, basis: "product_flat", createdAt: yesterday, calcDetail: { approvedAt: tomorrow.toISOString() }, orderItem: { order: { receipt } } }]);
  expect(await getReleasedPosProductCommissionForStaffPeriod("staff", range("2026-09-22").start, range("2026-09-22").end)).toBe(200);
  expect(await getReleasedPosProductCommissionForStaffPeriod("staff", range("2026-09-23").start, range("2026-09-23").end)).toBe(0);
});
test("historical daily ledger rows follow the linked POS date without rewriting source records", async () => {
  const entries = [{ id: "entry", date: yesterday, receipts: [{ receiptNumber: receipt.receiptNumber, sellingTotal: 10000, buyingTotal: 6000 }], sales: [] }];
  expect(await ledgerEntriesForRecognitionPeriod(entries, range("2026-09-21").start, range("2026-09-21").end, prisma)).toEqual([]);
  const recognized = await ledgerEntriesForRecognitionPeriod(entries, range("2026-09-22").start, range("2026-09-22").end, prisma);
  expect(recognized[0]).toMatchObject({ date: today, totalSales: 10000, totalProfit: 4000 });
  expect(entries[0].date).toEqual(yesterday);
});
test("historical support pricing dates are resolved from dated receipt keys", async () => {
  delete receipt.data.buyingPriceUpdatedAt;
  receipt.totals = { total: 10000 };
  receipt.order.items = [];
  (prisma.supportReceipt.findMany as jest.Mock).mockResolvedValue([{ receiptKey: "2026-09-22:BETECH202609211", buyingTotal: 6000, items: [{ buyingPrice: 6000, pricedAt: today }] }]);
  const summary = await computeAdminReceiptSummary({ ...range("2026-09-22"), onlyPos: true, scope: "global" });
  expect(summary.totalSales).toBe(10000); expect(summary.totalProfit).toBe(4000);
});

test("projects need completion and pricing; whichever happens later determines recognition", () => {
  receipt.data.projectFlow = { isProject: true, stage: "COMPLETED_POSTED", projectValue: 10000, totalPaidAmount: 10000, completedAt: yesterday.toISOString() };
  expect(getReceiptRecognitionDate(receipt)).toEqual(today);
  receipt.data.projectFlow.completedAt = tomorrow.toISOString();
  expect(getReceiptRecognitionDate(receipt)).toEqual(tomorrow);
  receipt.data.projectFlow.stage = "PROJECT_INSTALLED";
  expect(getReceiptRecognitionDate(receipt)).toBeNull();
});

 test("refunds override stale paid project and POD markers", async () => {
  receipt.order.paidAmount = 5000;
  receipt.data.podDelivery = { status: "delivered", deliveredAt: today.toISOString(), paidAt: today.toISOString() };
  expect(getReceiptRecognitionDate(receipt)).toBeNull();
  for (const summarize of [computeAdminReceiptSummary, summarizePosReceiptsForPeriod]) {
    const result = await summarize({ ...range("2026-09-22"), onlyPos: true } as any);
    expect(result.totalSales).toBe(0); expect(result.totalProfit).toBe(0);
  }
  (prisma.commissionEarning.findMany as jest.Mock).mockResolvedValue([{ amount: 200, basis: "product_flat", orderItem: { order: { receipt } } }]);
  expect(await getReleasedPosProductCommissionForStaffPeriod("staff", range("2026-09-22").start, range("2026-09-22").end)).toBe(0);
});
 test("a fully paid mixed receipt with an unpriced line is visible but not commission eligible", async () => {
  receipt.totals = { total: 25000, buyingTotal: 15550, needsPricing: false };
  receipt.order.totalAmount = receipt.order.paidAmount = 25000;
  receipt.order.items = [{ quantity: 2, sellingPrice: 1500, orderCosts: [], product: {} }, { quantity: 1, sellingPrice: 22000, orderCosts: [{ unitCost: 15550, createdAt: today }] }];
  (prisma.supportReceipt.findMany as jest.Mock).mockResolvedValue([{ receiptNumber: receipt.receiptNumber, buyingTotal: 15550, items: [{ buyingPrice: 0 }, { buyingPrice: 15550 }] }]);
  const result = await summarizePosReceiptsForPeriod(range("2026-09-22"));
  expect(result.totalSales).toBe(0);
  // Created yesterday: visible in the full trading period audit, not falsely recognized today.
  const period = await summarizePosReceiptsForPeriod({ start: yesterday, end: tomorrow });
  expect(period.receiptBreakdown[0]).toMatchObject({ sales: 25000, eligibleSales: 0, reason: "Awaiting complete buying prices" });
});
 test("profit is recomputed from costs rather than stale persisted profit", async () => {
  receipt.totals = { total: 10000, profit: 9999 };
  const result = await summarizePosReceiptsForPeriod(range("2026-09-22"));
  expect(result.totalProfit).toBe(4000);
  receipt.order.items[0].orderCosts[0].unitCost = 11000;
  expect((await summarizePosReceiptsForPeriod(range("2026-09-22"))).totalProfit).toBe(-1000);
});
 test("POD support pricing deducts delivery costs once and canonical aliases do not duplicate profit", async () => {
  receipt.totals = { total: 10000 };
  receipt.data.podDelivery = { status: "delivered", deliveredAt: today.toISOString(), deliveryFee: 500 };
  (prisma.supportReceipt.findMany as jest.Mock).mockResolvedValue([{ receiptNumber: receipt.receiptNumber, receiptKey: "2026-09-22:BETECH202609211", sellingTotal: 10000, buyingTotal: 6000, items: [{ buyingPrice: 6000, pricedAt: today }] }]);
  for (const summarize of [computeAdminReceiptSummary, summarizePosReceiptsForPeriod]) {
    const result = await summarize({ ...range("2026-09-22"), onlyPos: true } as any);
    expect(result.totalProfit).toBe(3500); expect(result.totalSales).toBe(10000);
  }
});
