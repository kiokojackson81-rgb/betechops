"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Card from "@/app/_components/Card";
import Button from "@/app/_components/Button";
import { showToast } from "@/lib/ui/toast";
import type { UnpricedSale } from "@/lib/marketingUnpricedSales";

const POLL_INTERVAL_MS = 60_000;

type PendingReceiptItem = NonNullable<UnpricedSale["receiptItems"]>[number];

const formatKES = (value: number) => `KES ${Math.round(value).toLocaleString("en-KE")}`;

function getDraftKey(sale: UnpricedSale) {
  return `${sale.source}:${sale.id}`;
}

function allocateReceiptBuyingPrices(
  total: number,
  items: Array<{ id: string; saleValue?: number }>,
) {
  const roundedTotal = Math.max(0, Math.round(total));
  if (!items.length || roundedTotal <= 0) return [];
  const weights = items.map((item) => Math.max(0, item.saleValue ?? 0));
  const weightSum = weights.reduce((sum, value) => sum + value, 0);
  let remainder = roundedTotal;
  const allocations = items.map((item, index) => {
    const value =
      weightSum > 0
        ? Math.floor((weights[index] / weightSum) * roundedTotal)
        : Math.floor(roundedTotal / items.length);
    remainder -= value;
    return { id: item.id, value };
  });
  let pointer = 0;
  while (remainder > 0 && allocations.length > 0) {
    allocations[pointer % allocations.length].value += 1;
    remainder -= 1;
    pointer += 1;
  }
  return allocations;
}

export default function BenjaminPosPricingPanel({
  onQueueEmpty,
}: {
  onQueueEmpty?: () => void;
}) {
  const [sales, setSales] = useState<UnpricedSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [pricingKey, setPricingKey] = useState<string | null>(null);
  const [buyingDrafts, setBuyingDrafts] = useState<Record<string, string>>({});
  const [saveToCatalogDrafts, setSaveToCatalogDrafts] = useState<Record<string, boolean>>({});

  const fetchSales = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/marketing/unpriced-sales", {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("Failed to load pending POS pricing");
      const data = await res.json();
      const nextSales = Array.isArray(data?.sales) ? (data.sales as UnpricedSale[]) : [];
      setSales(nextSales);
      if (nextSales.length === 0) {
        onQueueEmpty?.();
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load pending POS pricing", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchSales();
    const id = setInterval(() => {
      void fetchSales();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const queueStats = useMemo(() => {
    return sales.reduce(
      (acc, sale) => {
        const pending = sale.receiptItems?.length ?? sale.itemsPending ?? 0;
        acc.receipts += 1;
        acc.items += pending > 0 ? pending : 1;
        return acc;
      },
      { receipts: 0, items: 0 },
    );
  }, [sales]);

  const handlePriceSupportReceipt = async (sale: UnpricedSale) => {
    const draftKey = getDraftKey(sale);
    const draft = buyingDrafts[draftKey];
    const saveToCatalog = Boolean(saveToCatalogDrafts[draftKey]);
    const numeric = Number(draft);
    if (!draft || Number.isNaN(numeric) || numeric <= 0) {
      showToast("Enter a valid buying price", "error");
      return;
    }
    const items = (sale.receiptItems as PendingReceiptItem[] | undefined) ?? [];
    if (!items.length) {
      showToast("No receipt items available for pricing", "error");
      return;
    }

    const allocations = allocateReceiptBuyingPrices(Math.round(numeric), items as Array<{ id: string; saleValue?: number }>);
    setPricingKey(draftKey);
    try {
      for (const { id, value } of allocations) {
        const res = await fetch("/api/support/price-sale", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            receiptItemId: id,
            buyingPrice: value,
            saveToCatalog,
          }),
          credentials: "same-origin",
        });
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          throw new Error(err?.error || "Failed to save buying price");
        }
      }

      setSales((prev) => prev.filter((row) => row.id !== sale.id));
      setBuyingDrafts((prev) => {
        const next = { ...prev };
        delete next[draftKey];
        return next;
      });
      setSaveToCatalogDrafts((prev) => {
        const next = { ...prev };
        delete next[draftKey];
        return next;
      });
      showToast("Buying price saved", "success");
      if (sales.length <= 1) {
        onQueueEmpty?.();
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save buying price", "error");
    } finally {
      setPricingKey(null);
    }
  };

  return (
    <Card className="space-y-5 border-slate-800 bg-slate-900/80 shadow-xl shadow-black/40">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">POS pricing</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Pending buying prices</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Enter buying prices for POS variable-cost receipts. After pricing a receipt, it is removed from your queue automatically.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">
            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Receipts</div>
            <div className="mt-1 text-2xl font-semibold text-white">{queueStats.receipts}</div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">
            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Items pending</div>
            <div className="mt-1 text-2xl font-semibold text-white">{queueStats.items}</div>
          </div>
          <Button variant="secondary" onClick={() => void fetchSales()} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
      </div>

      {loading && sales.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-8 text-center text-sm text-slate-400">
          Loading pending POS pricing…
        </div>
      ) : sales.length === 0 ? (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-8 text-center">
          <div className="text-lg font-semibold text-emerald-200">No pending POS pricing items</div>
          <p className="mt-2 text-sm text-slate-400">Your pricing queue is clear.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sales.map((sale) => {
            const draftKey = getDraftKey(sale);
            const receiptItems = (sale.receiptItems as PendingReceiptItem[] | undefined) ?? [];
            const canSaveToCatalog = receiptItems.length > 0 && receiptItems.every((item) => Boolean(item.catalogProductId));
            const saleDate = new Date(sale.saleDate);

            return (
              <div
                key={sale.id}
                className="rounded-3xl border border-slate-800 bg-slate-950/60 p-4"
              >
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.7fr)_180px]">
                  <div className="space-y-2">
                    <div className="font-semibold text-white">{sale.productName}</div>
                    {sale.receiptId ? (
                      <Link
                        href={`/receipts/print/${encodeURIComponent(sale.receiptId)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex text-sm font-medium text-cyan-300 underline underline-offset-4 transition hover:text-cyan-200"
                      >
                        Open receipt
                      </Link>
                    ) : null}
                    <div className="text-sm text-slate-400">Support / POS variable cost</div>
                    {sale.day ? <div className="text-sm text-slate-500">Day: {sale.day}</div> : null}
                  </div>

                  <div className="space-y-1 text-sm text-slate-300">
                    <div>
                      {saleDate.toLocaleDateString("en-KE")} {saleDate.toLocaleTimeString("en-KE")}
                    </div>
                    <div>Receipt value: {formatKES(sale.sellingPrice)}</div>
                    <div>Payment: {sale.paymentMethod ?? "N/A"}</div>
                    <div>Receipt: {sale.receiptNumber || "N/A"}</div>
                    <div className="text-[11px] uppercase tracking-wide text-slate-500">
                      {((sale.itemsPending ?? receiptItems.length ?? 0) || 0).toLocaleString()} pending
                      {sale.itemsTotal ? ` of ${sale.itemsTotal}` : ""} items
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-3 text-sm text-slate-200">
                      <div className="font-medium text-white">{sale.productName}</div>
                    </div>
                    <input
                      type="number"
                      value={buyingDrafts[draftKey] ?? ""}
                      onChange={(event) =>
                        setBuyingDrafts((prev) => ({
                          ...prev,
                          [draftKey]: event.target.value,
                        }))
                      }
                      placeholder="Total buying price"
                      className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/60"
                    />
                    <label className="flex items-start gap-3 text-sm text-slate-400">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-white/15 bg-slate-950 text-emerald-400"
                        checked={Boolean(saveToCatalogDrafts[draftKey])}
                        onChange={(event) =>
                          setSaveToCatalogDrafts((prev) => ({
                            ...prev,
                            [draftKey]: event.target.checked,
                          }))
                        }
                        disabled={!canSaveToCatalog}
                      />
                      <span>
                        Save this buying price to product catalog for future profit calculation{" "}
                        {!canSaveToCatalog
                          ? "Catalog product not linked, buying price cannot be saved for future use."
                          : ""}
                      </span>
                    </label>
                  </div>

                  <div className="flex items-start">
                    <Button
                      onClick={() => void handlePriceSupportReceipt(sale)}
                      disabled={pricingKey === draftKey}
                      className="w-full bg-emerald-500 font-semibold text-black hover:brightness-95"
                    >
                      {pricingKey === draftKey ? "Saving…" : "Price receipt"}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
