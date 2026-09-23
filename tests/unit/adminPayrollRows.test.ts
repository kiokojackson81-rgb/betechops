jest.mock("@/lib/prisma", () => ({ prisma: {} }));
jest.mock("@/lib/earningsSummary", () => ({ getEarningsSummaryForUser: jest.fn() }));
jest.mock("@/lib/onlineOps", () => ({ getOnlineEarningsSummary: jest.fn() }));
jest.mock("@/lib/posReceiptSummary", () => ({ summarizePosReceiptsForPeriod: jest.fn() }));
jest.mock("@/lib/adminReceiptsSummary", () => ({ computeAdminReceiptSummary: jest.fn() }));
jest.mock("@/lib/commission", () => ({ computeSalesCommissionFromTiers: jest.fn(), computeJenifferProratedCommission: jest.fn(), getOrCreateCommissionPeriod: jest.fn() }));
jest.mock("@/lib/userCommissionConfig", () => ({ getUserCommissionConfigLike: jest.fn() }));
jest.mock("@/lib/payrollAdjustmentStorage", () => ({ ensurePayrollAdjustmentStorage: jest.fn() }));
jest.mock("@/lib/posProductCommission", () => ({ getReleasedPosProductCommissionForStaffPeriod: jest.fn() }));
jest.mock("@/lib/technicalCompensation", () => ({ getTechnicalProjectCommissionSummary: jest.fn(), TECHNICAL_POS_PROFIT_COMMISSION_RATE: 0.1 }));
test("admin payroll module exports shared multi-period builder", async () => {
  const payroll = await import("@/lib/adminPayroll");
  expect(typeof payroll.buildPayrollRows).toBe("function");
});
