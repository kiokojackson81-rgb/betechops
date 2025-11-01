// src/app/page.tsx
// BetechOps professional home page with live metrics
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

/** =========================
 * Types
 * ======================= */
type CountLike =
  | {
      count?: number;
      total?: number;
      value?: number;
      pendingAll?: number;
      queued?: number;
      approx?: boolean;
      approxPending?: boolean;
      orders?: unknown;
      items?: unknown;
    }
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
    // Cache-buster per minute to avoid any intermediary caches despite no-store
    let finalUrl = url;
    try {
      const u = new URL(url, window.location.origin);
      // Change every minute to reduce re-downloading while keeping things fresh
      u.searchParams.set("_v", String(Math.floor(Date.now() / 60000)));
      finalUrl = u.toString();
    } catch {
      // non-fatal if URL construction fails for relative strings
    }
    const r = await fetch(finalUrl, { cache: "no-store", signal: controller.signal });
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
      if (Array.isArray(j)) return j.length;
      if (typeof j === "number" && Number.isFinite(j)) return j;
      if (j && typeof j === "object") {
        const obj = j as {
          count?: number;
          total?: number;
          value?: number;
          pendingAll?: number;
          queued?: number;
          approx?: boolean;
          approxPending?: boolean;
          orders?: unknown;
          items?: unknown;
        };
        const approx = Boolean(obj.approx ?? obj.approxPending);
        let candidate: number | null = null;
        for (const k of ["count", "total", "value", "pendingAll", "queued"] as const) {
          if (typeof obj[k] === "number" && Number.isFinite(obj[k]!)) {
            candidate = obj[k]!;
            break;
          }
        }
        if (candidate !== null) {
          if (candidate === 0 && approx) continue;
          return candidate;
        }
        if (Array.isArray(obj.orders)) {
          const len = obj.orders.length;
          if (len === 0 && approx) continue;
          return len;
        }
        if (Array.isArray(obj.items)) {
          const len = obj.items.length;
          if (len === 0 && approx) continue;
          return len;
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
  sub,
}: {
  title: string;
  value: number | null | undefined;
  prefix?: string;
  tone?: "sky" | "violet" | "pink";
  sub?: string | null;
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
      {sub && (
        <div className="mt-1 text-xs text-slate-400">{sub}</div>
      )}
    </div>
  );
}

/** =========================
 * Page
 * ======================= */
export default function Home() {
  const [pickupCnt, setPickupCnt] = useState<number | null>(null);
  const [pricingCnt, setPricingCnt] = useState<number | null>(null);
  const [pendingAll, setPendingAll] = useState<number | null>(null);
  const [pendingUpdated, setPendingUpdated] = useState<string | null>(null);
  const LS_KEY = 'home:stats:v1';

  // endpoints per spec
  // Single source of truth per card to avoid inconsistent values from mixed endpoints
  const pickupPaths = useMemo(() => ["/api/returns/waiting-pickup"], []);
  const pricingPaths = useMemo(() => ["/api/orders/pending-pricing"], []);
  const pendingPaths = useMemo(() => ["/api/metrics/kpis"], []); // KPIs only

  useEffect(() => {
    let ignore = false;

    // 1) Hydrate instantly from last good local snapshot to avoid blanks on first paint.
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(LS_KEY) : null;
      if (raw) {
        const cached = JSON.parse(raw) as { pickup?: number; pricing?: number; pending?: number; updatedAt?: number };
        if (!ignore) {
          if (Number.isFinite(cached?.pickup)) setPickupCnt(Number(cached.pickup));
          if (Number.isFinite(cached?.pricing)) setPricingCnt(Number(cached.pricing));
          if (Number.isFinite(cached?.pending)) setPendingAll(Number(cached.pending));
          if (typeof cached?.updatedAt === 'number') {
            const dt = new Date(cached.updatedAt);
            const hh = String(dt.getHours()).padStart(2, '0');
            const mm = String(dt.getMinutes()).padStart(2, '0');
            setPendingUpdated(`Updated ${dt.toLocaleDateString()} ${hh}:${mm}`);
          }
        }
      }
    } catch {}

    const run = async () => {
      try {
        const [c1, c2, kpis] = await Promise.all([
          tryCounts(pickupPaths),
          tryCounts(pricingPaths),
          fetchJsonWithTimeout<any>("/api/metrics/kpis"),
        ]);
        if (!ignore) {
          // Only update when we have a concrete value; keep last value on errors
          if (typeof c1 === "number" && Number.isFinite(c1)) setPickupCnt(c1);
          if (typeof c2 === "number" && Number.isFinite(c2)) setPricingCnt(c2);

          const pending = Number(kpis?.pendingAll);
          const approx = Boolean(kpis?.approx);
          // Protect against transient zeros: if approx is true and pending is 0, keep last non-zero value
          if (Number.isFinite(pending)) {
            if (pending === 0 && approx && (pendingAll ?? 0) > 0) {
              // keep previous value, just refresh the timestamp
            } else {
              setPendingAll(pending);
            }
          }

          const ts = typeof kpis?.updatedAt === "number" ? kpis.updatedAt : Date.now();
          const dt = new Date(ts);
          const hh = String(dt.getHours()).padStart(2, "0");
          const mm = String(dt.getMinutes()).padStart(2, "0");
          setPendingUpdated(`Updated ${dt.toLocaleDateString()} ${hh}:${mm}`);

          // 2) Persist latest successful snapshot for instant reuse next load
          try {
            const snapshot = {
              pickup: typeof c1 === 'number' && Number.isFinite(c1) ? c1 : pickupCnt,
              pricing: typeof c2 === 'number' && Number.isFinite(c2) ? c2 : pricingCnt,
              pending: Number.isFinite(pending) ? (pending === 0 && approx && (pendingAll ?? 0) > 0 ? pendingAll : pending) : pendingAll,
              updatedAt: ts,
            };
            localStorage.setItem(LS_KEY, JSON.stringify(snapshot));
          } catch {}
        }
      } catch {
        // On error, keep previous values to avoid flicker to zero; just clear the timestamp
        if (!ignore) setPendingUpdated(null);
      }
    };

    void run();
    const interval = setInterval(run, 60_000);
    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, [pickupPaths, pricingPaths, pendingPaths]);

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
              href="/attendant/login"
              className="rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/10"
            >
              Attendant Login
            </Link>
            <Link
              href="/admin/login"
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
            <Stat title="Pending Orders (All)" value={pendingAll} tone="pink" sub={pendingUpdated} />
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
