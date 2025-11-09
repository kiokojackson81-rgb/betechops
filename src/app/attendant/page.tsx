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
import { getCategoryDefinition } from "@/lib/attendants/categories";
import type { AttendantCategory } from "@prisma/client";

type ProfileResponse = {
  user: {
    id: string;
    name: string | null;
    email: string;
    role: string;
    attendantCategory: AttendantCategory;
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
  const [shopId, setShopId] = useState<string | undefined>(undefined);
  const [profile, setProfile] = useState<ProfileResponse["user"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [shops, setShops] = useState<ShopSummary[]>([]);
  const [loadingShops, setLoadingShops] = useState(true);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("shopId") || undefined : undefined;
    setShopId(saved || undefined);
    void fetchProfile();
    void fetchShops();
  }, []);

  async function fetchProfile() {
    try {
      const res = await fetch("/api/attendants/me", { cache: "no-store" });
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
      const res = await fetch("/api/attendants/shops", { cache: "no-store" });
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

  const def = getCategoryDefinition(profile?.attendantCategory);

  const widgets = useMemo(() => {
    const nodes = def.defaultWidgets
      .map((id) => ({ id, node: renderWidget(id, shopId) }))
      .filter((item) => Boolean(item.node));
    const primary = nodes.filter((n) => PRIMARY_WIDGETS.has(n.id));
    const secondary = nodes.filter((n) => !PRIMARY_WIDGETS.has(n.id));
    return { primary, secondary };
  }, [def.defaultWidgets, shopId]);

  return (
    <div className="mx-auto max-w-7xl p-6 text-slate-100">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Attendant Dashboard</h1>
          <div className="mt-1 inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-widest text-slate-300">
            Category <span className="font-semibold text-white">{def.label}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-400">Shop:</span>
          <select
            className="rounded-lg border border-white/10 bg-transparent px-2 py-1 outline-none"
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
  );
}
