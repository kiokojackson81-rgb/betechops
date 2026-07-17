"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function AdminTopbarBadges() {
  const [reviews, setReviews] = useState<number | null>(null);
  const [projects, setProjects] = useState<number | null>(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const [a, b] = await Promise.all([
          fetch("/api/admin/reviews-referrals/summary", { cache: "no-store" }).then(r => r.ok ? r.json() : { summary: { reviews: { submittedReviews: 0 } } }),
          fetch("/api/receipts?customerType=project&scope=global&page=1&size=1", { cache: "no-store" }).then(r => r.ok ? r.json() : { paging: { totalCount: 0 } }),
        ]);
        if (!ignore) {
          setReviews(a.summary?.reviews?.submittedReviews ?? 0);
          setProjects(b.paging?.totalCount ?? 0);
        }
      } catch {
        if (!ignore) { setReviews(0); setProjects(0); }
      }
    })();
    return () => { ignore = true; };
  }, []);

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
    <div className="flex items-center gap-2">
      <Badge href="/admin/reviews-referrals" label="Customer Reviews" count={reviews} />
      <Badge href="/admin/returns" label="Projects" count={projects} />
    </div>
  );
}
