"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ToastContainer from "@/app/_components/ToastContainer";
import MarketplaceWeeklyCsvUpload from "@/app/_components/MarketplaceWeeklyCsvUpload.client";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { getOnlineOpsWeeksForTradingPeriod } from "@/lib/onlineOpsWeeks";
import { Platform } from "@prisma/client";

type AccountOption = { id: string; platform: Platform; displayName: string };

type ShopPayload = {
  id: string;
  shopName: string | null;
  displayName: string | null;
  platform: Platform;
  attendants: Array<{ id: string; name: string | null; email: string | null }>;
  primaryAttendant: { id: string; name: string | null; email: string | null } | null;
};

export default function ProfitCaptureFormClient(props: {
  accounts: AccountOption[];
  limitedView?: boolean;
  backHref?: string;
}) {
  const router = useRouter();
  const [csvShops, setCsvShops] = useState<
    Array<{
      id: string;
      displayName: string | null;
      shopName?: string | null;
      platform: "JUMIA" | "KILIMALL";
      primaryAttendantId?: string | null;
    }>
  >([]);
  const [csvAssignees, setCsvAssignees] = useState<Array<{ id: string; name: string }>>([]);

  const csvWeeks = useMemo(() => {
    const period = getTradingPeriodFor(new Date());
    const weeks = getOnlineOpsWeeksForTradingPeriod(period, period.end, 4);
    return weeks.map((w) => ({
      startInput: w.startInput,
      endInput: w.weekEndInclusive.toISOString().slice(0, 10),
      label: w.label.replace(/–/g, "-"),
    }));
  }, []);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/online/manual/shops", { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as any;
      if (!res.ok) return;

      const shops = (Array.isArray(data) ? (data as ShopPayload[]) : []).map((s) => ({
        id: s.id,
        displayName: s.displayName,
        shopName: s.shopName,
        platform: s.platform,
        primaryAttendantId: s.primaryAttendant?.id ?? null,
      }));
      setCsvShops(shops);

      const assigneeMap = new Map<string, { id: string; name: string }>();
      (Array.isArray(data) ? (data as ShopPayload[]) : []).forEach((s) => {
        const users = [s.primaryAttendant, ...(s.attendants ?? [])].filter(Boolean) as Array<{
          id: string;
          name: string | null;
          email: string | null;
        }>;
        users.forEach((u) => {
          const label = u.name || u.email || u.id;
          if (!assigneeMap.has(u.id)) assigneeMap.set(u.id, { id: u.id, name: label });
        });
      });
      setCsvAssignees(Array.from(assigneeMap.values()).sort((a, b) => a.name.localeCompare(b.name)));
    })().catch(() => {});
  }, []);

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

        <div className="mt-4">
          <MarketplaceWeeklyCsvUpload
            title="CSV statement upload (fast)"
            shops={
              csvShops.length
                ? csvShops
                : props.accounts.map((a) => ({
                    id: a.id,
                    displayName: a.displayName,
                    platform: a.platform as unknown as "JUMIA" | "KILIMALL",
                  }))
            }
            weeks={csvWeeks}
            disableAssigneeSelect={Boolean(props.limitedView)}
            assignees={csvAssignees}
            hideSummaryTotals={Boolean(props.limitedView)}
            onImported={() => router.refresh()}
          />
        </div>
      </section>
    </div>
  );
}
