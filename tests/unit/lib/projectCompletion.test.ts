jest.mock("@/lib/projectPricingSync", () => ({ syncCompletedProjectReceiptToPricing: jest.fn() }));
import { certifiedProjectFlow, completeCertifiedProject } from "@/lib/projectCompletion";
import { buildReceiptProjectFlow, getReceiptProjectCompletionDate } from "@/lib/receiptProjects";
import { Prisma } from "@prisma/client";

test("certification completes a partly-paid project without changing payments", () => {
  const flow = buildReceiptProjectFlow({ projectValue: 100000, amountPaidTotal: 30000, stage: "PROJECT_IN_PROGRESS" });
  const finished = certifiedProjectFlow({ projectFlow: flow }, new Date("2026-09-14T12:00:00Z"), 100000, 30000);
  expect(finished.stage).toBe("COMPLETED_POSTED");
  expect(finished.totalPaidAmount).toBe(flow.totalPaidAmount);
  expect(finished.remainingAmount).toBe(flow.remainingAmount);
  expect(finished.paymentStatus).toBe(flow.paymentStatus);
  expect(finished.completedAt).toBe("2026-09-14T12:00:00.000Z");
  expect(getReceiptProjectCompletionDate({ ...finished, updatedAt: "2027-01-01" })?.toISOString()).toBe(finished.completedAt);
});

test("completion never writes order payment fields", async () => {
  const receipt = { id: "r", orderId: "o", data: { projectFlow: buildReceiptProjectFlow({ projectValue: 100000, amountPaidTotal: 30000 }) }, order: { totalAmount: 100000, paidAmount: 30000 } };
  const tx = { receipt: { findUnique: jest.fn().mockResolvedValue(receipt), update: jest.fn().mockResolvedValue(receipt) } };
  await completeCertifiedProject(tx as unknown as Prisma.TransactionClient, "r", new Date());
  expect(tx.receipt.update.mock.calls[0][0].data.order).toEqual({ update: { status: "COMPLETED" } });
});

test("cancelled projects cannot become certified by accident", () => {
  expect(() => certifiedProjectFlow({ projectFlow: buildReceiptProjectFlow({ projectValue: 100, stage: "CANCELLED" }) }, new Date(), 100, 0)).toThrow("cancelled");
});
