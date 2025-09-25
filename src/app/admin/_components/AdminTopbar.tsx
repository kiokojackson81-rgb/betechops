"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function AdminTopbar() {
  const [pendingPricing, setPendingPricing] = useState<number | null>(null);
  const [waitingPickup, setWaitingPickup] = useState<number | null>(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const [pp, rp] = await Promise.all([
          fetch("/api/orders/pending-pricing", { cache: "no-store" })
            .then(r => r.json()).catch(() => ({ count: 0 })),
          fetch("/api/returns/waiting-pickup", { cache: "no-store" })
            .then(r => r.json()).catch(() => ({ count: 0 })),
        ]);
        if (!ignore) {
          setPendingPricing(typeof pp.count === "number" ? pp.count : 0);
          setWaitingPickup(typeof rp.count === "number" ? rp.count : 0);
        }
      } catch {
        if (!ignore) { setPendingPricing(0); setWaitingPickup(0); }
      }
    })();
    return () => { ignore = true; };
  }, []);

  return (
    <nav className="flex items-center gap-3 p-3">
      <Link href="/admin" className="px-3 py-1 rounded bg-white/5">Dashboard</Link>
      <Link href="/admin/shops" className="px-3 py-1 rounded bg-white/5">Shops</Link>
      <Link href="/admin/attendants" className="px-3 py-1 rounded bg-white/5">Attendants</Link>

      <Link href="/admin/pending-pricing" className="px-3 py-1 rounded bg-white/5 relative">
        Pending Pricing
        {pendingPricing !== null && (
          <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-yellow-500/20 px-2 text-yellow-300 text-xs">
            {pendingPricing}
          </span>
        )}
      </Link>

      <Link href="/admin/reports" className="px-3 py-1 rounded bg-white/5">Reports</Link>

      <Link href="/admin/returns" className="px-3 py-1 rounded bg-white/5 relative">
        Returns
        {waitingPickup !== null && (
          <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-indigo-500/20 px-2 text-indigo-300 text-xs">
            {waitingPickup}
          </span>
        )}
      </Link>
    </nav>
  );
}