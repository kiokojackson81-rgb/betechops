// src/app/admin/_components/AdminTopbar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

/** Resilient fetch helpers */
async function jFetch<T = unknown>(url: string, ms = 6000): Promise<T | null> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { cache: "no-store", signal: ctl.signal });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function tryCount(paths: string[]): Promise<number> {
  for (const p of paths) {
    const j: unknown = await jFetch(p);
    if (j == null) continue;
    if (typeof j === "number") return j;
    const response = j as Record<string, unknown>;
    for (const k of ["count", "total", "value", "waiting", "pending"]) {
      if (typeof response?.[k] === "number") return response[k];
    }
  }
  return 0;
}

const tabs = [
  { href: "/admin", label: "Dashboard", match: /^\/admin\/?$/ },
  { href: "/admin/shops", label: "Shops", match: /^\/admin\/shops/ },
  { href: "/admin/attendants", label: "Attendants", match: /^\/admin\/attendants/ },
  { href: "/admin/pending-pricing", label: "Pending Pricing", match: /^\/admin\/pending-pricing/ },
  { href: "/admin/reports", label: "Reports", match: /^\/admin\/reports/ },
  { href: "/admin/returns", label: "Returns", match: /^\/admin\/returns/ },
];

export default function AdminTopbar() {
  const pathname = usePathname();

  const [pendingPricing, setPendingPricing] = useState<number>(0);
  const [returnsWaiting, setReturnsWaiting] = useState<number>(0);

  // endpoints from your spec with fallbacks
  const pricingPaths = useMemo(
    () => ["/api/orders/pending-pricing", "/api/reports/pending-pricing"],
    []
  );
  const returnsPaths = useMemo(
    () => ["/api/returns/waiting-pickup", "/api/returns/count?status=waiting-pickup"],
    []
  );

  useEffect(() => {
    let ignore = false;
    (async () => {
      const [a, b] = await Promise.all([tryCount(pricingPaths), tryCount(returnsPaths)]);
      if (!ignore) {
        setPendingPricing(a);
        setReturnsWaiting(b);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [pricingPaths, returnsPaths]);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-black/25 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold leading-none">Jumia Ops · Admin</div>
          <div className="text-xs text-slate-400">Operations Control Center</div>
        </div>
        <nav className="flex gap-1 overflow-x-auto [&>*]:shrink-0">
          {tabs.map((t) => {
            const active = t.match.test(pathname || "");
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`px-3 py-2 rounded-xl text-sm border border-white/10 hover:bg-white/10 ${
                  active ? "bg-white/10" : "bg-white/5"
                }`}
              >
                <span>{t.label}</span>
                {t.href === "/admin/pending-pricing" && (
                  <span className="ml-2 rounded-md bg-yellow-400/20 text-yellow-300 px-2 py-0.5 text-xs">
                    {pendingPricing}
                  </span>
                )}
                {t.href === "/admin/returns" && (
                  <span className="ml-2 rounded-md bg-indigo-400/20 text-indigo-300 px-2 py-0.5 text-xs">
                    {returnsWaiting}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}