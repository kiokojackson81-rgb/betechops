function money(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function rowRequiresPricing(row: any): boolean {
  return money(row?.netPayout) >= 0;
}

function rowPricingKey(row: any, index: number): string {
  const txn = String(row?.itemCreditTxn ?? "").trim();
  if (txn) return txn;
  return `__row_${index}`;
}

export function getDraftCompletionStats(input: {
  rows: unknown;
  submittedByTxn: unknown;
  fallbackRowCount?: number;
}) {
  const rows = Array.isArray(input.rows) ? (input.rows as any[]) : [];
  const submittedByTxn =
    input.submittedByTxn && typeof input.submittedByTxn === "object" && !Array.isArray(input.submittedByTxn)
      ? (input.submittedByTxn as Record<string, unknown>)
      : {};

  const requiredPricingKeys =
    rows.length > 0
      ? Array.from(
          new Set(
            rows
              .map((row, index) => ({ row, key: rowPricingKey(row, index) }))
              .filter(({ row }) => rowRequiresPricing(row))
              .map(({ key }) => key),
          ),
        )
      : [];
  const requiredRowCount =
    rows.length > 0 ? requiredPricingKeys.length : Math.max(0, Number(input.fallbackRowCount ?? 0));
  const submittedCount =
    rows.length > 0
      ? requiredPricingKeys.filter((key) => Object.prototype.hasOwnProperty.call(submittedByTxn, key)).length
      : Object.keys(submittedByTxn).length;

  return {
    submittedCount,
    requiredRowCount,
    isComplete: requiredRowCount === 0 || submittedCount >= requiredRowCount,
  };
}
