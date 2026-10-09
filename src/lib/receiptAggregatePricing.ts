type JsonRecord = Record<string, unknown>;

const asRecord = (value: unknown): JsonRecord =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};

const toFiniteNumber = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export type ReceiptAggregatePricing = {
  buyingTotal: number;
  mode: "TOTAL" | "ITEMS" | null;
  isAuthoritativeTotal: boolean;
};

export function readReceiptAggregatePricing(receipt: unknown): ReceiptAggregatePricing {
  const row = asRecord(receipt);
  const totals = asRecord(row.totals);
  const data = asRecord(row.data);
  const dataTotals = asRecord(data.totals);
  const rawMode = String(
    totals.buyingPriceMode ?? dataTotals.buyingPriceMode ?? data.buyingPriceMode ?? row.buyingPriceMode ?? "",
  ).toUpperCase();
  const mode = rawMode === "TOTAL" || rawMode === "ITEMS" ? rawMode : null;
  const buyingTotal = toFiniteNumber(
    totals.buyingTotal ?? dataTotals.buyingTotal ?? data.buyingTotal ?? row.buyingTotal,
  );

  // Older completed receipts were saved with an aggregate buying total and
  // profit but before `buyingPriceMode` was introduced.  Recalculating those
  // receipts from a product's *current* cost changes historical profit after
  // the fact.  Treat the aggregate as authoritative only when its saved
  // profit proves that the figures belong together; this deliberately does
  // not promote incomplete/unpriced legacy receipts.
  const sellingTotal = toFiniteNumber(
    totals.total ??
      totals.sellingTotal ??
      totals.grandTotal ??
      dataTotals.total ??
      data.total ??
      data.amount ??
      row.totalAmount,
  );
  const savedProfit = toFiniteNumber(totals.profit ?? dataTotals.profit ?? data.profit ?? row.profit);
  const commissionTotal = toFiniteNumber(
    data.agentSale && typeof data.agentSale === "object"
      ? asRecord(data.agentSale).commissionAmount
      : 0,
  );
  const hasCompleteLegacyAggregate =
    buyingTotal > 0 &&
    sellingTotal > 0 &&
    data.needsPricing !== true &&
    totals.needsPricing !== true &&
    dataTotals.needsPricing !== true &&
    Math.abs(savedProfit - (sellingTotal - buyingTotal - commissionTotal)) < 0.01;
  const isAuthoritativeTotal = (mode === "TOTAL" && buyingTotal > 0) || hasCompleteLegacyAggregate;

  return {
    buyingTotal,
    mode: mode ?? (hasCompleteLegacyAggregate ? "TOTAL" : null),
    isAuthoritativeTotal,
  };
}

export function calculateAggregateReceiptProfit({
  sellingTotal,
  buyingTotal,
  commissionTotal = 0,
  deliveryFee = 0,
}: {
  sellingTotal: number;
  buyingTotal: number;
  commissionTotal?: number;
  deliveryFee?: number;
}): number {
  return (
    toFiniteNumber(sellingTotal) -
    toFiniteNumber(buyingTotal) -
    toFiniteNumber(commissionTotal) -
    toFiniteNumber(deliveryFee)
  );
}
