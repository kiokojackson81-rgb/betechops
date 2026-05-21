"use client";

import { useEffect } from "react";
import { trackProductView, trackShopView } from "@/app/shop/shopAnalytics";

type ShopAnalyticsTrackerProps =
  | {
      kind: "shop_view";
      payload?: Record<string, unknown>;
    }
  | {
      kind: "product_view";
      payload?: Record<string, unknown>;
    };

export default function ShopAnalyticsTracker({ kind, payload }: ShopAnalyticsTrackerProps) {
  useEffect(() => {
    if (kind === "shop_view") {
      trackShopView(payload);
      return;
    }

    trackProductView(payload);
  }, [kind, payload]);

  return null;
}
