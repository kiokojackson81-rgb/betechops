"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export type AdminPendingCounts = {
  orders: number;
  pendingPricing: number;
  projects: number;
  wellness: number;
  siteVisits: number;
  customerReviews: number;
  quotationCenter: number;
  websiteOrders: number;
};

const ZERO_COUNTS: AdminPendingCounts = {
  orders: 0,
  pendingPricing: 0,
  projects: 0,
  wellness: 0,
  siteVisits: 0,
  customerReviews: 0,
  quotationCenter: 0,
  websiteOrders: 0,
};

let pendingCountsRequest: Promise<AdminPendingCounts> | null = null;
let pendingCountsCachedAt = 0;
let pendingCountsCache: AdminPendingCounts | null = null;

async function fetchPendingCountsOnce(): Promise<AdminPendingCounts> {
  // AdminTopNav and AdminTopbarBadges mount together. Share their request and
  // retain the result briefly so focus/navigation cannot create a burst.
  if (pendingCountsCache && Date.now() - pendingCountsCachedAt < 5_000) return pendingCountsCache;
  if (pendingCountsRequest) return pendingCountsRequest;
  pendingCountsRequest = fetch("/api/admin/pending-counts", { cache: "no-store" })
    .then(async (response) => {
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.counts) return ZERO_COUNTS;
      return {
        orders: Number(payload.counts.orders ?? 0),
        pendingPricing: Number(payload.counts.pendingPricing ?? 0),
        projects: Number(payload.counts.projects ?? 0),
        wellness: Number(payload.counts.wellness ?? 0),
        siteVisits: Number(payload.counts.siteVisits ?? 0),
        customerReviews: Number(payload.counts.customerReviews ?? 0),
        quotationCenter: Number(payload.counts.quotationCenter ?? 0),
        websiteOrders: Number(payload.counts.websiteOrders ?? 0),
      };
    })
    .catch(() => ZERO_COUNTS)
    .then((counts) => {
      pendingCountsCache = counts;
      pendingCountsCachedAt = Date.now();
      return counts;
    })
    .finally(() => { pendingCountsRequest = null; });
  return pendingCountsRequest;
}

export function useAdminPendingCounts() {
  const [counts, setCounts] = useState<AdminPendingCounts | null>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const navigationKey = `${pathname}?${searchParams.toString()}`;

  useEffect(() => {
    let ignore = false;

    const refreshCounts = async () => {
      const next = await fetchPendingCountsOnce();
      if (!ignore) setCounts(next);
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refreshCounts();
    };

    void refreshCounts();
    window.addEventListener("focus", refreshCounts);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    const refreshInterval = window.setInterval(refreshCounts, 30_000);

    return () => {
      ignore = true;
      window.removeEventListener("focus", refreshCounts);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.clearInterval(refreshInterval);
    };
  }, [navigationKey]);

  return counts;
}
