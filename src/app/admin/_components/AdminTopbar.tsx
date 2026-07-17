"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function AdminTopbar() {
  const [reviewsCount, setReviewsCount] = useState<number | null>(null);
  const [projectsCount, setProjectsCount] = useState<number | null>(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const [pp, rp] = await Promise.all([
          fetch("/api/admin/reviews-referrals/summary", { cache: "no-store" })
            .then(r => r.json()).catch(() => ({ count: 0 })),
          fetch("/api/receipts?customerType=project&scope=global&page=1&size=1", { cache: "no-store" })
            .then(r => r.json()).catch(() => ({ paging: { totalCount: 0 } })),
        ]);
        if (!ignore) {
          setReviewsCount(typeof pp?.summary?.reviews?.submittedReviews === "number" ? pp.summary.reviews.submittedReviews : 0);
          setProjectsCount(typeof rp?.paging?.totalCount === "number" ? rp.paging.totalCount : 0);
        }
      } catch {
        if (!ignore) { setReviewsCount(0); setProjectsCount(0); }
      }
    })();
    return () => { ignore = true; };
  }, []);

  return (
    <nav className="flex items-center gap-3 p-3">
      <Link href="/admin" className="px-3 py-1 rounded bg-white/5">Dashboard</Link>
      <Link href="/admin/shops" className="px-3 py-1 rounded bg-white/5">Shops</Link>
      <Link href="/admin/users" className="px-3 py-1 rounded bg-white/5">Users</Link>

      <Link href="/admin/reviews-referrals" className="px-3 py-1 rounded bg-white/5 relative">
        Customer Reviews
        {reviewsCount !== null && (
          <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-yellow-500/20 px-2 text-yellow-300 text-xs">
            {reviewsCount}
          </span>
        )}
      </Link>

      <Link href="/admin/reports" className="px-3 py-1 rounded bg-white/5">Reports</Link>

      <Link href="/admin/marketing-report" className="px-3 py-1 rounded bg-white/5">Marketing Report</Link>

      <Link href="/admin/returns" className="px-3 py-1 rounded bg-white/5 relative">
        Projects
        {projectsCount !== null && (
          <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-indigo-500/20 px-2 text-indigo-300 text-xs">
            {projectsCount}
          </span>
        )}
      </Link>
    </nav>
  );
}
