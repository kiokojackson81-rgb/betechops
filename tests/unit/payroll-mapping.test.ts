import { mapPayrollToEarningsSummary, mapPayrollToPayrollRow } from "@/lib/payrollMapping";
import { buildEarningsCardBreakdown } from "@/lib/earningsCardBreakdown";

describe("payroll mapping helpers", () => {
  test("maps minimal payroll summary to earnings summary", () => {
    const input = {
      periodLabel: "25 Nov - 24 Dec",
      salary: 20000,
      directCommission: 1000,
      marketplaceCommission: 500,
      totalCommission: 1500,
      deductions: 300,
      netPay: 21200,
    } as any;

    const out = mapPayrollToEarningsSummary(input, 5);
    expect(out).not.toBeNull();
    expect(out?.baseSalary).toBe(20000);
    expect(out?.salesCommission).toBe(1500);
    expect(out?.chamaTotal).toBe(300);
    expect(out?.totalReceipts).toBe(5);
  });

  test("maps detailed breakdown into payroll row", () => {
    const input = {
      baseSalary: 15000,
      directCommission: 800,
      marketplaceCommission: 200,
      chamaTotal: 100,
      latenessTotal: 50,
      disciplineTotal: 25,
      otherDeductionsTotal: 10,
      bonusTotal: 300,
      commissionTopUpTotal: 100,
      penalties: 0,
      netPay: 15615,
    } as any;

    const row = mapPayrollToPayrollRow(input, "user-123");
    expect(row.attendantId).toBe("user-123");
    expect(row.baseSalary).toBe(15000);
    expect(row.commission).toBe(1000); // 800 + 200
    expect(row.adjustmentBreakdown.chama).toBe(100);
    expect(row.adjustmentBreakdown.lateness).toBe(50);
    expect(row.bonusTotal).toBe(400); // bonus + commissionTopUp
  });

  test("preserves technical commission breakdown so payslip can show project commission", () => {
    const summary = mapPayrollToEarningsSummary(
      {
        attendantCategory: "TECHNICAL_TEAM",
        baseSalary: 61000,
        commissionDirect: 12000,
        commissionTotal: 14000,
        commissionBreakdown: {
          posProfitShare: 0,
          posProduct: 0,
          projectCompleted: 14000,
        },
      } as any,
      0,
    );

    expect(summary?.commissionBreakdown).toEqual({
      posProfitShare: 0,
      posProduct: 0,
      projectCompleted: 14000,
    });

    const breakdown = buildEarningsCardBreakdown(summary as any);
    expect(breakdown.lines.some((line) => line.label === "Project commission" && line.amount === 14000)).toBe(true);
  });
});
