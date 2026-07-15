"use client";

import { useEffect } from "react";

type ReferralClickTrackerProps = {
  referralCode: string;
  productSlug: string;
};

export default function ReferralClickTracker({ referralCode, productSlug }: ReferralClickTrackerProps) {
  useEffect(() => {
    if (!referralCode) return;

    void fetch(`/api/referrals/${encodeURIComponent(referralCode)}/click`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "product_page",
        metadata: {
          productSlug,
          page: "shop_product_detail",
        },
      }),
    }).catch(() => null);
  }, [productSlug, referralCode]);

  return null;
}
