import Image from "next/image";
import Link from "next/link";
import { MessageCircle, ShoppingCart } from "lucide-react";
import type { ShopProduct } from "@/app/shop/shopData";
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

  const whatsappHref = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(
    `Hello Betech Solar, I want to order ${product.name} at ${formatCurrency(product.price)}.`,
  )}`;
  const quoteHref = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(
    `Hello Betech Solar, I need a quote for ${product.name}.`,
  )}`;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[28px] border border-[#7a0000]/10 bg-[linear-gradient(180deg,#fffaf1_0%,#ffffff_100%)] text-slate-950 shadow-[0_18px_40px_rgba(15,23,42,0.06)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_56px_rgba(122,0,0,0.12)]">
      <div className="relative h-36 overflow-hidden border-b border-[#7a0000]/10 bg-[#f6eee2] sm:h-44 xl:h-52">
        <Image
          src={product.image}
          alt={product.name}
          fill
          sizes="(max-width: 767px) 50vw, (max-width: 1279px) 33vw, 24vw"
          className="object-contain p-3 transition duration-500 group-hover:scale-[1.03] sm:p-4"
        />
        <div className="absolute left-3 top-3 inline-flex rounded-full bg-[#fff3d8] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#7a0000] shadow-[0_12px_24px_rgba(242,178,15,0.18)]">
          {product.brand}
        </div>
        <div className="absolute right-3 top-3 max-w-[46%] truncate rounded-full bg-white/92 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">
          {product.warranty}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#7a0000]/75">{product.category}</div>
        <h3 className="mt-2 line-clamp-2 text-sm font-black leading-6 text-slate-950 sm:text-base">{product.name}</h3>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {product.tags.slice(0, 2).map((tag) => (
            <span key={tag} className="rounded-full bg-[#fcf4e4] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#7a0000]/80">
              {tag.replace(/-/g, " ")}
            </span>
          ))}
        </div>
        <ul className="mt-3 grid gap-1 text-xs leading-5 text-slate-500">
          {product.specs.slice(0, 2).map((spec) => (
            <li key={spec} className="line-clamp-1">
              {spec}
            </li>
          ))}
        </ul>

        <div className="mt-4 flex items-end gap-2">
          <div className="text-lg font-black text-slate-950 sm:text-2xl">{formatCurrency(product.price)}</div>
          {product.oldPrice ? <div className="pb-0.5 text-xs font-semibold text-slate-400 line-through sm:text-sm">{formatCurrency(product.oldPrice)}</div> : null}
        </div>

        <div className="mt-3 inline-flex w-fit rounded-full border border-[#0f9d58]/14 bg-[#effcf4] px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-[#0f9d58]">
          {stockLabelMap[product.stockStatus]}
        </div>

        <div className="mt-4 grid gap-2 sm:mt-5">
          <button
            type="button"
            className="inline-flex min-h-[2.9rem] items-center justify-center gap-2 rounded-2xl bg-[#7a0000] px-4 py-3 text-xs font-bold text-white shadow-[0_16px_30px_rgba(122,0,0,0.18)] transition hover:-translate-y-0.5 sm:min-h-[3.15rem] sm:text-sm"
          >
            <ShoppingCart className="h-4 w-4" />
            Add to Cart
          </button>
          <Link
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-[2.9rem] items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#11b86a_0%,#0f9d58_55%,#0b7c44_100%)] px-4 py-3 text-xs font-bold text-white shadow-[0_16px_34px_rgba(15,157,88,0.24)] transition hover:-translate-y-0.5 sm:min-h-[3.15rem] sm:text-sm"
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp Order
          </Link>
          <Link
            href={quoteHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-[2.75rem] items-center justify-center rounded-2xl border border-[#7a0000]/12 bg-white px-4 py-2 text-xs font-bold text-[#7a0000] transition hover:-translate-y-0.5 sm:text-sm"
          >
            Request Quote
          </Link>
        </div>
      </div>
    </article>
  );
}
