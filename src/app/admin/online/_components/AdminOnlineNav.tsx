"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/admin/online/summary", label: "Summary" },
  { href: "/admin/online/accounts", label: "Accounts" },
  { href: "/admin/online/returns", label: "Returns" },
];

export default function AdminOnlineNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2 text-sm font-semibold text-slate-300">
      {tabs.map((tab) => {
        const active = pathname?.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-full border px-4 py-1.5 transition ${
              active
                ? "border-emerald-400 bg-emerald-500/10 text-emerald-200"
                : "border-white/10 text-slate-300 hover:border-emerald-400/60 hover:text-emerald-200"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

