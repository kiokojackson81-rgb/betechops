"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import ToastContainer from "@/app/_components/ToastContainer";
import { showToast } from "@/lib/ui/toast";
import { Platform } from "@prisma/client";
import { parseMarketplaceProfitTransaction } from "@/lib/marketplaceProfitParser";

const currency = new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 });

type CaptureResponse = {
  id: string;
  accountId?: string;
  platform: Platform;
  date: string;
  weekStart: string;
  periodKey: string;
  itemCreditTxn: string;
  itemCreditAmount: number;
  commissionAmount: number;
  shippingAmount: number;
  netPayout: number;
  buyingPrice: number;
  profit: number;
  marginPct: number;
  commissionRatePct: number;
};

type AccountOption = { id: string; platform: Platform; displayName: string };

export default function ProfitCaptureFormClient(props: { accounts: AccountOption[] }) {
  const [accountId, setAccountId] = useState<string>("");
  const [shopSearch, setShopSearch] = useState<string>("");
  const [transactionText, setTransactionText] = useState("");
  const [buyingPriceKes, setBuyingPriceKes] = useState("");
  const [orderId, setOrderId] = useState("");
  const [sku, setSku] = useState("");
  const [productName, setProductName] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<CaptureResponse | null>(null);
  const [showMore, setShowMore] = useState(false);

  const buyingNum = useMemo(() => Number(buyingPriceKes), [buyingPriceKes]);

  const filteredAccounts = useMemo(() => {
    const q = shopSearch.trim().toLowerCase();
    if (!q) return props.accounts;
    return props.accounts.filter((a) => (a.displayName || "").toLowerCase().includes(q) || a.platform.toLowerCase().includes(q));
  }, [props.accounts, shopSearch]);

  const parsedPreview = useMemo(() => {
    if (!transactionText.trim()) return { ok: false as const, error: "" };
    try {
      const parsed = parseMarketplaceProfitTransaction(transactionText);
      const netPayout = parsed.itemCreditAmount + parsed.commissionAmount + parsed.shippingAmount;
      const profit = netPayout - (Number.isFinite(buyingNum) ? buyingNum : 0);
      const marginPct = netPayout !== 0 ? (profit / netPayout) * 100 : 0;
      const commissionRatePct = parsed.itemCreditAmount !== 0 ? (Math.abs(parsed.commissionAmount) / parsed.itemCreditAmount) * 100 : 0;
      return {
        ok: true as const,
        parsed,
        netPayout,
        profit,
        marginPct,
        commissionRatePct,
      };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : "Could not parse transaction details",
      };
    }
  }, [buyingNum, transactionText]);

  const onSubmit = async () => {
    if (!accountId) {
      showToast("Select a shop first", "error");
      return;
    }
    if (!transactionText.trim()) {
      showToast("Paste the transaction details first", "error");
      return;
    }
    if (!Number.isFinite(buyingNum) || buyingNum < 0) {
      showToast("Enter a valid buying price", "error");
      return;
    }
    if (!parsedPreview.ok) {
      showToast("Could not parse transaction details. Please paste the full block.", "error");
      return;
    }

    setSaving(true);
    setLastSaved(null);
    try {
      const res = await fetch("/api/admin/marketplace-profit-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          transactionText,
          buyingPriceKes: buyingNum,
          orderId: orderId.trim() || null,
          sku: sku.trim() || null,
          productName: productName.trim() || null,
        }),
      });
      const data = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        throw new Error(data?.error || "Failed to save profit entry");
      }
      setLastSaved(data as CaptureResponse);
      showToast("Profit entry saved", "success");
      setTransactionText("");
      setBuyingPriceKes("");
      setOrderId("");
      setSku("");
      setProductName("");
    } catch (err) {
      console.error(err);
      showToast(err instanceof Error ? err.message : "Failed to save profit entry", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <ToastContainer />

      <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-white">Capture entry</h2>
          <Link href="/admin/online/performance" className="text-sm font-semibold text-emerald-200 hover:text-emerald-100">
            Back to performance →
          </Link>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <label className="text-sm text-slate-300">
            Shop search
            <input
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm"
              value={shopSearch}
              onChange={(e) => setShopSearch(e.target.value)}
              placeholder="Search shop name or platform..."
            />
          </label>

          <label className="text-sm text-slate-300">
            Shop
            <select
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              <option value="">Select shop...</option>
              {(["JUMIA", "KILIMALL"] as Platform[]).map((platform) => {
                const items = filteredAccounts.filter((a) => a.platform === platform);
                if (items.length === 0) return null;
                return (
                  <optgroup key={platform} label={platform}>
                    {items.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.displayName} — {platform}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
          </label>

          <label className="text-sm text-slate-300">
            Buying price (KES)
            <input
              type="number"
              min="0"
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm"
              value={buyingPriceKes}
              onChange={(e) => setBuyingPriceKes(e.target.value)}
              placeholder="e.g. 2500"
            />
          </label>

          <label className="text-sm text-slate-300 lg:col-span-2">
            Paste transaction details
            <textarea
              className="mt-1 h-56 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm"
              value={transactionText}
              onChange={(e) => setTransactionText(e.target.value)}
              placeholder="Paste the full transaction block here (Item Price Credit, Commission, Shipping Fee, Date...)"
            />
          </label>
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className="text-sm font-semibold text-slate-200 hover:text-white"
          >
            {showMore ? "Hide" : "More details"} →
          </button>
          {showMore && (
            <div className="mt-3 grid gap-4 lg:grid-cols-2">
              <label className="text-sm text-slate-300">
                Order ID (optional)
                <input
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  placeholder="e.g. 123456789"
                />
              </label>
              <label className="text-sm text-slate-300">
                SKU (optional)
                <input
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="e.g. SKU-001"
                />
              </label>
              <label className="text-sm text-slate-300 lg:col-span-2">
                Product name (optional)
                <input
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="e.g. Inverter 3KVA"
                />
              </label>
            </div>
          )}
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Preview</p>
          {!transactionText.trim() ? (
            <p className="mt-2 text-sm text-slate-400">Paste the transaction block to see extracted values.</p>
          ) : parsedPreview.ok ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Date</p>
                <p className="mt-1 font-semibold text-white">{parsedPreview.parsed.date.toLocaleDateString()}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs uppercase tracking-wide text-slate-500">Item credit</p>
                <p className="mt-1 font-semibold text-white">
                  {parsedPreview.parsed.itemCreditTxn} • {currency.format(parsedPreview.parsed.itemCreditAmount)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Commission %</p>
                <p className="mt-1 font-semibold text-slate-100">{parsedPreview.commissionRatePct.toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Commission</p>
                <p className="mt-1 font-semibold text-slate-100">{currency.format(parsedPreview.parsed.commissionAmount)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Shipping</p>
                <p className="mt-1 font-semibold text-slate-100">{currency.format(parsedPreview.parsed.shippingAmount)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Net payout</p>
                <p className="mt-1 font-semibold text-emerald-300">{currency.format(parsedPreview.netPayout)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Profit</p>
                <p className={`mt-1 font-semibold ${parsedPreview.profit < 0 ? "text-red-300" : "text-emerald-200"}`}>
                  {currency.format(parsedPreview.profit)} ({parsedPreview.marginPct.toFixed(1)}%)
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-red-200">{parsedPreview.error}</p>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onSubmit}
            disabled={saving || !accountId || !Number.isFinite(buyingNum) || buyingNum < 0 || !parsedPreview.ok}
            className="rounded-full bg-emerald-500 px-6 py-2 text-sm font-semibold text-black hover:brightness-95 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save profit entry"}
          </button>
          <p className="text-xs text-slate-500">
            Tip: include lines for <span className="text-slate-300">Item Price Credit</span>,{" "}
            <span className="text-slate-300">Commission</span>, and <span className="text-slate-300">Shipping Fee</span>.
          </p>
        </div>
      </section>

      {lastSaved && (
        <section className="rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-6">
          <h3 className="text-lg font-semibold text-white">Saved</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Txn</p>
              <p className="mt-1 font-semibold text-white">{lastSaved.itemCreditTxn}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Net payout</p>
              <p className="mt-1 font-semibold text-emerald-300">{currency.format(lastSaved.netPayout)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Profit</p>
              <p className={`mt-1 font-semibold ${lastSaved.profit < 0 ? "text-red-300" : "text-emerald-200"}`}>
                {currency.format(lastSaved.profit)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Margin %</p>
              <p className="mt-1 font-semibold text-slate-100">{Number(lastSaved.marginPct ?? 0).toFixed(1)}%</p>
            </div>
          </div>
          <div className="mt-4 text-sm text-slate-300">
            Week start: <span className="font-semibold text-white">{String(lastSaved.weekStart).slice(0, 10)}</span>{" "}
            | Trading period key: <span className="font-semibold text-white">{lastSaved.periodKey}</span>
          </div>
        </section>
      )}
    </div>
  );
}
