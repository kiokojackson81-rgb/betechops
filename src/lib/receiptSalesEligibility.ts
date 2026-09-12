const cancelledStates = new Set(["CANCELED", "CANCELLED"]);

const isCancelledState = (value: unknown) =>
  cancelledStates.has(String(value ?? "").trim().toUpperCase());

/**
 * Cancelled receipts remain in the audit trail, but never belong in financial
 * totals, product counts, payment-method totals, profit, or commission.
 */
export const isReceiptCancelledForSales = (receipt: unknown): boolean => {
  const row =
    receipt && typeof receipt === "object" && !Array.isArray(receipt)
      ? (receipt as Record<string, unknown>)
      : {};
  const order =
    row.order && typeof row.order === "object" && !Array.isArray(row.order)
      ? (row.order as Record<string, unknown>)
      : {};
  if (isCancelledState(order.status)) return true;

  const data =
    row.data && typeof row.data === "object" && !Array.isArray(row.data)
      ? (row.data as Record<string, unknown>)
      : {};
  if (data.cancellation && typeof data.cancellation === "object") return true;

  const podDelivery =
    data.podDelivery && typeof data.podDelivery === "object" && !Array.isArray(data.podDelivery)
      ? (data.podDelivery as Record<string, unknown>)
      : null;
  if (isCancelledState(podDelivery?.status)) return true;

  const projectFlow =
    data.projectFlow && typeof data.projectFlow === "object" && !Array.isArray(data.projectFlow)
      ? (data.projectFlow as Record<string, unknown>)
      : null;
  return isCancelledState(projectFlow?.stage);
};
