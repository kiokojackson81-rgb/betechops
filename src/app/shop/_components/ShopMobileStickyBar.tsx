"use client";

import { MessageCircle } from "lucide-react";
import Link from "next/link";
import AddToCartButton from "@/app/shop/_components/AddToCartButton";
import TrackedWhatsAppLink from "@/app/shop/_components/TrackedWhatsAppLink";
import { formatCurrency } from "@/app/shop/_components/shopStyles";
import { getShopRequestQuoteHref } from "@/app/shop/storefrontPaths";

type ShopMobileStickyBarProps = {
  productId: string;
  productName: string;
  price: number;
};

export default function ShopMobileStickyBar({ productId, productName, price }: ShopMobileStickyBarProps) {
  const whatsappHref = `https://wa.me/254722151083?text=${encodeURIComponent(
    `Hello Betech Solar, I want to order ${productName} at ${formatCurrency(price)}.`,
  )}`;
  const quoteHref = getShopRequestQuoteHref(productName);

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[#7a0000]/10 bg-white/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.8rem)] pt-2.5 shadow-[0_-18px_40px_rgba(15,23,42,0.12)] backdrop-blur lg:hidden">
      <div className="mx-auto grid max-w-[1380px] gap-2">
        <div className="flex items-center justify-between gap-3 rounded-[18px] border border-[#7a0000]/8 bg-[#fcfaf7] px-3 py-2.5">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Price</div>
            <div className="truncate text-[1.05rem] font-bold tracking-tight text-slate-950">{formatCurrency(price)}</div>
          </div>
          <Link
            href={quoteHref}
            className="inline-flex min-h-[2.6rem] shrink-0 items-center justify-center rounded-[16px] border border-[#7a0000]/18 bg-white px-3 py-2 text-[12px] font-bold text-slate-950 shadow-[0_10px_18px_rgba(15,23,42,0.05)]"
          >
            Quote
          </Link>
        </div>
        <div className="grid grid-cols-[1.1fr_0.9fr] gap-2">
          <AddToCartButton
            productId={productId}
            productName={productName}
            className="inline-flex min-h-[3.2rem] items-center justify-center gap-2 rounded-[18px] bg-[#7a0000] px-4 py-2.5 text-sm font-bold text-white shadow-[0_14px_28px_rgba(122,0,0,0.18)]"
          />
          <TrackedWhatsAppLink
            href={whatsappHref}
            className="inline-flex min-h-[3.2rem] items-center justify-center gap-2 rounded-[18px] bg-[linear-gradient(135deg,#11b86a_0%,#0f9d58_55%,#0b7c44_100%)] px-4 py-2.5 text-sm font-bold text-white shadow-[0_14px_28px_rgba(15,157,88,0.22)]"
            label={`Mobile WhatsApp order ${productName}`}
            context="product_mobile_sticky_bar"
            ariaLabel={`Order ${productName} on WhatsApp`}
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </TrackedWhatsAppLink>
        </div>
      </div>
    </div>
  );
}
