"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Headphones, Menu, ShoppingCart, User2, X } from "lucide-react";
import ShopPreviewBanner from "@/app/shop/_components/ShopPreviewBanner";
import ShopSearchBar from "@/app/shop/_components/ShopSearchBar";
import TrackedWhatsAppLink from "@/app/shop/_components/TrackedWhatsAppLink";
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
      <ShopPreviewBanner />
      <div className={`${shopStyles.shell} py-2 sm:py-3`}>
        <div className="flex items-center justify-between gap-2 lg:hidden">
          <button
            type="button"
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            onClick={() => setMenuOpen((current) => !current)}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#7a0000]/10 bg-white text-[#7a0000] shadow-[0_10px_20px_rgba(15,23,42,0.05)]"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <Link href="/shop" className="flex min-w-0 flex-1 items-center gap-2.5">
            <div className="overflow-hidden rounded-2xl border border-[#7a0000]/10 bg-white shadow-[0_16px_30px_rgba(122,0,0,0.12)]">
              <Image src="/agents/betech-logo-crop.png" alt="Betech Solar" width={38} height={38} className="h-9 w-9 object-contain sm:h-10 sm:w-10" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-[11px] font-black uppercase tracking-[0.14em] text-[#7a0000] sm:text-sm">Betech Solar</div>
              <div className="truncate text-[11px] text-slate-500">Online Store</div>
            </div>
          </Link>

          <div className="flex shrink-0 items-center gap-1.5">
            <Link
              href="/shop/cart"
              aria-label="Open cart"
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[#7a0000]/10 bg-white text-slate-700 shadow-[0_10px_20px_rgba(15,23,42,0.05)]"
            >
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 ? (
                <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#7a0000] px-1 text-[10px] font-black text-white">
                  {cartCount}
                </span>
              ) : null}
            </Link>
            <Link
              href="/shop/account"
              aria-label="Open account"
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[#7a0000]/10 bg-white text-slate-700 shadow-[0_10px_20px_rgba(15,23,42,0.05)]"
            >
              <User2 className="h-5 w-5" />
            </Link>
          </div>
        </div>

        <div className="mt-2 lg:hidden">
          <ShopSearchBar compact />
        </div>

        {menuOpen ? (
          <div className="mt-2 rounded-[24px] border border-[#7a0000]/10 bg-white p-3 shadow-[0_16px_32px_rgba(15,23,42,0.08)] lg:hidden">
            <nav className="grid gap-2">
              {navLinks.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-2xl border border-[#7a0000]/8 bg-[#fcfaf7] px-4 py-2.5 text-sm font-semibold text-slate-700"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        ) : null}

        <div className="hidden items-center gap-3 lg:flex xl:gap-4">
          <Link href="/shop" className="flex shrink-0 items-center gap-3">
            <div className="overflow-hidden rounded-2xl border border-[#7a0000]/10 bg-white shadow-[0_16px_30px_rgba(122,0,0,0.12)]">
              <Image src="/agents/betech-logo-crop.png" alt="Betech Solar" width={48} height={48} className="h-12 w-12 object-contain" />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-[#7a0000]">Betech Solar</div>
              <div className="text-base font-black tracking-tight text-slate-950">Online Store</div>
            </div>
          </Link>

          <div className="min-w-0 flex-1">
            <ShopSearchBar />
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <TrackedWhatsAppLink
              href="https://wa.me/254722151083?text=Hello%20Betech%20Solar%2C%20I%20need%20help%20choosing%20the%20right%20solar%20products."
              className="inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#11b86a_0%,#0f9d58_55%,#0b7c44_100%)] px-3 py-2.5 text-sm font-semibold text-white shadow-[0_14px_24px_rgba(15,157,88,0.22)] xl:px-3.5"
              label="Header WhatsApp support"
              context="shop_header"
              ariaLabel="Talk to Betech Solar on WhatsApp"
            >
              <Headphones className="h-4 w-4" />
              <span className="hidden xl:inline">WhatsApp Support</span>
              <span className="xl:hidden">Support</span>
            </TrackedWhatsAppLink>
            <Link
              href="/shop/account"
              className="inline-flex items-center gap-2 rounded-2xl border border-[#7a0000]/10 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 shadow-[0_10px_20px_rgba(15,23,42,0.05)] xl:px-3.5"
            >
              <User2 className="h-4 w-4" />
              <span className="hidden xl:inline">Account</span>
            </Link>
            <Link
              href="/shop/cart"
              className="inline-flex items-center gap-2 rounded-2xl bg-[#7a0000] px-3 py-2.5 text-sm font-semibold text-white shadow-[0_14px_24px_rgba(122,0,0,0.16)] xl:px-3.5"
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
