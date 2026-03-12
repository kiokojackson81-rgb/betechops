"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ToastContainer from "@/app/_components/ToastContainer";
import { showToast } from "@/lib/ui/toast";
import type { Platform } from "@prisma/client";

type EntryRow = {
  id: string;
  date: string;
  platform: Platform;
  itemCreditTxn: string;
  shopName?: string;
  orderId?: string;
  sku?: string;
  productName?: string;
  itemCreditAmount?: number;
  commissionAmount?: number;
  shippingAmount?: number;
  netPayout: number;
  buyingPrice: number;
  profit: number;
  enteredBy: string;
};

const currency = new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 });

export default function WeekProfitEntriesClient(props: {
  rows: EntryRow[];
  emptyText: string;
  variant: "loss" | "all";
  enableBulkDelete?: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<EntryRow[]>(props.rows);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [openRowId, setOpenRowId] = useState<string | null>(null);
  const [detailBuyingInput, setDetailBuyingInput] = useState<string>("");

  const selectedList = useMemo(() => Object.keys(selectedIds).filter((id) => selectedIds[id]), [selectedIds]);
  const tableColSpan = props.enableBulkDelete ? (props.variant === "all" ? 12 : 9) : props.variant === "all" ? 11 : 8;

  const toggleAll = (checked: boolean) => {
    if (!checked) return setSelectedIds({});
    const next: Record<string, boolean> = {};
    for (const r of rows) next[r.id] = true;
    setSelectedIds(next);
  };

  const deleteOne = async (id: string) => {
    const ok = window.confirm("Delete this entry? This cannot be undone.");
    if (!ok) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/marketplace-profit-entry/${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(data?.error || "Delete failed");
      setRows((prev) => prev.filter((r) => r.id !== id));
      setSelectedIds((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      showToast("Deleted", "success");
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Delete failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const bulkDelete = async () => {
    const ids = selectedList;
    if (ids.length === 0) return;
    const ok = window.confirm(`Delete ${ids.length} selected entr${ids.length === 1 ? "y" : "ies"}? This cannot be undone.`);
    if (!ok) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/marketplace-profit-entry/batch-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(data?.error || "Bulk delete failed");
      const deletedIds = new Set<string>(ids);
      setRows((prev) => prev.filter((r) => !deletedIds.has(r.id)));
      setSelectedIds({});
      showToast(`Deleted ${ids.length}`, "success");
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Bulk delete failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const saveBuyingPrice = async (row: EntryRow, nextBuying: number) => {
    if (!Number.isFinite(nextBuying) || nextBuying < 0) {
      showToast("Enter a valid non-negative number", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/marketplace-profit-entry/${encodeURIComponent(row.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buyingPriceKes: nextBuying }),
      });
      const data = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(data?.error || "Update failed");
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id
            ? {
                ...r,
                buyingPrice: Number(data.buyingPrice ?? nextBuying),
                profit: Number(data.profit ?? r.profit),
              }
            : r,
        ),
      );
      showToast("Updated", "success");
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Update failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const openDetails = (row: EntryRow) => {
    const nextOpen = openRowId === row.id ? null : row.id;
    setOpenRowId(nextOpen);
    setDetailBuyingInput(String(row.buyingPrice ?? 0));
  };

  const saveBuyingFromDetails = async (row: EntryRow) => {
    const nextBuying = Number(detailBuyingInput);
    await saveBuyingPrice(row, nextBuying);
  };

  const hasRows = rows.length > 0;

  return (
    <div className="space-y-3">
      <ToastContainer />

      {props.enableBulkDelete ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm">
          <label className="flex items-center gap-2 text-slate-200">
            <input
              type="checkbox"
              checked={hasRows && selectedList.length === rows.length}
              onChange={(e) => toggleAll(e.target.checked)}
              disabled={!hasRows || saving}
            />
            Select all
          </label>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">{selectedList.length} selected</span>
            <button
              type="button"
              onClick={bulkDelete}
              disabled={saving || selectedList.length === 0}
              className="rounded-full border border-red-400/40 bg-red-500/10 px-4 py-1.5 text-sm font-semibold text-red-100 hover:bg-red-500/15 disabled:opacity-60"
            >
              Delete selected
            </button>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className={`w-full text-left text-sm ${props.variant === "all" ? "min-w-[1220px]" : "min-w-[1080px]"}`}>
          <thead>
            <tr className="text-xs uppercase tracking-wide text-slate-400">
              {props.enableBulkDelete ? <th className="py-2 pr-4">Sel</th> : null}
              <th className="py-2 pr-4">Date</th>
              <th className="py-2 pr-4">Platform</th>
              <th className="py-2 pr-4">{props.variant === "all" ? "Item credit txn" : "Txn"}</th>
              {props.variant === "all" ? (
                <>
                  <th className="py-2 pr-4 text-right">Credit</th>
                  <th className="py-2 pr-4 text-right">Commission</th>
                  <th className="py-2 pr-4 text-right">Shipping</th>
                </>
              ) : null}
              <th className="py-2 pr-4 text-right">Net payout</th>
              <th className="py-2 pr-4 text-right">Buying</th>
              <th className="py-2 pr-4 text-right">Profit</th>
              <th className="py-2 pr-4">Entered by</th>
              <th className="py-2 pr-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Fragment key={r.id}>
                <tr className="border-t border-white/5">
                  {props.enableBulkDelete ? (
                    <td className="py-3 pr-4">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedIds[r.id])}
                        onChange={(e) => setSelectedIds((prev) => ({ ...prev, [r.id]: e.target.checked }))}
                        disabled={saving}
                      />
                    </td>
                  ) : null}
                  <td className="py-3 pr-4 text-slate-200">{new Date(r.date).toLocaleDateString()}</td>
                  <td className="py-3 pr-4 text-slate-200">{r.platform}</td>
                  <td className="py-3 pr-4">
                    <button
                      type="button"
                      onClick={() => openDetails(r)}
                      className="font-medium text-emerald-200 hover:text-emerald-100 hover:underline"
                      title="Open order details"
                    >
                      {r.itemCreditTxn}
                    </button>
                  </td>
                  {props.variant === "all" ? (
                    <>
                      <td className="py-3 pr-4 text-right text-slate-200">{currency.format(Number(r.itemCreditAmount ?? 0))}</td>
                      <td className="py-3 pr-4 text-right text-slate-200">{currency.format(Number(r.commissionAmount ?? 0))}</td>
                      <td className="py-3 pr-4 text-right text-slate-200">{currency.format(Number(r.shippingAmount ?? 0))}</td>
                    </>
                  ) : null}
                  <td className="py-3 pr-4 text-right text-slate-200">{currency.format(Number(r.netPayout ?? 0))}</td>
                  <td className="py-3 pr-4 text-right text-slate-200">{currency.format(Number(r.buyingPrice ?? 0))}</td>
                  <td className={`py-3 pr-4 text-right font-semibold ${Number(r.profit ?? 0) < 0 ? "text-red-300" : "text-emerald-200"}`}>
                    {currency.format(Number(r.profit ?? 0))}
                  </td>
                  <td className="py-3 pr-4 text-slate-300">{r.enteredBy || "-"}</td>
                  <td className="py-3 pr-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openDetails(r)}
                        disabled={saving}
                        className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-white/10 disabled:opacity-60"
                      >
                        Details
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteOne(r.id)}
                        disabled={saving}
                        className="rounded-full border border-red-400/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-100 hover:bg-red-500/15 disabled:opacity-60"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
                {openRowId === r.id ? (
                  <tr className="border-t border-white/5 bg-slate-950/40">
                    <td className="px-4 py-4" colSpan={tableColSpan}>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                          <div className="text-[11px] uppercase tracking-wide text-slate-400">Shop</div>
                          <div className="mt-1 text-sm text-slate-100">{r.shopName || "-"}</div>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                          <div className="text-[11px] uppercase tracking-wide text-slate-400">Order number</div>
                          <div className="mt-1 text-sm text-slate-100">{r.orderId || "-"}</div>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                          <div className="text-[11px] uppercase tracking-wide text-slate-400">SKU</div>
                          <div className="mt-1 text-sm text-slate-100">{r.sku || "-"}</div>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                          <div className="text-[11px] uppercase tracking-wide text-slate-400">Item</div>
                          <div className="mt-1 text-sm text-slate-100">{r.productName || "-"}</div>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                          <div className="text-[11px] uppercase tracking-wide text-slate-400">Selling price</div>
                          <div className="mt-1 text-sm font-semibold text-slate-100">{currency.format(Number(r.itemCreditAmount ?? 0))}</div>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                          <div className="text-[11px] uppercase tracking-wide text-slate-400">Net payout</div>
                          <div className="mt-1 text-sm font-semibold text-slate-100">{currency.format(Number(r.netPayout ?? 0))}</div>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                          <div className="text-[11px] uppercase tracking-wide text-slate-400">Current buying</div>
                          <div className="mt-1 text-sm font-semibold text-slate-100">{currency.format(Number(r.buyingPrice ?? 0))}</div>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                          <div className="text-[11px] uppercase tracking-wide text-slate-400">Current profit</div>
                          <div className={`mt-1 text-sm font-semibold ${Number(r.profit ?? 0) < 0 ? "text-red-300" : "text-emerald-200"}`}>
                            {currency.format(Number(r.profit ?? 0))}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-end gap-3">
                        <label className="block">
                          <div className="mb-1 text-xs uppercase tracking-wide text-slate-400">Edit buying price (KES)</div>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={detailBuyingInput}
                            onChange={(e) => setDetailBuyingInput(e.target.value)}
                            className="w-44 rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-slate-100"
                          />
                        </label>
                        <div className="text-xs text-slate-400">
                          Preview profit: {currency.format(Number(r.netPayout ?? 0) - (Number(detailBuyingInput) || 0))}
                        </div>
                        <button
                          type="button"
                          onClick={() => void saveBuyingFromDetails(r)}
                          disabled={saving}
                          className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-60"
                        >
                          Save buying price
                        </button>
                        <button
                          type="button"
                          onClick={() => setOpenRowId(null)}
                          className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"
                        >
                          Close
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
            {!rows.length ? (
              <tr>
                <td className="py-6 text-center text-slate-500" colSpan={tableColSpan}>
                  {props.emptyText}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
