"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useState, type ReactNode } from "react";
import {
  Activity,
  BatteryCharging,
  FileDown,
  HeartPulse,
  Headphones,
  LayoutDashboard,
  LogOut,
  PhoneCall,
  Receipt,
  WalletCards,
} from "lucide-react";

type Identity = {
  name: string;
  email: string;
  role: string;
};

const initialIdentity: Identity = {
  name: "Support staff",
  email: "Account loading...",
  role: "Support Operations",
};

export default function SupportWorkspaceShell({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const impersonateId = searchParams.get("impersonateId")?.trim() || "";
  const [identity, setIdentity] = useState<Identity>(initialIdentity);

  useEffect(() => {
    const params = new URLSearchParams();
    if (impersonateId) {
      params.set("impersonateId", impersonateId);
      params.set("scope", "mine");
    }
    const query = params.toString();
    const controller = new AbortController();

    void fetch(`/api/attendants/me${query ? `?${query}` : ""}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return null;
        const body = await response.json().catch(() => null);
        return body?.data ?? body;
      })
      .then((payload) => {
        if (!payload?.user) return;
        setIdentity({
          name: String(payload.user.name ?? payload.user.email ?? "Support staff"),
          email: String(payload.user.email ?? ""),
          role: String(payload.user.attendantCategory ?? payload.user.role ?? "SUPPORT_OPS").replace(/_/g, " "),
        });
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, [impersonateId]);

  const withImpersonation = (href: string) => {
    if (!impersonateId) return href;
    const [pathAndQuery, hash = ""] = href.split("#", 2);
    const [path, query = ""] = pathAndQuery.split("?", 2);
    const params = new URLSearchParams(query);
    params.set("impersonateId", impersonateId);
    const next = `${path}?${params.toString()}`;
    return hash ? `${next}#${hash}` : next;
  };

  const links = {
    dashboard: withImpersonation("/attendant/support"),
    performance: withImpersonation("/attendant/support#performance"),
    dailyReport: withImpersonation("/attendant/support#daily-report"),
    earnings: withImpersonation("/attendant/support#earnings"),
    receipts: withImpersonation("/receipts"),
    followUps: withImpersonation("/attendant/voice?tab=followups"),
    wellness: withImpersonation("/attendant/wellness"),
    report: withImpersonation("/api/attendant/daily-report/performance-receipt/pdf"),
    payslip: withImpersonation("/api/attendant/payslip"),
  };

  const navClass =
    "flex items-center gap-3 rounded-2xl border border-transparent px-3 py-3 text-sm text-slate-300 transition hover:border-white/10 hover:bg-white/5 hover:text-white";
  const mobileLinks = [
    { href: links.dashboard, label: "Dashboard", icon: LayoutDashboard },
    { href: links.dailyReport, label: "Daily report", icon: BatteryCharging },
    { href: links.receipts, label: "Receipts", icon: Receipt },
    { href: links.earnings, label: "Earnings", icon: WalletCards },
  ];

  return (
    <div className="min-h-screen bg-[#07111f] text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-[1700px]">
        <aside className="sticky top-0 hidden h-screen w-[280px] shrink-0 overflow-y-auto border-r border-white/10 bg-[#06101d] px-5 py-6 lg:block">
          <div className="mb-8 rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-400/15 via-emerald-400/10 to-transparent p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/15 text-cyan-200">
                <Headphones className="h-6 w-6" />
              </div>
              <div>
                <div className="text-xl font-semibold tracking-tight text-white">Betech</div>
                <div className="text-xs uppercase tracking-[0.22em] text-cyan-100/75">Support Operations</div>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="truncate text-sm font-semibold text-white">{identity.name}</div>
              <div className="truncate text-sm text-slate-300">{identity.email}</div>
              <div className="mt-2 text-xs uppercase tracking-[0.18em] text-cyan-100/75">{identity.role}</div>
            </div>
          </div>

          <nav className="space-y-6">
            <div>
              <div className="mb-2 px-3 text-[11px] uppercase tracking-[0.24em] text-slate-500">Support desk</div>
              <div className="space-y-1">
                <Link href={links.dashboard} className={`${navClass} border-cyan-400/30 bg-cyan-400/10 text-white`}><LayoutDashboard className="h-4 w-4 text-cyan-200" />Dashboard</Link>
                <Link href={links.performance} className={navClass}><Activity className="h-4 w-4" />Performance snapshot</Link>
                <Link href={links.dailyReport} className={navClass}><BatteryCharging className="h-4 w-4 text-emerald-200" />Battery report</Link>
                <Link href={links.receipts} className={navClass}><Receipt className="h-4 w-4" />Receipts</Link>
                <Link href={links.followUps} className={navClass}><PhoneCall className="h-4 w-4" />Calls & follow-ups</Link>
              </div>
            </div>

            <div>
              <div className="mb-2 px-3 text-[11px] uppercase tracking-[0.24em] text-slate-500">Employee tools</div>
              <div className="space-y-1">
                <Link href={links.earnings} className={navClass}><WalletCards className="h-4 w-4 text-emerald-200" />Earnings & payroll</Link>
                <Link href={links.wellness} className={navClass}><HeartPulse className="h-4 w-4" />Wellness</Link>
                <a href={links.report} download className={navClass}><FileDown className="h-4 w-4 text-cyan-200" />Performance report</a>
                <a href={links.payslip} download className={navClass}><FileDown className="h-4 w-4 text-amber-200" />Download payslip</a>
              </div>
            </div>

            <button type="button" onClick={() => void signOut({ callbackUrl: "/attendant/login" })} className="flex w-full items-center gap-3 rounded-2xl border border-rose-500/20 px-3 py-3 text-sm text-rose-100 transition hover:bg-rose-500/10">
              <LogOut className="h-4 w-4" />Log out
            </button>
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-white/10 bg-[#101a2a]/95 px-3 py-3 backdrop-blur sm:px-4 sm:py-4 lg:px-8">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-white">
                <Activity className="h-4 w-4 shrink-0 text-cyan-200" />
                <span className="truncate text-base font-semibold sm:text-lg">Support Operations Dashboard</span>
              </div>
              <div className="hidden text-sm text-slate-400 sm:block">Customer support performance, battery reports, receipts, and earnings.</div>
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <div className="hidden min-w-0 text-right min-[430px]:block">
                <div className="truncate text-sm font-medium text-white">{identity.name}</div>
                <div className="hidden text-xs uppercase tracking-[0.18em] text-slate-400 sm:block">{identity.role}</div>
              </div>
              <button type="button" onClick={() => void signOut({ callbackUrl: "/attendant/login" })} aria-label="Log out" className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-white/10 px-3 text-sm transition hover:bg-white/5 sm:px-4">
                <LogOut className="h-4 w-4" /><span className="hidden sm:inline">Log out</span>
              </button>
            </div>
          </header>

          <div className="sticky top-[65px] z-20 border-b border-white/10 bg-[#091223]/95 px-2 py-2 backdrop-blur lg:hidden sm:top-[73px] sm:px-4 sm:py-3">
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
              {mobileLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.label} href={item.href} className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl border border-white/10 px-1 py-2 text-center text-[10px] leading-tight text-slate-200 sm:flex-row sm:text-sm">
                    <Icon className="h-4 w-4" /><span className="line-clamp-1">{item.label}</span>
                  </Link>
                );
              })}
            </div>
            <details className="mt-2 rounded-2xl border border-white/10 bg-white/[0.03]">
              <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm text-slate-100 [&::-webkit-details-marker]:hidden">
                <span>More support tools</span><span className="text-xs text-slate-500">Open</span>
              </summary>
              <div className="grid grid-cols-2 gap-2 border-t border-white/10 p-2 sm:grid-cols-4">
                <Link href={links.followUps} className="rounded-xl border border-white/10 px-3 py-2 text-center text-xs">Follow-ups</Link>
                <Link href={links.wellness} className="rounded-xl border border-white/10 px-3 py-2 text-center text-xs">Wellness</Link>
                <a href={links.report} download className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-3 py-2 text-center text-xs text-cyan-100">Report PDF</a>
                <a href={links.payslip} download className="rounded-xl border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-center text-xs text-amber-100">Payslip PDF</a>
              </div>
            </details>
          </div>

          <main className="min-w-0 px-2 py-4 sm:px-4 sm:py-6 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
