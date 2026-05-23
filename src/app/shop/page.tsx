import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Clock3, Headphones, MapPin, ShieldCheck } from "lucide-react";
import CategoryScroller from "@/app/shop/_components/CategoryScroller";
import FloatingWhatsApp from "@/app/shop/_components/FloatingWhatsApp";
import ProductSection from "@/app/shop/_components/ProductSection";
import ShopAnalyticsTracker from "@/app/shop/_components/ShopAnalyticsTracker";
import ShopCategoryNav from "@/app/shop/_components/ShopCategoryNav";
import ShopFooter from "@/app/shop/_components/ShopFooter";
import ShopHeader from "@/app/shop/_components/ShopHeader";
import ShopHero from "@/app/shop/_components/ShopHero";
import ShopMobileDock from "@/app/shop/_components/ShopMobileDock";
import ShopSupportStrip from "@/app/shop/_components/ShopSupportStrip";
import { shopStyles } from "@/app/shop/_components/shopStyles";
import { buildShopMetadata } from "@/app/shop/shopMetadata";
import { deliveryPaymentSteps, shopCategories, shopNavLinks, type ShopProduct } from "@/app/shop/shopData";
import { getShopProducts } from "@/app/shop/shopApi";

export const metadata: Metadata = buildShopMetadata();

// Route planning for future isolated ecommerce expansion:
// - /shop/product/[slug]
// - /shop/category/[slug]
// - /shop/cart
// - /shop/checkout
// - /shop/request-quote
// - /shop/order-success
// TODO: Checkout should create pending ecommerce order in ops.
// TODO: Link customer to existing customer database.
// TODO: Link completed order to receipt system.

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function getProductsForCategories(products: ShopProduct[], categorySlugs: string[], limit = 4) {
  const allowed = new Set(categorySlugs);
  return products.filter((product) => allowed.has(slugify(product.category))).slice(0, limit);
}

export default async function ShopPage() {
  const products = await getShopProducts();
  const kitProducts = getProductsForCategories(products, ["solar-full-kits"]);
  const panelProducts = getProductsForCategories(products, ["solar-panels"]);
  const inverterProducts = getProductsForCategories(products, ["solar-inverters"]);
  const batteryProducts = getProductsForCategories(products, ["solar-batteries", "lithium-batteries"]);
  const outdoorProducts = getProductsForCategories(products, ["solar-water-pumps", "solar-lights", "solar-water-heaters"]);

  const topTrustItems = [
    { title: "Genuine products", icon: BadgeCheck },
    { title: "Warranty support", icon: ShieldCheck },
    { title: "Expert solar guidance", icon: Headphones },
    { title: "Nairobi CBD shop", icon: MapPin },
    { title: "Preview checkout only", icon: Clock3 },
  ];

  return (
    <div className={`${shopStyles.page} pb-40 sm:pb-28`}>
      <ShopAnalyticsTracker kind="shop_view" payload={{ page: "/shop", brand: "Betech Solar Solutions" }} />
      <ShopHeader navLinks={shopNavLinks} />
      <ShopCategoryNav categories={shopCategories} />
      <ShopHero categories={shopCategories} />
      <CategoryScroller categories={shopCategories} />

      <section className="py-3">
        <div className={shopStyles.shell}>
          <div className={`${shopStyles.lightCard} overflow-hidden px-3 py-3 sm:px-4`}>
            <div className="grid gap-2 md:grid-cols-5">
              {topTrustItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="flex items-center gap-2.5 rounded-2xl bg-[#fcfaf7] px-3 py-2.5">
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#fff3d8] text-[#7a0000]">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="text-xs font-bold text-slate-700 sm:text-sm">{item.title}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {products.length ? (
        <ProductSection
          id="shop-catalogue"
          title="Live Shop Catalogue"
          subtitle="Real products currently published from POS Management for storefront testing."
          products={products}
        />
      ) : null}

      {kitProducts.length ? (
        <ProductSection
          id="best-selling-solar-kits"
          title="Best Selling Solar Kits"
          subtitle="Ready-built kits for home backup and biashara power."
          href="/shop/category/solar-full-kits"
          products={kitProducts}
        />
      ) : null}

      {panelProducts.length ? (
        <ProductSection
          id="solar-panels"
          title="Solar Panels"
          subtitle="High-output mono panels for rooftops and clean daytime generation."
          href="/shop/category/solar-panels"
          products={panelProducts}
        />
      ) : null}

      {inverterProducts.length ? (
        <ProductSection
          id="solar-inverters"
          title="Inverters"
          subtitle="Hybrid inverter options for starter and stronger backup setups."
          href="/shop/category/solar-inverters"
          products={inverterProducts}
        />
      ) : null}

      {batteryProducts.length ? (
        <ProductSection
          id="solar-batteries"
          title="Batteries"
          subtitle="Gel and lithium storage for dependable reserve power."
          href="/shop/category/solar-batteries"
          products={batteryProducts}
        />
      ) : null}

      {outdoorProducts.length ? (
        <ProductSection
          id="solar-water-pumps"
          title="Water Pumps & Lights"
          subtitle="Outdoor solar solutions for irrigation and compound lighting."
          href="/shop/category/solar-water-pumps"
          products={outdoorProducts}
        />
      ) : null}

      <section className="py-5 sm:py-6">
        <div className={shopStyles.shell}>
          <div className="grid gap-3 lg:grid-cols-[1.08fr_0.92fr]">
            <div className={`${shopStyles.lightCard} p-4 sm:p-5`}>
              <div className={shopStyles.sectionEyebrow}>Delivery and payment</div>
              <h2 className="mt-3 text-xl font-black tracking-tight text-slate-950 sm:text-2xl">How delivery and payment works</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                We deliver solar panels, batteries, inverters, pumps and kits across Kenya. Orders are confirmed by our team after stock, delivery, and payment review.
              </p>
              <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                {deliveryPaymentSteps.map((step) => (
                  <div key={step.title} className="rounded-[20px] border border-[#7a0000]/10 bg-[#fcfaf7] p-3.5">
                    <div className="text-xs font-black uppercase tracking-[0.14em] text-[#7a0000] sm:text-sm">{step.title}</div>
                    <p className="mt-1.5 text-sm leading-6 text-slate-600">{step.copy}</p>
                  </div>
                ))}
              </div>
            </div>

            <ShopSupportStrip />
          </div>
        </div>
      </section>

      <section id="quote" className="pb-4 pt-1.5 sm:pb-5">
        <div className={shopStyles.shell}>
          <div className={`${shopStyles.darkPanel} p-4 sm:p-5 lg:p-6`}>
            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div>
                <div className="inline-flex rounded-full bg-[#fff3d8] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#7a0000]">
                  Not sure what you need?
                </div>
                <h2 className="mt-3 text-xl font-black tracking-tight text-white sm:text-2xl">Get help choosing the right inverter, battery and panels.</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/78">
                  Request a solar quote and our team will guide the right system for your home, biashara, farm or pumping needs.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <Link href="/shop/request-quote" className={`${shopStyles.goldButton} min-h-[2.9rem] w-full`}>
                  Request Free Quote
                </Link>
                <Link href="/shop/category/solar-full-kits" className={`${shopStyles.secondaryButton} min-h-[2.9rem] w-full bg-white/92`}>
                  Browse Full Kits
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <ShopFooter />
      <ShopMobileDock />
      <FloatingWhatsApp hideOnMobile />
    </div>
  );
}
