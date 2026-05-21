"use client";

import Image from "next/image";
import Link from "next/link";
import { MessageCircle, Minus, Plus, Trash2 } from "lucide-react";
import {
  buildDetailedCart,
  removeShopCartItem,
  updateShopCartQuantity,
  useShopCartItems,
} from "@/app/shop/cartStore";
import type { ShopProduct } from "@/app/shop/shopData";
import { formatCurrency, shopStyles } from "@/app/shop/_components/shopStyles";

type CartClientProps = {
  products: ShopProduct[];
};

export default function CartClient({ products }: CartClientProps) {
  const items = useShopCartItems();
  const detailedItems = buildDetailedCart(items, products);
  const subtotal = detailedItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const cartWhatsappHref = `https://wa.me/254722151083?text=${encodeURIComponent(
    `Hello Betech Solar, I want to checkout these items: ${detailedItems
      .map((item) => `${item.product.name} x${item.quantity}`)
      .join(", ") || "my cart"}.`,
  )}`;

  if (!detailedItems.length) {
    return (
      <div className="grid gap-5">
        <div className={`${shopStyles.softCard} p-6 sm:p-8`}>
          <div className={shopStyles.sectionEyebrow}>Your cart is empty</div>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950">Start with genuine Betech Solar products.</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
            Add panels, inverters, batteries, pumps, or full kits to continue with the mock checkout flow.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href="/shop" className={shopStyles.primaryButton}>
              Continue Shopping
            </Link>
            <Link href="/shop/request-quote" className={shopStyles.secondaryButton}>
              Request a Solar System Quote
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
      <div className="grid gap-4">
        {detailedItems.map(({ product, quantity, lineTotal }) => (
          <article key={product.id} className={`${shopStyles.lightCard} flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5`}>
            <div className="relative h-28 rounded-[24px] border border-[#7a0000]/10 bg-[#f6eee2] sm:h-32 sm:w-32">
              <Image src={product.image} alt={product.name} fill sizes="8rem" className="object-contain p-3" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#7a0000]/75">{product.category}</div>
              <h2 className="mt-2 text-lg font-black text-slate-950">{product.name}</h2>
              <div className="mt-2 text-sm text-slate-500">{product.brand}</div>
              <div className="mt-3 text-xl font-black text-slate-950">{formatCurrency(product.price)}</div>
            </div>
            <div className="flex flex-col gap-3 sm:items-end">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#7a0000]/10 bg-[#fcfaf7] px-2 py-2">
                <button
                  type="button"
                  aria-label={`Reduce quantity for ${product.name}`}
                  onClick={() => updateShopCartQuantity(product.id, quantity - 1)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#7a0000]"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="min-w-8 text-center text-sm font-black text-slate-950">{quantity}</span>
                <button
                  type="button"
                  aria-label={`Increase quantity for ${product.name}`}
                  onClick={() => updateShopCartQuantity(product.id, quantity + 1)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#7a0000]"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <div className="text-lg font-black text-slate-950">{formatCurrency(lineTotal)}</div>
              <button
                type="button"
                onClick={() => removeShopCartItem(product.id)}
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#7a0000]"
              >
                <Trash2 className="h-4 w-4" />
                Remove
              </button>
            </div>
          </article>
        ))}
      </div>

      <aside className={`${shopStyles.softCard} h-fit p-5 sm:p-6 xl:sticky xl:top-28`}>
        <div className={shopStyles.sectionEyebrow}>Order Summary</div>
        <div className="mt-5 grid gap-3 text-sm text-slate-600">
          <div className="flex items-center justify-between">
            <span>Items</span>
            <span>{detailedItems.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Subtotal</span>
            <span className="font-semibold text-slate-950">{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Delivery</span>
            <span>Calculated at checkout</span>
          </div>
        </div>
        <div className="mt-5 border-t border-[#7a0000]/10 pt-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-600">Estimated total</span>
            <span className="text-2xl font-black text-slate-950">{formatCurrency(subtotal)}</span>
          </div>
        </div>
        <div className="mt-6 grid gap-3">
          <Link href="/shop/checkout" className={shopStyles.primaryButton}>
            Proceed to Checkout
          </Link>
          <Link href="/shop" className={shopStyles.secondaryButton}>
            Continue Shopping
          </Link>
          <Link href={cartWhatsappHref} target="_blank" rel="noreferrer" className={shopStyles.whatsappButton}>
            <MessageCircle className="h-4 w-4" />
            WhatsApp Checkout
          </Link>
        </div>
      </aside>
    </div>
  );
}
