"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  Activity,
  BarChart3,
  CircleDollarSign,
  FileDown,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  Receipt,
  Settings2,
  ShoppingBag,
  Store,
} from "lucide-react";

type ShellProps = {
  children: ReactNode;
  userName: string;
  userEmail: string;
  roleLabel: string;
  dashboardTitle: string;
  dashboardDescription: string;
  dashboardHref: string;
  receiptsHref: string;
  reportHref: string;
  wellnessHref: string;
  isSupervisor: boolean;
  pricingOpen: boolean;
  onOpenPerformance: () => void;
  onOpenProfitCapture: () => void;
  onOpenManualWeekly: () => void;
  onTogglePricing: () => void;
  onLogout: () => void;
};

const navItemClass =
  "flex items-center gap-3 rounded-2xl border border-transparent px-3 py-3 text-sm text-slate-300 transition hover:border-white/10 hover:bg-white/5 hover:text-white";

export default function OnlineOperationsShell({
  children,
  userName,
  userEmail,
  roleLabel,
  dashboardTitle,
  dashboardDescription,
  dashboardHref,
  receiptsHref,
  reportHref,
  wellnessHref,
  isSupervisor,
  pricingOpen,
  onOpenPerformance,
  onOpenProfitCapture,
  onOpenManualWeekly,
  onTogglePricing,
  onLogout,
}: ShellProps) {
  const mobileLinks = [
    { href: dashboardHref, label: "Dashboard", icon: LayoutDashboard },
    { href: receiptsHref, label: "Receipts", icon: Receipt },
    { href: "/receipts", label: "Create receipt", icon: ShoppingBag },
    { href: wellnessHref, label: "Wellness", icon: HeartPulse },
  ];

  return (
    <div className="min-h-screen bg-[#07111f] text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-[1700px]">
        <aside className="hidden w-[280px] shrink-0 border-r border-white/10 bg-[#06101d] px-5 py-6 lg:block">
          <div className="mb-8 rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-400/15 via-emerald-400/10 to-transparent p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/15 text-cyan-200">
                <Store className="h-6 w-6" />
              </div>
              <div>
                <div className="text-xl font-semibold tracking-tight text-white">Betech</div>
                <div className="text-xs uppercase tracking-[0.22em] text-cyan-100/75">Online Operations</div>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="truncate text-sm font-semibold text-white">{userName}</div>
              <div className="truncate text-sm text-slate-300">{userEmail}</div>
              <div className="mt-2 text-xs uppercase tracking-[0.18em] text-cyan-100/75">{roleLabel}</div>
            </div>
          </div>

          <nav className="space-y-6">
            <div>
              <div className="mb-2 px-3 text-[11px] uppercase tracking-[0.24em] text-slate-500">Operations</div>
              <div className="space-y-1">
                <Link href={dashboardHref} className={`${navItemClass} border-cyan-400/40 bg-cyan-400/10 text-white`}>
                  <LayoutDashboard className="h-4 w-4 text-cyan-200" />
                  Dashboard
                </Link>
                <Link href={receiptsHref} className={navItemClass}>
                  <Receipt className="h-4 w-4" />
                  Receipt history
                </Link>
                <Link href="/receipts" className={navItemClass}>
                  <ShoppingBag className="h-4 w-4" />
                  Create receipt
                </Link>
              </div>
            </div>

            <div>
              <div className="mb-2 px-3 text-[11px] uppercase tracking-[0.24em] text-slate-500">Reports & employee</div>
              <div className="space-y-1">
                <a href={reportHref} target="_blank" rel="noreferrer" className={navItemClass}>
                  <FileDown className="h-4 w-4" />
                  Performance report
                </a>
                <Link href={wellnessHref} className={navItemClass}>
                  <HeartPulse className="h-4 w-4" />
                  Wellness
                </Link>
              </div>
            </div>

            {isSupervisor ? (
              <div>
                <div className="mb-2 px-3 text-[11px] uppercase tracking-[0.24em] text-slate-500">Supervisor tools</div>
                <div className="space-y-1">
                  <button type="button" onClick={onOpenPerformance} className={`${navItemClass} w-full text-left`}>
                    <BarChart3 className="h-4 w-4" />
                    Performance
                  </button>
                  <button type="button" onClick={onOpenProfitCapture} className={`${navItemClass} w-full text-left`}>
                    <CircleDollarSign className="h-4 w-4" />
                    Capture profit
                  </button>
                  <button type="button" onClick={onOpenManualWeekly} className={`${navItemClass} w-full text-left`}>
                    <Activity className="h-4 w-4" />
                    Manual weekly
                  </button>
                  <button
                    type="button"
                    onClick={onTogglePricing}
                    className={`${navItemClass} w-full text-left ${pricingOpen ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-100" : ""}`}
                  >
                    <Settings2 className="h-4 w-4" />
                    POS pricing
                  </button>
                </div>
              </div>
            ) : null}

            <button
              type="button"
              onClick={onLogout}
              className="flex w-full items-center gap-3 rounded-2xl border border-rose-500/20 px-3 py-3 text-sm text-rose-100 transition hover:border-rose-400/40 hover:bg-rose-500/10"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="flex flex-col gap-3 border-b border-white/10 bg-white/5 px-4 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between lg:px-8">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-white">
                <Activity className="h-4 w-4 text-cyan-200" />
                <span className="text-lg font-semibold">{dashboardTitle}</span>
              </div>
              <div className="text-sm text-slate-400">{dashboardDescription}</div>
            </div>
            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <div className="min-w-0 sm:text-right">
                <div className="truncate text-sm font-medium text-white">{userName}</div>
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{roleLabel}</div>
              </div>
              <button type="button" onClick={onLogout} className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm transition hover:bg-white/5">
                <LogOut className="h-4 w-4" />
                Log out
              </button>
            </div>
          </header>

          <div className="border-b border-white/10 bg-[#091223] px-4 py-3 lg:hidden">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {mobileLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={`${item.href}-${item.label}`} href={item.href} className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/5">
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
              <button type="button" onClick={onLogout} className="inline-flex shrink-0 items-center gap-2 rounded-full border border-rose-500/20 px-4 py-2 text-sm text-rose-100">
                <LogOut className="h-4 w-4" />
                Log out
              </button>
            </div>
          </div>

          <main className="px-4 py-6 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
