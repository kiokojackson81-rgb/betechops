"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import type { ShopProduct } from "@/app/shop/shopData";
import AddToCartButton from "@/app/shop/_components/AddToCartButton";
import ShopProductVisual from "@/app/shop/_components/ShopProductVisual";
import TrackedWhatsAppLink from "@/app/shop/_components/TrackedWhatsAppLink";
import { formatCurrency } from "@/app/shop/_components/shopStyles";
import { getProductAvailabilityBadge } from "@/app/shop/shopAvailability";

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
  const availabilityBadge = getProductAvailabilityBadge(product);
  const discountPercent =
    product.oldPrice && product.oldPrice > product.price
      ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
      : null;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[20px] border border-[#7a0000]/8 bg-white text-slate-950 shadow-[0_12px_28px_rgba(15,23,42,0.05)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_42px_rgba(122,0,0,0.08)] sm:rounded-[24px]">
      <div className="relative h-32 overflow-hidden border-b border-[#7a0000]/8 bg-[linear-gradient(180deg,#fbf5eb_0%,#ffffff_100%)] sm:h-44 xl:h-48">
        <div className="absolute inset-0 p-2.5 sm:p-3">
          {product.image ? (
            <img src={product.image} alt={product.name} className="h-full w-full object-contain transition duration-500 group-hover:scale-[1.03]" />
          ) : (
            <ShopProductVisual visualType={product.visualType} productName={product.name} compact className="h-full w-full" />
          )}
        </div>
        <div className="absolute left-2.5 top-2.5 inline-flex max-w-[70%] truncate rounded-full bg-[#fff3d8] px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#7a0000] sm:left-3 sm:top-3 sm:px-2.5">
          {product.brand}
        </div>
        {discountPercent ? (
          <div className="absolute right-2.5 top-2.5 inline-flex rounded-full bg-[#7a0000] px-2 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-white sm:right-3 sm:top-3">
            -{discountPercent}%
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-3.5 sm:p-4">
        <Link href={`/shop/product/${product.slug}`} className="block">
          <h3 className="line-clamp-2 min-h-[2.45rem] text-[14px] font-bold leading-[1.15rem] tracking-[-0.01em] text-slate-950 transition group-hover:text-[#7a0000] sm:min-h-[2.8rem] sm:text-[15px] sm:leading-5">
            {product.name}
          </h3>
        </Link>
        <p className="mt-1.5 line-clamp-2 min-h-[1.8rem] text-[10px] leading-4 text-slate-500 sm:min-h-[2rem] sm:text-[11px]">{product.specs[0] || "Contact us for full specs"}</p>

        <div className="mt-2.5">
          <div className="text-[17px] font-bold tracking-[-0.02em] text-slate-950 sm:text-[18px]">{formatCurrency(product.price)}</div>
          <div className="mt-1 flex items-center gap-1.5">
            {product.oldPrice ? <div className="text-[11px] font-medium text-slate-400 line-through">{formatCurrency(product.oldPrice)}</div> : null}
            {discountPercent ? <div className="text-[11px] font-bold text-[#7a0000]">-{discountPercent}%</div> : null}
          </div>
        </div>

        <div className="mt-2.5 inline-flex w-fit rounded-full border border-[#0f9d58]/14 bg-[#effcf4] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#0f9d58]">
          {stockLabelMap[product.stockStatus]}
        </div>
        <div className="mt-1.5 inline-flex w-fit rounded-full border border-[#7a0000]/10 bg-[#fcfaf7] px-2.5 py-1 text-[9px] font-black tracking-[0.08em] text-[#7a0000]">
          {availabilityBadge}
        </div>

        <div className="mt-auto grid gap-2 pt-3.5 sm:pt-4">
          <AddToCartButton
            productId={product.id}
            productName={product.name}
            className="inline-flex min-h-[2.7rem] items-center justify-center rounded-[16px] bg-[#7a0000] px-3 py-2 text-[11px] font-bold text-white shadow-[0_10px_20px_rgba(122,0,0,0.12)] transition hover:-translate-y-0.5 sm:text-[12px]"
          />
          <TrackedWhatsAppLink
            href={whatsappHref}
            className="inline-flex min-h-[2.7rem] items-center justify-center gap-1.5 rounded-[16px] bg-[linear-gradient(135deg,#11b86a_0%,#0f9d58_55%,#0b7c44_100%)] px-3 py-2 text-[11px] font-bold text-white shadow-[0_10px_20px_rgba(15,157,88,0.16)] transition hover:-translate-y-0.5 sm:text-[12px]"
            label={`WhatsApp order ${product.name}`}
            context="product_card"
            ariaLabel={`Order ${product.name} on WhatsApp`}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Order via WhatsApp
          </TrackedWhatsAppLink>
        </div>
      </div>
    </article>
  );
}
