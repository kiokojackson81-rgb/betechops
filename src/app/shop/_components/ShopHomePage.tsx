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
import { buildShopCategories, deliveryPaymentSteps, shopNavLinks, type ShopProduct } from "@/app/shop/shopData";
import { getShopProducts } from "@/app/shop/shopApi";
import { getShopCategoryHref, SHOP_REQUEST_QUOTE_HREF } from "@/app/shop/storefrontPaths";
import { getShopImageOverrides } from "@/lib/shopImageOverrides";

type ShopHomePageProps = {
  searchParams?: Promise<{
    q?: string;
  }>;
  analyticsPage?: string;
};

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function getProductsForCategories(products: ShopProduct[], categorySlugs: string[], limit = 4) {
  const allowed = new Set(categorySlugs);
  return products.filter((product) => allowed.has(slugify(product.category))).slice(0, limit);
}

export default async function ShopHomePage({
  searchParams,
  analyticsPage = "/shop",
}: ShopHomePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const rawQuery = String(resolvedSearchParams?.q ?? "").trim();
  const searchQuery = rawQuery.length > 0 ? rawQuery : undefined;
  const [products, imageOverrides] = await Promise.all([getShopProducts({ q: searchQuery }), getShopImageOverrides()]);
  const categories = buildShopCategories(imageOverrides.categoryImages);
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
      <ShopAnalyticsTracker kind="shop_view" payload={{ page: analyticsPage, brand: "Betech Solar Solutions" }} />
      <ShopHeader navLinks={shopNavLinks} />
      <ShopCategoryNav categories={categories} />
      <ShopHero categories={categories} heroImageUrl={imageOverrides.heroBannerUrl ?? undefined} />
      <CategoryScroller categories={categories} />

      <section className="py-2.5 sm:py-3">
        <div className={shopStyles.shell}>
          <div className={`${shopStyles.lightCard} overflow-hidden px-3 py-3 sm:px-4`}>
            <div className="grid gap-2 grid-cols-2 md:grid-cols-5">
              {topTrustItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="flex items-center gap-2 rounded-2xl bg-[#fcfaf7] px-3 py-2.5">
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#fff3d8] text-[#7a0000]">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="text-[11px] font-bold leading-4 text-slate-700 sm:text-sm">{item.title}</div>
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
          title={searchQuery ? `Search results for "${searchQuery}"` : "Live Shop Catalogue"}
          subtitle={
            searchQuery
              ? `Showing ${products.length} product${products.length === 1 ? "" : "s"} matching your search.`
              : "Real products currently published from POS Management for storefront testing."
          }
          products={products}
        />
      ) : null}

      {!searchQuery && kitProducts.length ? (
        <ProductSection
          id="best-selling-solar-kits"
          title="Best Selling Solar Kits"
          subtitle="Ready-built kits for home backup and biashara power."
          href={getShopCategoryHref("solar-full-kits")}
          products={kitProducts}
        />
      ) : null}

      {!searchQuery && panelProducts.length ? (
        <ProductSection
          id="solar-panels"
          title="Solar Panels"
          subtitle="High-output mono panels for rooftops and clean daytime generation."
          href={getShopCategoryHref("solar-panels")}
          products={panelProducts}
        />
      ) : null}

      {!searchQuery && inverterProducts.length ? (
        <ProductSection
          id="solar-inverters"
          title="Inverters"
          subtitle="Hybrid inverter options for starter and stronger backup setups."
          href={getShopCategoryHref("solar-inverters")}
          products={inverterProducts}
        />
      ) : null}

      {!searchQuery && batteryProducts.length ? (
        <ProductSection
          id="solar-batteries"
          title="Batteries"
          subtitle="Gel and lithium storage for dependable reserve power."
          href={getShopCategoryHref("solar-batteries")}
          products={batteryProducts}
        />
      ) : null}

      {!searchQuery && outdoorProducts.length ? (
        <ProductSection
          id="solar-water-pumps"
          title="Water Pumps & Lights"
          subtitle="Outdoor solar solutions for irrigation and compound lighting."
          href={getShopCategoryHref("solar-water-pumps")}
          products={outdoorProducts}
        />
      ) : null}

      {searchQuery && !products.length ? (
        <section id="shop-catalogue" className="py-3.5 sm:py-4">
          <div className={shopStyles.shell}>
            <div className={`${shopStyles.lightCard} p-6 text-center sm:p-8`}>
              <div className={shopStyles.sectionEyebrow}>No matches</div>
              <h2 className="mt-3 text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
                No products found for &quot;{searchQuery}&quot;
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Try a simpler search like inverter, battery, panel, pump, or full kit.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="py-4 sm:py-6">
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
                  <div key={step.title} className="rounded-[18px] border border-[#7a0000]/10 bg-[#fcfaf7] p-3.5 sm:rounded-[20px]">
                    <div className="text-[11px] font-black uppercase tracking-[0.14em] text-[#7a0000] sm:text-sm">{step.title}</div>
                    <p className="mt-1.5 text-[13px] leading-5 text-slate-600 sm:text-sm sm:leading-6">{step.copy}</p>
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
                <Link href={SHOP_REQUEST_QUOTE_HREF} className={`${shopStyles.goldButton} min-h-[2.9rem] w-full`}>
                  Request Free Quote
                </Link>
                <Link href={getShopCategoryHref("solar-full-kits")} className={`${shopStyles.secondaryButton} min-h-[2.9rem] w-full bg-white/92`}>
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
