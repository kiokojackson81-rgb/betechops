"use client";

import { useSearchParams } from "next/navigation";
import { withImpersonateId } from "@/lib/impersonation";

const items = [
  { href: "/attendant/returns/new", label: "New Return" },
  { href: "/attendant/pending-pricing", label: "Pending Pricing" },
  { href: "/attendant/orders/new", label: "Create Order" },
  { href: "/attendant/stock-low", label: "Low Stock" },
  { href: "/attendant/online", label: "Online Ops" },
  // New shortcut for submitting daily reports
  { href: "/attendant/daily-report", label: "Daily Report" },
  { href: "/attendant/cash-advance", label: "Cash Advance" },
];

export default function Shortcuts() {
  const searchParams = useSearchParams();
  const impersonateId = searchParams.get("impersonateId");

  return (
    <section className="rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(18,22,32,.9),rgba(18,22,32,.7))] p-4 backdrop-blur">
      <h2 className="mb-3 text-lg font-semibold">Shortcuts</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((x) => (
          <a
            key={x.href}
            href={withImpersonateId(x.href, impersonateId)}
            className="rounded-xl border border-white/10 bg-[#0b0e13] px-3 py-2 text-sm hover:bg-white/10"
          >
            {x.label}
          </a>
        ))}
      </div>
    </section>
  );
}
