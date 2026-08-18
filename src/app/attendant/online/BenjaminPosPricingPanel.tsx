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
    const items = (sale.receiptItems as PendingReceiptItem[] | undefined) ?? [];
    if (!items.length) {
      showToast("No receipt items available for pricing", "error");
      return;
    }

    const enteredItems = items
      .map((item) => ({ item, unitBuyingPrice: Number(buyingDrafts[item.id]) }))
      .filter(({ unitBuyingPrice }) => Number.isFinite(unitBuyingPrice) && unitBuyingPrice > 0);
    if (!enteredItems.length) {
      showToast("Enter a unit buying price for at least one item", "error");
      return;
    }

    setPricingKey(draftKey);
    try {
      for (const { item, unitBuyingPrice } of enteredItems) {
        const quantity = Math.max(1, Number(item.quantity ?? 1));
        const res = await fetch("/api/support/price-sale", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            receiptItemId: item.id,
            buyingPrice: Math.round(unitBuyingPrice * quantity),
            unitBuyingPrice: Math.round(unitBuyingPrice),
            saveToCatalog: Boolean(saveToCatalogDrafts[item.id]),
          }),
          credentials: "same-origin",
        });
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          throw new Error(err?.error || "Failed to save buying price");
        }
      }

      setBuyingDrafts((prev) => {
        const next = { ...prev };
        enteredItems.forEach(({ item }) => delete next[item.id]);
        return next;
      });
      setSaveToCatalogDrafts((prev) => {
        const next = { ...prev };
        enteredItems.forEach(({ item }) => delete next[item.id]);
        return next;
      });
      const completed = enteredItems.length === items.length;
      showToast(
        completed
          ? "All item costs saved. Receipt profit is now calculated."
          : `${enteredItems.length} item cost${enteredItems.length === 1 ? "" : "s"} saved. Profit remains pending.`,
        "success",
      );
      await fetchSales();
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
            const saleDate = new Date(sale.saleDate);
            const pricedCount = Math.max(0, Number(sale.itemsTotal ?? receiptItems.length) - receiptItems.length);
            const enteredCount = receiptItems.filter((item) => Number(buyingDrafts[item.id]) > 0).length;
            const enteredBuyingTotal = receiptItems.reduce(
              (sum, item) => sum + Math.max(0, Number(buyingDrafts[item.id]) || 0) * Math.max(1, Number(item.quantity ?? 1)),
              0,
            );

            return (
              <div
                key={sale.id}
                className="rounded-3xl border border-slate-800 bg-slate-950/60 p-4"
              >
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.8fr)]">
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

                  <div className="space-y-1 rounded-2xl border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-300">
                    <div>
                      {saleDate.toLocaleDateString("en-KE")} {saleDate.toLocaleTimeString("en-KE")}
                    </div>
                    <div>Receipt value: {formatKES(sale.sellingPrice)}</div>
                    <div>Payment: {sale.paymentMethod ?? "N/A"}</div>
                    <div>Receipt: {sale.receiptNumber || "N/A"}</div>
                    <div className="font-medium text-amber-300">
                      {pricedCount} of {sale.itemsTotal ?? receiptItems.length} items priced
                    </div>
                  </div>
                </div>

                <div className="mt-5 overflow-hidden rounded-2xl border border-slate-800">
                  <div className="hidden grid-cols-[minmax(0,1fr)_90px_130px_150px_170px] gap-3 bg-slate-900 px-4 py-3 text-[11px] uppercase tracking-[0.16em] text-slate-500 md:grid">
                    <span>Item</span>
                    <span>Quantity</span>
                    <span>Selling total</span>
                    <span>Unit buying price</span>
                    <span>Line buying total</span>
                  </div>
                  <div className="divide-y divide-slate-800">
                    {receiptItems.map((item) => {
                      const quantity = Math.max(1, Number(item.quantity ?? 1));
                      const unitBuyingPrice = Math.max(0, Number(buyingDrafts[item.id]) || 0);
                      const lineBuyingTotal = unitBuyingPrice * quantity;
                      return (
                        <div key={item.id} className="grid gap-3 bg-slate-950/40 p-4 md:grid-cols-[minmax(0,1fr)_90px_130px_150px_170px] md:items-center">
                          <div>
                            <div className="font-medium text-white">{item.productName}</div>
                            <div className="mt-1 text-xs text-slate-500 md:hidden">Quantity: {quantity}</div>
                          </div>
                          <div className="hidden text-sm text-slate-300 md:block">{quantity}</div>
                          <div className="text-sm text-slate-300">
                            <span className="mr-2 text-xs text-slate-500 md:hidden">Selling:</span>
                            {formatKES(Number(item.sellingTotal ?? 0))}
                          </div>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={buyingDrafts[item.id] ?? ""}
                            onChange={(event) => setBuyingDrafts((prev) => ({ ...prev, [item.id]: event.target.value }))}
                            placeholder="Unit cost"
                            aria-label={`Unit buying price for ${item.productName}`}
                            className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/60"
                          />
                          <div className="text-sm font-semibold text-emerald-300">
                            <span className="mr-2 text-xs font-normal text-slate-500 md:hidden">Line cost:</span>
                            {formatKES(lineBuyingTotal)}
                          </div>
                          <label className="md:col-span-5 flex items-start gap-2 text-xs text-slate-400">
                            <input
                              type="checkbox"
                              className="mt-0.5 h-4 w-4 rounded border-white/15 bg-slate-950 text-emerald-400"
                              checked={Boolean(saveToCatalogDrafts[item.id])}
                              onChange={(event) => setSaveToCatalogDrafts((prev) => ({ ...prev, [item.id]: event.target.checked }))}
                              disabled={!item.catalogProductId}
                            />
                            <span>
                              Save this unit cost to the product catalogue
                              {!item.catalogProductId ? " (catalogue product not linked)" : ""}
                            </span>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Entered buying total</div>
                    <div className="mt-1 text-xl font-semibold text-white">{formatKES(enteredBuyingTotal)}</div>
                    <div className="mt-1 text-xs text-amber-300">
                      Profit remains pending until all {sale.itemsTotal ?? receiptItems.length} items are priced.
                    </div>
                  </div>
                  <Button
                    onClick={() => void handlePriceSupportReceipt(sale)}
                    disabled={pricingKey === draftKey || enteredCount === 0}
                    className="w-full bg-emerald-500 font-semibold text-black hover:brightness-95 sm:w-auto"
                  >
                    {pricingKey === draftKey
                      ? "Saving…"
                      : enteredCount === receiptItems.length
                        ? "Complete receipt pricing"
                        : `Save ${enteredCount} priced item${enteredCount === 1 ? "" : "s"}`}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
