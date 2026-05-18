import Link from "next/link";
import { Banknote, ShieldAlert, Users, Wallet } from "lucide-react";

const SECTIONS = [
  {
    href: "/admin/agents",
    label: "Agents",
    helper: "Profiles and performance",
    icon: Users,
  },
  {
    href: "/admin/agents/pending-sales",
    label: "Sales",
    helper: "Queues and delivery stages",
    icon: Wallet,
  },
  {
    href: "/admin/agents/commissions",
    label: "Commissions",
    helper: "Locked to paid",
    icon: Wallet,
  },
  {
    href: "/admin/agents/payouts",
    label: "Payouts",
    helper: "Withdrawals and approvals",
    icon: Banknote,
  },
  {
    href: "/admin/agents/fraud",
    label: "Fraud & Risk",
    helper: "Duplicates and disputes",
    icon: ShieldAlert,
  },
] as const;

type SecondaryItem = {
  href: string;
  label: string;
  count?: number | string;
};

export default function AgentOpsSectionNav({
  activeHref,
  secondaryItems,
}: {
  activeHref: string;
  secondaryItems?: SecondaryItem[];
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {SECTIONS.map((section) => {
          const active = activeHref === section.href;
          const Icon = section.icon;
          return (
            <Link
              key={section.href}
              href={section.href}
              className={`rounded-[22px] border px-4 py-4 transition ${
                active
                  ? "border-cyan-400/30 bg-cyan-400/10 shadow-[0_18px_50px_rgba(34,211,238,0.10)]"
                  : "border-white/10 bg-white/[0.03] hover:border-white/20"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-2xl border ${
                    active
                      ? "border-cyan-300/30 bg-cyan-300/12 text-cyan-100"
                      : "border-white/10 bg-slate-950/50 text-slate-300"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className={`text-sm font-semibold ${active ? "text-cyan-100" : "text-white"}`}>{section.label}</div>
                  <div className="text-xs text-slate-400">{section.helper}</div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {secondaryItems?.length ? (
        <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-3">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
            {secondaryItems.map((item) => {
              const active = item.href === activeHref;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 text-sm transition ${
                    active
                      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
                      : "border-white/10 bg-slate-950/40 text-slate-300 hover:border-white/20 hover:text-white"
                  }`}
                >
                  <span className="truncate font-medium">{item.label}</span>
                  {item.count !== undefined ? (
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold">{item.count}</span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
