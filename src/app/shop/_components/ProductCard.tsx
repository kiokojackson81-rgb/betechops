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
  const discountPercent =
    product.oldPrice && product.oldPrice > product.price
      ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
      : null;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[16px] border border-[#7a0000]/10 bg-white text-slate-950 shadow-[0_8px_18px_rgba(15,23,42,0.04)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(122,0,0,0.08)]">
      <div className="relative h-20 overflow-hidden border-b border-[#7a0000]/8 bg-[#f8f1e8] sm:h-24 xl:h-28">
        <div className="absolute inset-0 p-2">
          <ShopProductVisual visualType={product.visualType} productName={product.name} compact className="h-full w-full" />
        </div>
        <div className="absolute left-2 top-2 inline-flex rounded-full bg-[#fff3d8] px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.12em] text-[#7a0000]">
          {product.brand}
        </div>
        {discountPercent ? (
          <div className="absolute right-2 top-2 inline-flex rounded-full bg-[#7a0000] px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.1em] text-white">
            -{discountPercent}%
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-2.5">
        <Link href={`/shop/product/${product.slug}`} className="block">
          <h3 className="line-clamp-2 text-[13px] font-black leading-4.5 text-slate-950 transition group-hover:text-[#7a0000] sm:text-sm">
            {product.name}
          </h3>
        </Link>
        <p className="mt-1 line-clamp-1 text-[11px] leading-4 text-slate-500">{product.specs[0] || "Contact us for full specs"}</p>

        <div className="mt-2">
          <div className="text-sm font-black text-slate-950 sm:text-[15px]">{formatCurrency(product.price)}</div>
          {product.oldPrice ? <div className="mt-0.5 text-[11px] font-medium text-slate-400 line-through">{formatCurrency(product.oldPrice)}</div> : null}
        </div>

        <div className="mt-2 inline-flex w-fit rounded-full border border-[#0f9d58]/14 bg-[#effcf4] px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.12em] text-[#0f9d58]">
          {stockLabelMap[product.stockStatus]}
        </div>

        <div className="mt-2.5 grid grid-cols-2 gap-1.5">
          <AddToCartButton
            productId={product.id}
            productName={product.name}
            className="inline-flex min-h-[2.1rem] items-center justify-center rounded-xl bg-[#7a0000] px-2.5 py-1.5 text-[11px] font-bold text-white shadow-[0_8px_16px_rgba(122,0,0,0.14)] transition hover:-translate-y-0.5"
          />
          <TrackedWhatsAppLink
            href={whatsappHref}
            className="inline-flex min-h-[2.1rem] items-center justify-center gap-1 rounded-xl bg-[linear-gradient(135deg,#11b86a_0%,#0f9d58_55%,#0b7c44_100%)] px-2 py-1.5 text-[11px] font-bold text-white shadow-[0_10px_18px_rgba(15,157,88,0.18)] transition hover:-translate-y-0.5"
            label={`WhatsApp order ${product.name}`}
            context="product_card"
            ariaLabel={`Order ${product.name} on WhatsApp`}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            WhatsApp
          </TrackedWhatsAppLink>
        </div>
      </div>
    </article>
  );
}
