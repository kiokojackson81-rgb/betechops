"use client";

import { useEffect, useState } from "react";
import Card from "@/app/_components/Card";
import { showToast } from "@/lib/ui/toast";

type UnpricedOrder = {
  id: string;
  accountId: string;
  accountName: string;
  platform: string;
  orderId: string;
  orderItemId: string;
  status: string;
  orderedAt: string;
  productName: string;
  productUrl?: string;
  sellingPrice: number;
  currency: string;
  suggestedBuyingPrice: number | null;
};

export default function UnpricedOrdersCard() {
  const [orders, setOrders] = useState<UnpricedOrder[]>([]);
  const [status, setStatus] = useState<string>("all");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/online/unpriced-orders?status=${encodeURIComponent(status)}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load unpriced orders");
      const data = await res.json().catch(() => null);
      setOrders(data?.orders ?? []);
      setDrafts({});
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load unpriced orders", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    window.addEventListener("onlineOps:refresh", fetchOrders);
    return () => window.removeEventListener("onlineOps:refresh", fetchOrders);
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [status]);

  const handleSave = async (order: UnpricedOrder) => {
    const input = drafts[order.id] ?? "";
    const parsed = Number(input || order.suggestedBuyingPrice || 0);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      showToast("Enter a valid buying price", "warn");
      return;
    }
    try {
      const res = await fetch("/api/online/price-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderItemId: order.orderItemId, buyingPrice: parsed }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => null);
        throw new Error(error?.error || "Failed to save buying price");
      }
      showToast("Buying price saved", "success");
      setOrders((prev) => prev.filter((item) => item.id !== order.id));
      window.dispatchEvent(new CustomEvent("onlineOps:refresh"));
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save buying price", "error");
    }
  };

  return (
    <Card className="space-y-4 border-slate-800 bg-slate-900/40 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Orders needing buying price</h3>
          <p className="text-sm text-slate-400">Approve costs so profit + commission can be booked.</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-xl bg-white/5 border border-white/10 px-2 py-1 text-sm text-slate-200"
          >
            <option value="all">All unpriced</option>
            <option value="pending">Pending</option>
            <option value="delivered">Delivered</option>
          </select>
          <button
          type="button"
          className="rounded-xl border border-white/10 px-3 py-1 text-xs text-slate-300 hover:bg-white/5"
          onClick={fetchOrders}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
        </div>
      </div>

      {loading && !orders.length ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-6 text-sm text-slate-400">
          Loading unpriced orders…
        </div>
      ) : null}

      {!loading && orders.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-6 text-sm text-slate-400">
          All caught up! No pending pricing items.
        </div>
      ) : null}

      <div className="space-y-3">
        {orders.map((order) => (
          <div key={order.id} className="space-y-2 rounded-2xl border border-slate-800 bg-slate-950/50 p-3">
            <div className="flex items-center justify-between text-sm">
              <div>
                <p className="font-semibold text-slate-100">{order.productName}</p>
                <p className="text-xs text-slate-400">
                  {order.accountName} • {order.platform}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">Selling price</p>
                <p className="text-lg font-semibold text-emerald-400">KES {order.sellingPrice.toLocaleString()}</p>
              </div>
            </div>
            {order.productUrl ? (
              <a
                href={order.productUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-emerald-400 underline"
              >
                View listing
              </a>
            ) : null}
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <input
                type="number"
                min={0}
                placeholder={order.suggestedBuyingPrice ? `Suggested: ${order.suggestedBuyingPrice}` : "Enter buying price"}
                value={drafts[order.id] ?? ""}
                onChange={(e) => setDrafts((prev) => ({ ...prev, [order.id]: e.target.value }))}
                className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
              <button
                type="button"
                className="rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-black hover:brightness-95"
                onClick={() => handleSave(order)}
              >
                Save price
              </button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
