"use client";

import { useEffect, useMemo, useState } from "react";
import { showToast } from "@/lib/ui/toast";
import { withImpersonateId } from "@/lib/impersonation";

const currency = new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 });

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
  const [existingTxns, setExistingTxns] = useState<string[]>([]);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [buyingByTxn, setBuyingByTxn] = useState<Record<string, string>>({});
  const [bulkBuying, setBulkBuying] = useState<string>("");
  const [submitted, setSubmitted] = useState(false);
  const [draftId, setDraftId] = useState<string>("");
  const [submittingTxn, setSubmittingTxn] = useState<string>("");
  const [submittedByTxn, setSubmittedByTxn] = useState<Record<string, string>>({});
  const [resolvedAccountId, setResolvedAccountId] = useState<string>("");
  const [localOnlyDraft, setLocalOnlyDraft] = useState(false);

  const selectedWeek = useMemo(() => weeks.find((w) => w.startInput === weekStart) ?? null, [weeks, weekStart]);
  const selectedShop = useMemo(() => props.shops.find((s) => s.id === shopId) ?? null, [props.shops, shopId]);

  const draftKey = useMemo(() => {
    if (!shopId || !weekStart) return "";
    return `betechops:csv-draft:v1:${shopId}:${weekStart}`;
  }, [shopId, weekStart]);

  const totals = useMemo(() => {
    const netPayout = rows.reduce((sum, r) => sum + Number(r.netPayout ?? 0), 0);
    const grossSale = rows.reduce((sum, r) => sum + Number(r.grossSale ?? 0), 0);
    const duplicates = rows.filter((r) => existingTxns.includes(r.itemCreditTxn)).length;
    const profit = rows.reduce((sum, r) => {
      if (!submittedByTxn[r.itemCreditTxn]) return sum;
      const buying = Number(buyingByTxn[r.itemCreditTxn] ?? 0);
      return sum + (Number(r.netPayout ?? 0) - (Number.isFinite(buying) ? buying : 0));
    }, 0);
    const submittedCount = Object.keys(submittedByTxn).length;
    return { netPayout, grossSale, duplicates, profit, submittedCount };
  }, [rows, existingTxns, buyingByTxn, submittedByTxn]);

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
      if (props.disableAssigneeSelect) {
        if (props.defaultAssigneeId) form.set("userId", props.defaultAssigneeId);
      } else if (assigneeId) {
        form.set("userId", assigneeId);
      }
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
      setSubmitted(false);
      setSubmittedByTxn({});
      setResolvedAccountId(String(data?.account?.id ?? "").trim());
      setLocalOnlyDraft(false);
      const did = String(data?.draftId ?? "").trim();
      if (did) {
        setDraftId(did);
        try {
          localStorage.setItem(draftKey, JSON.stringify({ id: did, savedAt: new Date().toISOString() }));
        } catch {}
      } else {
        setDraftId("");
        setLocalOnlyDraft(true);
        try {
          localStorage.setItem(
            draftKey,
            JSON.stringify({
              mode: "local",
              savedAt: new Date().toISOString(),
              shopId,
              weekStart,
              accountId: String(data?.account?.id ?? "").trim(),
              existingTxns: Array.isArray(data?.existingTxns) ? (data.existingTxns as string[]) : [],
              rows: items,
              buyingByTxn: {},
              submittedByTxn: {},
            }),
          );
        } catch {}
        showToast("Draft saved locally (DB update pending). You can still submit rows.", "warn");
      }
      if (data?.aggregated?.errors?.length) {
        showToast(String(data.aggregated.errors[0] ?? "Preview warning"), "warn");
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Preview failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const perRowProfit = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      if (!submittedByTxn[r.itemCreditTxn]) continue;
      const buying = Number(buyingByTxn[r.itemCreditTxn] ?? 0);
      map.set(r.itemCreditTxn, Number(r.netPayout ?? 0) - (Number.isFinite(buying) ? buying : 0));
    }
    return map;
  }, [rows, buyingByTxn, submittedByTxn]);

  const updateBuying = (txn: string, next: string) => {
    setBuyingByTxn((prev) => ({ ...prev, [txn]: next }));
  };

  const submitRow = async (txn: string) => {
    const raw = String(buyingByTxn[txn] ?? "").trim();
    const buying = Number(raw);
    if (!raw || !Number.isFinite(buying) || buying < 0) {
      showToast("Enter a valid buying price", "error");
      return;
    }

    setSubmittingTxn(txn);
    try {
      const row = rows.find((r) => r.itemCreditTxn === txn) ?? null;
      if (!row) throw new Error("Row not found");

      const doSubmit = async (allowDuplicates: boolean) => {
        const endpoint = draftId
          ? withImpersonateId(
              `/api/admin/marketplace-profit-entry/csv/draft/${encodeURIComponent(draftId)}/submit-row`,
              props.impersonateId ?? null,
            )
          : withImpersonateId("/api/admin/marketplace-profit-entry/csv/submit-row", props.impersonateId ?? null);

        const payload = draftId
          ? { itemCreditTxn: txn, buyingPriceKes: buying, allowDuplicates }
          : {
              accountId: resolvedAccountId || shopId,
              row,
              buyingPriceKes: buying,
              allowDuplicates,
            };

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await res.json().catch(() => null)) as any;
        return { res, data };
      };

      let { res, data } = await doSubmit(false);
      if (res.status === 409) {
        const ok = window.confirm("This unique number already exists. Submit anyway?");
        if (!ok) return;
        ({ res, data } = await doSubmit(true));
      }
      if (!res.ok) throw new Error(data?.error || "Submit failed");

      const entryId = String(data?.entry?.id ?? data?.entryId ?? "").trim();
      if (entryId) {
        setSubmittedByTxn((prev) => ({ ...prev, [txn]: entryId }));
        setSubmitted(true);
        if (localOnlyDraft) {
          try {
            const rawDraft = localStorage.getItem(draftKey);
            const parsed = rawDraft ? (JSON.parse(rawDraft) as any) : null;
            if (parsed && parsed.mode === "local") {
              parsed.buyingByTxn = { ...(parsed.buyingByTxn ?? {}), [txn]: String(buying) };
              parsed.submittedByTxn = { ...(parsed.submittedByTxn ?? {}), [txn]: entryId };
              localStorage.setItem(draftKey, JSON.stringify(parsed));
            }
          } catch {}
        }
      }
      showToast("Saved", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Submit failed", "error");
    } finally {
      setSubmittingTxn("");
    }
  };

  const copySku = async (sku: string) => {
    const value = String(sku ?? "").trim();
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      showToast("SKU copied", "success");
    } catch {
      showToast("Copy failed", "error");
    }
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
      const parsed = JSON.parse(raw) as any;
      if (parsed?.mode === "local") {
        const localRows = Array.isArray(parsed?.rows) ? (parsed.rows as PreviewRow[]) : [];
        setRows(localRows);
        setExistingTxns(Array.isArray(parsed?.existingTxns) ? (parsed.existingTxns as string[]) : []);
        setBuyingByTxn(parsed?.buyingByTxn && typeof parsed.buyingByTxn === "object" ? (parsed.buyingByTxn as Record<string, string>) : {});
        setSubmittedByTxn(
          parsed?.submittedByTxn && typeof parsed.submittedByTxn === "object" ? (parsed.submittedByTxn as Record<string, string>) : {},
        );
        setSubmitted(Object.keys(parsed?.submittedByTxn ?? {}).length > 0);
        setResolvedAccountId(String(parsed?.accountId ?? "").trim());
        setDraftId("");
        setLocalOnlyDraft(true);
        return;
      }

      const did = String(parsed?.id ?? "").trim();
      if (!did) return;
      setDraftId(did);
      setLocalOnlyDraft(false);
      void (async () => {
        const res = await fetch(
          withImpersonateId(`/api/admin/marketplace-profit-entry/csv/draft/${encodeURIComponent(did)}`, props.impersonateId ?? null),
          { cache: "no-store" },
        );
        const data = (await res.json().catch(() => null)) as any;
        if (!res.ok) return;
        const draftRows = Array.isArray(data?.rows) ? (data.rows as PreviewRow[]) : [];
        const buying =
          data?.buyingByTxn && typeof data.buyingByTxn === "object" ? (data.buyingByTxn as Record<string, any>) : {};
        const submittedMap =
          data?.submittedByTxn && typeof data.submittedByTxn === "object" ? (data.submittedByTxn as Record<string, any>) : {};
        setRows(draftRows);
        setBuyingByTxn(Object.fromEntries(Object.entries(buying).map(([k, v]) => [k, String(v)])));
        setSubmittedByTxn(Object.fromEntries(Object.entries(submittedMap).map(([k, v]) => [k, String(v)])));
        setSubmitted(Object.keys(submittedMap).length > 0);
      })();
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  const clearDraft = () => {
    setRows([]);
    setBuyingByTxn({});
    setExistingTxns([]);
    setSubmittedByTxn({});
    setSubmitted(false);
    setDraftId("");
    setResolvedAccountId("");
    setLocalOnlyDraft(false);
    setFile(null);
    try {
      if (draftKey) localStorage.removeItem(draftKey);
    } catch {}
  };

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
            disabled={loading || Boolean(rows.length)}
            type="button"
          >
            {loading ? "Loading..." : "Load statement"}
          </button>
          <button
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 hover:bg-slate-900 disabled:opacity-50"
            onClick={clearDraft}
            disabled={loading || (!rows.length && !draftId)}
            type="button"
          >
            Clear
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
            disabled={Boolean(rows.length)}
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
            disabled={Boolean(rows.length)}
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
              setDraftId("");
              setSubmittedByTxn({});
            }}
            disabled={Boolean(rows.length)}
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
            <div className="text-xs text-slate-500">
              Profit appears only after you submit each order.
              {localOnlyDraft ? " (Draft is stored in this browser only.)" : ""}
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
              {!props.hideSummaryTotals ? (
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                  <div className="text-xs text-slate-400">Submitted</div>
                  <div className="text-base font-semibold text-slate-100">{totals.submittedCount}</div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="min-w-[980px] w-full text-left text-sm">
              <thead className="bg-slate-950/60 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Order</th>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2">SKU</th>
                  <th className="px-3 py-2 whitespace-nowrap">Net</th>
                  <th className="px-3 py-2 whitespace-nowrap">Buying</th>
                  {submitted ? <th className="px-3 py-2 whitespace-nowrap">Profit</th> : null}
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-900/20">
                {rows.map((r) => {
                  const profitValue = perRowProfit.get(r.itemCreditTxn);
                  const isDup = existingTxns.includes(r.itemCreditTxn);
                  const isSubmitted = Boolean(submittedByTxn[r.itemCreditTxn]);
                  const buyingRaw = String(buyingByTxn[r.itemCreditTxn] ?? "").trim();
                  const buyingNum = Number(buyingRaw);
                  const canSubmitRow = !isSubmitted && buyingRaw.length > 0 && Number.isFinite(buyingNum) && buyingNum >= 0;
                  const skuLabel = String(r.jumiaSku || r.sellerSku || "-");
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
                        {skuLabel !== "-" ? (
                          <button
                            type="button"
                            onClick={() => void copySku(skuLabel)}
                            className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-900"
                            title={skuLabel}
                          >
                            Copy SKU
                          </button>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap font-medium text-slate-100">
                        {currency.format(Number(r.netPayout ?? 0))}
                      </td>
                      <td className="px-3 py-2">
                        <input
                          className="w-28 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
                          inputMode="decimal"
                          placeholder="0"
                          value={buyingByTxn[r.itemCreditTxn] ?? ""}
                          onChange={(e) => updateBuying(r.itemCreditTxn, e.target.value)}
                          disabled={isSubmitted}
                        />
                      </td>
                      {submitted ? (
                        <td
                          className={
                            profitValue !== undefined && profitValue < 0
                              ? "px-3 py-2 whitespace-nowrap font-semibold text-rose-300"
                              : "px-3 py-2 whitespace-nowrap font-semibold text-emerald-300"
                          }
                        >
                          {isSubmitted && profitValue !== undefined ? currency.format(profitValue) : "—"}
                        </td>
                      ) : null}
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => void submitRow(r.itemCreditTxn)}
                          disabled={!canSubmitRow || submittingTxn === r.itemCreditTxn}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                        >
                          {isSubmitted ? "Saved" : submittingTxn === r.itemCreditTxn ? "Saving..." : "Submit"}
                        </button>
                      </td>
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
