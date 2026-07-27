"use client";

import { useEffect, useState } from "react";

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

export function useAdminPendingCounts() {
  const [counts, setCounts] = useState<AdminPendingCounts | null>(null);

  useEffect(() => {
    let ignore = false;

    (async () => {
      try {
        const response = await fetch("/api/admin/pending-counts", { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (ignore) return;
        if (!response.ok || !payload?.counts) {
          setCounts(ZERO_COUNTS);
          return;
        }
        setCounts({
          orders: Number(payload.counts.orders ?? 0),
          pendingPricing: Number(payload.counts.pendingPricing ?? 0),
          projects: Number(payload.counts.projects ?? 0),
          wellness: Number(payload.counts.wellness ?? 0),
          siteVisits: Number(payload.counts.siteVisits ?? 0),
          customerReviews: Number(payload.counts.customerReviews ?? 0),
          quotationCenter: Number(payload.counts.quotationCenter ?? 0),
          websiteOrders: Number(payload.counts.websiteOrders ?? 0),
        });
      } catch {
        if (!ignore) setCounts(ZERO_COUNTS);
      }
    })();

    return () => {
      ignore = true;
    };
  }, []);

  return counts;
}
