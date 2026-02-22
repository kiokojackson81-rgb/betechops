"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ToastContainer from "@/app/_components/ToastContainer";
import { showToast } from "@/lib/ui/toast";
import { Platform, WeeklySaleSource, WeeklySaleStatus } from "@prisma/client";

const currencyFormatter = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  maximumFractionDigits: 0,
});

type ShopPayload = {
  id: string;
  shopName: string | null;
  displayName: string | null;
  platform: Platform;
  primaryAttendant: { id: string; name: string | null; email: string | null } | null;
};

type WeekEntry = {
  id: string;
  shopId: string | null;
  platform: Platform;
  amount: number;
  status: WeeklySaleStatus;
  source: WeeklySaleSource;
  attendantName: string;
};

export default function ManualWeekViewClient(props: {
  weekLabel: string;
  shops: ShopPayload[];
  entries: WeekEntry[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string>("");

  const entryByShopId = useMemo(() => {
    const map = new Map<string, WeekEntry>();
    props.entries.forEach((entry) => {
      if (!entry.shopId) return;
      map.set(entry.shopId, entry);
    });
    return map;
  }, [props.entries]);

  const editEntry = async (entry: WeekEntry) => {
    if (entry.source !== WeeklySaleSource.MANUAL) {
      showToast("Only manual entries can be edited", "error");
      return;
    }

    const input = prompt("Enter new amount (KES)", String(Number(entry.amount ?? 0)));
    if (input == null) return;

    const nextAmount = Number(input);
    if (!Number.isFinite(nextAmount) || nextAmount < 0) {
      showToast("Invalid amount", "error");
      return;
    }

    setBusyId(entry.id);
    try {
      const res = await fetch(`/api/admin/weekly-sale/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: nextAmount }),
      });
      if (!res.ok) throw new Error("Failed to update amount");
      showToast("Entry updated", "success");
      router.refresh();
    } catch (err) {
      console.error(err);
      showToast(err instanceof Error ? err.message : "Failed to update entry", "error");
    } finally {
      setBusyId("");
    }
  };

  const deleteEntry = async (entry: WeekEntry) => {
    if (entry.source !== WeeklySaleSource.MANUAL) {
      showToast("Only manual entries can be deleted", "error");
      return;
    }
    if (entry.status !== WeeklySaleStatus.PENDING) {
      showToast("Only pending entries can be deleted", "error");
      return;
    }
    if (!confirm("Delete this manual entry?")) return;

    setBusyId(entry.id);
    try {
      const res = await fetch(`/api/admin/weekly-sale/${entry.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete entry");
      showToast("Entry deleted", "success");
      router.refresh();
    } catch (err) {
      console.error(err);
      showToast(err instanceof Error ? err.message : "Failed to delete entry", "error");
    } finally {
      setBusyId("");
    }
  };

  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/30 p-5">
      <ToastContainer />
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Week view</h3>
          <p className="text-sm text-slate-400">Showing all shops for {props.weekLabel}.</p>
        </div>
        <p className="text-xs text-slate-500">Missing shops show as “Not entered”.</p>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-slate-400">
              <th className="py-2 pr-4">Platform</th>
              <th className="py-2 pr-4">Shop</th>
              <th className="py-2 pr-4">Attendant</th>
              <th className="py-2 pr-4 text-right">Amount</th>
              <th className="py-2 pr-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {props.shops.map((shop) => {
              const entry = entryByShopId.get(shop.id) ?? null;
              const amount = entry ? Number(entry.amount ?? 0) : null;
              const attendant =
                entry?.attendantName ??
                shop.primaryAttendant?.name ??
                shop.primaryAttendant?.email ??
                "—";

              return (
                <tr key={shop.id} className="border-t border-white/5">
                  <td className="py-3 pr-4 text-slate-200">{shop.platform}</td>
                  <td className="py-3 pr-4 font-medium text-white">{shop.displayName ?? shop.shopName ?? shop.id}</td>
                  <td className="py-3 pr-4 text-slate-200">{attendant}</td>
                  <td className="py-3 pr-4 text-right font-semibold">
                    {amount == null ? (
                      <span className="text-amber-200">Not entered</span>
                    ) : (
                      <span className="text-emerald-300">{currencyFormatter.format(amount)}</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-right">
                    {entry ? (
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-60"
                          onClick={() => editEntry(entry)}
                          disabled={busyId === entry.id}
                        >
                          Edit
                        </button>
                        {entry.source === WeeklySaleSource.MANUAL && entry.status === WeeklySaleStatus.PENDING && (
                          <button
                            type="button"
                            className="rounded-full border border-red-400/50 px-3 py-1 text-xs font-semibold text-red-200 hover:bg-red-500/10 disabled:opacity-60"
                            onClick={() => deleteEntry(entry)}
                            disabled={busyId === entry.id}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

