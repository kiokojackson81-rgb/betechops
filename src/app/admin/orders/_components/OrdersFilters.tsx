"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const STATUSES = ["PENDING","PACKED","READY_TO_SHIP","DELIVERED","CANCELLED","RETURNED","DISPUTED"];

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

  const snapshot = useMemo(() => ({
    status: sp.get("status") || DEFAULTS.status,
    country: sp.get("country") || DEFAULTS.country,
    shopId: sp.get("shopId") || DEFAULTS.shopId,
    dateFrom: sp.get("dateFrom") || DEFAULTS.dateFrom,
    dateTo: sp.get("dateTo") || DEFAULTS.dateTo,
    q: sp.get("q") || DEFAULTS.q,
    size: sp.get("size") || DEFAULTS.size,
  }), [sp]);

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
    assign("size", pending.size, DEFAULTS.size);

    q.delete("nextToken");
    router.push(`${pathname}?${q.toString()}`);
  };

  const reset = () => {
    setPending(DEFAULTS);
    const q = new URLSearchParams(sp.toString());
    Object.keys(DEFAULTS).forEach((key) => q.delete(key));
    q.delete("nextToken");
    router.push(`${pathname}?${q.toString()}`);
  };

  return (
    <div className="rounded-xl border border-white/10 bg-[var(--panel,#121723)] p-4 space-y-3">
      <div className="grid md:grid-cols-6 gap-3">
        <select
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
          value={pending.country}
          onChange={(e) => setPending((prev) => ({ ...prev, country: e.target.value }))}
          placeholder="Country (e.g. KE)"
          className="border border-white/10 bg-white/5 rounded-lg px-2 py-2"
        />

        <select
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
          value={pending.dateFrom}
          onChange={(e) => setPending((prev) => ({ ...prev, dateFrom: e.target.value }))}
          className="border border-white/10 bg-white/5 rounded-lg px-2 py-2"
        />
        <input
          type="date"
          value={pending.dateTo}
          onChange={(e) => setPending((prev) => ({ ...prev, dateTo: e.target.value }))}
          className="border border-white/10 bg-white/5 rounded-lg px-2 py-2"
        />

        <input
          value={pending.q}
          onChange={(e) => setPending((prev) => ({ ...prev, q: e.target.value }))}
          placeholder="Search number or name."
          className="border border-white/10 bg-white/5 rounded-lg px-2 py-2"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={pending.size}
          onChange={(e) => setPending((prev) => ({ ...prev, size: e.target.value }))}
          className="border border-white/10 bg-white/5 rounded-lg px-2 py-2"
        >
          {[25, 50, 100].map((n) => (
            <option key={n} value={n.toString()}>
              {n} / page
            </option>
          ))}
        </select>
        <button
          onClick={apply}
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
    </div>
  );
}
