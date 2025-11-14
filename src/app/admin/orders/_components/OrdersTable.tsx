"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { OrdersRow } from "../_lib/types";

type Props = {
  rows: OrdersRow[];
  nextToken: string | null;
  isLastPage: boolean;
};

export default function OrdersTable({ rows, nextToken, isLastPage }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState<"pack" | "rts" | "print" | null>(null);
  const [selected, setSelected] = useState<Record<string, { shopId?: string }>>({});
  const [details, setDetails] = useState<Record<string, { url?: string; name?: string; total?: { currency?: string; value: number }; count?: number }>>({});
  const pathname = usePathname();
  const router = useRouter();
  const sp = useSearchParams();

  const dispatchRefresh = () => {
    try {
      window.dispatchEvent(new CustomEvent("orders:refresh", { detail: { source: "action", ts: Date.now() } }));
    } catch {
      // ignored
    }
  };

  async function callAction(row: OrdersRow, action: "pack" | "rts" | "print") {
    const id = row.id;
    const key = `${id}:${action}`;
    setBusy(key);
    try {
      const shopIdForRow =
        row.shopId ??
        (Array.isArray(row.shopIds) ? row.shopIds.find((s) => typeof s === "string") : undefined) ??
        undefined;
      if (action === "print") {
        // Single-button flow: trigger RTS (auto-packs when needed) then open Print Labels
        const rtsEndpoint = shopIdForRow
          ? `/api/jumia/orders/${id}/ready-to-ship?shopId=${encodeURIComponent(shopIdForRow)}`
          : `/api/jumia/orders/${id}/ready-to-ship`;
        const res = await fetch(rtsEndpoint, { method: "POST" });
        if (!res.ok) throw new Error(`Action rts failed with status ${res.status}`);
        const printUrl = shopIdForRow
          ? `/api/jumia/orders/${id}/print-labels?shopId=${encodeURIComponent(shopIdForRow)}`
          : `/api/jumia/orders/${id}/print-labels`;
        try { window.open(printUrl, "_blank"); } catch {}
        const params = new URLSearchParams();
        if (shopIdForRow) params.set("shopId", shopIdForRow);
        const query = params.toString();
        await fetch(`/api/jumia/jobs/sync-incremental${query ? `?${query}` : ""}`, { method: "POST" }).catch(() => {});
        dispatchRefresh();
        router.refresh();
        return;
      }

      const endpoint =
        action === "pack"
          ? shopIdForRow
            ? `/api/jumia/orders/${id}/pack?shopId=${encodeURIComponent(shopIdForRow)}`
            : `/api/jumia/orders/${id}/pack`
          : shopIdForRow
          ? `/api/jumia/orders/${id}/ready-to-ship?shopId=${encodeURIComponent(shopIdForRow)}`
          : `/api/jumia/orders/${id}/ready-to-ship`;
      const res = await fetch(endpoint, { method: "POST" });
      if (!res.ok) {
        throw new Error(`Action ${action} failed with status ${res.status}`);
      }

      // If RTS succeeded, immediately open Print Labels for a smooth flow
      if (action === "rts") {
        const printUrl = shopIdForRow
          ? `/api/jumia/orders/${id}/print-labels?shopId=${encodeURIComponent(shopIdForRow)}`
          : `/api/jumia/orders/${id}/print-labels`;
        try { window.open(printUrl, "_blank"); } catch {}
      }

      const shopId = shopIdForRow;

      try {
        const params = new URLSearchParams();
        if (shopId) params.set("shopId", shopId);
        const query = params.toString();
        await fetch(`/api/jumia/jobs/sync-incremental${query ? `?${query}` : ""}`, { method: "POST" });
      } catch (err) {
        console.warn("[orders.table] incremental sync failed", err);
      }

      dispatchRefresh();
      router.refresh();
    } catch (error) {
      console.warn("[orders.table] action failed", error);
    } finally {
      setBusy(null);
    }
  }

  function pageNext() {
    if (!nextToken) return;
    const q = new URLSearchParams(sp.toString());
    q.set("nextToken", nextToken);
    router.push(`${pathname}?${q.toString()}`);
  }

  function pagePrev() {
    const q = new URLSearchParams(sp.toString());
    q.delete("nextToken");
    router.push(`${pathname}?${q.toString()}`);
  }

  // Lazy-load per-order item details (product URL and computed amount) for rows missing them.
  const idsNeedingDetails = useMemo(() => {
    return rows
      .filter((r) => !details[r.id])
      .map((r) => ({ id: r.id, shopId: r.shopId || (Array.isArray(r.shopIds) ? r.shopIds[0] : undefined) }));
  }, [rows, details]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      for (const { id, shopId } of idsNeedingDetails) {
        try {
          const url = shopId ? `/api/jumia/orders/${encodeURIComponent(id)}/items?shopId=${encodeURIComponent(shopId)}` : `/api/jumia/orders/${encodeURIComponent(id)}/items`;
          const res = await fetch(url, { cache: "no-store" });
          if (!res.ok) continue;
          const j = await res.json();
          if (cancelled) return;
          setDetails((prev) => ({
            ...prev,
            [id]: {
              url: j?.primaryProductUrl || undefined,
              name: j?.primaryProductName || undefined,
              total: j?.totalAmountLocal || undefined,
              count: typeof j?.itemsCount === "number" ? j.itemsCount : Array.isArray(j?.items) ? j.items.length : undefined,
            },
          }));
        } catch {
          // ignore
        }
      }
    }
    if (idsNeedingDetails.length) void load();
    return () => {
      cancelled = true;
    };
  }, [idsNeedingDetails]);

  // Persist selection across pages using localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('ordersSelection');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') setSelected(parsed);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('ordersSelection', JSON.stringify(selected));
    } catch {}
  }, [selected]);

  const currentShopId = useMemo(() => sp.get("shopId") || undefined, [sp]);
  const selectedIds = Object.keys(selected);
  const allOnPageSelected = rows.length > 0 && rows.every((r) => selected[r.id]);
  const someSelected = selectedIds.length > 0;

  function toggleRow(id: string, shopId?: string) {
    setSelected((prev) => {
      const cp = { ...prev };
      if (cp[id]) delete cp[id];
      else cp[id] = { shopId };
      return cp;
    });
  }

  function toggleAllOnPage() {
    if (allOnPageSelected) {
      // clear only rows on page
      const ids = new Set(rows.map((r) => r.id));
      setSelected((prev) => {
        const cp = { ...prev } as Record<string, { shopId?: string }>;
        for (const id of rows.map((r) => r.id)) delete cp[id];
        return cp;
      });
    } else {
      // add rows on page
      const add: Record<string, { shopId?: string }> = {};
      for (const r of rows) add[r.id] = { shopId: (r.shopId || (Array.isArray(r.shopIds) ? r.shopIds[0] : undefined)) };
      setSelected((prev) => ({ ...prev, ...add }));
    }
  }

  function timeAgo(ts?: string) {
    if (!ts) return "";
    try {
      const d = new Date(ts);
      const now = Date.now();
      const diff = Math.max(0, now - d.getTime());
      const s = Math.floor(diff / 1000);
      if (s < 60) return `${s}s ago`;
      const m = Math.floor(s / 60);
      if (m < 60) return `${m}m ago`;
      const h = Math.floor(m / 60);
      if (h < 24) return `${h}h ago`;
      const dys = Math.floor(h / 24);
      return `${dys}d ago`;
    } catch {
      return "";
    }
  }

  async function runBulk(action: "pack" | "rts" | "print") {
    if (!someSelected) return;
    setBulkBusy(action);
    try {
      // group by shopId
      const groups = new Map<string, string[]>();
      for (const [id, meta] of Object.entries(selected)) {
        const sid = meta.shopId || currentShopId || "";
        if (!sid) continue;
        if (!groups.has(sid)) groups.set(sid, []);
        groups.get(sid)!.push(id);
      }
      // call endpoints per shop
      for (const [shopId, orderIds] of groups) {
        if (!orderIds.length) continue;
        if (action === "print") {
          // Single-button bulk flow: RTS then Print Labels
          await fetch("/api/jumia/orders/bulk/ready-to-ship", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ shopId, orderIds }),
          });
          await fetch("/api/jumia/orders/bulk/print-labels", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ shopId, orderIds }),
          });
        } else {
          const endpoint = action === "pack" ? "/api/jumia/orders/bulk/pack" : "/api/jumia/orders/bulk/ready-to-ship";
          await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ shopId, orderIds }),
          });
        }
        await fetch(`/api/jumia/jobs/sync-incremental?shopId=${encodeURIComponent(shopId)}`, { method: "POST" }).catch(() => {});
      }
      // clear selection and refresh
      setSelected({});
      dispatchRefresh();
      router.refresh();
    } catch (e) {
      console.warn("[orders.table] bulk action failed", e);
    } finally {
      setBulkBusy(null);
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-[var(--panel,#121723)] overflow-auto">
      {someSelected && (
        <div className="flex items-center justify-between gap-3 p-3 border-b border-white/10 bg-black/20 sticky top-0 z-10">
          <div className="text-sm">Selected {selectedIds.length} row(s)</div>
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1 rounded border border-white/10 hover:bg-white/10 disabled:opacity-50"
              onClick={() => runBulk("pack")}
              disabled={!!bulkBusy}
            >
              {bulkBusy === "pack" ? "Packing…" : "Pack selected"}
            </button>
            <button
              className="px-3 py-1 rounded border border-white/10 hover:bg-white/10 disabled:opacity-50"
              onClick={() => runBulk("rts")}
              disabled={!!bulkBusy}
            >
              {bulkBusy === "rts" ? "Marking…" : "RTS selected"}
            </button>
            <button
              className="px-3 py-1 rounded border border-white/10 hover:bg-white/10 disabled:opacity-50"
              onClick={() => runBulk("print")}
              disabled={!!bulkBusy}
            >
              {bulkBusy === "print" ? "Printing…" : "Print selected"}
            </button>
            <button
              className="px-3 py-1 rounded border border-white/10 hover:bg-white/10"
              onClick={() => setSelected({})}
            >
              Clear
            </button>
          </div>
        </div>
      )}
      <table className="w-full text-sm">
        <thead className="text-left bg-black/10">
          <tr>
            <th className="px-3 py-2">
              <input type="checkbox" checked={allOnPageSelected} onChange={toggleAllOnPage} />
            </th>
            <th className="px-3 py-2">Order #</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Created / Updated</th>
            <th className="px-3 py-2">Items</th>
            <th className="px-3 py-2">Total</th>
            <th className="px-3 py-2">Shop</th>
            <th className="px-3 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className="px-3 py-6 text-center text-slate-400">
                No orders found.
              </td>
            </tr>
          )}
          {rows.map((row) => {
            const actionBusy = busy === `${row.id}:pack` || busy === `${row.id}:rts`;
            const printBusy = busy === `${row.id}:print`;
            return (
              <tr key={row.id} className="border-t border-white/5">
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={!!selected[row.id]}
                    onChange={() => toggleRow(row.id, row.shopId || (Array.isArray(row.shopIds) ? row.shopIds[0] : undefined))}
                  />
                </td>
                <td className="px-3 py-2 font-medium">{row.number ?? row.id}</td>
                <td className="px-3 py-2">
                  <span className="px-2 py-0.5 rounded-md border border-white/10 bg-white/5">{row.status}</span>
                  {row.pendingSince && <span className="ml-2 text-xs opacity-70">- {row.pendingSince}</span>}
                </td>
                <td className="px-3 py-2">
                  <div>{new Date(row.createdAt).toLocaleString()}</div>
                  {row.updatedAt && (
                    <div className="text-xs opacity-70">
                      Updated: {new Date(row.updatedAt).toLocaleString()} ({timeAgo(row.updatedAt)})
                    </div>
                  )}
                </td>
                <td className="px-3 py-2">
                  {typeof row.packedItems === "number" && typeof row.totalItems === "number"
                    ? `${row.packedItems}/${row.totalItems}`
                    : row.totalItems ?? "-"}
                </td>
                <td className="px-3 py-2 font-medium">
                  {row.totalAmountLocal
                    ? `${row.totalAmountLocal.currency ?? ""} ${row.totalAmountLocal.value.toLocaleString()}`.trim()
                    : details[row.id]?.total
                    ? `${details[row.id]?.total?.currency ?? ""} ${details[row.id]?.total?.value.toLocaleString()}`.trim()
                    : "-"}
                </td>
                <td className="px-3 py-2">
                  {details[row.id]?.url ? (
                    <a
                      href={details[row.id]?.url ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-300 hover:underline"
                      title={details[row.id]?.name || "Open product on Jumia"}
                    >
                      {(row.shopName ?? row.shopId ?? row.shopIds?.[0] ?? "-")}
                      {(details[row.id]?.count ?? 0) > 1 && (
                        <span className="ml-1 text-xs opacity-70">(x{details[row.id]?.count})</span>
                      )}
                    </a>
                  ) : (
                    <>
                      {row.shopName ?? row.shopId ?? row.shopIds?.[0] ?? "-"}
                      {(details[row.id]?.count ?? 0) > 1 && (
                        <span className="ml-1 text-xs opacity-70">(x{details[row.id]?.count})</span>
                      )}
                    </>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <button
                      className="px-2 py-1 rounded border border-white/10 hover:bg-white/10 disabled:opacity-60"
                      onClick={() => callAction(row, "print")}
                      disabled={printBusy}
                    >
                      {printBusy ? "…" : "Print"}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="flex items-center justify-between px-3 py-3 border-t border-white/10">
        <button onClick={pagePrev} className="px-3 py-1 rounded border border-white/10 hover:bg-white/10">
          First page
        </button>
        <div className="text-xs opacity-70">
          {isLastPage ? "Last page" : nextToken ? "More results available" : ""}
        </div>
        <button
          onClick={pageNext}
          disabled={!nextToken}
          className="px-3 py-1 rounded border border-white/10 hover:bg-white/10 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
