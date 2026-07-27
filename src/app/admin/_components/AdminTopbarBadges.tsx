"use client";
import Link from "next/link";
import { useAdminPendingCounts } from "./useAdminPendingCounts";

export default function AdminTopbarBadges() {
  const counts = useAdminPendingCounts();

  const Badge = ({ href, label, count }: { href: string; label: string; count: number | null }) => (
    <Link href={href} className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 admin-badge">
      <span className="mr-2">{label}</span>
      {count !== null && (
        <span className="inline-flex items-center justify-center min-w-[20px] h-5 rounded-full bg-white/10 text-xs">
          {count}
        </span>
      )}
    </Link>
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge href="/admin/orders" label="Orders" count={counts?.orders ?? null} />
      <Badge href="/admin/receipts/missing-buying" label="Pending Pricing" count={counts?.pendingPricing ?? null} />
      <Badge href="/admin/returns" label="Projects" count={counts?.projects ?? null} />
      <Badge href="/admin/wellness" label="Wellness" count={counts?.wellness ?? null} />
      <Badge href="/admin/quotation-center/site-visits" label="Site Visits" count={counts?.siteVisits ?? null} />
      <Badge href="/admin/reviews-referrals" label="Customer Reviews" count={counts?.customerReviews ?? null} />
    </div>
  );
}
