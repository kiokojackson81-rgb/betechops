"use client";

import Link from "next/link";
import { FileText, MessageCircle, ShoppingCart } from "lucide-react";
import { getShopCartCount, useShopCartItems } from "@/app/shop/cartStore";
import TrackedWhatsAppLink from "@/app/shop/_components/TrackedWhatsAppLink";

const whatsappHref =
  "https://wa.me/254722151083?text=Hello%20Betech%20Solar%2C%20I%20need%20help%20choosing%20the%20right%20solar%20products.";

export default function ShopMobileDock() {
  useShopCartItems();
  const cartCount = getShopCartCount();

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[#7a0000]/10 bg-white/96 px-4 pb-[calc(env(safe-area-inset-bottom)+0.9rem)] pt-3 shadow-[0_-18px_40px_rgba(15,23,42,0.10)] backdrop-blur sm:hidden">
      <div className="grid grid-cols-3 gap-2.5">
        <TrackedWhatsAppLink
          href={whatsappHref}
          className="inline-flex min-h-[3.2rem] items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#11b86a_0%,#0f9d58_55%,#0b7c44_100%)] px-3 py-3 text-sm font-bold text-white shadow-[0_16px_34px_rgba(15,157,88,0.24)]"
          label="Shop mobile dock WhatsApp"
          context="shop_mobile_dock"
          ariaLabel="Talk to Betech Solar on WhatsApp"
        >
          <MessageCircle className="h-4 w-4" />
          WhatsApp
        </TrackedWhatsAppLink>
        <Link
          href="/shop/cart"
          className="inline-flex min-h-[3.2rem] items-center justify-center gap-2 rounded-2xl bg-[#7a0000] px-3 py-3 text-sm font-bold text-white shadow-[0_16px_30px_rgba(122,0,0,0.18)]"
        >
          <ShoppingCart className="h-4 w-4" />
          {cartCount > 0 ? `Cart (${cartCount})` : "Cart"}
        </Link>
        <Link
          href="/shop/request-quote"
          className="inline-flex min-h-[3.2rem] items-center justify-center gap-2 rounded-2xl border border-[#7a0000]/12 bg-[#fff7ea] px-3 py-3 text-sm font-bold text-[#7a0000]"
        >
          <FileText className="h-4 w-4" />
          Quote
        </Link>
      </div>
    </div>
  );
}
