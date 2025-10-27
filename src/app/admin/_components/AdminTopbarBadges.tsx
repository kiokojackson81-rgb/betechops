"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function AdminTopbarBadges() {
  const [pp, setPP] = useState<number | null>(null);
  const [rp, setRP] = useState<number | null>(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const [a, b] = await Promise.all([
          fetch("/api/orders/pending-pricing", { cache: "no-store" }).then(r => r.ok ? r.json() : { count: 0 }),
          fetch("/api/returns/waiting-pickup", { cache: "no-store" }).then(r => r.ok ? r.json() : { count: 0 }),
        ]);
        if (!ignore) { setPP(a.count ?? 0); setRP(b.count ?? 0); }
      } catch { if (!ignore) { setPP(0); setRP(0); } }
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
      <Badge href="/admin/pending-pricing" label="Pending Pricing" count={pp} />
      <Badge href="/admin/returns" label="Returns" count={rp} />
    </div>
  );
}
