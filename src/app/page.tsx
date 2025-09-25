// src/app/page.tsx
// BetechOps professional home page with live metrics
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

/** =========================
 * Types
 * ======================= */
type CountLike =
  | { count?: number; total?: number; value?: number }
  | number;

type MoneyLike =
  | { total?: number; amount?: number; revenue?: number; sales?: number; value?: number }
  | number;

/** =========================
 * Helpers: robust fetchers
 * ======================= */
async function fetchJsonWithTimeout<T = unknown>(url: string, timeoutMs = 5000): Promise<T | null> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(url, { cache: "no-store", signal: controller.signal });
    if (!r.ok) throw new Error(`${url} -> ${r.status}`);
    return (await r.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

/** Try a list of endpoints until one gives a numeric count. */
async function tryCounts(paths: string[]): Promise<number> {
  for (const p of paths) {
    try {
      const j = await fetchJsonWithTimeout<CountLike>(p);
      if (typeof j === "number" && Number.isFinite(j)) return j;
      if (j && typeof j === "object") {
        const obj = j as { count?: number; total?: number; value?: number };
        for (const k of ["count", "total", "value"] as const) {
          if (typeof obj[k] === "number" && Number.isFinite(obj[k]!)) return obj[k]!;
        }
      }
    } catch {
      // try next
    }
  }
  return 0;
}

/** Try a list of endpoints until one gives a numeric money total. */
async function tryMoney(paths: string[]): Promise<number> {
  for (const p of paths) {
    try {
      const j = await fetchJsonWithTimeout<MoneyLike>(p);
      if (typeof j === "number" && Number.isFinite(j)) return j;
      if (j && typeof j === "object") {
        const obj = j as { total?: number; amount?: number; revenue?: number; sales?: number; value?: number };
        for (const k of ["total", "amount", "revenue", "sales", "value"] as const) {
          if (typeof obj[k] === "number" && Number.isFinite(obj[k]!)) return obj[k]!;
        }
      }
    } catch {
      // try next
    }
  }
  return 0;
}

/** =========================
 * Small UI helpers
 * ======================= */
function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const numberFmt = new Intl.NumberFormat(undefined);

/** Stat card with tones: sky, violet, pink */
function Stat({
  title,
  value,
  prefix,
  tone = "sky",
}: {
  title: string;
  value: number | null | undefined;
  prefix?: string;
  tone?: "sky" | "violet" | "pink";
}) {
  const display = typeof value === "number" ? numberFmt.format(value) : "—";
  const ring =
    tone === "sky"
      ? "ring-sky-400/40"
      : tone === "violet"
      ? "ring-violet-400/40"
      : "ring-pink-400/40";
  const glow =
    tone === "sky"
      ? "shadow-[0_0_30px_rgba(56,189,248,.15)]"
      : tone === "violet"
      ? "shadow-[0_0_30px_rgba(167,139,250,.15)]"
      : "shadow-[0_0_30px_rgba(244,114,182,.15)]";

  return (
    <div
      className={cx(
        "rounded-2xl border border-white/10 backdrop-blur",
        "bg-[linear-gradient(135deg,rgba(10,12,20,.8),rgba(10,12,20,.6))]",
        "p-5 ring-1",
        ring,
        glow
      )}
    >
      <div className="text-sm text-slate-300">{title}</div>
      <div className="mt-2 text-4xl font-semibold tracking-tight">
        {prefix ? `${prefix} ` : ""}{display}
      </div>
    </div>
  );
}

/** =========================
 * Page
 * ======================= */
export default function Home() {
  const [pickupCnt, setPickupCnt] = useState<number | null>(null);
  const [pricingCnt, setPricingCnt] = useState<number | null>(null);
  const [salesToday, setSalesToday] = useState<number | null>(null);

  // endpoints per spec
  const pickupPaths = useMemo(
    () => ["/api/returns/waiting-pickup", "/api/returns/count?status=waiting-pickup"],
    []
  );
  const pricingPaths = useMemo(
    () => ["/api/orders/pending-pricing", "/api/reports/pending-pricing"],
    []
  );
  const salesPaths = useMemo(
    () => ["/api/reports/sales-today", "/api/reports/summary?range=today"],
    []
  );

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const [c1, c2, s1] = await Promise.all([
          tryCounts(pickupPaths),
          tryCounts(pricingPaths),
          tryMoney(salesPaths),
        ]);
        if (!ignore) {
          setPickupCnt(c1);
          setPricingCnt(c2);
          setSalesToday(s1);
        }
      } catch {
        if (!ignore) {
          setPickupCnt(0);
          setPricingCnt(0);
          setSalesToday(0);
        }
      }
    })();
    return () => {
      ignore = true;
    };
  }, [pickupPaths, pricingPaths, salesPaths]);

  return (
    <div
      className={cx(
        "min-h-screen text-white",
        // Background: radial gradient purple -> dark navy
        "bg-[radial-gradient(circle_at_20%_0%,#3b0b7a_0%,transparent_40%),radial-gradient(circle_at_100%_0%,#1a0b3b_0%,transparent_35%),linear-gradient(#090b12,#090b12)]"
      )}
    >
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/20 backdrop-blur">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div>
            <div className="text-lg font-semibold leading-none">BetechOps</div>
            <div className="text-xs text-slate-400">Operations Dashboard</div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/attendant"
              className="rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/10"
            >
              Attendant Login
            </Link>
            <Link
              href="/admin"
              className="rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/10"
            >
              Admin Login
            </Link>
            <Link
              href="/docs"
              className="rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/10"
            >
              Documentation
            </Link>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4">
        {/* Hero */}
        <section className="pt-14 pb-10 text-center">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            BetechOps Operations Dashboard
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-slate-300">
            Live visibility into pickups, pricing, and sales. Quick access to admin
            and attendant portals.
          </p>
          <div className="mt-7 flex items-center justify-center">
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/admin/login"
                className="rounded-2xl bg-slate-900/50 border border-white/10 px-6 py-3 font-semibold hover:bg-white/10"
              >
                Admin Portal
              </Link>

              <Link
                href="/attendant/login"
                className="rounded-2xl bg-slate-900/50 border border-white/10 px-6 py-3 font-semibold hover:bg-white/10"
              >
                Attendant Portal
              </Link>
            </div>
          </div>
        </section>

        {/* Live Stats Grid */}
        <section className="pb-8">
          <div className="grid gap-4 md:grid-cols-3">
            <Stat
              title="Orders Waiting Pickup"
              value={pickupCnt}
              tone="sky"
            />
            <Stat
              title="Orders Waiting Pricing"
              value={pricingCnt}
              tone="violet"
            />
            <Stat
              title="Today's Sales"
              value={salesToday}
              prefix="Ksh"
              tone="pink"
            />
          </div>
        </section>

        {/* Motivational Strip */}
        <section
          className={cx(
            "mb-10 rounded-2xl border border-white/10 p-4 text-center text-sm text-slate-300",
            "bg-[linear-gradient(135deg,rgba(10,12,20,.8),rgba(10,12,20,.6))] backdrop-blur"
          )}
        >
          Every order moved today keeps customers happy tomorrow.
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-black/20 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-slate-400 md:flex-row">
          <div>© {new Date().getFullYear()} BetechOps</div>
          <div className="flex items-center gap-3">
            <Link href="/privacy" className="hover:text-slate-200">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-slate-200">
              Terms
            </Link>
            <a
              href="https://www.betech.co.ke"
              target="_blank"
              rel="noreferrer"
              className="hover:text-slate-200"
            >
              Website
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
