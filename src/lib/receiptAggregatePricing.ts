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

  return {
    buyingTotal,
    mode,
    isAuthoritativeTotal: mode === "TOTAL" && buyingTotal > 0,
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
