"use client";

import { useEffect, useMemo, useState } from "react";
import Card from "@/app/_components/Card";
import Input from "@/app/_components/Input";
import Button from "@/app/_components/Button";
import { showToast } from "@/lib/ui/toast";
import type { UnpricedSale } from "@/lib/marketingUnpricedSales";

const POLL_INTERVAL_MS = 60_000;

const sourceLabels: Record<UnpricedSale["source"], string> = {
  "daily-sale": "Daily report",
  support: "Support entry",
};

const formatKES = (value: number) => `KES ${Math.round(value).toLocaleString("en-KE")}`;

const getSaleKey = (sale: UnpricedSale) => `${sale.source}:${sale.id}`;
const dayFilters = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const getDraftKey = (sale: UnpricedSale, receiptItemId?: string) =>
  receiptItemId ? `${sale.source}:item:${receiptItemId}` : getSaleKey(sale);

export default function AdminPricingPanel() {
  const [sales, setSales] = useState<UnpricedSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [buyingDrafts, setBuyingDrafts] = useState<Record<string, string>>({});
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
      const res = await fetch("/api/marketing/unpriced-sales", { cache: "no-store" });
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
    sales.forEach((sale) => {
      const key = (sale.attendantEmail || sale.attendantName || "").toLowerCase();
      if (!key) return;
      const label = sale.attendantEmail
        ? `${sale.attendantName || "Unknown"} (${sale.attendantEmail})`
        : sale.attendantName;
      if (label) map.set(key, label);
    });
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [sales]);

  const filteredSales = useMemo(() => {
    let rows = [...sales];
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
  }, [sales, search, sourceFilter, attendantFilter, paymentFilter, dayFilter, dateFilter, receiptFilter]);
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
          acc.items += 1;
        }
        return acc;
      },
      { total: 0, support: 0, items: 0 },
    );
  }, [filteredSales]);

  const handleSetDraft = (key: string, value: string) => {
    setBuyingDrafts((prev) => ({ ...prev, [key]: value }));
  };

  const allocateReceiptBuyingPrices = (total: number, items: Array<{ id: string }>) => {
    if (!items.length) return [];
    const base = Math.floor(total / items.length);
    let remainder = total - base * items.length;
    return items.map((item) => {
      const extra = remainder > 0 ? 1 : 0;
      if (remainder > 0) remainder -= 1;
      return { id: item.id, value: base + extra };
    });
  };

  const submitPrice = async (sale: UnpricedSale, receiptItemId: string | undefined, buyingPrice: number) => {
    if (sale.source === "support" && !receiptItemId) {
      throw new Error("Select a receipt item to price");
    }
    const endpoint = sale.source === "support" ? "/api/support/price-sale" : "/api/marketing/price-sale";
    const payload =
      sale.source === "support"
        ? { receiptItemId, buyingPrice }
        : { dailySaleId: sale.id, buyingPrice };
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
      const next: UnpricedSale[] = [];
      for (const row of prev) {
        if (row.id !== sale.id || row.source !== sale.source) {
          next.push(row);
          continue;
        }
        if (row.source === "support" && receiptItemId) {
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
    });
  };

  const handlePriceSale = async (sale: UnpricedSale, receiptItemId?: string) => {
    const draftKey = getDraftKey(sale, receiptItemId);
    const draft = buyingDrafts[draftKey];
    const numeric = Number(draft);
    if (!draft || Number.isNaN(numeric) || numeric <= 0) {
      showToast("Enter a valid buying price", "error");
      return;
    }
    setPricingKey(draftKey);
    try {
      await submitPrice(sale, receiptItemId, Math.round(numeric));
      setBuyingDrafts((prev) => {
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

  const handlePriceSupportReceipt = async (sale: UnpricedSale) => {
    const draftKey = getDraftKey(sale);
    const draft = buyingDrafts[draftKey];
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
        await submitPrice(sale, id, value);
      }
      setBuyingDrafts((prev) => {
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

  const handleDeleteSale = async (sale: UnpricedSale) => {
    const key = getSaleKey(sale);
    if (!window.confirm("Remove this sale from the pricing queue?")) return;
    setDeletingKey(key);
    try {
      const res = await fetch("/api/marketing/unpriced-sales/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ saleId: sale.id, source: sale.source }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Failed to delete sale");
      }
      showToast("Sale removed from queue", "success");
      setSales((prev) => prev.filter((row) => getSaleKey(row) !== key));
      setBuyingDrafts((prev) => {
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
                const hasReceiptItems = sale.source === "support" && (sale.receiptItems?.length ?? 0) > 0;
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
                      {sale.source === "support" ? (
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
                              {sale.receiptItems!.map((item) => (
                                <li key={item.id}>{item.productName || "Receipt item"}</li>
                              ))}
                            </ul>
                          </div>
                          <Input
                            type="number"
                            min="0"
                            step="50"
                            value={buyingDrafts[getDraftKey(sale)] ?? ""}
                            placeholder="Total buying price"
                            onChange={(e) => handleSetDraft(getDraftKey(sale), e.target.value)}
                          />
                        </div>
                      ) : (
                        <Input
                          type="number"
                          min="0"
                          step="50"
                          value={buyingDrafts[getDraftKey(sale)] ?? ""}
                          placeholder="Buying price"
                          onChange={(e) => handleSetDraft(getDraftKey(sale), e.target.value)}
                        />
                      )}
                    </td>
                    <td className="px-3 py-3 align-top space-y-2">
                      {hasReceiptItems ? (
                        <Button
                          onClick={() => handlePriceSupportReceipt(sale)}
                          disabled={pricingKey === getDraftKey(sale)}
                          className="w-full"
                        >
                          {pricingKey === getDraftKey(sale) ? "Saving…" : "Price receipt"}
                        </Button>
                      ) : (
                        <Button
                          onClick={() => handlePriceSale(sale)}
                          disabled={pricingKey === getDraftKey(sale)}
                          className="w-full"
                        >
                          {pricingKey === getDraftKey(sale) ? "Saving…" : "Price sale"}
                        </Button>
                      ) : null}
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
