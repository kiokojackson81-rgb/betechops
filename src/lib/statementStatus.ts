export type StatementStatusLabel = "PAID" | "UNPAID" | "OPEN";

export function deriveStatementStatus(
  statementNumber?: string | null,
  paid?: boolean | null,
): { isPaid: boolean; label: StatementStatusLabel } {
  const normalizedNumber = String(statementNumber ?? "").toUpperCase();
  if (normalizedNumber.endsWith("OPEN")) {
    return { isPaid: false, label: "OPEN" };
  }
  if (normalizedNumber.endsWith("PAID")) {
    return { isPaid: true, label: "PAID" };
  }
  if (normalizedNumber.endsWith("UNPAID")) {
    return { isPaid: false, label: "UNPAID" };
  }
  if (paid !== undefined && paid !== null) {
    const boolPaid = Boolean(paid);
    return { isPaid: boolPaid, label: boolPaid ? "PAID" : "UNPAID" };
  }
  return { isPaid: false, label: "UNPAID" };
}
