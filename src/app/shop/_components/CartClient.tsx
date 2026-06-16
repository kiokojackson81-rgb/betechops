"use client";
import Link from "next/link";
import { MessageCircle, Minus, Plus, Trash2 } from "lucide-react";
import {
  buildDetailedCart,
  removeShopCartItem,
  updateShopCartQuantity,
  useShopCartItems,
} from "@/app/shop/cartStore";
import ShopProductVisual from "@/app/shop/_components/ShopProductVisual";
import ShopStatePanel from "@/app/shop/_components/ShopStatePanel";
import TrackedWhatsAppLink from "@/app/shop/_components/TrackedWhatsAppLink";
import type { ShopProduct } from "@/app/shop/shopData";
import { formatCurrency, shopStyles } from "@/app/shop/_components/shopStyles";
import { getProductAvailabilityMessage } from "@/app/shop/shopAvailability";
import { getShopProductHref, SHOP_CHECKOUT_LOGIN_HREF, SHOP_HOME_HREF, SHOP_REQUEST_QUOTE_HREF } from "@/app/shop/storefrontPaths";

type CartClientProps = {
  products: ShopProduct[];
};

export default function CartClient({ products }: CartClientProps) {
  const items = useShopCartItems();
  const detailedItems = buildDetailedCart(items, products);
  const subtotal = detailedItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const hasWarehouseItems = detailedItems.some((item) => item.product.availabilityType === "WAREHOUSE");
  const availabilityNotice = hasWarehouseItems
    ? "Some items in your order are available from warehouse. Pickup or delivery will be available after 1 day."
    : "All items are available for immediate shop pickup.";
  const cartProductIds = new Set(detailedItems.map((item) => item.product.id));
  const recommendedProducts = products
    .filter((product) =>
      !cartProductIds.has(product.id) &&
      ["solar-accessories", "solar-batteries", "solar-charge-controllers", "dc-appliances"].includes(
        product.tags[0] || "",
      ),
    )
    .slice(0, 4);
  const cartWhatsappHref = `https://wa.me/254722151083?text=${encodeURIComponent(
    `Hello Betech Solar, I want to checkout these items: ${detailedItems
      .map((item) => `${item.product.name} x${item.quantity}`)
      .join(", ") || "my cart"}.`,
  )}`;

  if (!detailedItems.length) {
    return (
      <div className="grid gap-5">
        <ShopStatePanel
          eyebrow="Your cart is empty"
          title="Start with genuine Betech Solar products."
          copy="Add panels, inverters, batteries, pumps, heaters, or full kits to continue with checkout."
          primaryHref={SHOP_HOME_HREF}
          primaryLabel="Continue Shopping"
          secondaryHref={SHOP_REQUEST_QUOTE_HREF}
          secondaryLabel="Request a Solar System Quote"
        />
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.18fr)_340px]">
      <div className="grid gap-3 self-start">
        {detailedItems.map(({ product, quantity, lineTotal }) => (
          <article key={product.id} className="rounded-[18px] border border-[#7a0000]/10 bg-white p-3 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
            <div className="flex items-start gap-3 sm:items-center">
              <div className="relative h-[5rem] w-[5rem] shrink-0 rounded-[14px] border border-[#7a0000]/8 bg-[#f6eee2] p-2 sm:h-[6.5rem] sm:w-[6.5rem]">
                <ShopProductVisual visualType={product.visualType} productName={product.name} compact className="h-full w-full" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[#7a0000]/75">{product.category}</div>
                <h2 className="mt-1 line-clamp-2 text-[14px] font-black leading-[1.15rem] text-slate-950 sm:text-base sm:leading-5">{product.name}</h2>
                <div className="mt-1 text-xs text-slate-500">{product.brand}</div>
                <div className="mt-1 line-clamp-1 text-[11px] text-slate-500">{product.specs[0] || "Contact us for full specs"}</div>
                <div className="mt-1 text-[11px] font-semibold text-slate-500">{getProductAvailabilityMessage(product)}</div>
              </div>
              <div className="hidden min-w-[120px] flex-col items-end gap-2 sm:flex">
                <div className="text-lg font-black text-slate-950">{formatCurrency(product.price)}</div>
                <div className="inline-flex items-center gap-1 rounded-full border border-[#7a0000]/10 bg-[#fcfaf7] px-1.5 py-1">
                  <button
                    type="button"
                    aria-label={`Reduce quantity for ${product.name}`}
                    onClick={() => updateShopCartQuantity(product.id, quantity - 1)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-[#7a0000]"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="min-w-7 text-center text-sm font-black text-slate-950">{quantity}</span>
                  <button
                    type="button"
                    aria-label={`Increase quantity for ${product.name}`}
                    onClick={() => updateShopCartQuantity(product.id, quantity + 1)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-[#7a0000]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="text-base font-black text-slate-950">{formatCurrency(lineTotal)}</div>
                <button
                  type="button"
                  onClick={() => removeShopCartItem(product.id)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#7a0000]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </button>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#7a0000]/8 pt-3 sm:hidden">
              <div>
                <div className="text-base font-black text-slate-950">{formatCurrency(product.price)}</div>
                <div className="mt-1 text-sm font-black text-slate-950">{formatCurrency(lineTotal)}</div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="inline-flex items-center gap-1 rounded-full border border-[#7a0000]/10 bg-[#fcfaf7] px-1.5 py-1">
                  <button
                    type="button"
                    aria-label={`Reduce quantity for ${product.name}`}
                    onClick={() => updateShopCartQuantity(product.id, quantity - 1)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-[#7a0000]"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="min-w-7 text-center text-sm font-black text-slate-950">{quantity}</span>
                  <button
                    type="button"
                    aria-label={`Increase quantity for ${product.name}`}
                    onClick={() => updateShopCartQuantity(product.id, quantity + 1)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-[#7a0000]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => removeShopCartItem(product.id)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#7a0000]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </button>
              </div>
            </div>
          </article>
        ))}

        {recommendedProducts.length ? (
          <section className="rounded-[18px] border border-[#7a0000]/10 bg-white p-3.5 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[#7a0000]">Recommended solar accessories</div>
                <h2 className="mt-1 text-lg font-black text-slate-950">Customers also viewed</h2>
              </div>
              <Link href={SHOP_HOME_HREF} className="text-sm font-bold text-[#7a0000]">
                View more
              </Link>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {recommendedProducts.map((product) => (
                <Link
                  key={product.id}
                  href={getShopProductHref(product.slug, product.opsProductId)}
                  className="flex items-center gap-3 rounded-[14px] border border-[#7a0000]/8 bg-[#fcfaf7] p-2.5 transition hover:border-[#7a0000]/20"
                >
                  <div className="h-14 w-14 shrink-0 rounded-[12px] bg-[#f6eee2] p-2">
                    <ShopProductVisual visualType={product.visualType} productName={product.name} compact className="h-full w-full" />
                  </div>
                  <div className="min-w-0">
                    <div className="line-clamp-2 text-xs font-black leading-4 text-slate-950">{product.name}</div>
                    <div className="mt-1 text-[11px] font-semibold text-[#7a0000]">{formatCurrency(product.price)}</div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <aside className="order-first h-fit self-start rounded-[20px] border border-[#7a0000]/10 bg-[linear-gradient(180deg,#fffaf2_0%,#ffffff_100%)] p-4 shadow-[0_14px_32px_rgba(15,23,42,0.06)] xl:order-none xl:sticky xl:top-24">
        <div className={shopStyles.sectionEyebrow}>Order Summary</div>
        <div className="mt-4 grid gap-2.5 text-sm text-slate-600">
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
        <div className="mt-4 border-t border-[#7a0000]/10 pt-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-600">Estimated total</span>
            <span className="text-xl font-black text-slate-950">{formatCurrency(subtotal)}</span>
          </div>
        </div>
        <div className="mt-3 rounded-[16px] border border-amber-400/20 bg-amber-400/5 px-3 py-2.5 text-sm font-semibold leading-6 text-slate-700">
          {availabilityNotice}
        </div>
        <div className="mt-4 grid gap-2.5">
          <Link href={SHOP_CHECKOUT_LOGIN_HREF} className="inline-flex min-h-[2.9rem] items-center justify-center gap-2 rounded-[14px] bg-[#7a0000] px-4 py-2.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(122,0,0,0.16)] transition hover:bg-[#610000]">
            Proceed to Checkout
          </Link>
          <TrackedWhatsAppLink
            href={cartWhatsappHref}
            className="inline-flex min-h-[2.9rem] items-center justify-center gap-2 rounded-[14px] bg-[linear-gradient(135deg,#11b86a_0%,#0f9d58_55%,#0b7c44_100%)] px-4 py-2.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(15,157,88,0.22)] transition"
            label="Cart WhatsApp checkout"
            context="cart_summary"
            ariaLabel="Checkout this cart on WhatsApp"
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp Checkout
          </TrackedWhatsAppLink>
          <Link href={SHOP_HOME_HREF} className="inline-flex min-h-[2.9rem] items-center justify-center gap-2 rounded-[14px] border border-[#7a0000]/16 bg-white px-4 py-2.5 text-sm font-bold text-slate-950 shadow-[0_10px_22px_rgba(15,23,42,0.04)] transition">
            Continue Shopping
          </Link>
        </div>
        <div className="mt-4 rounded-[16px] border border-[#7a0000]/10 bg-white p-3.5">
          <div className="text-sm font-black uppercase tracking-[0.16em] text-[#7a0000]">Not sure what you need?</div>
          <p className="mt-1.5 text-sm leading-6 text-slate-600">Request a solar quote and our team will help size your system before the order is confirmed.</p>
          <Link href={SHOP_REQUEST_QUOTE_HREF} className="mt-3 inline-flex text-sm font-bold text-[#7a0000]">
            Request a Solar System Quote
          </Link>
        </div>
      </aside>
    </div>
  );
}
