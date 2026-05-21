"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, ShoppingCart, User2, X } from "lucide-react";
import ShopSearchBar from "@/app/shop/_components/ShopSearchBar";
import { getShopCartCount, useShopCartItems } from "@/app/shop/cartStore";
import { shopStyles } from "@/app/shop/_components/shopStyles";

type ShopHeaderProps = {
  navLinks: { label: string; href: string }[];
};

export default function ShopHeader({ navLinks }: ShopHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  useShopCartItems();
  const cartCount = getShopCartCount();

  return (
    <header className={`sticky top-0 z-50 ${shopStyles.headerGlass}`}>
      <div className={`${shopStyles.shell} py-3 sm:py-4`}>
        <div className="flex items-center justify-between gap-3 lg:hidden">
          <button
            type="button"
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            onClick={() => setMenuOpen((current) => !current)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#7a0000]/10 bg-white text-[#7a0000] shadow-[0_12px_24px_rgba(15,23,42,0.05)]"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <Link href="/shop" className="flex min-w-0 items-center gap-3">
            <div className="overflow-hidden rounded-2xl border border-[#7a0000]/10 bg-white shadow-[0_16px_30px_rgba(122,0,0,0.12)]">
              <Image src="/agents/betech-logo-crop.png" alt="Betech Solar" width={44} height={44} className="h-11 w-11 object-contain" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-black uppercase tracking-[0.18em] text-[#7a0000]">Betech Solar</div>
              <div className="truncate text-xs text-slate-500">Online Store</div>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href="/shop/cart"
              aria-label="Open cart"
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#7a0000]/10 bg-white text-slate-700 shadow-[0_12px_24px_rgba(15,23,42,0.05)]"
            >
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 ? (
                <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#7a0000] px-1 text-[10px] font-black text-white">
                  {cartCount}
                </span>
              ) : null}
            </Link>
            <button
              type="button"
              aria-label="Open account"
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#7a0000]/10 bg-white text-slate-700 shadow-[0_12px_24px_rgba(15,23,42,0.05)]"
            >
              <User2 className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="mt-3 lg:hidden">
          <ShopSearchBar compact />
        </div>

        {menuOpen ? (
          <div className="mt-3 rounded-[28px] border border-[#7a0000]/10 bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.08)] lg:hidden">
            <nav className="grid gap-2">
              {navLinks.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-2xl border border-[#7a0000]/8 bg-[#fcfaf7] px-4 py-3 text-sm font-semibold text-slate-700"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        ) : null}

        <div className="hidden items-center gap-6 lg:flex">
          <Link href="/shop" className="flex shrink-0 items-center gap-4">
            <div className="overflow-hidden rounded-2xl border border-[#7a0000]/10 bg-white shadow-[0_16px_30px_rgba(122,0,0,0.12)]">
              <Image src="/agents/betech-logo-crop.png" alt="Betech Solar" width={56} height={56} className="h-14 w-14 object-contain" />
            </div>
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.28em] text-[#7a0000]">Betech Solar</div>
              <div className="text-lg font-black tracking-tight text-slate-950">Online Store</div>
            </div>
          </Link>

          <div className="min-w-0 flex-1">
            <ShopSearchBar />
          </div>

          <nav className="hidden min-w-0 items-center gap-1.5 lg:flex xl:gap-2">
            {navLinks.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="rounded-full border border-[#7a0000]/10 bg-white px-3 py-3 text-[13px] font-semibold text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-[#7a0000]/25 hover:text-[#7a0000]"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-2xl border border-[#7a0000]/10 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-[0_12px_24px_rgba(15,23,42,0.05)]"
            >
              <User2 className="h-4 w-4" />
              <span className="hidden xl:inline">Account</span>
            </button>
            <Link
              href="/shop/cart"
              className="inline-flex items-center gap-2 rounded-2xl bg-[#7a0000] px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(122,0,0,0.18)]"
            >
              <ShoppingCart className="h-4 w-4" />
              <span>{cartCount > 0 ? `Cart (${cartCount})` : "Cart"}</span>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
