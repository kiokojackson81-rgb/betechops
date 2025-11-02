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
      if (action === "print") {
        const url = `/api/jumia/orders/${id}/print-labels`;
        window.open(url, "_blank");
        return;
      }

      const endpoint =
        action === "pack"
          ? `/api/jumia/orders/${id}/pack`
          : `/api/jumia/orders/${id}/ready-to-ship`;
      const res = await fetch(endpoint, { method: "POST" });
      if (!res.ok) {
        throw new Error(`Action ${action} failed with status ${res.status}`);
      }

      const shopId =
        row.shopId ??
        (Array.isArray(row.shopIds) ? row.shopIds.find((s) => typeof s === "string") : undefined) ??
        undefined;

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

  return (
    <div className="rounded-xl border border-white/10 bg-[var(--panel,#121723)] overflow-auto">
      <table className="w-full text-sm">
        <thead className="text-left bg-black/10">
          <tr>
            <th className="px-3 py-2">Order #</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Created</th>
            <th className="px-3 py-2">Items</th>
            <th className="px-3 py-2">Total</th>
            <th className="px-3 py-2">Shop</th>
            <th className="px-3 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="px-3 py-6 text-center text-slate-400">
                No orders found.
              </td>
            </tr>
          )}
          {rows.map((row) => {
            const actionBusy = busy === `${row.id}:pack` || busy === `${row.id}:rts`;
            const printBusy = busy === `${row.id}:print`;
            return (
              <tr key={row.id} className="border-t border-white/5">
                <td className="px-3 py-2 font-medium">{row.number ?? row.id}</td>
                <td className="px-3 py-2">
                  <span className="px-2 py-0.5 rounded-md border border-white/10 bg-white/5">{row.status}</span>
                  {row.pendingSince && <span className="ml-2 text-xs opacity-70">- {row.pendingSince}</span>}
                </td>
                <td className="px-3 py-2">{new Date(row.createdAt).toLocaleString()}</td>
                <td className="px-3 py-2">
                  {typeof row.packedItems === "number" && typeof row.totalItems === "number"
                    ? `${row.packedItems}/${row.totalItems}`
                    : row.totalItems ?? "-"}
                </td>
                <td className="px-3 py-2">
                  {row.totalAmountLocal
                    ? `${row.totalAmountLocal.currency ?? ""} ${row.totalAmountLocal.value.toLocaleString()}`.trim()
                    : details[row.id]?.total
                    ? `${details[row.id]?.total?.currency ?? ""} ${details[row.id]?.total?.value.toLocaleString()}`.trim()
                    : "-"}
                </td>
                <td className="px-3 py-2">
                  {details[row.id]?.url ? (
                    <a
                      href={details[row.id]!.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-300 hover:underline"
                      title={details[row.id]?.name || "Open product on Jumia"}
                    >
                      {(row.shopName ?? row.shopId ?? row.shopIds?.[0] ?? "-")}
                      {typeof details[row.id]?.count === "number" && details[row.id]?.count! > 1 && (
                        <span className="ml-1 text-xs opacity-70">(x{details[row.id]?.count})</span>
                      )}
                    </a>
                  ) : (
                    <>
                      {row.shopName ?? row.shopId ?? row.shopIds?.[0] ?? "-"}
                      {typeof details[row.id]?.count === "number" && details[row.id]?.count! > 1 && (
                        <span className="ml-1 text-xs opacity-70">(x{details[row.id]?.count})</span>
                      )}
                    </>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <button
                      className="px-2 py-1 rounded border border-white/10 hover:bg-white/10 disabled:opacity-60"
                      onClick={() => callAction(row, "pack")}
                      disabled={busy !== null}
                    >
                      {actionBusy && busy?.endsWith(":pack") ? "…" : "Pack"}
                    </button>
                    <button
                      className="px-2 py-1 rounded border border-white/10 hover:bg-white/10 disabled:opacity-60"
                      onClick={() => callAction(row, "rts")}
                      disabled={busy !== null}
                    >
                      {actionBusy && busy?.endsWith(":rts") ? "…" : "RTS"}
                    </button>
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
