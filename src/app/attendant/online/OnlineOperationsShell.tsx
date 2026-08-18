"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  Activity,
  BarChart3,
  CircleDollarSign,
  FileDown,
  HeartPulse,
  HandCoins,
  LayoutDashboard,
  LogOut,
  MinusCircle,
  Receipt,
  Settings2,
  ShoppingBag,
  Store,
  WalletCards,
} from "lucide-react";

type ShellProps = {
  children: ReactNode;
  userName: string;
  userEmail: string;
  roleLabel: string;
  dashboardTitle: string;
  dashboardDescription: string;
  workspaceLabel: string;
  dashboardHref: string;
  receiptsHref: string;
  createReceiptHref: string;
  reportHref: string;
  payslipHref: string;
  wellnessHref: string;
  earningsHref: string;
  activePath: string;
  receiptView: string;
  isSupervisor: boolean;
  pricingOpen: boolean;
  onOpenPerformance: () => void;
  onOpenLipaPolePole: () => void;
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
  workspaceLabel,
  dashboardHref,
  receiptsHref,
  createReceiptHref,
  reportHref,
  payslipHref,
  wellnessHref,
  earningsHref,
  activePath,
  receiptView,
  isSupervisor,
  pricingOpen,
  onOpenPerformance,
  onOpenLipaPolePole,
  onOpenProfitCapture,
  onOpenManualWeekly,
  onTogglePricing,
  onLogout,
}: ShellProps) {
  const activeClass = (href: string, exact = false) => {
    const path = href.split("?")[0];
    const active = exact ? activePath === path : activePath === path || activePath.startsWith(`${path}/`);
    return active ? "border-cyan-400/40 bg-cyan-400/10 text-white" : "";
  };
  const mobileLinks = [
    { href: dashboardHref, label: "Dashboard", icon: LayoutDashboard },
    { href: receiptsHref, label: "Receipts", icon: Receipt },
    { href: createReceiptHref, label: "Create receipt", icon: ShoppingBag },
    { href: wellnessHref, label: "Wellness", icon: HeartPulse },
  ];
  const earningsSectionHref = (section: string) => `${earningsHref}#${section}`;

  return (
    <div className="min-h-screen bg-[#07111f] text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-[1700px]">
        <aside className="sticky top-0 hidden h-screen w-[280px] shrink-0 overflow-y-auto border-r border-white/10 bg-[#06101d] px-5 py-6 lg:block">
          <div className="mb-8 rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-400/15 via-emerald-400/10 to-transparent p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/15 text-cyan-200">
                <Store className="h-6 w-6" />
              </div>
              <div>
                <div className="text-xl font-semibold tracking-tight text-white">Betech</div>
                <div className="text-xs uppercase tracking-[0.22em] text-cyan-100/75">{workspaceLabel}</div>
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
                <Link href={dashboardHref} className={`${navItemClass} ${activeClass(dashboardHref, true)}`}>
                  <LayoutDashboard className="h-4 w-4 text-cyan-200" />
                  Dashboard
                </Link>
                <Link href={receiptsHref} className={`${navItemClass} ${activePath.includes("/receipts") && receiptView !== "create" ? "border-cyan-400/40 bg-cyan-400/10 text-white" : ""}`}>
                  <Receipt className="h-4 w-4" />
                  Receipt history
                </Link>
                <Link href={createReceiptHref} className={`${navItemClass} ${activePath.includes("/receipts") && receiptView === "create" ? "border-cyan-400/40 bg-cyan-400/10 text-white" : ""}`}>
                  <ShoppingBag className="h-4 w-4" />
                  Create receipt
                </Link>
              </div>
            </div>

            <div>
              <div className="mb-2 px-3 text-[11px] uppercase tracking-[0.24em] text-slate-500">Reports & employee</div>
              <div className="space-y-1">
                <a href={reportHref} download className={navItemClass}>
                  <FileDown className="h-4 w-4" />
                  Performance report
                </a>
                <Link href={wellnessHref} className={`${navItemClass} ${activeClass(wellnessHref)}`}>
                  <HeartPulse className="h-4 w-4" />
                  Wellness
                </Link>
              </div>
            </div>

            <div>
              <div className="mb-2 px-3 text-[11px] uppercase tracking-[0.24em] text-slate-500">Earnings & payroll</div>
              <div className="space-y-1">
                <Link href={earningsSectionHref("earnings")} className={`${navItemClass} ${activeClass(earningsHref)}`}>
                  <WalletCards className="h-4 w-4 text-emerald-200" />
                  Earnings overview
                </Link>
                <Link href={earningsSectionHref("commissions")} className={`${navItemClass} ${activeClass(earningsHref)}`}>
                  <CircleDollarSign className="h-4 w-4 text-amber-200" />
                  Commissions
                </Link>
                <Link href={earningsSectionHref("deductions")} className={`${navItemClass} ${activeClass(earningsHref)}`}>
                  <MinusCircle className="h-4 w-4 text-rose-200" />
                  Deductions
                </Link>
                <a href={payslipHref} download className={navItemClass}>
                  <FileDown className="h-4 w-4 text-cyan-200" />
                  Download payslip
                </a>
              </div>
            </div>

            {isSupervisor ? (
              <div>
                <div className="mb-2 px-3 text-[11px] uppercase tracking-[0.24em] text-slate-500">Supervisor tools</div>
                <div className="space-y-1">
                  <button type="button" onClick={onOpenLipaPolePole} className={`${navItemClass} ${activeClass("/attendant/online/lipa-pole-pole")} w-full text-left`}>
                    <HandCoins className="h-4 w-4" />
                    Lipa Pole Pole
                  </button>
                  <button type="button" onClick={onOpenPerformance} className={`${navItemClass} ${activePath.endsWith("/performance") || activePath.includes("/performance/week") ? "border-cyan-400/40 bg-cyan-400/10 text-white" : ""} w-full text-left`}>
                    <BarChart3 className="h-4 w-4" />
                    Performance
                  </button>
                  <button type="button" onClick={onOpenProfitCapture} className={`${navItemClass} ${activeClass("/attendant/online/performance/capture", true)} w-full text-left`}>
                    <CircleDollarSign className="h-4 w-4" />
                    Capture profit
                  </button>
                  <button type="button" onClick={onOpenManualWeekly} className={`${navItemClass} ${activeClass("/attendant/online/manual-weekly")} w-full text-left`}>
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
          <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-white/10 bg-[#101a2a]/95 px-3 py-3 backdrop-blur sm:px-4 sm:py-4 lg:px-8">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-white">
                <Activity className="h-4 w-4 shrink-0 text-cyan-200" />
                <span className="truncate text-base font-semibold sm:text-lg">{dashboardTitle}</span>
              </div>
              <div className="hidden text-sm text-slate-400 sm:block">{dashboardDescription}</div>
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <div className="hidden min-w-0 text-right min-[430px]:block">
                <div className="truncate text-sm font-medium text-white">{userName}</div>
                <div className="hidden text-xs uppercase tracking-[0.18em] text-slate-400 sm:block">{roleLabel}</div>
              </div>
              <button type="button" onClick={onLogout} aria-label="Log out" className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-white/10 px-3 text-sm transition hover:bg-white/5 sm:px-4">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Log out</span>
              </button>
            </div>
          </header>

          <div className="sticky top-[65px] z-20 border-b border-white/10 bg-[#091223]/95 px-2 py-2 backdrop-blur lg:hidden sm:top-[73px] sm:px-4 sm:py-3">
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
              {mobileLinks.map((item) => {
                const Icon = item.icon;
                const isReceiptLink = item.label === "Receipts";
                const isCreateLink = item.label === "Create receipt";
                const isActive = isReceiptLink
                  ? activePath.includes("/receipts") && receiptView !== "create"
                  : isCreateLink
                    ? activePath.includes("/receipts") && receiptView === "create"
                    : Boolean(activeClass(item.href));
                return (
                  <Link key={`${item.href}-${item.label}`} href={item.href} className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-center text-[10px] leading-tight transition hover:bg-white/5 sm:flex-row sm:gap-2 sm:rounded-full sm:px-3 sm:text-sm ${isActive ? "border-cyan-400/40 bg-cyan-400/10 text-white" : "border-white/10 text-slate-200"}`}>
                    <Icon className="h-4 w-4" />
                    <span className="line-clamp-1">{item.label === "Create receipt" ? "Create" : item.label}</span>
                  </Link>
                );
              })}
            </div>
            <details className="mt-2 rounded-2xl border border-white/10 bg-white/[0.03]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-medium text-slate-100 [&::-webkit-details-marker]:hidden">
                <span className="inline-flex items-center gap-2">
                  <WalletCards className="h-4 w-4 text-emerald-200" />
                  Earnings & payroll
                </span>
                <span className="text-xs text-slate-500">Open</span>
              </summary>
              <div className="grid grid-cols-2 gap-2 border-t border-white/10 p-2 sm:grid-cols-4">
                <Link href={earningsSectionHref("earnings")} className="rounded-xl border border-white/10 px-3 py-2 text-center text-xs text-slate-200">Overview</Link>
                <Link href={earningsSectionHref("commissions")} className="rounded-xl border border-white/10 px-3 py-2 text-center text-xs text-slate-200">Commissions</Link>
                <Link href={earningsSectionHref("deductions")} className="rounded-xl border border-white/10 px-3 py-2 text-center text-xs text-slate-200">Deductions</Link>
                <a href={payslipHref} download className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-3 py-2 text-center text-xs text-cyan-100">Payslip PDF</a>
              </div>
            </details>
            {isSupervisor ? (
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                <>
                  <button type="button" onClick={onOpenLipaPolePole} className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm ${activeClass("/attendant/online/lipa-pole-pole") ? "border-cyan-400/40 bg-cyan-400/10 text-white" : "border-white/10 text-slate-200"}`}>
                    <HandCoins className="h-4 w-4" /> Lipa Pole Pole
                  </button>
                  <button type="button" onClick={onOpenPerformance} className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200">
                    <BarChart3 className="h-4 w-4" /> Performance
                  </button>
                  <button type="button" onClick={onOpenProfitCapture} className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200">
                    <CircleDollarSign className="h-4 w-4" /> Capture profit
                  </button>
                  <button type="button" onClick={onOpenManualWeekly} className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200">
                    <Activity className="h-4 w-4" /> Manual weekly
                  </button>
                  <button type="button" onClick={onTogglePricing} className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200">
                    <Settings2 className="h-4 w-4" /> POS pricing
                  </button>
                </>
              </div>
            ) : null}
          </div>

          <main className="min-w-0 px-2 py-4 sm:px-4 sm:py-6 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
