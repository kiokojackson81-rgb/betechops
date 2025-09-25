"use client";

import { useEffect, useState } from "react";
import QueueList from "./_components/QueueList";
import QuickPriceCard from "./_components/QuickPriceCard";
import ReturnsCard from "./_components/ReturnsCard";
import ShopSnapshot from "./_components/ShopSnapshot";
import Shortcuts from "./_components/Shortcuts";
import Announcement from "./_components/Announcement";

export default function AttendantDashboard() {
  const [shopId, setShopId] = useState<string | undefined>(undefined);

  useEffect(() => {
    const saved = localStorage.getItem("shopId") || undefined;
    setShopId(saved || undefined);
  }, []);

  return (
    <div className="mx-auto max-w-7xl p-6 text-slate-100">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Attendant Dashboard</h1>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-400">Shop:</span>
          <select className="rounded-lg border border-white/10 bg-transparent px-2 py-1 outline-none" value={shopId || ""} onChange={(e) => { const val = e.target.value || undefined; setShopId(val); if (val) localStorage.setItem("shopId", val); }}>
            <option value="">All</option>
            <option value="1">Shop 1</option>
            <option value="2">Shop 2</option>
          </select>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
        <div className="space-y-6">
          <QueueList shopId={shopId} />
          <QuickPriceCard />
          <ReturnsCard />
        </div>

        <div className="space-y-6">
          <ShopSnapshot shopId={shopId} />
          <Shortcuts />
          <Announcement />
        </div>
      </div>
    </div>
  );
}