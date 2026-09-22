import { Prisma } from "@prisma/client";
import { buildReceiptProjectFlow, readReceiptProjectFlow } from "@/lib/receiptProjects";
import { syncCompletedProjectReceiptToPricing } from "@/lib/projectPricingSync";
import { commissioningPaymentState, requireCommissioningPaymentDecision, type CommissioningPaymentDecision } from "@/lib/commissioningPayment";

export function certifiedProjectFlow(data: Record<string, unknown>, completedAt: Date, projectValue: number, paidAmount: number) {
  const previous = readReceiptProjectFlow(data.projectFlow);
  if (previous?.stage === "CANCELLED") throw new Error("A cancelled project cannot be certified.");
  if (paidAmount < projectValue) return previous || buildReceiptProjectFlow({ projectValue, amountPaidTotal: paidAmount, depositPaidAmount: paidAmount });
  const depositPaidAmount = Math.min(projectValue, previous?.depositPaidAmount ?? paidAmount);
  const flow = buildReceiptProjectFlow({ existing: previous as unknown as Record<string, unknown> | null, projectValue, amountPaidTotal: paidAmount, depositPaidAmount, balancePaidAmount: Math.max(0, paidAmount - depositPaidAmount), stage: "COMPLETED_POSTED" });
  return { ...flow, completedAt: previous?.completedAt || completedAt.toISOString(), updatedAt: completedAt.toISOString() };
}

/** Technical certification does not settle a balance without explicit confirmation. */
export async function completeCertifiedProject(tx: Prisma.TransactionClient, receiptId: string, completedAt: Date, confirmation?: { decision?: CommissioningPaymentDecision; actorId?: string | null; sessionId: string }) {
  const receipt = await tx.receipt.findUnique({ where: { id: receiptId }, include: { order: true } });
  if (!receipt) throw new Error("Project receipt not found.");
  const data = receipt.data && typeof receipt.data === "object" && !Array.isArray(receipt.data) ? receipt.data as Record<string, unknown> : {};
  if (receipt.order?.status === "CANCELED" || readReceiptProjectFlow(data.projectFlow)?.stage === "CANCELLED") throw new Error("A cancelled project cannot be certified.");
  const payment = commissioningPaymentState(receipt.order);
  const decision = requireCommissioningPaymentDecision(payment.fullyPaid, confirmation?.decision);
  if (decision === "OUTSTANDING") return receipt;
  const flow = certifiedProjectFlow(data, completedAt, payment.totalAmount, payment.totalAmount);
  const totals = receipt.totals && typeof receipt.totals === "object" && !Array.isArray(receipt.totals) ? receipt.totals as Record<string, unknown> : {};
  const updated = await tx.receipt.update({ where: { id: receiptId }, data: {
    totals: { ...totals, balance: 0 } as Prisma.InputJsonValue,
    data: { ...data, customerType: "project", projectFlow: flow, ...(decision === "CLEARED" ? { commissioningPaymentConfirmation: { sessionId: confirmation!.sessionId, actorId: confirmation?.actorId || null, confirmedAt: completedAt.toISOString(), previousPaidAmount: payment.paidAmount, amountReceived: payment.balance } } : {}) } as Prisma.InputJsonValue,
    order: { update: { status: "COMPLETED", paidAmount: decision === "CLEARED" ? payment.totalAmount : payment.paidAmount, paymentStatus: "PAID" } },
  }, include: { order: true } });
  const normalized = readReceiptProjectFlow(flow);
  if (normalized) await syncCompletedProjectReceiptToPricing(tx, updated, normalized);
  return updated;
}
