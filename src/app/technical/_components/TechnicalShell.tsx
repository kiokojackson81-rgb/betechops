"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  Activity,
  BriefcaseBusiness,
  CalendarDays,
  ClipboardList,
  FileText,
  HeartPulse,
  LayoutDashboard,
  Receipt,
  ShieldCheck,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";

type Viewer = {
  name: string;
  email: string;
  roleLabel: string;
};

const sections = [
  {
    label: "Operations",
    items: [
      { href: "/technical/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/technical/site-visits", label: "Site Visits", icon: CalendarDays },
      { href: "/technical/projects", label: "Projects", icon: BriefcaseBusiness },
      { href: "/receipts", label: "Receipts", icon: Receipt, newTab: true },
      { href: "/technical/quotations", label: "Quotations", icon: FileText },
    ],
  },
  {
    label: "Employee",
    items: [
      { href: "/technical/daily-report", label: "Daily Reports", icon: ClipboardList },
      { href: "/technical/earnings", label: "Earnings & Payslip", icon: Wallet },
      { href: "/technical/wellness", label: "Wellness", icon: HeartPulse },
      { href: "/technical/compliance", label: "Compliance", icon: ShieldCheck },
      { href: "/receipts", label: "Customers", icon: Users },
    ],
  },
] as const;

function navClass(active: boolean) {
  return active
    ? "border-emerald-500/50 bg-emerald-500/15 text-white"
    : "border-transparent text-slate-300 hover:border-white/10 hover:bg-white/5 hover:text-white";
}

export default function TechnicalShell({
  viewer,
  children,
}: {
  viewer: Viewer;
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#07111f] text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-[1700px]">
        <aside className="hidden w-[280px] shrink-0 border-r border-white/10 bg-[#06101d] px-5 py-6 lg:block">
          <div className="mb-8 rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/15 via-cyan-500/10 to-transparent p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300">
                <Wrench className="h-6 w-6" />
              </div>
              <div>
                <div className="text-xl font-semibold tracking-tight text-white">Betech</div>
                <div className="text-xs uppercase tracking-[0.24em] text-emerald-200/80">Technical Team</div>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="text-sm font-semibold text-white">{viewer.name}</div>
              <div className="text-sm text-slate-300">{viewer.email}</div>
              <div className="mt-2 text-xs uppercase tracking-[0.2em] text-emerald-200/80">{viewer.roleLabel}</div>
            </div>
          </div>

          <nav className="space-y-6">
            {sections.map((section) => (
              <div key={section.label}>
                <div className="mb-2 px-3 text-[11px] uppercase tracking-[0.24em] text-slate-500">{section.label}</div>
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const active = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        target={item.newTab ? "_blank" : undefined}
                        rel={item.newTab ? "noreferrer" : undefined}
                        className={`flex items-center gap-3 rounded-2xl border px-3 py-3 text-sm transition ${navClass(active)}`}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-4 py-4 backdrop-blur lg:px-8">
            <div>
              <div className="flex items-center gap-2 text-white">
                <Activity className="h-4 w-4 text-emerald-300" />
                <span className="text-lg font-semibold">Technical Team Dashboard</span>
              </div>
              <div className="text-sm text-slate-400">Unified operations, receipts, payroll, and field activity.</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium text-white">{viewer.name}</div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{viewer.roleLabel}</div>
            </div>
          </div>
          <main className="px-4 py-6 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
