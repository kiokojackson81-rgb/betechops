jest.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: jest.fn() }, attendantPayrollAdjustment: { findMany: jest.fn() } } }));
jest.mock("@/lib/posReceiptSummary", () => ({ summarizePosReceiptsForPeriod: jest.fn() }));
jest.mock("@/lib/posProductCommission", () => ({ getReleasedPosProductCommissionForStaffPeriod: jest.fn() }));
jest.mock("@/lib/marketingPeriodTotals", () => ({ summarizeMarketingReportsForPeriod: jest.fn() }));
jest.mock("@/lib/onlineOps", () => ({ getAssignedMarketplaceSalesForPeriod: jest.fn() }));
jest.mock("@/lib/userCommissionConfig", () => ({ getUserCommissionConfigLike: jest.fn() }));
jest.mock("@/lib/commission", () => ({ ...jest.requireActual("@/lib/commission"), getOrCreateCommissionPeriod: jest.fn() }));
import { prisma } from "@/lib/prisma";
import { getAttendantCommissionSummary } from "@/lib/attendantCommission";
import { summarizePosReceiptsForPeriod } from "@/lib/posReceiptSummary";
import { getReleasedPosProductCommissionForStaffPeriod } from "@/lib/posProductCommission";
import { summarizeMarketingReportsForPeriod } from "@/lib/marketingPeriodTotals";
import { getAssignedMarketplaceSalesForPeriod } from "@/lib/onlineOps";
import { getUserCommissionConfigLike } from "@/lib/userCommissionConfig";
import { getOrCreateCommissionPeriod } from "@/lib/commission";
const args = { attendantId: "staff", start: new Date("2026-08-25T00:00:00+03:00"), end: new Date("2026-09-24T23:59:59.999+03:00") };
beforeEach(() => {
  jest.clearAllMocks();
  (prisma.user.findUnique as jest.Mock).mockResolvedValue({ email: "brendah@betech.co.ke" });
  (prisma.attendantPayrollAdjustment.findMany as jest.Mock).mockResolvedValue([]);
  (getUserCommissionConfigLike as jest.Mock).mockResolvedValue({ salesCommissionMode: "POS_PROFIT_10", posTotalsMode: "USER" });
  (getReleasedPosProductCommissionForStaffPeriod as jest.Mock).mockResolvedValue(200);
  (getOrCreateCommissionPeriod as jest.Mock).mockResolvedValue({ tiers: [{ minSales: 500000, maxSales: 1000000, payoutFlat: 10000 }] });
  (summarizeMarketingReportsForPeriod as jest.Mock).mockResolvedValue({ totals: { totalNewProducts: 0, totalCopiedProducts: 0, totalEditedProducts: 0 } });
  (getAssignedMarketplaceSalesForPeriod as jest.Mock).mockResolvedValue({ totals: { jumiaSales: 0, kilimallSales: 0 } });
  (summarizePosReceiptsForPeriod as jest.Mock).mockResolvedValue({ totalSales: 10000, totalProfit: 3000, recordedSales: 15000, totalItems: 2, totalReceipts: 2, receiptBreakdown: [
    { receiptId: "a", eligible: true, eligibleSales: 6000, sales: 6000, profit: 2000, salesDate: new Date("2026-09-01"), createdAt: new Date("2026-09-01") },
    { receiptId: "b", eligible: true, eligibleSales: 4000, sales: 4000, profit: 1000, salesDate: new Date("2026-09-02"), createdAt: new Date("2026-09-02") },
    { receiptId: "pending", eligible: false, eligibleSales: 0, sales: 5000, profit: 0, createdAt: new Date("2026-09-03") },
  ] });
});
test("configured rate takes precedence over email and released product commission is added exactly once", async () => {
  const result = await getAttendantCommissionSummary(args);
  expect(result.directSalesCommission).toBe(300);
  expect(result.totalCommission).toBe(500);
  expect(result.receiptBreakdown.map(row => row.commission)).toEqual([200, 100, 0]);
  expect(result.receiptBreakdown.reduce((sum, row) => sum + row.commission!, 0)).toBe(result.directSalesCommission);
  expect(result.recordedSales).toBe(15000);
  expect(result.commissionEligibleSales).toBe(10000);
});
test("signed adjustments are applied once and legacy period keys remain searchable", async () => {
  (prisma.attendantPayrollAdjustment.findMany as jest.Mock).mockResolvedValue([
    { amount: 80, adjustmentType: "COMMISSION_TOPUP", adjustmentKind: "ADDITION" },
    { amount: 30, adjustmentType: "COMMISSION_TOPUP", adjustmentKind: "DEDUCTION" },
  ]);
  const result = await getAttendantCommissionSummary(args);
  expect(result.totalCommission).toBe(550);
  expect((prisma.attendantPayrollAdjustment.findMany as jest.Mock).mock.calls[0][0].where.periodKey.in).toContain("2026-08-25T00:00:00.000Z_2026-09-24T23:59:59.999Z");
});
test("Jeniffer prorated mode does not receive an unconfigured profit fallback", async () => {
  (getUserCommissionConfigLike as jest.Mock).mockResolvedValue({ salesCommissionMode: "JENIFFER_PRORATED" });
  const result = await getAttendantCommissionSummary(args);
  expect(result.directSalesCommission).toBe(0);
  expect(result.totalCommission).toBe(200);
});
