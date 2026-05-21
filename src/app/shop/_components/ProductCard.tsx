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
    <article className="group flex h-full flex-col overflow-hidden rounded-[24px] border border-[#7a0000]/10 bg-white text-slate-950 shadow-[0_14px_30px_rgba(15,23,42,0.05)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_48px_rgba(122,0,0,0.12)]">
      <div className="relative h-32 overflow-hidden border-b border-[#7a0000]/10 bg-[#f8f1e8] sm:h-36 xl:h-40">
        <div className="absolute inset-0 p-2.5 sm:p-3">
          <ShopProductVisual visualType={product.visualType} productName={product.name} compact className="h-full w-full" />
        </div>
        <div className="absolute left-2.5 top-2.5 inline-flex rounded-full bg-[#fff3d8] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#7a0000] shadow-[0_10px_18px_rgba(242,178,15,0.16)]">
          {product.brand}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-3 sm:p-3.5">
        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[#7a0000]/75">{product.category}</div>
        <Link href={`/shop/product/${product.slug}`} className="mt-2 block">
          <h3 className="line-clamp-2 text-sm font-black leading-5 text-slate-950 transition group-hover:text-[#7a0000] sm:text-[15px]">{product.name}</h3>
        </Link>
        <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{product.specs.slice(0, 2).join(" • ") || "Contact us for full specs"}</p>
        <div className="mt-2 text-[11px] font-semibold text-slate-500">{product.warranty}</div>

        <div className="mt-3">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[#7a0000]/70">{priceLabel}</div>
          <div className="mt-1 flex items-end gap-2">
            <div className="text-lg font-black text-slate-950 sm:text-xl">{formatCurrency(product.price)}</div>
            {product.oldPrice ? <div className="pb-0.5 text-xs font-semibold text-slate-400 line-through">{formatCurrency(product.oldPrice)}</div> : null}
          </div>
        </div>

        <div className="mt-3 inline-flex w-fit rounded-full border border-[#0f9d58]/14 bg-[#effcf4] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#0f9d58]">
          {stockLabelMap[product.stockStatus]}
        </div>

        <div className="mt-3 grid gap-2">
          <AddToCartButton
            productId={product.id}
            productName={product.name}
            className="inline-flex min-h-[2.9rem] items-center justify-center gap-2 rounded-2xl bg-[#7a0000] px-3 py-2.5 text-sm font-bold text-white shadow-[0_14px_26px_rgba(122,0,0,0.16)] transition hover:-translate-y-0.5 sm:min-h-[3rem]"
          />
          <TrackedWhatsAppLink
            href={whatsappHref}
            className="inline-flex min-h-[2.9rem] items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#11b86a_0%,#0f9d58_55%,#0b7c44_100%)] px-3 py-2.5 text-sm font-bold text-white shadow-[0_16px_34px_rgba(15,157,88,0.24)] transition hover:-translate-y-0.5 sm:min-h-[3rem]"
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
