import { Prisma } from "@prisma/client";
import { buildReceiptProjectFlow, readReceiptProjectFlow } from "@/lib/receiptProjects";
import { syncCompletedProjectReceiptToPricing } from "@/lib/projectPricingSync";

export function certifiedProjectFlow(data: Record<string, unknown>, completedAt: Date, projectValue: number, paidAmount: number) {
  const previous = readReceiptProjectFlow(data.projectFlow);
  if (previous?.stage === "CANCELLED") throw new Error("A cancelled project cannot be certified.");
  const raw = data.projectFlow && typeof data.projectFlow === "object" && !Array.isArray(data.projectFlow) ? data.projectFlow as Record<string, unknown> : {};
  const flow = previous || buildReceiptProjectFlow({ projectValue, amountPaidTotal: paidAmount });
  return { ...flow, ...raw, stage: "COMPLETED_POSTED" as const, completedAt: typeof raw.completedAt === "string" ? raw.completedAt : completedAt.toISOString(), updatedAt: completedAt.toISOString() };
}

/** Runs in the same transaction as professional certification. Never writes payment amounts/status. */
export async function completeCertifiedProject(tx: Prisma.TransactionClient, receiptId: string, completedAt: Date) {
  const receipt = await tx.receipt.findUnique({ where: { id: receiptId }, include: { order: true } });
  if (!receipt) throw new Error("Project receipt not found.");
  const data = receipt.data && typeof receipt.data === "object" && !Array.isArray(receipt.data) ? receipt.data as Record<string, unknown> : {};
  const flow = certifiedProjectFlow(data, completedAt, receipt.order?.totalAmount || 0, receipt.order?.paidAmount || 0);
  const updated = await tx.receipt.update({ where: { id: receiptId }, data: { data: { ...data, customerType: "project", projectFlow: flow } as Prisma.InputJsonValue, ...(receipt.orderId ? { order: { update: { status: "COMPLETED" } } } : {}) }, include: { order: true } });
  const normalized = readReceiptProjectFlow(flow);
  if (normalized) await syncCompletedProjectReceiptToPricing(tx, updated, normalized);
  return updated;
}
