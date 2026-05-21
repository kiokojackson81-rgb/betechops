"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import AddToCartButton from "@/app/shop/_components/AddToCartButton";
import TrackedWhatsAppLink from "@/app/shop/_components/TrackedWhatsAppLink";
import { formatCurrency } from "@/app/shop/_components/shopStyles";
import type { ShopProduct } from "@/app/shop/shopData";

type ShopProductDetailActionsProps = {
  product: ShopProduct;
};

export default function ShopProductDetailActions({ product }: ShopProductDetailActionsProps) {
  const whatsappHref = `https://wa.me/254722151083?text=${encodeURIComponent(
    `Hello Betech Solar, I want to order ${product.name} at ${formatCurrency(product.price)}.`,
  )}`;
  const quoteHref = `/shop/request-quote?product=${encodeURIComponent(product.name)}`;

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <AddToCartButton
        productId={product.id}
        productName={product.name}
        className="inline-flex min-h-[3.4rem] items-center justify-center gap-2 rounded-2xl bg-[#7a0000] px-5 py-3 text-sm font-bold text-white shadow-[0_18px_35px_rgba(122,0,0,0.18)] transition hover:-translate-y-0.5"
      />
      <TrackedWhatsAppLink
        href={whatsappHref}
        className="inline-flex min-h-[3.4rem] items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#11b86a_0%,#0f9d58_55%,#0b7c44_100%)] px-5 py-3 text-sm font-bold text-white shadow-[0_18px_38px_rgba(15,157,88,0.26)] transition hover:-translate-y-0.5"
        label={`WhatsApp order ${product.name}`}
        context="product_detail"
        ariaLabel={`Order ${product.name} on WhatsApp`}
      >
        <MessageCircle className="h-4 w-4" />
        WhatsApp Order
      </TrackedWhatsAppLink>
      <Link
        href={quoteHref}
        className="inline-flex min-h-[3.4rem] items-center justify-center rounded-2xl border border-[#7a0000]/18 bg-white px-5 py-3 text-sm font-bold text-slate-950 shadow-[0_14px_30px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:border-[#7a0000]/35"
      >
        Request Quote
      </Link>
    </div>
  );
}
