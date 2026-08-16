"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import AddToCartButton from "@/app/shop/_components/AddToCartButton";
import ShopLipaPolePoleStarter from "@/app/shop/_components/ShopLipaPolePoleStarter";
import TrackedWhatsAppLink from "@/app/shop/_components/TrackedWhatsAppLink";
import { formatCurrency } from "@/app/shop/_components/shopStyles";
import type { ShopProduct } from "@/app/shop/shopData";
import { getShopRequestQuoteHref } from "@/app/shop/storefrontPaths";

type ShopProductDetailActionsProps = {
  product: ShopProduct;
  customer: {
    isAuthenticated: boolean;
    name: string;
    phone: string;
    email: string;
    county: string;
    town: string;
    estateLandmark: string;
    locationNotes: string;
  };
  loginHref: string;
  openLipaPolePole?: boolean;
};

export default function ShopProductDetailActions({
  product,
  customer,
  loginHref,
  openLipaPolePole = false,
}: ShopProductDetailActionsProps) {
  const whatsappHref = `https://wa.me/254722151083?text=${encodeURIComponent(
    `Hello Betech Solar, I want to order ${product.name} at ${formatCurrency(product.price)}.`,
  )}`;
  const quoteHref = getShopRequestQuoteHref(product.name);

  return (
    <div className="grid gap-3">
      <AddToCartButton
        productId={product.id}
        productName={product.name}
        className="inline-flex min-h-[3.55rem] items-center justify-center gap-2 rounded-[20px] bg-[#7a0000] px-5 py-3 text-sm font-bold text-white shadow-[0_20px_36px_rgba(122,0,0,0.18)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#660000] hover:shadow-[0_24px_42px_rgba(122,0,0,0.24)]"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <TrackedWhatsAppLink
          href={whatsappHref}
          className="inline-flex min-h-[3.35rem] items-center justify-center gap-2 rounded-[20px] bg-[linear-gradient(135deg,#11b86a_0%,#0f9d58_55%,#0b7c44_100%)] px-4 py-3 text-sm font-bold text-white shadow-[0_18px_34px_rgba(15,157,88,0.22)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_40px_rgba(15,157,88,0.28)]"
          label={`WhatsApp order ${product.name}`}
          context="product_detail"
          ariaLabel={`Order ${product.name} on WhatsApp`}
        >
          <MessageCircle className="h-4 w-4" />
          WhatsApp Order
        </TrackedWhatsAppLink>
        <Link
          href={quoteHref}
          className="inline-flex min-h-[3.35rem] items-center justify-center rounded-[20px] border border-[#7a0000]/18 bg-white px-4 py-3 text-sm font-bold text-slate-950 shadow-[0_14px_30px_rgba(15,23,42,0.06)] transition duration-200 hover:-translate-y-0.5 hover:border-[#7a0000]/35 hover:shadow-[0_18px_34px_rgba(15,23,42,0.08)]"
        >
          Request Quote
        </Link>
      </div>
      <ShopLipaPolePoleStarter product={product} customer={customer} loginHref={loginHref} autoOpen={openLipaPolePole} />
    </div>
  );
}
