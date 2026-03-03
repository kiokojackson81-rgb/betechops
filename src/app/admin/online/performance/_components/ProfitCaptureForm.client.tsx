"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ToastContainer from "@/app/_components/ToastContainer";
import { showToast } from "@/lib/ui/toast";
import { Platform } from "@prisma/client";
type PreviewItem = {
  extracted: {
    method: string;
    confidence: number;
    notes: string[];
    date: string;
    currency: "KES";
    item_price_credit: { amount: number; txn: string };
    commission: { amount: number; txn: string };
    shipping_fee: { amount: number; txn: string };
  };
  computed: {
    netPayout: number;
    buyingPriceKes: number;
    profit: number;
    marginPct: number;
    commissionRatePct: number;
    isLoss: boolean;
  };
};

type PreviewPayload = {
  account: { id: string; displayName: string; platform: Platform };
  mode: "single" | "batch";
  rawText: string;
  items: PreviewItem[];
  totals: {
    netPayout: number;
    profit: number;
    lossCount: number;
  };
};

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

type CaptureBatchResponse = {
  mode: "batch" | "single";
  createdCount: number;
  duplicateCount: number;
  failedCount: number;
  duplicates: string[];
  failed: { txn?: string; error: string }[];
  items: CaptureResponse[];
};

type AccountOption = { id: string; platform: Platform; displayName: string };

export default function ProfitCaptureFormClient(props: {
  accounts: AccountOption[];
  limitedView?: boolean;
  backHref?: string;
}) {
  const router = useRouter();
  const [accountId, setAccountId] = useState<string>("");
  const [transactionText, setTransactionText] = useState("");
  const [buyingPriceKes, setBuyingPriceKes] = useState("");
  const [orderId, setOrderId] = useState("");
  const [sku, setSku] = useState("");
  const [productName, setProductName] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<CaptureResponse | CaptureBatchResponse | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [previewError, setPreviewError] = useState<string>("");

  const buyingNum = useMemo(() => Number(buyingPriceKes), [buyingPriceKes]);

  const canPreview =
    Boolean(accountId) &&
    Number.isFinite(buyingNum) &&
    buyingNum >= 0 &&
    transactionText.trim().length > 0;

  const canSave =
    Boolean(accountId) && Number.isFinite(buyingNum) && buyingNum >= 0 && transactionText.trim().length > 0;

  const deleteEntry = async (id: string) => {
    const ok = window.confirm("Delete this profit entry? This cannot be undone.");
    if (!ok) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/marketplace-profit-entry/${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(data?.error || "Delete failed");
      showToast("Deleted", "success");
      setLastSaved((prev) => {
        if (!prev) return prev;
        if ("items" in prev) {
          return { ...prev, items: prev.items.filter((x) => x.id !== id), createdCount: Math.max(0, prev.createdCount - 1) };
        }
        return prev.id === id ? null : prev;
      });
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Delete failed", "error");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem("betechops:profit-capture:accountId") ?? "";
      if (!saved) return;
      if (props.accounts.some((a) => a.id === saved)) {
        setAccountId(saved);
      }
    } catch {}
  }, [props.accounts]);

  useEffect(() => {
    try {
      if (accountId) localStorage.setItem("betechops:profit-capture:accountId", accountId);
      else localStorage.removeItem("betechops:profit-capture:accountId");
    } catch {}
  }, [accountId]);

  const runPreview = async () => {
    if (!accountId) return showToast("Select a shop first", "error");
    if (!transactionText.trim()) return showToast("Paste the transaction details first", "error");
    if (!Number.isFinite(buyingNum) || buyingNum < 0) return showToast("Enter a valid buying price", "error");

    setPreview(null);
    setPreviewError("");
    setSaving(true);
    try {
      const res = await fetch("/api/admin/marketplace-profit-entry/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, buyingPriceKes: buyingNum, transactionText }),
      });
      const data = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        throw new Error(data?.error || "Preview failed");
      }
      const payload = data as PreviewPayload;
      setPreview(payload);

      showToast("Preview ready", "success");
    } catch (err) {
      console.error(err);
      setPreviewError(err instanceof Error ? err.message : "Preview failed");
      showToast(err instanceof Error ? err.message : "Preview failed", "error");
    } finally {
      setSaving(false);
    }
  };

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

    setSaving(true);
    setLastSaved(null);
    try {
      const saveOnce = async (opts: { allowDuplicates?: boolean }) => {
        const res = await fetch("/api/admin/marketplace-profit-entry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId,
            transactionText: preview?.rawText || transactionText,
            buyingPriceKes: buyingNum,
            orderId: orderId.trim() || null,
            sku: sku.trim() || null,
            productName: productName.trim() || null,
            allowDuplicates: Boolean(opts.allowDuplicates),
          }),
        });
        const data = (await res.json().catch(() => null)) as any;
        return { res, data };
      };

      let { res, data } = await saveOnce({ allowDuplicates: false });
      if (res.status === 409 && Array.isArray(data?.existingTxns) && data.existingTxns.length > 0) {
        const existingTxns = data.existingTxns.map((t: any) => String(t)).filter(Boolean);
        const sample = existingTxns.slice(0, 3).join(", ");
        const msg =
          existingTxns.length === 1
            ? `This unique number already exists for this shop: ${sample}. Save anyway?`
            : `Some unique numbers already exist for this shop (${existingTxns.length}): ${sample}${
                existingTxns.length > 3 ? ", ..." : ""
              }. Save anyway?`;
        const ok = window.confirm(msg);
        if (!ok) return;
        ({ res, data } = await saveOnce({ allowDuplicates: true }));
      }

      if (!res.ok) {
        throw new Error(data?.error || "Failed to save profit entry");
      }

      setLastSaved(data as any);
      showToast("Profit entry saved", "success");
      setTransactionText("");
      setBuyingPriceKes("");
      setOrderId("");
      setSku("");
      setProductName("");
      setPreview(null);
      setPreviewError("");
      router.refresh();
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
          <Link
            href={props.backHref ?? "/admin/online/performance"}
            className="text-sm font-semibold text-emerald-200 hover:text-emerald-100"
          >
            Back to performance
          </Link>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <label className="text-sm text-slate-300">
            Shop
            <select
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              <option value="">Select shop...</option>
              {(["JUMIA", "KILIMALL"] as Platform[]).map((platform) => {
                const items = props.accounts.filter((a) => a.platform === platform);
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
            {showMore ? "Hide" : "More details"}
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
          ) : preview ? (
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <p className="text-slate-300">
                  Shop: <span className="font-semibold text-white">{preview.account.displayName}</span> —{" "}
                  <span className="font-semibold text-white">{preview.account.platform}</span>
                </p>
                <p className="text-xs text-slate-400">
                  Transactions: <span className="font-semibold text-slate-200">{preview.items.length}</span>
                </p>
              </div>
              {preview.items.some((i) => i.extracted.notes?.length) ? (
                <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-300">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Warnings</p>
                  <ul className="mt-2 list-disc pl-5">
                    {preview.items.flatMap((i) => i.extracted.notes ?? []).slice(0, 8).map((n, idx) => (
                      <li key={`${idx}-${n}`}>{n}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {!props.limitedView ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Total net payout</p>
                    <p className="mt-1 font-semibold text-emerald-300">{currency.format(preview.totals.netPayout)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Total profit</p>
                    <p className={`mt-1 font-semibold ${preview.totals.profit < 0 ? "text-red-300" : "text-emerald-200"}`}>
                      {currency.format(preview.totals.profit)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Loss entries</p>
                    <p className="mt-1 font-semibold text-amber-200">{preview.totals.lossCount}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Buying price (each)</p>
                    <p className="mt-1 font-semibold text-slate-100">{currency.format(buyingNum || 0)}</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-300">
                  Totals hidden for supervisor view. Review profit per item below.
                </div>
              )}

              <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/10">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-slate-400">
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Txn</th>
                      <th className="px-3 py-2 text-right">Net payout</th>
                      <th className="px-3 py-2 text-right">Profit</th>
                      <th className="px-3 py-2 text-right">Commission %</th>
                      <th className="px-3 py-2 text-right">Confidence</th>
                      <th className="px-3 py-2">Method</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.items.map((it) => (
                      <tr key={it.extracted.item_price_credit.txn} className="border-t border-white/5">
                        <td className="px-3 py-2 text-slate-200">{new Date(it.extracted.date).toLocaleDateString()}</td>
                        <td className="px-3 py-2 font-medium text-white">{it.extracted.item_price_credit.txn}</td>
                        <td className="px-3 py-2 text-right text-slate-200">{currency.format(it.computed.netPayout)}</td>
                        <td className={`px-3 py-2 text-right font-semibold ${it.computed.profit < 0 ? "text-red-300" : "text-emerald-200"}`}>
                          {currency.format(it.computed.profit)}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-200">{it.computed.commissionRatePct.toFixed(1)}%</td>
                        <td className="px-3 py-2 text-right text-slate-200">{(it.extracted.confidence ?? 0).toFixed(2)}</td>
                        <td className="px-3 py-2 text-slate-300">{it.extracted.method}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-400">
              Optional: click <span className="font-semibold text-slate-200">Preview</span> to verify extraction before saving.
              {previewError ? <span className="block pt-2 text-red-200">{previewError}</span> : null}
            </p>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={runPreview}
            disabled={saving || !canPreview}
            className="rounded-full border border-white/15 bg-white/5 px-6 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-60"
          >
            {saving ? "Working..." : "Preview"}
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={saving || !canSave}
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
          {"items" in lastSaved ? (
            <>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Created</p>
                  <p className="mt-1 font-semibold text-white">{lastSaved.createdCount}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Duplicates</p>
                  <p className="mt-1 font-semibold text-slate-100">{lastSaved.duplicateCount}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Failed</p>
                  <p className="mt-1 font-semibold text-slate-100">{lastSaved.failedCount}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Tip</p>
                  <p className="mt-1 text-slate-300">Duplicates are skipped automatically.</p>
                </div>
              </div>

              {lastSaved.items?.length ? (
                <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10 bg-black/20">
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Txn</th>
                        <th className="px-3 py-2">Net</th>
                        <th className="px-3 py-2">Profit</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {lastSaved.items.slice(0, 25).map((it) => (
                        <tr key={it.id} className="hover:bg-white/5">
                          <td className="px-3 py-2 font-semibold text-slate-100">{it.itemCreditTxn}</td>
                          <td className="px-3 py-2 text-emerald-300">{currency.format(it.netPayout)}</td>
                          <td className={`px-3 py-2 ${it.profit < 0 ? "text-red-300" : "text-emerald-200"}`}>
                            {currency.format(it.profit)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => deleteEntry(it.id)}
                              className="rounded-full border border-red-400/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-100 hover:bg-red-500/15 disabled:opacity-60"
                              disabled={saving}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </>
          ) : (
            <>
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
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => deleteEntry(String(lastSaved.id))}
                  disabled={saving}
                  className="rounded-full border border-red-400/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-100 hover:bg-red-500/15 disabled:opacity-60"
                >
                  Delete entry
                </button>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
