"use client";

import { useEffect, useMemo, useState } from "react";
import Card from "@/app/_components/Card";
import Input from "@/app/_components/Input";
import Button from "@/app/_components/Button";
import { showToast } from "@/lib/ui/toast";
import type { UnpricedSale } from "@/lib/marketingUnpricedSales";
import {
  groupMarketingUnpricedSales,
  type GroupedUnpricedSale,
  type ReceiptGroupingItem,
} from "@/lib/unpricedReceiptGrouping";

const POLL_INTERVAL_MS = 60_000;

const sourceLabels: Record<UnpricedSale["source"], string> = {
  "daily-sale": "Daily report",
  support: "Support / POS variable cost",
};

const formatKES = (value: number) => `KES ${Math.round(value).toLocaleString("en-KE")}`;

const getSaleKey = (sale: GroupedUnpricedSale) => `${sale.source}:${sale.id}`;
const dayFilters = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const getDraftKey = (sale: GroupedUnpricedSale, receiptItemId?: string) =>
  receiptItemId ? `${sale.source}:item:${receiptItemId}` : getSaleKey(sale);

export default function AdminPricingPanel() {
  const [sales, setSales] = useState<UnpricedSale[]>([]);
  const groupedSales = useMemo(() => groupMarketingUnpricedSales(sales), [sales]);
  const [loading, setLoading] = useState(true);
  const [buyingDrafts, setBuyingDrafts] = useState<Record<string, string>>({});
  const [saveToCatalogDrafts, setSaveToCatalogDrafts] = useState<Record<string, boolean>>({});
  const [pricingKey, setPricingKey] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"" | UnpricedSale["source"]>("");
  const [attendantFilter, setAttendantFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<"" | "MPESA" | "CASH" | "NONE">("");
  const [dayFilter, setDayFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [receiptFilter, setReceiptFilter] = useState<"" | "with" | "without">("");

  const fetchSales = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/marketing/unpriced-sales", { cache: "no-store", credentials: "same-origin" });
      if (!res.ok) throw new Error("Failed to load unpriced sales");
      const data = await res.json();
      setSales(data?.sales ?? []);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load unpriced sales", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
    const id = setInterval(fetchSales, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const attendantOptions = useMemo(() => {
    const map = new Map<string, string>();
    groupedSales.forEach((sale) => {
      const key = (sale.attendantEmail || sale.attendantName || "").toLowerCase();
      if (!key) return;
      const label = sale.attendantEmail
        ? `${sale.attendantName || "Unknown"} (${sale.attendantEmail})`
        : sale.attendantName;
      if (label) map.set(key, label);
    });
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [groupedSales]);

  const filteredSales = useMemo(() => {
    let rows: GroupedUnpricedSale[] = [...groupedSales];
    if (sourceFilter) {
      rows = rows.filter((sale) => sale.source === sourceFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (sale) =>
          sale.productName.toLowerCase().includes(q) ||
          sale.attendantName.toLowerCase().includes(q) ||
          (sale.attendantEmail ?? "").toLowerCase().includes(q) ||
          (sale.receiptNumber ?? "").toLowerCase().includes(q),
      );
    }
    if (attendantFilter) {
      rows = rows.filter((sale) => {
        const matchKey = (sale.attendantEmail || sale.attendantName || "").toLowerCase();
        return matchKey === attendantFilter;
      });
    }
    if (paymentFilter) {
      if (paymentFilter === "NONE") {
        rows = rows.filter((sale) => !sale.paymentMethod);
      } else {
        rows = rows.filter((sale) => sale.paymentMethod === paymentFilter);
      }
    }
    if (dayFilter) {
      rows = rows.filter((sale) => (sale.day || "").toLowerCase() === dayFilter.toLowerCase());
    }
    if (dateFilter) {
      rows = rows.filter((sale) => {
        const dateStr = new Date(sale.saleDate).toISOString().split("T")[0];
        return dateStr === dateFilter;
      });
    }
    if (receiptFilter === "with") {
      rows = rows.filter((sale) => Boolean(sale.receiptNumber));
    } else if (receiptFilter === "without") {
      rows = rows.filter((sale) => !sale.receiptNumber);
    }
    return rows;
  }, [groupedSales, search, sourceFilter, attendantFilter, paymentFilter, dayFilter, dateFilter, receiptFilter]);
  const queueStats = useMemo(() => {
    return filteredSales.reduce(
      (acc, sale) => {
        acc.total += 1;
        if (sale.source === "support") {
          acc.support += 1;
          const pending = sale.receiptItems?.length ?? sale.itemsPending ?? 0;
          if (pending > 0) {
            acc.items += pending;
          } else {
            const fallback = sale.itemsPending ?? 0;
            acc.items += fallback > 0 ? fallback : 1;
          }
        } else {
          const pending = (sale.groupedSaleIds?.length ?? sale.itemsPending ?? 1) || 1;
          acc.items += pending;
        }
        return acc;
      },
      { total: 0, support: 0, items: 0 },
    );
  }, [filteredSales]);

  const handleSetDraft = (key: string, value: string) => {
    setBuyingDrafts((prev) => ({ ...prev, [key]: value }));
  };

  const handleSetSaveToCatalog = (key: string, checked: boolean) => {
    setSaveToCatalogDrafts((prev) => ({ ...prev, [key]: checked }));
  };

  const allocateReceiptBuyingPrices = (
    total: number,
    items: Array<{ id: string; saleValue?: number }>,
  ) => {
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
  };

  const submitPrice = async (
    sale: GroupedUnpricedSale,
    receiptItemId: string | undefined,
    buyingPrice: number,
    options?: { overrideSaleId?: string; saveToCatalog?: boolean },
  ) => {
    if (sale.source === "support" && !receiptItemId) {
      throw new Error("Select a receipt item to price");
    }
    const targetSaleId = options?.overrideSaleId ?? sale.id;
    const endpoint = sale.source === "support" ? "/api/support/price-sale" : "/api/marketing/price-sale";
    const payload =
      sale.source === "support"
        ? { receiptItemId, buyingPrice, saveToCatalog: Boolean(options?.saveToCatalog) }
        : { dailySaleId: targetSaleId, buyingPrice, saveToCatalog: Boolean(options?.saveToCatalog) };
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "same-origin",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.error || "Failed to save buying price");
    }
    setSales((prev) => {
      if (sale.source === "support") {
        const next: UnpricedSale[] = [];
        for (const row of prev) {
          if (row.id !== sale.id || row.source !== sale.source) {
            next.push(row);
            continue;
          }
          if (receiptItemId) {
            const remaining = (row.receiptItems || []).filter((item) => item.id !== receiptItemId);
            if (!remaining.length) {
              continue;
            }
            next.push({
              ...row,
              receiptItems: remaining,
              itemsPending: Math.max(0, (row.itemsPending ?? remaining.length + 1) - 1),
            });
            continue;
          }
        }
        return next;
      }
      return prev.filter((row) => row.id !== targetSaleId);
    });
  };

  const handlePriceSale = async (sale: GroupedUnpricedSale, receiptItemId?: string) => {
    const receiptItems = sale.receiptItems as ReceiptGroupingItem[] | undefined;
    if (sale.source === "daily-sale" && (receiptItems?.length ?? 0) > 0) {
      await handlePriceReceiptGroup(sale);
      return;
    }
    const draftKey = getDraftKey(sale, receiptItemId);
    const draft = buyingDrafts[draftKey];
    const saveToCatalog = Boolean(saveToCatalogDrafts[draftKey]);
    const numeric = Number(draft);
    if (!draft || Number.isNaN(numeric) || numeric <= 0) {
      showToast("Enter a valid buying price", "error");
      return;
    }
    setPricingKey(draftKey);
    try {
      await submitPrice(sale, receiptItemId, Math.round(numeric), { saveToCatalog });
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
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save buying price", "error");
    } finally {
      setPricingKey(null);
    }
  };

  const handlePriceSupportReceipt = async (sale: GroupedUnpricedSale) => {
    const draftKey = getDraftKey(sale);
    const draft = buyingDrafts[draftKey];
    const saveToCatalog = Boolean(saveToCatalogDrafts[draftKey]);
    const numeric = Number(draft);
    if (!draft || Number.isNaN(numeric) || numeric <= 0) {
      showToast("Enter a valid buying price", "error");
      return;
    }
    const items = sale.receiptItems || [];
    if (!items.length) {
      showToast("No receipt items available for pricing", "error");
      return;
    }
    const allocations = allocateReceiptBuyingPrices(Math.round(numeric), items);
    setPricingKey(draftKey);
    try {
      for (const { id, value } of allocations) {
        await submitPrice(sale, id, value, { saveToCatalog });
      }
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
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save buying price", "error");
    } finally {
      setPricingKey(null);
    }
  };

  const handlePriceReceiptGroup = async (sale: GroupedUnpricedSale) => {
    const draftKey = getDraftKey(sale);
    const draft = buyingDrafts[draftKey];
    const saveToCatalog = Boolean(saveToCatalogDrafts[draftKey]);
    const numeric = Number(draft);
    if (!draft || Number.isNaN(numeric) || numeric <= 0) {
      showToast("Enter a valid buying price", "error");
      return;
    }
    const items = (sale.receiptItems as ReceiptGroupingItem[] | undefined) ?? [];
    if (!items.length) {
      showToast("No receipt items available for pricing", "error");
      return;
    }
    const allocations = allocateReceiptBuyingPrices(Math.round(numeric), items);
    setPricingKey(draftKey);
    try {
      for (const { id, value } of allocations) {
        await submitPrice(sale, undefined, value, { overrideSaleId: id, saveToCatalog });
      }
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
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save buying price", "error");
    } finally {
      setPricingKey(null);
    }
  };

  const handleDeleteSale = async (sale: GroupedUnpricedSale) => {
    const key = getSaleKey(sale);
    if (!window.confirm("Remove this sale from the pricing queue?")) return;
    setDeletingKey(key);
    try {
      const ids =
        sale.source === "daily-sale" && sale.groupedSaleIds?.length
          ? sale.groupedSaleIds
          : [sale.id];
      for (const saleId of ids) {
        const res = await fetch("/api/marketing/unpriced-sales/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ saleId, source: sale.source }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          throw new Error(err?.error || "Failed to delete sale");
        }
      }
      showToast("Sale removed from queue", "success");
      setSales((prev) => prev.filter((row) => !(sale.groupedSaleIds ?? [sale.id]).includes(row.id)));
      setBuyingDrafts((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setSaveToCatalogDrafts((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to delete sale", "error");
    } finally {
      setDeletingKey(null);
    }
  };

  return (
    <Card className="space-y-4 border-slate-800 bg-slate-900/70 p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Manual pricing queue</h2>
          <p className="text-sm text-slate-400">
            Admins can price pending sales on behalf of attendants. Details include the original attendant and receipt info.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={fetchSales} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Input
          placeholder="Search product, receipt, or attendant"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1"
        />
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value as "" | UnpricedSale["source"])}
          className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
        >
          <option value="">All sources</option>
          <option value="daily-sale">Daily report</option>
          <option value="support">Support entry</option>
        </select>
        <select
          value={attendantFilter}
          onChange={(e) => setAttendantFilter(e.target.value)}
          className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
        >
          <option value="">All attendants</option>
          {attendantOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <select
          value={paymentFilter}
          onChange={(e) => setPaymentFilter(e.target.value as "" | "MPESA" | "CASH" | "NONE")}
          className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
        >
          <option value="">All payment methods</option>
          <option value="MPESA">MPESA</option>
          <option value="CASH">Cash</option>
          <option value="NONE">No payment data</option>
        </select>
        <select
          value={dayFilter}
          onChange={(e) => setDayFilter(e.target.value)}
          className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
        >
          <option value="">All days</option>
          {dayFilters.map((day) => (
            <option key={day} value={day}>
              {day}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          />
          <select
            value={receiptFilter}
            onChange={(e) => setReceiptFilter(e.target.value as "" | "with" | "without")}
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          >
            <option value="">All receipts</option>
            <option value="with">With receipt number</option>
            <option value="without">Without receipt number</option>
          </select>
        </div>
      </div>

      {filteredSales.length > 0 ? (
        <div className="grid gap-3 text-xs uppercase tracking-wide text-slate-300 md:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
            <p className="text-[10px] text-slate-500">Pending receipts</p>
            <p className="text-lg font-semibold text-white">{queueStats.total}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
            <p className="text-[10px] text-slate-500">Pending items</p>
            <p className="text-lg font-semibold text-white">{queueStats.items}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
            <p className="text-[10px] text-slate-500">Support receipts</p>
            <p className="text-lg font-semibold text-white">{queueStats.support}</p>
          </div>
        </div>
      ) : null}

      {loading && sales.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-400">
          Loading unpriced sales…
        </div>
      ) : null}

      {!loading && filteredSales.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-400">
          No pending sales in the current trading period.
        </div>
      ) : null}

      {filteredSales.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-950/50 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2">Attendant</th>
                <th className="px-3 py-2">Sale info</th>
                <th className="px-3 py-2">Buying price</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.map((sale) => {
                const key = getSaleKey(sale);
                const saleDate = new Date(sale.saleDate);
                const receiptItems = sale.receiptItems as ReceiptGroupingItem[] | undefined;
                const hasReceiptItems = (receiptItems?.length ?? 0) > 0;
                const isSupportReceipt = sale.source === "support";
                const canSaveToCatalog =
                  isSupportReceipt &&
                  hasReceiptItems &&
                  receiptItems!.every((item) => Boolean(item.catalogProductId));
                const saveToCatalogKey = getDraftKey(sale);
                return (
                  <tr key={key} className="border-t border-slate-800 bg-slate-950/30">
                    <td className="px-3 py-3 align-top">
                      <div className="font-semibold text-white">{sale.productName}</div>
                      <div className="text-xs text-slate-400">{sourceLabels[sale.source]}</div>
                      {sale.day ? (
                        <div className="text-xs text-slate-500">Day: {sale.day}</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <div className="text-sm text-white">{sale.attendantName}</div>
                      <div className="text-xs text-slate-400">{sale.attendantEmail || "No email"}</div>
                    </td>
                    <td className="px-3 py-3 align-top text-xs text-slate-300">
                      <div>
                        {saleDate.toLocaleDateString("en-KE")} {saleDate.toLocaleTimeString("en-KE")}
                      </div>
                      <div>{hasReceiptItems ? "Receipt value" : "Selling price"}: {formatKES(sale.sellingPrice)}</div>
                      <div>Payment: {sale.paymentMethod ?? "N/A"}</div>
                      <div>Receipt: {sale.receiptNumber || "N/A"}</div>
                      {hasReceiptItems ? (
                        <div className="text-[10px] uppercase tracking-wide text-slate-500">
                          {((sale.itemsPending ?? sale.receiptItems?.length ?? 0) || 0).toLocaleString()} pending
                          {sale.itemsTotal ? ` of ${sale.itemsTotal}` : ""} items
                        </div>
                      ) : (
                        <div className="text-[10px] uppercase tracking-wide text-slate-500">1 item pending</div>
                      )}
                    </td>
                    <td className="px-3 py-3 align-top">
                      {hasReceiptItems ? (
                        <div className="space-y-2">
                          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-2 text-xs text-slate-300">
                            <ul className="list-disc space-y-1 pl-4 text-slate-100">
                              {receiptItems!.map((item) => (
                                <li key={item.id} className="flex items-center justify-between gap-2">
                                  <span>{item.productName || "Receipt item"}</span>
                                  {typeof item.saleValue === "number" ? (
                                    <span className="text-slate-400">{formatKES(item.saleValue)}</span>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <Input
                            type="number"
                            min="0"
                            step="50"
                            value={buyingDrafts[saveToCatalogKey] ?? ""}
                            placeholder="Total buying price"
                            onChange={(e) => handleSetDraft(saveToCatalogKey, e.target.value)}
                          />
                          <label className={`flex items-start gap-2 text-xs ${canSaveToCatalog ? "text-slate-300" : "text-slate-500"}`}>
                            <input
                              type="checkbox"
                              checked={Boolean(saveToCatalogDrafts[saveToCatalogKey])}
                              disabled={!canSaveToCatalog}
                              onChange={(e) => handleSetSaveToCatalog(saveToCatalogKey, e.target.checked)}
                              className="mt-0.5"
                            />
                            <span>
                              Save this buying price to product catalog for future profit calculation
                              {!canSaveToCatalog ? " Catalog product not linked, buying price cannot be saved for future use." : ""}
                            </span>
                          </label>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Input
                            type="number"
                            min="0"
                            step="50"
                            value={buyingDrafts[saveToCatalogKey] ?? ""}
                            placeholder="Buying price"
                            onChange={(e) => handleSetDraft(saveToCatalogKey, e.target.value)}
                          />
                          <label className="flex items-start gap-2 text-xs text-slate-500">
                            <input
                              type="checkbox"
                              checked={false}
                              disabled
                              readOnly
                              className="mt-0.5"
                            />
                            <span>
                              Save this buying price to product catalog for future profit calculation. Catalog product not linked, buying price cannot be saved for future use.
                            </span>
                          </label>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 align-top space-y-2">
                      {hasReceiptItems ? (
                        <Button
                          onClick={() => (isSupportReceipt ? handlePriceSupportReceipt(sale) : handlePriceReceiptGroup(sale))}
                          disabled={pricingKey === getDraftKey(sale)}
                          className="w-full bg-emerald-500 text-black font-semibold hover:brightness-95"
                        >
                          {pricingKey === getDraftKey(sale) ? "Saving…" : "Price receipt"}
                        </Button>
                      ) : (
                        <Button
                          onClick={() => handlePriceSale(sale)}
                          disabled={pricingKey === getDraftKey(sale)}
                          className="w-full bg-emerald-500 text-black font-semibold hover:brightness-95"
                        >
                          {pricingKey === getDraftKey(sale) ? "Saving…" : "Price sale"}
                        </Button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteSale(sale)}
                        disabled={deletingKey === key}
                        className="w-full rounded-xl border border-red-500/60 px-3 py-2 text-sm text-red-200 hover:bg-red-500/10 disabled:opacity-60"
                      >
                        {deletingKey === key ? "Removing…" : "Remove"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
