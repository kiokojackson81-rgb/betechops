"use strict";
// src/app/page.tsx
// BetechOps professional home page with live metrics
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Home;
const react_1 = require("react");
const link_1 = __importDefault(require("next/link"));
/** =========================
 * Helpers: robust fetchers
 * ======================= */
async function fetchJsonWithTimeout(url, timeoutMs = 5000) {
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
        }
        catch {
            // non-fatal if URL construction fails for relative strings
        }
        const r = await fetch(finalUrl, { cache: "no-store", signal: controller.signal });
        if (!r.ok)
            throw new Error(`${url} -> ${r.status}`);
        return (await r.json());
    }
    finally {
        clearTimeout(t);
    }
}
/** Try a list of endpoints until one gives a numeric count. */
async function tryCounts(paths) {
    for (const p of paths) {
        try {
            const j = await fetchJsonWithTimeout(p);
            if (Array.isArray(j))
                return j.length;
            if (typeof j === "number" && Number.isFinite(j))
                return j;
            if (j && typeof j === "object") {
                const obj = j;
                const approx = Boolean(obj.approx ?? obj.approxPending);
                let candidate = null;
                for (const k of ["count", "total", "value", "pendingAll", "queued"]) {
                    if (typeof obj[k] === "number" && Number.isFinite(obj[k])) {
                        candidate = obj[k];
                        break;
                    }
                }
                if (candidate !== null) {
                    if (candidate === 0 && approx)
                        continue;
                    return candidate;
                }
                if (Array.isArray(obj.orders)) {
                    const len = obj.orders.length;
                    if (len === 0 && approx)
                        continue;
                    return len;
                }
                if (Array.isArray(obj.items)) {
                    const len = obj.items.length;
                    if (len === 0 && approx)
                        continue;
                    return len;
                }
            }
        }
        catch {
            // try next
        }
    }
    return 0;
}
/** Try a list of endpoints until one gives a numeric money total. */
async function tryMoney(paths) {
    for (const p of paths) {
        try {
            const j = await fetchJsonWithTimeout(p);
            if (typeof j === "number" && Number.isFinite(j))
                return j;
            if (j && typeof j === "object") {
                const obj = j;
                for (const k of ["total", "amount", "revenue", "sales", "value"]) {
                    if (typeof obj[k] === "number" && Number.isFinite(obj[k]))
                        return obj[k];
                }
            }
        }
        catch {
            // try next
        }
    }
    return 0;
}
/** =========================
 * Small UI helpers
 * ======================= */
function cx(...classes) {
    return classes.filter(Boolean).join(" ");
}
const numberFmt = new Intl.NumberFormat(undefined);
/** Stat card with tones: sky, violet, pink */
function Stat({ title, value, prefix, tone = "sky", sub, }) {
    const display = typeof value === "number" ? numberFmt.format(value) : "—";
    const ring = tone === "sky"
        ? "ring-sky-400/40"
        : tone === "violet"
            ? "ring-violet-400/40"
            : "ring-pink-400/40";
    const glow = tone === "sky"
        ? "shadow-[0_0_30px_rgba(56,189,248,.15)]"
        : tone === "violet"
            ? "shadow-[0_0_30px_rgba(167,139,250,.15)]"
            : "shadow-[0_0_30px_rgba(244,114,182,.15)]";
    return (<div className={cx("rounded-2xl border border-white/10 backdrop-blur", "bg-[linear-gradient(135deg,rgba(10,12,20,.8),rgba(10,12,20,.6))]", "p-5 ring-1", ring, glow)}>
      <div className="text-sm text-slate-300">{title}</div>
      <div className="mt-2 text-4xl font-semibold tracking-tight">
        {prefix ? `${prefix} ` : ""}{display}
      </div>
      {sub && (<div className="mt-1 text-xs text-slate-400">{sub}</div>)}
    </div>);
}
/** =========================
 * Page
 * ======================= */
function Home() {
    const [pickupCnt, setPickupCnt] = (0, react_1.useState)(null);
    const [pricingCnt, setPricingCnt] = (0, react_1.useState)(null);
    const [pendingAll, setPendingAll] = (0, react_1.useState)(null);
    const [pendingUpdated, setPendingUpdated] = (0, react_1.useState)(null);
    // Explicitly disable any localStorage snapshot usage to always show DB values
    const USE_LOCAL_SNAPSHOT = false;
    // endpoints per spec
    // Single source of truth per card to avoid inconsistent values from mixed endpoints
    const pickupPaths = (0, react_1.useMemo)(() => ["/api/returns/waiting-pickup"], []);
    const pricingPaths = (0, react_1.useMemo)(() => ["/api/orders/pending-pricing"], []);
    const pendingPaths = (0, react_1.useMemo)(() => [], []);
    (0, react_1.useEffect)(() => {
        let ignore = false;
        // 1) Bypass localStorage hydration entirely for strict DB accuracy
        if (!USE_LOCAL_SNAPSHOT) {
            setPendingUpdated(null);
        }
        const run = async () => {
            try {
                const [c1, c2, kpis] = await Promise.all([
                    tryCounts(pickupPaths),
                    tryCounts(pricingPaths),
                    // DB-only accuracy: disable live vendor boost
                    fetchJsonWithTimeout("/api/metrics/kpis?noLive=1&pendingStatuses=PENDING"),
                ]);
                if (!ignore) {
                    // Only update when we have a concrete value; keep last value on errors
                    if (typeof c1 === "number" && Number.isFinite(c1))
                        setPickupCnt(c1);
                    if (typeof c2 === "number" && Number.isFinite(c2))
                        setPricingCnt(c2);
                    const rawPending = typeof kpis?.pendingAll === "number" && Number.isFinite(kpis.pendingAll)
                        ? Number(kpis.pendingAll)
                        : null;
                    const approx = Boolean(kpis?.approx);
                    if (rawPending !== null) {
                        const prev = pendingAll;
                        const shouldKeepPrev = approx && typeof prev === "number" && Number.isFinite(prev) && rawPending < prev;
                        if (!shouldKeepPrev) {
                            setPendingAll(rawPending);
                        }
                        const ts = typeof kpis?.updatedAt === "number" && !Number.isNaN(kpis.updatedAt)
                            ? kpis.updatedAt
                            : Date.now();
                        const dt = new Date(ts);
                        const hh = String(dt.getHours()).padStart(2, "0");
                        const mm = String(dt.getMinutes()).padStart(2, "0");
                        setPendingUpdated(approx
                            ? `Live ${dt.toLocaleDateString()} ${hh}:${mm}`
                            : `Updated ${dt.toLocaleDateString()} ${hh}:${mm}`);
                    }
                    else {
                        setPendingUpdated(null);
                    }
                    // 2) Skip persisting any snapshot to localStorage
                }
            }
            catch {
                // On error, keep previous values to avoid flicker to zero; just clear the timestamp
                if (!ignore)
                    setPendingUpdated(null);
            }
        };
        void run();
        const interval = setInterval(run, 5000);
        return () => {
            ignore = true;
            clearInterval(interval);
        };
    }, [pickupPaths, pricingPaths, pendingPaths]);
    return (<div className={cx("min-h-screen text-white", 
        // Background: radial gradient purple -> dark navy
        "bg-[radial-gradient(circle_at_20%_0%,#3b0b7a_0%,transparent_40%),radial-gradient(circle_at_100%_0%,#1a0b3b_0%,transparent_35%),linear-gradient(#090b12,#090b12)]")}>
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/20 backdrop-blur">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div>
            <div className="text-lg font-semibold leading-none">BetechOps</div>
            <div className="text-xs text-slate-400">Operations Dashboard</div>
          </div>
          <div className="flex items-center gap-2">
            <link_1.default href="/attendant/login" className="rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/10">
              Attendant Login
            </link_1.default>
            <link_1.default href="/admin/login" className="rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/10">
              Admin Login
            </link_1.default>
            <link_1.default href="/docs" className="rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/10">
              Documentation
            </link_1.default>
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
              <link_1.default href="/admin/login" className="rounded-2xl bg-slate-900/50 border border-white/10 px-6 py-3 font-semibold hover:bg-white/10">
                Admin Portal
              </link_1.default>

              <link_1.default href="/attendant/login" className="rounded-2xl bg-slate-900/50 border border-white/10 px-6 py-3 font-semibold hover:bg-white/10">
                Attendant Portal
              </link_1.default>
            </div>
          </div>
        </section>

        {/* Live Stats Grid */}
        <section className="pb-8">
          <div className="grid gap-4 md:grid-cols-3">
            <Stat title="Orders Waiting Pickup" value={pickupCnt} tone="sky"/>
            <Stat title="Orders Waiting Pricing" value={pricingCnt} tone="violet"/>
            <Stat title="Pending Orders (All)" value={pendingAll} tone="pink" sub={pendingUpdated}/>
          </div>
        </section>

        {/* Motivational Strip */}
        <section className={cx("mb-10 rounded-2xl border border-white/10 p-4 text-center text-sm text-slate-300", "bg-[linear-gradient(135deg,rgba(10,12,20,.8),rgba(10,12,20,.6))] backdrop-blur")}>
          Every order moved today keeps customers happy tomorrow.
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-black/20 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-slate-400 md:flex-row">
          <div>© {new Date().getFullYear()} BetechOps</div>
          <div className="flex items-center gap-3">
            <link_1.default href="/privacy" className="hover:text-slate-200">
              Privacy
            </link_1.default>
            <link_1.default href="/terms" className="hover:text-slate-200">
              Terms
            </link_1.default>
            <a href="https://www.betech.co.ke" target="_blank" rel="noreferrer" className="hover:text-slate-200">
              Website
            </a>
          </div>
        </div>
      </footer>
    </div>);
}
