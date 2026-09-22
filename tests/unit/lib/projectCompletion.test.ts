jest.mock("@/lib/projectPricingSync", () => ({ syncCompletedProjectReceiptToPricing: jest.fn() }));
import { certifiedProjectFlow, completeCertifiedProject } from "@/lib/projectCompletion";
import { buildReceiptProjectFlow } from "@/lib/receiptProjects";
import { syncCompletedProjectReceiptToPricing } from "@/lib/projectPricingSync";
import { Prisma } from "@prisma/client";
function fixture(paidAmount = 30000) {
  const receipt = { id: "r", orderId: "o", totals: { total: 100000, balance: 100000 - paidAmount }, data: { projectFlow: buildReceiptProjectFlow({ projectValue: 100000, amountPaidTotal: paidAmount, depositPaidAmount: paidAmount, stage: "PROJECT_IN_PROGRESS" }) }, order: { totalAmount: 100000, paidAmount, status: "PENDING" } };
  const tx = { receipt: { findUnique: jest.fn().mockResolvedValue(receipt), update: jest.fn().mockResolvedValue(receipt) } };
  return { receipt, tx, client: tx as unknown as Prisma.TransactionClient };
}
beforeEach(() => jest.clearAllMocks());
test("technical completion preserves the original unpaid project stage", () => {
  const { receipt } = fixture();
  const flow = certifiedProjectFlow(receipt.data, new Date(), 100000, 30000);
  expect(flow.stage).toBe("PROJECT_IN_PROGRESS");
  expect(flow.totalPaidAmount).toBe(30000);
  expect(flow.remainingAmount).toBe(70000);
});
test("outstanding balance preserves every receipt and payment field", async () => {
  const { receipt, tx, client } = fixture();
  expect(await completeCertifiedProject(client, "r", new Date(), { decision: "OUTSTANDING", sessionId: "s" })).toBe(receipt);
  expect(tx.receipt.update).not.toHaveBeenCalled();
  expect(syncCompletedProjectReceiptToPricing).not.toHaveBeenCalled();
});
test("missing decision cannot settle an outstanding balance", async () => {
  const { tx, client } = fixture();
  await expect(completeCertifiedProject(client, "r", new Date())).rejects.toThrow("Confirm whether");
  expect(tx.receipt.update).not.toHaveBeenCalled();
});
test("technician confirmation records the remaining payment and audit", async () => {
  const { tx, client } = fixture();
  await completeCertifiedProject(client, "r", new Date(), { decision: "CLEARED", actorId: "tech", sessionId: "s" });
  const saved = tx.receipt.update.mock.calls[0][0].data;
  expect(saved.order.update).toEqual({ status: "COMPLETED", paidAmount: 100000, paymentStatus: "PAID" });
  expect(saved.data.projectFlow).toMatchObject({ stage: "COMPLETED_POSTED", totalPaidAmount: 100000, remainingAmount: 0 });
  expect(saved.data.commissioningPaymentConfirmation).toMatchObject({ actorId: "tech", sessionId: "s", previousPaidAmount: 30000, amountReceived: 70000 });
  expect(saved.totals.balance).toBe(0);
  expect(syncCompletedProjectReceiptToPricing).toHaveBeenCalledTimes(1);
});
test("already paid receipts complete without a new payment decision", async () => {
  const { tx, client } = fixture(100000);
  await completeCertifiedProject(client, "r", new Date());
  const saved = tx.receipt.update.mock.calls[0][0].data;
  expect(saved.data.projectFlow.stage).toBe("COMPLETED_POSTED");
  expect(saved.data.commissioningPaymentConfirmation).toBeUndefined();
});
test("cancelled projects cannot become certified", () => {
  expect(() => certifiedProjectFlow({ projectFlow: buildReceiptProjectFlow({ projectValue: 100, stage: "CANCELLED" }) }, new Date(), 100, 0)).toThrow("cancelled");
});

test("commissioning does not reduce an existing overpayment", async () => {
  const { tx, client } = fixture(110000);
  await completeCertifiedProject(client, "r", new Date());
  expect(tx.receipt.update.mock.calls[0][0].data.order.update.paidAmount).toBe(110000);
});
