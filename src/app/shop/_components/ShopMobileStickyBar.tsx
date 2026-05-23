"use client";

import { MessageCircle } from "lucide-react";
import AddToCartButton from "@/app/shop/_components/AddToCartButton";
import TrackedWhatsAppLink from "@/app/shop/_components/TrackedWhatsAppLink";
import { formatCurrency } from "@/app/shop/_components/shopStyles";

type ShopMobileStickyBarProps = {
  productId: string;
  productName: string;
  price: number;
};

export default function ShopMobileStickyBar({ productId, productName, price }: ShopMobileStickyBarProps) {
  const whatsappHref = `https://wa.me/254722151083?text=${encodeURIComponent(
    `Hello Betech Solar, I want to order ${productName} at ${formatCurrency(price)}.`,
  )}`;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[#7a0000]/10 bg-white/96 px-3 pb-[calc(env(safe-area-inset-bottom)+0.8rem)] pt-3 shadow-[0_-18px_40px_rgba(15,23,42,0.12)] backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-[1380px] items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Price</div>
          <div className="truncate text-lg font-bold tracking-tight text-slate-950">{formatCurrency(price)}</div>
        </div>
        <AddToCartButton
          productId={productId}
          productName={productName}
          className="inline-flex min-h-[3.2rem] items-center justify-center gap-2 rounded-2xl bg-[#7a0000] px-4 py-2.5 text-sm font-bold text-white shadow-[0_14px_28px_rgba(122,0,0,0.18)]"
        />
        <TrackedWhatsAppLink
          href={whatsappHref}
          className="inline-flex min-h-[3.2rem] items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#11b86a_0%,#0f9d58_55%,#0b7c44_100%)] px-4 py-2.5 text-sm font-bold text-white shadow-[0_14px_28px_rgba(15,157,88,0.22)]"
          label={`Mobile WhatsApp order ${productName}`}
          context="product_mobile_sticky_bar"
          ariaLabel={`Order ${productName} on WhatsApp`}
        >
          <MessageCircle className="h-4 w-4" />
          WhatsApp
        </TrackedWhatsAppLink>
      </div>
    </div>
  );
}
