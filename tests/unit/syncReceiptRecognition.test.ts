jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("@/lib/prisma", () => ({ prisma: {} }));
jest.mock("@/lib/marketingReceiptCleanup", () => ({ recalcSupportEntry: jest.fn(), recalcMarketingEntry: jest.fn() }));
jest.mock("@/lib/supportCommission", () => ({ recomputeSupportCommissionLedger: jest.fn() }));
jest.mock("@/lib/marketingPeriodTotals", () => ({ recomputeMarketingCommissionLedger: jest.fn() }));
import { syncReceiptRecognition, recognitionDay } from "@/lib/syncReceiptRecognition";
import { recalcSupportEntry } from "@/lib/marketingReceiptCleanup";
const created = new Date("2026-08-24T10:00:00+03:00");
const priced = new Date("2026-08-25T00:30:00+03:00");
test("Nairobi recognition days include times before midnight UTC", () => {
  expect(recognitionDay(priced).start.toISOString()).toBe("2026-08-24T21:00:00.000Z");
  expect(recognitionDay(priced).end.toISOString()).toBe("2026-08-25T20:59:59.999Z");
});
test("pricing moves linked ledger entries and returns both periods without rewriting receipt creation", async () => {
  const support = { id: "sr", receiptNumber: "Betech-1", buyingTotal: 6000, items: [], dailyEntryId: "old", dailyEntry: { submittedById: "staff", date: created } };
  const tx: any = {
    receipt: { findUnique: jest.fn().mockResolvedValue({ id: "r", receiptNumber: "Betech-1", createdAt: created, generatedAt: created, totals: { total: 10000, buyingTotal: 6000, buyingPriceMode: "TOTAL" }, data: { buyingPriceUpdatedAt: priced.toISOString() }, order: { orderNumber: "Betech-1", items: [] } }), update: jest.fn() },
    supportReceipt: { findMany: jest.fn().mockResolvedValue([support]), update: jest.fn() },
    supportDailyEntry: { findFirst: jest.fn().mockResolvedValue({ id: "new" }) }, supportSale: { updateMany: jest.fn() },
    marketingReceipt: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const affected = await syncReceiptRecognition(tx, "r");
  expect(tx.receipt.update.mock.calls[0][0].data).toEqual({ data: { buyingPriceUpdatedAt: priced.toISOString(), financialRecognitionAt: priced.toISOString() } });
  expect(tx.supportReceipt.update).toHaveBeenCalledWith({ where: { id: "sr" }, data: { dailyEntryId: "new" } });
  expect(recalcSupportEntry).toHaveBeenCalledWith(tx, "old");
  expect(recalcSupportEntry).toHaveBeenCalledWith(tx, "new");
  expect(affected).toEqual([{ userId: "staff", date: created }, { userId: "staff", date: priced }]);
});
