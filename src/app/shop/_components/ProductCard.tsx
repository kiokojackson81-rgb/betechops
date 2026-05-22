"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import type { ShopProduct } from "@/app/shop/shopData";
import AddToCartButton from "@/app/shop/_components/AddToCartButton";
import ShopProductVisual from "@/app/shop/_components/ShopProductVisual";
import TrackedWhatsAppLink from "@/app/shop/_components/TrackedWhatsAppLink";
import { formatCurrency } from "@/app/shop/_components/shopStyles";

const WHATSAPP_PHONE = "254722151083";

type ProductCardProps = {
  product: ShopProduct;
};

export default function ProductCard({ product }: ProductCardProps) {
  const stockLabelMap = {
    in_stock: "In stock",
    limited_stock: "Limited stock",
    preorder: "Pre-order",
    quote_only: "Request quote",
  } as const;

  const whatsappHref = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(product.whatsappMessage)}`;
  const priceLabel = product.source === "ops" ? "Betech price" : "Preview price";

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[20px] border border-[#7a0000]/10 bg-white text-slate-950 shadow-[0_12px_22px_rgba(15,23,42,0.05)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(122,0,0,0.10)]">
      <div className="relative h-24 overflow-hidden border-b border-[#7a0000]/10 bg-[#f8f1e8] sm:h-28 xl:h-32">
        <div className="absolute inset-0 p-2 sm:p-2.5">
          <ShopProductVisual visualType={product.visualType} productName={product.name} compact className="h-full w-full" />
        </div>
        <div className="absolute left-2 top-2 inline-flex rounded-full bg-[#fff3d8] px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-[#7a0000] shadow-[0_8px_16px_rgba(242,178,15,0.14)]">
          {product.brand}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-2.5 sm:p-3">
        <Link href={`/shop/product/${product.slug}`} className="block">
          <h3 className="line-clamp-2 text-sm font-black leading-5 text-slate-950 transition group-hover:text-[#7a0000]">{product.name}</h3>
        </Link>
        <p className="mt-1.5 line-clamp-1 text-xs leading-5 text-slate-500">{product.specs[0] || "Contact us for full specs"}</p>

        <div className="mt-2.5">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[#7a0000]/70">{priceLabel}</div>
          <div className="mt-0.5 flex items-end gap-2">
            <div className="text-base font-black text-slate-950 sm:text-lg">{formatCurrency(product.price)}</div>
            {product.oldPrice ? <div className="pb-0.5 text-[11px] font-semibold text-slate-400 line-through">{formatCurrency(product.oldPrice)}</div> : null}
          </div>
        </div>

        <div className="mt-2 inline-flex w-fit rounded-full border border-[#0f9d58]/14 bg-[#effcf4] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#0f9d58]">
          {stockLabelMap[product.stockStatus]}
        </div>

        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <AddToCartButton productId={product.id} productName={product.name} className="inline-flex min-h-[2.45rem] items-center justify-center gap-2 rounded-2xl bg-[#7a0000] px-3 py-2 text-xs font-bold text-white shadow-[0_12px_22px_rgba(122,0,0,0.14)] transition hover:-translate-y-0.5" />
          <TrackedWhatsAppLink
            href={whatsappHref}
            className="inline-flex min-h-[2.45rem] items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#11b86a_0%,#0f9d58_55%,#0b7c44_100%)] px-3 py-2 text-xs font-bold text-white shadow-[0_14px_26px_rgba(15,157,88,0.22)] transition hover:-translate-y-0.5"
            label={`WhatsApp order ${product.name}`}
            context="product_card"
            ariaLabel={`Order ${product.name} on WhatsApp`}
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </TrackedWhatsAppLink>
        </div>
      </div>
    </article>
  );
}
