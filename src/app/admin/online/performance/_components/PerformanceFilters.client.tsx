"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Platform } from "@prisma/client";

type AccountOption = { id: string; platform: Platform; displayName: string };

export default function PerformanceFiltersClient(props: { accounts: AccountOption[] }) {
  const router = useRouter();
  const params = useSearchParams();

  const periodKey = params.get("periodKey") ?? "";
  const accountId = params.get("accountId") ?? "";

  const grouped = useMemo(() => {
    const jumia = props.accounts.filter((a) => a.platform === "JUMIA");
    const kilimall = props.accounts.filter((a) => a.platform === "KILIMALL");
    return { jumia, kilimall };
  }, [props.accounts]);

  const update = (next: { accountId?: string }) => {
    const nextParams = new URLSearchParams(params.toString());
    if (next.accountId !== undefined) {
      if (next.accountId) nextParams.set("accountId", next.accountId);
      else nextParams.delete("accountId");
    }
    // keep periodKey if present
    const qs = nextParams.toString();
    router.replace(qs ? `?${qs}` : "?");
  };

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="text-sm text-slate-300">
        Shop filter
        <select
          className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm"
          value={accountId}
          onChange={(e) => update({ accountId: e.target.value })}
        >
          <option value="">All shops</option>
          {grouped.jumia.length > 0 && (
            <optgroup label="JUMIA">
              {grouped.jumia.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.displayName} — JUMIA
                </option>
              ))}
            </optgroup>
          )}
          {grouped.kilimall.length > 0 && (
            <optgroup label="KILIMALL">
              {grouped.kilimall.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.displayName} — KILIMALL
                </option>
              ))}
            </optgroup>
          )}
        </select>
        {periodKey && (
          <p className="mt-1 text-xs text-slate-500">
            Filtering within selected trading period.
          </p>
        )}
      </label>
    </div>
  );
}

