"use client";

import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, CircleDollarSign } from "lucide-react";
import {
  getAgentPotentialCommissionValue,
  productCommissionRequiresApproval,
} from "@/app/agents/agentCatalogueShared";
import AgentStorefrontProductActions from "@/app/agents/_components/AgentStorefrontProductActions";
import type { ShopProduct } from "@/app/shop/shopData";
import { formatCurrency } from "@/app/shop/_components/shopStyles";
import { getAgentProductHref } from "@/app/agents/storefrontPaths";

type AgentCatalogueProductCardProps = {
  product: ShopProduct;
  loginHref: string;
  loggedIn: boolean;
  useRootPaths?: boolean;
};

export default function AgentCatalogueProductCard({
  product,
  loginHref,
  loggedIn,
  useRootPaths = false,
}: AgentCatalogueProductCardProps) {
  const discountPercent =
    product.oldPrice && product.oldPrice > product.price
      ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
      : null;
  const displayCommissionAmount = getAgentPotentialCommissionValue(product);
  const requiresApproval = productCommissionRequiresApproval(product);

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[22px] border border-[#7a0000]/10 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.06)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_52px_rgba(122,0,0,0.12)]">
      <Link href={getAgentProductHref(product.slug, useRootPaths, product.opsProductId)} prefetch={false} className="relative block h-40 overflow-hidden border-b border-[#7a0000]/8 bg-[linear-gradient(180deg,#fff6e8_0%,#ffffff_100%)] sm:h-48">
        <div className="absolute inset-0 p-3">
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 300px"
            className="object-contain transition duration-500 group-hover:scale-[1.03]"
          />
        </div>
        <div className="absolute left-3 top-3 inline-flex max-w-[72%] truncate rounded-full bg-[#fff3d8] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#7a0000]">
          {product.brand}
        </div>
        {discountPercent ? (
          <div className="absolute right-3 top-3 rounded-full bg-[#7a0000] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white">
            -{discountPercent}%
          </div>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <Link href={getAgentProductHref(product.slug, useRootPaths, product.opsProductId)} prefetch={false} className="block">
          <h3 className="line-clamp-2 text-[1rem] font-black tracking-[-0.02em] text-slate-950 transition group-hover:text-[#7a0000]">
            {product.name}
          </h3>
        </Link>
        <p className="mt-2 line-clamp-2 min-h-[2.7rem] text-sm leading-5 text-slate-600">
          {product.shortDescription || product.specs[0] || "Sell this Betech Solar product and earn from completed referrals."}
        </p>

        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <div className="text-xl font-black tracking-[-0.02em] text-slate-950">{formatCurrency(product.price)}</div>
            {product.oldPrice ? <div className="text-sm font-medium text-slate-400 line-through">{formatCurrency(product.oldPrice)}</div> : null}
          </div>
          <div className="rounded-2xl border border-[#f2b20f]/30 bg-[#fff6df] px-3 py-2 text-right">
            <div className="flex items-center justify-end gap-1 text-[11px] font-black uppercase tracking-[0.14em] text-[#7a0000]">
              <CircleDollarSign className="h-3.5 w-3.5" />
              Commission
            </div>
            <div className="mt-1 text-lg font-black text-slate-950">
              {formatCurrency(displayCommissionAmount)}
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <span className="inline-flex rounded-full border border-[#0f9d58]/14 bg-[#effcf4] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#0f9d58]">
            {product.stockStatus === "in_stock"
              ? "In stock"
              : product.stockStatus === "limited_stock"
                ? "Limited stock"
                : product.stockStatus === "quote_only"
                  ? "Quote required"
                  : "Pre-order"}
          </span>
          {requiresApproval ? (
            <span className="inline-flex rounded-full border border-[#7a0000]/10 bg-[#fcfaf7] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#7a0000]">
              Approval check
            </span>
          ) : (
            <span className="inline-flex rounded-full border border-[#f2b20f]/20 bg-[#fff8e8] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#8a5a00]">
              Referral ready
            </span>
          )}
        </div>

        <div className="mt-auto pt-4">
          <AgentStorefrontProductActions
            product={product}
            loginHref={loginHref}
            loggedIn={loggedIn}
            compact
          />
        </div>

        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
          <BadgeCheck className="h-3.5 w-3.5 text-[#7a0000]" />
          Earnings unlock after confirmed completed sale.
        </div>
      </div>
    </article>
  );
}
