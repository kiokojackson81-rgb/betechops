"use client";

import Link from "next/link";
import { BellRing, CalendarCheck2, MapPin, Package, ShieldCheck, UserRound, WalletCards } from "lucide-react";
import ShopAccountLogoutButton from "@/app/shop/_components/ShopAccountLogoutButton";

type SidebarSection = "overview" | "address" | "orders" | "lipaPolePole" | "quotes" | "siteVisits";

export default function CustomerAccountSidebar({
  profileCompletion,
  activeSection,
}: {
  profileCompletion: number;
  activeSection: SidebarSection;
}) {
  const items = [
    { key: "overview" as const, icon: UserRound, label: "Account overview", href: "/account#account-overview" },
    { key: "address" as const, icon: MapPin, label: "Address details", href: "/account#address-details" },
    { key: "orders" as const, icon: Package, label: "Recent orders", href: "/account/orders" },
    { key: "lipaPolePole" as const, icon: WalletCards, label: "Lipa Pole Pole", href: "/account#lipa-pole-pole" },
    { key: "quotes" as const, icon: BellRing, label: "Quote follow-up", href: "/account#quote-follow-up" },
    { key: "siteVisits" as const, icon: CalendarCheck2, label: "Site visits", href: "/account#site-visits" },
  ];

  return (
    <aside className="rounded-[22px] border border-[#7a0000]/10 bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)] sm:p-5">
      <div className="rounded-[18px] border border-[#f2b20f]/20 bg-[linear-gradient(180deg,#fff8ea_0%,#ffffff_100%)] p-4">
        <div className="flex items-center gap-2 text-sm font-black text-slate-950">
          <ShieldCheck className="h-4 w-4 text-[#0f9d58]" />
          Profile completion
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#f4ead0]">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,#f2b20f_0%,#0f9d58_100%)]"
            style={{ width: `${profileCompletion}%` }}
          />
        </div>
        <div className="mt-2 text-sm text-slate-600">{profileCompletion}% complete</div>
      </div>

      <div className="mt-5 space-y-2">
        {items.map(({ key, icon: Icon, label, href }) => {
          const active = activeSection === key;
          return (
            <Link
              key={label}
              href={href}
              className={`flex items-center gap-3 rounded-[16px] border px-3 py-3 text-sm font-semibold transition ${
                active
                  ? "border-[#7a0000]/20 bg-white text-[#7a0000] shadow-[0_12px_24px_rgba(122,0,0,0.08)]"
                  : "border-[#7a0000]/10 bg-[#fcfaf7] text-slate-700 hover:border-[#7a0000]/25 hover:bg-white hover:text-[#7a0000]"
              }`}
            >
              <Icon className="h-4 w-4 text-[#7a0000]" />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>

      <div className="mt-5 rounded-[18px] border border-[#7a0000]/10 bg-[#fcfaf7] p-4 text-sm text-slate-600">
        Checkout will reuse the saved name, phone, email, and town details shown here.
      </div>

      <div className="mt-5">
        <ShopAccountLogoutButton />
      </div>
    </aside>
  );
}
