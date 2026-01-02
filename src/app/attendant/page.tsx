"use client";

import { useEffect, useMemo, useState } from "react";
import QueueList from "./_components/QueueList";
import QuickPriceCard from "./_components/QuickPriceCard";
import ReturnsCard from "./_components/ReturnsCard";
import ShopSnapshot from "./_components/ShopSnapshot";
import Shortcuts from "./_components/Shortcuts";
import Announcement from "./_components/Announcement";
import DailySalesCard from "./_components/DailySalesCard";
import ProductUploadsCard from "./_components/ProductUploadsCard";
import Button from "@/app/_components/Button";
import Sparkline from "@/app/_components/Sparkline";
import { attendantCategoryById } from "@/lib/attendants/definitions";
import type { AttendantCategory } from "@prisma/client";

type ProfileResponse = {
  user: {
    id: string;
    name: string | null;
    email: string;
    role: string;
    attendantCategory: AttendantCategory;
    categories?: AttendantCategory[];
  };
};

const PRIMARY_WIDGETS = new Set(["QUEUE", "PRICING", "RETURNS", "DAILY_SALES", "PRODUCT_UPLOADS"]);

type ShopSummary = {
  id: string;
  name: string;
  platform: string;
};

function renderWidget(widget: string, shopId?: string | null) {
  switch (widget) {
    case "QUEUE":
      return <QueueList shopId={shopId ?? undefined} />;
    case "PRICING":
      return <QuickPriceCard />;
    case "RETURNS":
      return <ReturnsCard />;
    case "SHOP_SNAPSHOT":
      return <ShopSnapshot shopId={shopId ?? undefined} />;
    case "SHORTCUTS":
      return <Shortcuts />;
    case "ANNOUNCEMENTS":
      return <Announcement />;
    case "DAILY_SALES":
      return <DailySalesCard />;
    case "PRODUCT_UPLOADS":
      return <ProductUploadsCard />;
    default:
      return null;
  }
}

export default function AttendantDashboard() {
  // impersonateId is read from the client-side URL when performing fetches
  const impersonateIdFromWindow = () => (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("impersonateId") : null);
  const [shopId, setShopId] = useState<string | undefined>(undefined);
  const [profile, setProfile] = useState<ProfileResponse["user"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [shops, setShops] = useState<ShopSummary[]>([]);
  const [loadingShops, setLoadingShops] = useState(true);
  const [summary, setSummary] = useState<{ totalProducts: number; totalSales: number } | null>(null);
  const [recentReports, setRecentReports] = useState<Array<{ date: string; productsCount: number; totalSales: number }>>([]);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("shopId") || undefined : undefined;
    setShopId(saved || undefined);
    void fetchProfile();
    void fetchShops();
    void fetchSummary();
  }, []);

  async function fetchSummary() {
    try {
      const imp = impersonateIdFromWindow();
      const qp = imp ? `?page=1&pageSize=6&impersonateId=${encodeURIComponent(imp)}` : `?page=1&pageSize=6`;
      const res = await fetch(`/api/daily-report${qp}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setSummary(data.summary ?? null);
      const reports = (data.reports ?? []).map((r: any) => ({ date: r.date, productsCount: r.productsCount ?? 0, totalSales: r.totalSales ?? 0 }));
      setRecentReports(reports);
    } catch {
      // ignore
    }
  }

  async function fetchProfile() {
    try {
      const imp = impersonateIdFromWindow();
      const url = imp ? `/api/attendants/me?impersonateId=${encodeURIComponent(imp)}` : "/api/attendants/me";
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as ProfileResponse;
      setProfile(data.user);
    } catch {
      // ignore for now; dashboard will fallback to defaults
    } finally {
      setLoading(false);
    }
  }

  async function fetchShops() {
    try {
      const imp = impersonateIdFromWindow();
      const url = imp ? `/api/attendants/shops?impersonateId=${encodeURIComponent(imp)}` : "/api/attendants/shops";
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as ShopSummary[];
      setShops(data);

      if (data.length) {
        setShopId((prev) => {
          if (prev && data.some((shop) => shop.id === prev)) return prev;
          if (data.length === 1) {
            if (typeof window !== "undefined") localStorage.setItem("shopId", data[0].id);
            return data[0].id;
          }
          if (typeof window !== "undefined") localStorage.removeItem("shopId");
          return undefined;
        });
      } else {
        if (typeof window !== "undefined") localStorage.removeItem("shopId");
        setShopId(undefined);
      }
    } catch {
      // ignore network error for now
    } finally {
      setLoadingShops(false);
    }
  }

  const categoryOrder = useMemo<AttendantCategory[]>(() => {
    const fallback = profile?.attendantCategory ?? "DIRECT_SALES_OPS";
    const raw = profile?.categories ?? [];
    const ordered = [fallback, ...raw].filter(Boolean) as AttendantCategory[];
    return Array.from(new Set(ordered)) as AttendantCategory[];
  }, [profile?.attendantCategory, profile?.categories]);

  const definitions = useMemo(() => {
    if (categoryOrder.length) {
      return categoryOrder.map((cat) => (attendantCategoryById as any)[cat] ?? (attendantCategoryById as any)["DIRECT_SALES_OPS"]);
    }
    return [(attendantCategoryById as any)["DIRECT_SALES_OPS"]];
  }, [categoryOrder]);

  const widgets = useMemo(() => {
    const widgetSequence: string[] = [];
    for (const def of definitions) {
      for (const widget of def.defaultWidgets) {
        if (!widgetSequence.includes(widget)) widgetSequence.push(widget);
      }
    }

    const nodes = widgetSequence
      .map((id) => ({ id, node: renderWidget(id, shopId) }))
      .filter((item) => Boolean(item.node));
    const primary = nodes.filter((n) => PRIMARY_WIDGETS.has(n.id));
    const secondary = nodes.filter((n) => !PRIMARY_WIDGETS.has(n.id));
    return { primary, secondary };
  }, [definitions, shopId]);

  return (
    <div className="page-shell py-6 text-slate-100">
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Attendant Dashboard</h1>
          <div className="mt-2 flex flex-wrap gap-2 text-xs uppercase tracking-widest text-slate-300">
            {definitions.map((def, idx) => (
              <span key={def.id} className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1">
                <span className="font-semibold text-white">{def.label}</span>
                {idx === 0 ? <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-200">Primary</span> : null}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-400">Shop:</span>
          <select
            className="w-full max-w-xs rounded-lg border border-white/10 bg-transparent px-2 py-1 text-sm outline-none"
            value={shopId || ""}
            onChange={(e) => {
              const val = e.target.value || undefined;
              setShopId(val);
              if (val) localStorage.setItem("shopId", val);
              else localStorage.removeItem("shopId");
            }}
            disabled={!shops.length && !loadingShops}
          >
            <option value="">All</option>
            {shops.map((shop) => (
              <option key={shop.id} value={shop.id}>
                {shop.name} {shop.platform ? `(${shop.platform})` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI header */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="kpi-card flex-1 min-w-[140px]">
          <div className="kpi-title">Total products (recent)</div>
          <div className="kpi-value">{summary ? summary.totalProducts : "-"}</div>
        </div>
        <div className="kpi-card flex-1 min-w-[140px]">
          <div className="kpi-title">Total sales (KES)</div>
          <div className="kpi-value">{summary ? Number(summary.totalSales).toLocaleString() : "-"}</div>
        </div>
        <div className="text-sm opacity-70">Recent uploads</div>
        <div className="sparkline">
          <Sparkline values={recentReports.map((r) => r.productsCount)} color="var(--primary)" />
        </div>
        <div className="w-full sm:w-auto sm:ml-auto">
          <Button
            onClick={() => (window.location.href = "/attendant/daily-report")}
            variant="primary"
            className="w-full text-center sm:w-auto"
          >
            Open daily report
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-sm text-slate-400">
          Loading your workspace…
        </div>
      ) : shops.length || !loadingShops ? (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
          <div className="space-y-6">
            {widgets.primary.length ? (
              widgets.primary.map((w) => <div key={w.id}>{w.node}</div>)
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">
                No widgets configured for this category yet.
              </div>
            )}
          </div>
          <div className="space-y-6">
            {widgets.secondary.length ? widgets.secondary.map((w) => <div key={w.id}>{w.node}</div>) : null}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">
          You are not assigned to any active shop yet.
        </div>
      )}
    </div>
  </div>
  );
}

// sparkline is now provided by `src/app/_components/Sparkline`
