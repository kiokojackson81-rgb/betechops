import { summarizeAdjustments } from "@/lib/payrollAdjustments";
import { buildEarningsCardBreakdown } from "@/lib/earningsCardBreakdown";
import { buildPayslipPayload, renderPayslipDocumentHtml } from "@/lib/payrollPayslip";
import type { PayrollRow } from "@/app/admin/payroll/types";

describe("payroll adjustment consistency", () => {
  it("includes Jeniffer's KES 22,000 addition in admin, earnings and payslip totals", () => {
    const adjustment = summarizeAdjustments([{
      id: "jeniffer-powerstations",
      label: "11 Powerstations",
      amount: 22_000,
      adjustmentType: "BONUS",
      adjustmentKind: "ADDITION",
    }]);
    const commission = 182_493.78;
    const totalEarnings = 25_000 + commission + adjustment.totalBonus;
    const row: PayrollRow = {
      attendantId: "cmimxqf9t0003v5mcjdq8x61p", name: "Jeniffer", email: "jeniffer@betech.co.ke",
      attendantCategory: "DIRECT_SALES_OPS", isActive: true, baseSalary: 25_000, transportAllowance: 0,
      commission, commissionGross: commission, commissionDirect: commission,
      commissionMarketplaceJumia: 0, commissionMarketplaceKilimall: 0, commissionTotal: commission,
      commissionBreakdown: {}, totalAdditions: adjustment.totalBonus, bonusTotal: adjustment.totalBonus, deductionTotal: 0,
      totalEarnings, totalDeductions: 0, netPay: totalEarnings, totalSales: 0, totalProfit: 0,
      totalReceipts: 0, totalItems: 0, newProducts: 0, editedProducts: 0, copiedProducts: 0,
      adjustmentBreakdown: adjustment.breakdown, adjustmentEntries: adjustment.entries,
    };

    expect(row.totalAdditions).toBe(22_000);
    expect(row.totalEarnings).toBe(229_493.78);
    expect(row.totalDeductions).toBe(0);
    expect(row.netPay).toBe(229_493.78);

    const card = buildEarningsCardBreakdown(row);
    expect(card.totalEarnings).toBe(229_493.78);
    expect(card.netPay).toBe(229_493.78);
    expect(card.lines).toContainEqual(expect.objectContaining({ label: "11 Powerstations", amount: 22_000, kind: "earning" }));

    const payslip = buildPayslipPayload({
      attendant: { id: row.attendantId, name: row.name, email: row.email, attendantCategory: row.attendantCategory, isActive: row.isActive },
      row,
      period: { key: "2026-08-25_2026-09-24", label: "25 Aug 2026 - 24 Sep 2026", start: new Date("2026-08-25"), end: new Date("2026-09-24") },
      branding: { siteTitle: "BetechOps", letterheadUrl: null, logoUrl: null, brandColor: "#7A2020" },
    });
    expect(payslip.totalEarnings).toBe(229_493.78);
    expect(payslip.netPay).toBe(229_493.78);
    expect(payslip.earningsLines).toContainEqual({ label: "11 Powerstations", amount: 22_000 });
    const pdfHtml = renderPayslipDocumentHtml({ documentTitle: "Jeniffer payslip", slips: [payslip] });
    expect(pdfHtml).toContain("11 Powerstations");
    expect(pdfHtml).toContain("KES 22,000");
    expect(pdfHtml).toContain("KES 229,494");
  });
});
