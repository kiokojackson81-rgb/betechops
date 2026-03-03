"use client";

import { useEffect, useMemo, useState } from "react";
import { showToast } from "@/lib/ui/toast";
import { withImpersonateId } from "@/lib/impersonation";

const currency = new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 2 });

export type MarketplaceShopOption = {
  id: string;
  displayName: string | null;
  shopName?: string | null;
  platform: "JUMIA" | "KILIMALL";
  primaryAttendantId?: string | null;
};

export type MarketplaceWeekOption = {
  startInput: string;
  endInput: string;
  label: string;
};

type PreviewRow = {
  key: string;
  dateUtc: string;
  orderNo: string;
  orderItemNo: string;
  details: string;
  sellerSku: string;
  jumiaSku: string;
  itemCreditTxn: string;
  commissionTxn: string | null;
  shippingTxn: string | null;
  otherTxn: string[];
  grossSale: number;
  commission: number;
  shippingFee: number;
  otherFees: number;
  netPayout: number;
  statementNumber: string;
  paidStatus: string;
  orderItemStatus: string;
  shippingProvider: string;
  trackingNumber: string;
  countryCode: string;
};

type DraftState = {
  version: 1;
  savedAt: string;
  shopId: string;
  weekStart: string;
  rows: PreviewRow[];
  buyingByTxn: Record<string, string>;
};

export default function MarketplaceWeeklyCsvUpload(props: {
  title?: string;
  shops: MarketplaceShopOption[];
  weeks: MarketplaceWeekOption[];
  defaultWeekStart?: string;
  assignees?: Array<{ id: string; name: string }>;
  defaultAssigneeId?: string;
  disableAssigneeSelect?: boolean;
  hideSummaryTotals?: boolean;
  impersonateId?: string | null;
  onImported?: () => void;
}) {
  const weeks = props.weeks ?? [];
  const defaultWeekStart = props.defaultWeekStart ?? weeks.at(-1)?.startInput ?? weeks[0]?.startInput ?? "";

  const [shopId, setShopId] = useState("");
  const [weekStart, setWeekStart] = useState(defaultWeekStart);
  const [assigneeId, setAssigneeId] = useState(props.defaultAssigneeId ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [existingTxns, setExistingTxns] = useState<string[]>([]);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [activeTab, setActiveTab] = useState<"orders" | "profit">("orders");
  const [buyingByTxn, setBuyingByTxn] = useState<Record<string, string>>({});
  const [bulkBuying, setBulkBuying] = useState<string>("");
  const [submitted, setSubmitted] = useState(false);

  const selectedWeek = useMemo(() => weeks.find((w) => w.startInput === weekStart) ?? null, [weeks, weekStart]);
  const selectedShop = useMemo(() => props.shops.find((s) => s.id === shopId) ?? null, [props.shops, shopId]);

  const draftKey = useMemo(() => {
    if (!shopId || !weekStart) return "";
    return `betechops:csv-draft:v1:${shopId}:${weekStart}`;
  }, [shopId, weekStart]);

  const canSubmit = useMemo(() => {
    if (!rows.length) return false;
    // Require buying price for every row to avoid showing profit as net payout.
    return rows.every((r) => {
      const raw = String(buyingByTxn[r.itemCreditTxn] ?? "").trim();
      if (!raw) return false;
      const n = Number(raw);
      return Number.isFinite(n) && n >= 0;
    });
  }, [rows, buyingByTxn]);

  const totals = useMemo(() => {
    const netPayout = rows.reduce((sum, r) => sum + Number(r.netPayout ?? 0), 0);
    const grossSale = rows.reduce((sum, r) => sum + Number(r.grossSale ?? 0), 0);
    const duplicates = rows.filter((r) => existingTxns.includes(r.itemCreditTxn)).length;
    const profit = rows.reduce((sum, r) => {
      const buying = Number(buyingByTxn[r.itemCreditTxn] ?? 0);
      return sum + (Number(r.netPayout ?? 0) - (Number.isFinite(buying) ? buying : 0));
    }, 0);
    return { netPayout, grossSale, duplicates, profit };
  }, [rows, existingTxns, buyingByTxn]);

  const buildPayloadRows = () => {
    return rows.map((r) => {
      const buyingRaw = buyingByTxn[r.itemCreditTxn];
      const buyingPriceKes = buyingRaw === undefined || buyingRaw === null || String(buyingRaw).trim() === "" ? null : Number(buyingRaw);
      return {
        dateUtc: r.dateUtc,
        orderNo: r.orderNo,
        orderItemNo: r.orderItemNo,
        details: r.details,
        sellerSku: r.sellerSku,
        jumiaSku: r.jumiaSku,
        itemCreditTxn: r.itemCreditTxn,
        commissionTxn: r.commissionTxn,
        shippingTxn: r.shippingTxn,
        otherTxn: r.otherTxn,
        grossSale: r.grossSale,
        commission: r.commission,
        shippingFee: r.shippingFee,
        otherFees: r.otherFees,
        buyingPriceKes,
        statementNumber: r.statementNumber,
        paidStatus: r.paidStatus,
        orderItemStatus: r.orderItemStatus,
        shippingProvider: r.shippingProvider,
        trackingNumber: r.trackingNumber,
        countryCode: r.countryCode,
      };
    });
  };

  const loadStatement = async () => {
    if (!shopId) {
      showToast("Select a shop first", "error");
      return;
    }
    if (!weekStart) {
      showToast("Select a week first", "error");
      return;
    }
    if (!file) {
      showToast("Upload a CSV file first", "error");
      return;
    }

    setLoading(true);
    try {
      const form = new FormData();
      form.set("accountId", shopId);
      form.set("weekStart", weekStart);
      form.set("file", file);

      const res = await fetch(withImpersonateId("/api/admin/marketplace-profit-entry/csv/preview", props.impersonateId ?? null), {
        method: "POST",
        body: form,
      });
      const data = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(data?.error || "Preview failed");

      const items = Array.isArray(data?.items) ? (data.items as PreviewRow[]) : [];
      setRows(items);
      setExistingTxns(Array.isArray(data?.existingTxns) ? (data.existingTxns as string[]) : []);
      setBuyingByTxn({});
      setActiveTab("orders");
      setSubmitted(false);
      if (data?.aggregated?.errors?.length) {
        showToast(String(data.aggregated.errors[0] ?? "Preview warning"), "warn");
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Preview failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const importNow = async (allowDuplicates: boolean) => {
    if (!shopId || !weekStart || !rows.length) {
      showToast("Load the statement first", "error");
      return;
    }
    if (!canSubmit) {
      showToast("Enter buying price for all rows before submitting", "error");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(withImpersonateId("/api/admin/marketplace-profit-entry/csv", props.impersonateId ?? null), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: shopId,
          weekStart,
          userId: props.disableAssigneeSelect ? (props.defaultAssigneeId ?? null) : (assigneeId || null),
          allowDuplicates,
          rows: buildPayloadRows(),
        }),
      });

      const data = (await res.json().catch(() => null)) as any;
      if (res.status === 409) {
        const existing = Array.isArray(data?.existingTxns) ? (data.existingTxns as string[]) : [];
        const ok = window.confirm(
          `Duplicate unique numbers detected (${existing.length}). Do you want to continue and import anyway?`,
        );
        if (ok) {
          await importNow(true);
        }
        return;
      }

      if (!res.ok) throw new Error(data?.error || "Import failed");

      showToast(
        `Imported: ${Number(data?.createdCount ?? 0)} | Duplicates: ${Number(data?.duplicateCount ?? 0)} | Failed: ${Number(
          data?.failedCount ?? 0,
        )}`,
        "success",
      );
      setSubmitted(true);
      setActiveTab("profit");
      // Clear draft so reload doesn't bring back already-submitted rows.
      try {
        if (draftKey) localStorage.removeItem(draftKey);
      } catch {}
      props.onImported?.();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Import failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const perRowProfit = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const buying = Number(buyingByTxn[r.itemCreditTxn] ?? 0);
      map.set(r.itemCreditTxn, Number(r.netPayout ?? 0) - (Number.isFinite(buying) ? buying : 0));
    }
    return map;
  }, [rows, buyingByTxn]);

  const updateBuying = (txn: string, next: string) => {
    setBuyingByTxn((prev) => ({ ...prev, [txn]: next }));
  };

  const applyBulkBuying = () => {
    const raw = String(bulkBuying ?? "").trim();
    const n = Number(raw);
    if (!raw || !Number.isFinite(n) || n < 0) {
      showToast("Enter a valid bulk buying price", "error");
      return;
    }
    setBuyingByTxn((prev) => {
      const next = { ...prev };
      for (const r of rows) {
        if (!String(next[r.itemCreditTxn] ?? "").trim()) {
          next[r.itemCreditTxn] = raw;
        }
      }
      return next;
    });
  };

  // Restore draft after reload (client-only).
  useEffect(() => {
    if (!draftKey) return;
    if (rows.length) return;
    if (submitted) return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as DraftState;
      if (!parsed || parsed.version !== 1) return;
      if (parsed.shopId !== shopId || parsed.weekStart !== weekStart) return;
      setRows(Array.isArray(parsed.rows) ? parsed.rows : []);
      setBuyingByTxn(parsed.buyingByTxn && typeof parsed.buyingByTxn === "object" ? parsed.buyingByTxn : {});
      setSubmitted(false);
      setActiveTab("orders");
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  // Persist draft while editing so refresh doesn't lose work.
  useEffect(() => {
    if (!draftKey) return;
    if (!rows.length) return;
    if (submitted) return;
    const draft: DraftState = {
      version: 1,
      savedAt: new Date().toISOString(),
      shopId,
      weekStart,
      rows,
      buyingByTxn,
    };
    try {
      localStorage.setItem(draftKey, JSON.stringify(draft));
    } catch {}
  }, [draftKey, rows, buyingByTxn, submitted, shopId, weekStart]);

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">{props.title ?? "CSV weekly upload"}</h2>
          <p className="text-sm text-slate-300">Load a statement file, enter buying prices, then submit to save.</p>
        </div>
        <div className="flex gap-2">
          <button
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 hover:bg-slate-900 disabled:opacity-50"
            onClick={() => void loadStatement()}
            disabled={loading || saving}
            type="button"
          >
            {loading ? "Loading..." : "Load statement"}
          </button>
          <button
            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            onClick={() => void importNow(false)}
            disabled={saving || loading || !rows.length || !canSubmit}
            type="button"
          >
            {saving ? "Submitting..." : "Submit"}
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <label className="block">
          <div className="mb-1 text-xs text-slate-400">Shop</div>
          <select
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            value={shopId}
            onChange={(e) => {
              const next = e.target.value;
              setShopId(next);
              if (!props.disableAssigneeSelect && !assigneeId) {
                const shop = props.shops.find((s) => s.id === next) ?? null;
                const primary = shop?.primaryAttendantId ?? "";
                if (primary) setAssigneeId(primary);
              }
            }}
          >
            <option value="">Select shop...</option>
            {props.shops.map((s) => (
              <option key={s.id} value={s.id}>
                {(s.displayName || s.shopName || s.id).trim()} ({s.platform})
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <div className="mb-1 text-xs text-slate-400">Week</div>
          <select
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            value={weekStart}
            onChange={(e) => setWeekStart(e.target.value)}
          >
            {weeks.map((w) => (
              <option key={w.startInput} value={w.startInput}>
                {w.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <div className="mb-1 text-xs text-slate-400">CSV file</div>
          <input
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setRows([]);
              setBuyingByTxn({});
              setSubmitted(false);
              setActiveTab("orders");
            }}
          />
        </label>

        <label className="block">
          <div className="mb-1 text-xs text-slate-400">Assign to</div>
          <select
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 disabled:opacity-50"
            value={props.disableAssigneeSelect ? (props.defaultAssigneeId ?? "") : assigneeId}
            disabled={props.disableAssigneeSelect || !props.assignees?.length}
            onChange={(e) => setAssigneeId(e.target.value)}
          >
            <option value="">(Optional)</option>
            {(props.assignees ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          {selectedShop?.primaryAttendantId && !props.disableAssigneeSelect ? (
            <div className="mt-1 text-xs text-slate-500">Default assignee comes from shop primary attendant.</div>
          ) : null}
        </label>
      </div>

      {rows.length ? (
        <div className="mt-4">
          {!props.hideSummaryTotals ? (
            <div className="mb-3 grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                <div className="text-xs text-slate-400">Rows</div>
                <div className="text-base font-semibold text-slate-100">{rows.length}</div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                <div className="text-xs text-slate-400">Net payout total</div>
                <div className="text-base font-semibold text-slate-100">{currency.format(totals.netPayout)}</div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                <div className="text-xs text-slate-400">Duplicates</div>
                <div className="text-base font-semibold text-slate-100">{totals.duplicates}</div>
              </div>
            </div>
          ) : null}

          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("orders")}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  activeTab === "orders"
                    ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-200"
                    : "border-slate-700 text-slate-200 hover:bg-white/5"
                }`}
              >
                Orders
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!submitted) return;
                  setActiveTab("profit");
                }}
                disabled={!submitted}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
                  activeTab === "profit"
                    ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-200"
                    : "border-slate-700 text-slate-200 hover:bg-white/5"
                }`}
              >
                Profit
              </button>
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <label className="block">
                <div className="mb-1 text-xs text-slate-400">Bulk buying price (KES)</div>
                <div className="flex gap-2">
                  <input
                    className="w-40 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                    inputMode="decimal"
                    placeholder="e.g. 2500"
                    value={bulkBuying}
                    onChange={(e) => setBulkBuying(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={applyBulkBuying}
                    className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 hover:bg-slate-900"
                    disabled={!rows.length}
                  >
                    Apply
                  </button>
                </div>
              </label>

              {submitted && !props.hideSummaryTotals ? (
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                  <div className="text-xs text-slate-400">Profit total</div>
                  <div className={totals.profit < 0 ? "text-base font-semibold text-rose-300" : "text-base font-semibold text-emerald-300"}>
                    {currency.format(totals.profit)}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="min-w-[1100px] w-full text-left text-sm">
              <thead className="bg-slate-950/60 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Order</th>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2">SKU</th>
                  <th className="px-3 py-2">Net</th>
                  <th className="px-3 py-2">Buying</th>
                  {submitted ? <th className="px-3 py-2">Profit</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-900/20">
                {rows.map((r) => {
                  const profit = perRowProfit.get(r.itemCreditTxn) ?? 0;
                  const isDup = existingTxns.includes(r.itemCreditTxn);
                  return (
                    <tr key={r.key} className={isDup ? "bg-amber-950/20" : ""}>
                      <td className="px-3 py-2 text-slate-200">{new Date(r.dateUtc).toLocaleDateString("en-KE")}</td>
                      <td className="px-3 py-2 text-slate-200">{r.orderNo || "-"}</td>
                      <td className="px-3 py-2 text-slate-200">
                        <div className="max-w-[420px] truncate" title={r.details}>
                          {r.details || "-"}
                        </div>
                        <div className="text-xs text-slate-400">{r.orderItemNo || ""}</div>
                      </td>
                      <td className="px-3 py-2 text-slate-200">
                        <div className="max-w-[240px] truncate" title={`${r.jumiaSku || ""} ${r.sellerSku || ""}`.trim()}>
                          {r.jumiaSku || r.sellerSku || "-"}
                        </div>
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-100">{currency.format(Number(r.netPayout ?? 0))}</td>
                      <td className="px-3 py-2">
                        <input
                          className="w-28 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
                          inputMode="decimal"
                          placeholder="0"
                          value={buyingByTxn[r.itemCreditTxn] ?? ""}
                          onChange={(e) => updateBuying(r.itemCreditTxn, e.target.value)}
                        />
                      </td>
                      {submitted ? (
                        <td className={profit < 0 ? "px-3 py-2 font-semibold text-rose-300" : "px-3 py-2 font-semibold text-emerald-300"}>
                          {currency.format(profit)}
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-2 text-xs text-slate-400">
            {selectedWeek ? `Selected week: ${selectedWeek.label}` : null} — Profit appears after you click Submit.
          </div>
        </div>
      ) : (
        <div className="mt-4 text-sm text-slate-400">No preview yet.</div>
      )}
    </section>
  );
}
