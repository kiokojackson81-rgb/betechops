"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { isSyncedStatus } from "@/lib/jumia/orderStatus";

// Note: Jumia API uses American spelling for canceled -> "CANCELED"
const STATUSES = ["PENDING","PACKED","READY_TO_SHIP","DELIVERED","CANCELED","RETURNED","DISPUTED"];
const SIZE_OPTIONS = [25, 50, 100, 150, 200, 250, 300];

type FiltersState = {
  status: string;
  country: string;
  shopId: string;
  dateFrom: string;
  dateTo: string;
  q: string;
  size: string;
};

const DEFAULTS: FiltersState = {
  status: "PENDING",
  country: "",
  shopId: "ALL",
  dateFrom: "",
  dateTo: "",
  q: "",
  size: "50",
};

export default function OrdersFilters({ shops }: { shops: Array<{ id: string; name: string }> }) {
  const pathname = usePathname();
  const router = useRouter();
  const sp = useSearchParams();

  const snapshot = useMemo(() => {
    const status = sp.get("status") || DEFAULTS.status;
    const sizeDefault = (() => {
      if (isSyncedStatus(status)) {
        return status.trim().toUpperCase() === "PENDING" ? "300" : "150";
      }
      return DEFAULTS.size;
    })();
    return {
      status,
      country: sp.get("country") || DEFAULTS.country,
      shopId: sp.get("shopId") || DEFAULTS.shopId,
      dateFrom: sp.get("dateFrom") || DEFAULTS.dateFrom,
      dateTo: sp.get("dateTo") || DEFAULTS.dateTo,
      q: sp.get("q") || DEFAULTS.q,
      size: sp.get("size") || sizeDefault,
    };
  }, [sp]);

  const [pending, setPending] = useState<FiltersState>(snapshot);

  useEffect(() => {
    setPending(snapshot);
  }, [snapshot]);

  const apply = () => {
    const q = new URLSearchParams(sp.toString());
    const assign = (key: keyof FiltersState, value: string, defaultValue: string) => {
      if (!value || value === defaultValue) {
        q.delete(key);
      } else {
        q.set(key, value);
      }
    };

    assign("status", pending.status, DEFAULTS.status);
    assign("country", pending.country.trim(), DEFAULTS.country);
    assign("shopId", pending.shopId, DEFAULTS.shopId);
    assign("dateFrom", pending.dateFrom, DEFAULTS.dateFrom);
    assign("dateTo", pending.dateTo, DEFAULTS.dateTo);
    assign("q", pending.q.trim(), DEFAULTS.q);
    const sizeDefault = (() => {
      if (isSyncedStatus(pending.status)) {
        return pending.status.trim().toUpperCase() === "PENDING" ? "300" : "150";
      }
      return DEFAULTS.size;
    })();
    assign("size", pending.size, sizeDefault);

    q.delete("nextToken");
    router.push(`${pathname}?${q.toString()}`);
  };

  const reset = () => {
    const sizeDefault = (() => {
      if (isSyncedStatus(DEFAULTS.status)) {
        return DEFAULTS.status.trim().toUpperCase() === "PENDING" ? "300" : "150";
      }
      return DEFAULTS.size;
    })();
    setPending({ ...DEFAULTS, size: sizeDefault });
    const q = new URLSearchParams(sp.toString());
    Object.keys(DEFAULTS).forEach((key) => q.delete(key));
    q.delete("nextToken");
    router.push(`${pathname}?${q.toString()}`);
  };

  const onSubmit: React.FormEventHandler<HTMLFormElement> = (e) => {
    // Allow native GET submission while still cleaning params client-side for SPA navigation.
    // We trigger apply() but do not preventDefault when JS is available, letting browser do a full request fallback if needed.
    try {
      apply();
    } catch {}
    // Do NOT prevent default: ensures server component re-runs even if router push race conditions occur.
  };

  return (
    <form action={pathname || undefined} method="GET" onSubmit={onSubmit} className="rounded-xl border border-white/10 bg-[var(--panel,#121723)] p-4 space-y-3">
      <div className="grid md:grid-cols-6 gap-3">
        <select
          name="status"
          value={pending.status}
          onChange={(e) => setPending((prev) => ({ ...prev, status: e.target.value }))}
          className="border border-white/10 bg-white/5 rounded-lg px-2 py-2"
        >
          <option value="ALL">All Status</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <input
          name="country"
          value={pending.country}
          onChange={(e) => setPending((prev) => ({ ...prev, country: e.target.value }))}
          placeholder="Country (e.g. KE)"
          className="border border-white/10 bg-white/5 rounded-lg px-2 py-2"
        />

        <select
          name="shopId"
          value={pending.shopId}
          onChange={(e) => setPending((prev) => ({ ...prev, shopId: e.target.value }))}
          className="border border-white/10 bg-white/5 rounded-lg px-2 py-2"
        >
          <option value="ALL">All Jumia</option>
          {shops.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <input
          type="date"
          name="dateFrom"
          value={pending.dateFrom}
          onChange={(e) => setPending((prev) => ({ ...prev, dateFrom: e.target.value }))}
          className="border border-white/10 bg-white/5 rounded-lg px-2 py-2"
        />
        <input
          type="date"
          name="dateTo"
          value={pending.dateTo}
          onChange={(e) => setPending((prev) => ({ ...prev, dateTo: e.target.value }))}
          className="border border-white/10 bg-white/5 rounded-lg px-2 py-2"
        />

        <input
          name="q"
          value={pending.q}
          onChange={(e) => setPending((prev) => ({ ...prev, q: e.target.value }))}
          placeholder="Search number or name."
          className="border border-white/10 bg-white/5 rounded-lg px-2 py-2"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          name="size"
          value={pending.size}
          onChange={(e) => setPending((prev) => ({ ...prev, size: e.target.value }))}
          className="border border-white/10 bg-white/5 rounded-lg px-2 py-2"
        >
          {SIZE_OPTIONS.map((n) => (
            <option key={n} value={n.toString()}>
              {n} / page
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10"
        >
          Apply
        </button>
        <button
          onClick={reset}
          className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/10"
        >
          Reset
        </button>
      </div>
    </form>
  );
}
