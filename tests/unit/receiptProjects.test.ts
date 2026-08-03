import { buildReceiptSnapshot } from "@/app/receipts/buildSnapshot";
import renderReceiptTemplate from "@/app/templates/receiptTemplate";
import { readReceiptProjectFlow } from "@/lib/receiptProjects";

describe("project receipt payment normalization", () => {
  test("completed project flow is normalized to fully paid", () => {
    const flow = readReceiptProjectFlow({
      isProject: true,
      stage: "COMPLETED_POSTED",
      paymentTerm: "FULL_AFTER_INSTALLATION",
      paymentStatus: "PARTIALLY_PAID",
      projectValue: 450000,
      totalPaidAmount: 120000,
      amountPaidTotal: 120000,
      remainingAmount: 330000,
      balanceAmount: 330000,
      depositPendingAmount: 0,
      balancePendingAmount: 330000,
    });

    expect(flow).not.toBeNull();
    expect(flow?.paymentStatus).toBe("FULLY_PAID");
    expect(flow?.totalPaidAmount).toBe(450000);
    expect(flow?.remainingAmount).toBe(0);
    expect(flow?.balanceAmount).toBe(0);
  });

  test("receipt template does not show future payment instruction after full payment", () => {
    const snapshot = buildReceiptSnapshot({
      order: {
        customerName: "Muhammad",
        customerPhone: "0720387975",
      },
      data: {
        projectFlow: {
          isProject: true,
          stage: "COMPLETED_POSTED",
          paymentTerm: "FULL_AFTER_INSTALLATION",
          paymentStatus: "PARTIALLY_PAID",
          projectValue: 450000,
          totalPaidAmount: 120000,
          amountPaidTotal: 120000,
          remainingAmount: 330000,
          balanceAmount: 330000,
          depositPendingAmount: 0,
          balancePendingAmount: 330000,
        },
      },
      totals: { total: 450000 },
    });

    const html = renderReceiptTemplate(snapshot);

    expect(html).toContain("Fully paid");
    expect(html).toContain("Paid after installation");
    expect(html).toContain("Balance remaining");
    expect(html).not.toContain("Pay fully after installation");
    expect(html).not.toContain("Balance after installation</span>");
  });
});
