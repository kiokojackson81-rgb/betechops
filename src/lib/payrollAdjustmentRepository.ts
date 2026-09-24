import { prisma } from "@/lib/prisma";

export type PayrollAdjustmentEntry = {
  id: string;
  label: string;
  amount: number;
  adjustmentType: string;
  kind: "ADDITION" | "DEDUCTION";
};

/** The only persisted adjustment read boundary. `periodKey` is exact. */
export async function listPayrollAdjustmentEntries(args: {
  attendantId: string;
  periodKey: string;
}): Promise<PayrollAdjustmentEntry[]> {
  const startedAt = performance.now();
  const rows = await prisma.attendantPayrollAdjustment.findMany({
    // Recurring rules are calculated separately from their active definitions
    // by the canonical payroll calculator. Excluding old materialised rows
    // prevents a recurring Chama rule from being charged twice.
    where: { attendantId: args.attendantId, periodKey: args.periodKey, recurringItemId: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, label: true, amount: true, adjustmentType: true, adjustmentKind: true },
  });
  const entries = rows.map((row) => ({
    id: row.id, label: row.label, amount: Number(row.amount), adjustmentType: row.adjustmentType,
    kind: row.adjustmentKind === "ADDITION" ? "ADDITION" as const : "DEDUCTION" as const,
  }));
  console.info("[payroll-adjustment-repository]", {
    attendantId: args.attendantId, periodKey: args.periodKey, rowCount: entries.length,
    additionTotal: entries.filter((entry) => entry.kind === "ADDITION").reduce((sum, entry) => sum + entry.amount, 0),
    adjustmentQueryMs: Number((performance.now() - startedAt).toFixed(1)),
  });
  return entries;
}
