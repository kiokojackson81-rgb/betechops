"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import type { ReactNode } from "react";
import {
  ClipboardList,
  CreditCard,
  Home,
  LogOut,
  PhoneCall,
  PlusCircle,
  Settings2,
  UserRound,
  Wallet,
} from "lucide-react";
import { agentPath } from "@/lib/agents/host";

type AgentPortalShellProps = {
  title: string;
  description: string;
  useRootPaths?: boolean;
  children: ReactNode;
  agent: {
    displayName: string;
    email: string | null;
    status: string;
    referralCode: string;
    payoutPhone: string | null;
  };
  stats: {
    potentialCommission: number;
    earnedCommission: number;
    paidCommission: number;
  };
};

const money = (value: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(value || 0);

function initialsFor(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((item) => item[0]?.toUpperCase() || "")
    .join("") || "AG";
}

function isActive(pathname: string, href: string) {
  if (pathname === href) return true;
  if (href === "/dashboard" || href === "/agents/dashboard") return pathname === href;
  return pathname.startsWith(`${href}/`);
}

export default function AgentPortalShell({
  title,
  description,
  useRootPaths = false,
  children,
  agent,
  stats,
}: AgentPortalShellProps) {
  const pathname = usePathname() || "";
  const loginPath = agentPath("/login", useRootPaths);
  const navItems = [
    { href: agentPath("/dashboard", useRootPaths), label: "Dashboard", icon: Home },
    { href: agentPath("/sales", useRootPaths), label: "My Sales", icon: ClipboardList },
    { href: agentPath("/sales/new", useRootPaths), label: "Submit Order", icon: PlusCircle },
    { href: agentPath("/withdrawals", useRootPaths), label: "Withdrawals", icon: Wallet },
    { href: agentPath("/profile", useRootPaths), label: "Profile", icon: UserRound },
    { href: agentPath("/profile/payment-method", useRootPaths), label: "Payout Setup", icon: CreditCard },
  ];

  const mobileItems = [navItems[0], navItems[1], navItems[2], navItems[3]];

  return (
    <div className="min-h-screen bg-[#f7f1eb] text-slate-900">
      <div className="mx-auto grid min-h-screen max-w-[1500px] lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="hidden border-r border-[#d9c6ba] bg-[linear-gradient(180deg,#2f0b0b_0%,#5c0909_52%,#2f0b0b_100%)] px-6 py-8 text-white lg:flex lg:flex-col">
          <div className="flex items-center gap-3">
            <div className="overflow-hidden rounded-2xl bg-white px-2 py-1 shadow-[0_16px_28px_rgba(0,0,0,0.18)]">
              <Image src="/agents/betech-logo-crop.png" alt="Betech Solar Solutions" width={112} height={84} className="h-10 w-auto object-contain" />
            </div>
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.28em] text-[#f3d674]">Betech Agents</div>
              <div className="text-sm text-white/70">Solar sales network</div>
            </div>
          </div>

          <div className="mt-8 rounded-[28px] border border-white/10 bg-white/10 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-sm font-semibold text-white">
                {initialsFor(agent.displayName)}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{agent.displayName}</div>
                <div className="truncate text-xs text-white/70">{agent.email || "Agent account"}</div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between rounded-2xl bg-black/15 px-3 py-2">
              <span className="text-xs uppercase tracking-[0.2em] text-white/60">Status</span>
              <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-200">
                {String(agent.status || "").toLowerCase() === "approved" ? "Approved Agent" : agent.status}
              </span>
            </div>
            <div className="mt-3 text-xs text-white/65">Referral code: {agent.referralCode}</div>
          </div>

          <nav className="mt-8 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                    active
                      ? "bg-[#f1b81d] text-[#4d0808] shadow-[0_10px_25px_rgba(0,0,0,.18)]"
                      : "text-white/78 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-8 space-y-4">
            <div className="rounded-[28px] border border-[#f1b81d]/30 bg-[#f1b81d]/12 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[#f8dd8a]">Earnings snapshot</div>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-white/72">Potential</span>
                  <span className="font-semibold text-white">{money(stats.potentialCommission)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-white/72">Ready</span>
                  <span className="font-semibold text-white">{money(stats.earnedCommission)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-white/72">Withdrawn</span>
                  <span className="font-semibold text-white">{money(stats.paidCommission)}</span>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/10 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Settings2 className="h-4 w-4 text-[#f3d674]" />
                Withdrawal Method
              </div>
              <p className="mt-3 text-sm text-white/72">
                Your commissions will be sent to this M-Pesa number.
              </p>
              <div className="mt-3 text-sm font-medium text-white">
                {agent.payoutPhone ? `M-Pesa: ${agent.payoutPhone}` : "No payout phone saved yet"}
              </div>
              <Link
                href={agentPath("/profile/payment-method", useRootPaths)}
                className="mt-4 inline-flex rounded-2xl border border-white/15 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
              >
                Setup withdrawals
              </Link>
            </div>
          </div>

          <div className="mt-auto space-y-3 pt-8">
            <a
              href="https://wa.me/254722151083"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-2xl border border-white/10 px-4 py-3 text-sm text-white/78 transition hover:bg-white/10 hover:text-white"
            >
              <PhoneCall className="h-4 w-4" />
              Contact support
            </a>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: loginPath })}
              className="flex w-full items-center gap-3 rounded-2xl border border-white/10 px-4 py-3 text-sm text-white/78 transition hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </aside>

        <main className="min-w-0">
          <header className="sticky top-0 z-30 border-b border-[#e4d4cb] bg-[#f7f1eb]/92 px-4 py-3 backdrop-blur md:px-6 lg:px-8">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7a0000]">Betech Agents Hub</div>
                <h1 className="mt-1 text-xl font-black tracking-tight text-[#210505] sm:text-2xl md:text-3xl">{title}</h1>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                <div className="hidden rounded-2xl border border-[#f1b81d]/30 bg-[#fff6df] px-4 py-3 text-right md:block">
                  <div className="text-[11px] font-black uppercase tracking-[0.12em] text-[#7a0000]">Available to withdraw</div>
                  <div className="mt-1 text-lg font-black text-[#210505]">{money(stats.earnedCommission)}</div>
                </div>
                <div className="hidden rounded-2xl border border-[#d9c6ba] bg-white px-4 py-3 text-right md:block">
                  <div className="text-sm font-semibold text-[#210505]">{agent.displayName}</div>
                  <div className="text-xs uppercase tracking-[0.1em] text-slate-500">
                    {String(agent.status || "").toLowerCase() === "approved" ? "Approved Agent" : agent.status}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: loginPath })}
                  className="rounded-2xl border border-[#d9c6ba] bg-white px-4 py-3 text-sm font-semibold text-[#210505] transition hover:border-[#7a0000]/30 hover:text-[#7a0000]"
                >
                  Logout
                </button>
              </div>
            </div>
            <div className="mt-4 grid gap-3 lg:hidden">
              <div className="rounded-[24px] border border-[#d9c6ba] bg-white px-4 py-4 shadow-[0_10px_28px_rgba(64,32,18,0.05)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-[#210505]">{agent.displayName}</div>
                    <div className="truncate text-xs text-slate-500">{agent.email || "Agent account"}</div>
                  </div>
                  <div className="rounded-full bg-[#edf9f0] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#136233]">
                    {String(agent.status || "").toLowerCase() === "approved" ? "Approved" : agent.status}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                  <div className="rounded-2xl bg-[#fff6df] px-3 py-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Withdrawable</div>
                    <div className="mt-1 font-semibold text-[#210505]">{money(stats.earnedCommission)}</div>
                  </div>
                  <div className="rounded-2xl bg-[#fffaf5] px-3 py-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Potential</div>
                    <div className="mt-1 font-semibold text-[#210505]">{money(stats.potentialCommission)}</div>
                  </div>
                  <div className="rounded-2xl bg-[#fffaf5] px-3 py-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Ready</div>
                    <div className="mt-1 font-semibold text-[#210505]">{money(stats.earnedCommission)}</div>
                  </div>
                  <div className="rounded-2xl bg-[#fffaf5] px-3 py-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Paid</div>
                    <div className="mt-1 font-semibold text-[#210505]">{money(stats.paidCommission)}</div>
                  </div>
                </div>
              </div>
            </div>
          </header>

          <div className="px-4 py-5 md:px-6 lg:px-8 lg:py-8">
            <div className="mx-auto max-w-7xl pb-24 md:pb-28 lg:pb-8">{children}</div>
          </div>
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#d9c6ba] bg-[#fffaf5]/95 px-2 py-2 backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-4 gap-2">
          {mobileItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-[3.75rem] flex-col items-center justify-center rounded-2xl px-2 py-2 text-[11px] font-semibold transition ${
                  active ? "bg-[#7a0000] text-white" : "text-slate-600"
                }`}
              >
                <Icon className="mb-1 h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
