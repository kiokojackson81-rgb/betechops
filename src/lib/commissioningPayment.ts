export type CommissioningPaymentDecision = "CLEARED" | "OUTSTANDING";

export function commissioningPaymentState(order: { totalAmount: unknown; paidAmount: unknown }) {
  const total = Number(order.totalAmount);
  const paid = Number(order.paidAmount);
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(paid) || paid < 0) {
    throw new Error("The receipt needs valid sales and payment amounts before commissioning.");
  }
  const totalAmount = Math.round(total * 100) / 100;
  const paidAmount = Math.round(paid * 100) / 100;
  const balance = Math.round(Math.max(0, totalAmount - paidAmount) * 100) / 100;
  return { totalAmount, paidAmount, balance, fullyPaid: balance === 0 };
}

export function requireCommissioningPaymentDecision(fullyPaid: boolean, decision: unknown): CommissioningPaymentDecision | undefined {
  if (fullyPaid) return undefined;
  if (decision !== "CLEARED" && decision !== "OUTSTANDING") {
    throw new Error("Confirm whether the customer has cleared the outstanding balance before issuing certificates.");
  }
  return decision;
}
