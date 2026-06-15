import Link from "next/link";
import { BadgeCheck, Bike, Clock3, CreditCard, Headphones, MapPin, PackageCheck, ShieldCheck, Store, Truck } from "lucide-react";
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
import TrackedWhatsAppLink from "@/app/shop/_components/TrackedWhatsAppLink";
import { shopStyles } from "@/app/shop/_components/shopStyles";
import { buildShopCategories, shopNavLinks, type ShopProduct } from "@/app/shop/shopData";
import { getShopProducts } from "@/app/shop/shopApi";
import { getShopCategoryHref, SHOP_REQUEST_QUOTE_HREF } from "@/app/shop/storefrontPaths";
import { compareProductsByPopularity, getPopularitySignalsForProducts, type ProductPopularitySignal } from "@/lib/productPopularity";
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

function sortProductsForHomepage(products: ShopProduct[], popularitySignals: Map<string, ProductPopularitySignal>) {
  return [...products].sort((a, b) => {
    return compareProductsByPopularity(a, b, popularitySignals);
  });
}

function getProductsForCategories(products: ShopProduct[], categorySlugs: string[], popularitySignals: Map<string, ProductPopularitySignal>, limit = 4) {
  const allowed = new Set(categorySlugs);
  return sortProductsForHomepage(
    products.filter((product) => allowed.has(slugify(product.category))),
    popularitySignals,
  ).slice(0, limit);
}

export default async function ShopHomePage({
  searchParams,
  analyticsPage = "/shop",
}: ShopHomePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const rawQuery = String(resolvedSearchParams?.q ?? "").trim();
  const searchQuery = rawQuery.length > 0 ? rawQuery : undefined;
  const [products, imageOverrides] = await Promise.all([getShopProducts({ q: searchQuery }), getShopImageOverrides()]);
  const popularitySignals = searchQuery ? new Map<string, ProductPopularitySignal>() : await getPopularitySignalsForProducts(products);
  const popularProducts = searchQuery ? products : sortProductsForHomepage(products, popularitySignals).slice(0, 8);
  const categories = buildShopCategories(imageOverrides.categoryImages);
  const kitProducts = getProductsForCategories(products, ["solar-full-kits"], popularitySignals);
  const panelProducts = getProductsForCategories(products, ["solar-panels"], popularitySignals);
  const inverterProducts = getProductsForCategories(products, ["solar-inverters"], popularitySignals);
  const batteryProducts = getProductsForCategories(products, ["solar-batteries", "lithium-batteries"], popularitySignals);
  const outdoorProducts = getProductsForCategories(products, ["solar-water-pumps", "solar-lights", "solar-water-heaters"], popularitySignals);

  const topTrustItems = [
    { title: "Genuine products", icon: BadgeCheck },
    { title: "Warranty support", icon: ShieldCheck },
    { title: "Expert solar guidance", icon: Headphones },
    { title: "Nairobi CBD shop", icon: MapPin },
    { title: "Preview checkout only", icon: Clock3 },
  ];
  const paymentOptions = [
    {
      title: "Within Nairobi CBD and nearby areas",
      copy:
        "Customers can either pick up from the shop or request rider delivery. Pay on delivery is allowed after the customer receives and inspects the item.",
    },
    {
      title: "Outside Nairobi",
      copy:
        "Customers can prepay for the item and we dispatch through their preferred courier such as G4S, Wells Fargo, Ena Coach, and similar options. After dispatch, we share the official courier receipt or tracking details.",
    },
    {
      title: "Outside Nairobi Pay on Delivery",
      copy:
        "This is available through SpeedAf Express where covered. The customer pays the delivery or transport fee first, then pays for the item on delivery. SpeedAf does not cover all areas.",
    },
  ] as const;
  const deliveryOptions = [
    {
      title: "Shop Pick-Up",
      copy: "Pramukh Plaza, 3rd Floor, Shop No. 3, Nairobi CBD.",
      icon: Store,
    },
    {
      title: "Nairobi Delivery",
      copy: "Rider delivery available. Customer pays after receiving and inspecting the item.",
      icon: Bike,
    },
    {
      title: "Outside Nairobi Courier",
      copy: "Customer prepays, then the order is sent using the preferred courier service.",
      icon: PackageCheck,
    },
    {
      title: "Outside Nairobi Pay on Delivery",
      copy: "Handled through SpeedAf Express where available. Transport fee is paid first, then item payment happens on delivery.",
      icon: Truck,
    },
  ] as const;
  const transportSteps = [
    "Customer confirms the order.",
    "We take the item to the preferred courier.",
    "The courier confirms the transport cost.",
    "We communicate the transport cost to the customer.",
    "The customer pays the courier or transport fee.",
    "We share the official courier receipt.",
    "The customer receives notification from the courier when the item arrives.",
  ] as const;
  const directionSteps = [
    "Start at RNG Plaza entrance on Ronald Ngara Street.",
    "Look opposite the entrance for Ngatatha House and Munyu Road.",
    "Cross the street and walk straight along Munyu Road.",
    "Walk about 90 meters to the junction of Munyu Road and Sheikh Karume Road.",
    "Pramukh Plaza will be on your right.",
  ] as const;

  return (
    <div className={`${shopStyles.page} pb-40 sm:pb-28`}>
      <ShopAnalyticsTracker kind="shop_view" payload={{ page: analyticsPage, brand: "Betech Solar Solutions" }} />
      <ShopHeader navLinks={shopNavLinks} />
      {!searchQuery ? <ShopCategoryNav categories={categories} /> : null}
      {!searchQuery ? <ShopHero categories={categories} heroImageUrl={imageOverrides.heroBannerUrl ?? undefined} /> : null}
      {!searchQuery ? <CategoryScroller categories={categories} /> : null}

      {!searchQuery ? (
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
      ) : null}

      {products.length ? (
        <ProductSection
          id="shop-catalogue"
          title={searchQuery ? `Search results for "${searchQuery}"` : "Our Most Popular Products"}
          subtitle={
            searchQuery
              ? `Showing ${products.length} product${products.length === 1 ? "" : "s"} matching your search.`
              : "Popular customer picks across recent interest, enquiries, and demand in our solar catalogue."
          }
          href={!searchQuery ? "https://www.betech.co.ke/all-products" : undefined}
          linkLabel={!searchQuery ? "See all products" : undefined}
          products={popularProducts}
        />
      ) : null}

      {!searchQuery && kitProducts.length ? (
        <ProductSection
          id="best-selling-solar-kits"
          title="Solar Full Kits"
          subtitle="Popular complete kit options for home backup, biashara power, and everyday essentials."
          href={getShopCategoryHref("solar-full-kits")}
          linkLabel="See all products"
          products={kitProducts}
        />
      ) : null}

      {!searchQuery && panelProducts.length ? (
        <ProductSection
          id="solar-panels"
          title="Solar Panels"
          subtitle="Popular panel options for rooftops, system upgrades, and reliable daytime generation."
          href={getShopCategoryHref("solar-panels")}
          linkLabel="See all products"
          products={panelProducts}
        />
      ) : null}

      {!searchQuery && inverterProducts.length ? (
        <ProductSection
          id="solar-inverters"
          title="Inverters"
          subtitle="Trending inverter options for backup power, hybrid setups, and daily home use."
          href={getShopCategoryHref("solar-inverters")}
          linkLabel="See all products"
          products={inverterProducts}
        />
      ) : null}

      {!searchQuery && batteryProducts.length ? (
        <ProductSection
          id="solar-batteries"
          title="Batteries"
          subtitle="Popular battery options for dependable storage, backup power, and system expansion."
          href={getShopCategoryHref("solar-batteries")}
          linkLabel="See all products"
          products={batteryProducts}
        />
      ) : null}

      {!searchQuery && outdoorProducts.length ? (
        <ProductSection
          id="solar-water-pumps"
          title="Water Pumps, Lights & Outdoor Solar"
          subtitle="Popular outdoor solar solutions for pumping, security lighting, heating, and compound use."
          href={getShopCategoryHref("solar-water-pumps")}
          linkLabel="See all products"
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

      {!searchQuery ? (
        <section className="py-4 sm:py-6">
          <div className={shopStyles.shell}>
            <div className="grid gap-3">
              <div className={`${shopStyles.lightCard} p-4 sm:p-5 lg:p-6`}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <div className={shopStyles.sectionEyebrow}>Delivery & Payment Policy</div>
                    <h2 className="mt-3 text-xl font-black tracking-tight text-slate-950 sm:text-2xl">Clear delivery, payment, and transport guidance for every Betech Solar order</h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                      We deliver and install solar systems countrywide across Kenya. The exact payment and dispatch process depends on whether you are collecting in Nairobi, using courier dispatch, or requesting pay on delivery where coverage is available.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <TrackedWhatsAppLink
                      href="https://wa.me/254722151083?text=Hello%20Betech%20Solar%2C%20I%20need%20help%20choosing%20a%20delivery%20option."
                      className={shopStyles.whatsappButton}
                      label="Delivery policy WhatsApp"
                      context="delivery_policy"
                      ariaLabel="Chat with Betech Solar on WhatsApp"
                    >
                      Chat on WhatsApp
                    </TrackedWhatsAppLink>
                    <Link href="https://maps.app.goo.gl/BKWo6DqgYmyJQCWF8" target="_blank" rel="noreferrer" className={shopStyles.goldButton}>
                      Get Directions
                    </Link>
                    <Link href="#delivery-options" className={shopStyles.secondaryButton}>
                      Choose Delivery Option
                    </Link>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 xl:grid-cols-[1.02fr_0.98fr]">
                <div className={`${shopStyles.lightCard} p-4 sm:p-5`}>
                  <div className={shopStyles.sectionEyebrow}>Payment Options</div>
                  <div className="mt-4 grid gap-3">
                    {paymentOptions.map((option) => (
                      <div key={option.title} className="rounded-[18px] border border-[#7a0000]/10 bg-[#fcfaf7] p-3.5 sm:rounded-[20px]">
                        <div className="flex items-start gap-3">
                          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#fff3d8] text-[#7a0000]">
                            <CreditCard className="h-4 w-4" />
                          </span>
                          <div>
                            <div className="text-[11px] font-black uppercase tracking-[0.14em] text-[#7a0000] sm:text-sm">{option.title}</div>
                            <p className="mt-1.5 text-[13px] leading-5 text-slate-600 sm:text-sm sm:leading-6">{option.copy}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div id="delivery-options" className={`${shopStyles.softCard} p-4 sm:p-5`}>
                  <div className={shopStyles.sectionEyebrow}>Delivery Options</div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {deliveryOptions.map((option) => {
                      const Icon = option.icon;
                      return (
                        <div key={option.title} className="rounded-[18px] border border-[#7a0000]/10 bg-white p-3.5 shadow-[0_10px_22px_rgba(15,23,42,0.04)]">
                          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#fff3d8] text-[#7a0000]">
                            <Icon className="h-4 w-4" />
                          </span>
                          <div className="mt-3 text-sm font-black text-slate-950">{option.title}</div>
                          <p className="mt-1.5 text-[13px] leading-5 text-slate-600 sm:text-sm sm:leading-6">{option.copy}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 xl:grid-cols-[0.98fr_1.02fr]">
                <div className={`${shopStyles.lightCard} p-4 sm:p-5`}>
                  <div className={shopStyles.sectionEyebrow}>Transport Fee Policy</div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    Transport fees vary depending on customer location and the courier used. Once the item and courier are confirmed, we communicate the actual transport cost before dispatch is completed.
                  </p>
                  <div className="mt-4 grid gap-2.5">
                    {transportSteps.map((step, index) => (
                      <div key={step} className="flex items-start gap-3 rounded-[18px] border border-[#7a0000]/8 bg-[#fcfaf7] px-3.5 py-3">
                        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#7a0000] text-xs font-black text-white">
                          {index + 1}
                        </span>
                        <p className="text-[13px] leading-5 text-slate-600 sm:text-sm sm:leading-6">{step}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3">
                  <div className={`${shopStyles.softCard} p-4 sm:p-5`}>
                    <div className={shopStyles.sectionEyebrow}>Shop Location</div>
                    <div className="mt-3 text-base font-black leading-7 text-slate-950">
                      Betech Solar Solutions
                      <br />
                      Pramukh Plaza, 3rd Floor, Shop No. 3
                      <br />
                      Junction of Munyu Road & Sheikh Karume Road
                      <br />
                      Nairobi CBD
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[18px] border border-[#7a0000]/10 bg-white px-3.5 py-3">
                        <div className="text-[11px] font-black uppercase tracking-[0.14em] text-[#7a0000]">Call / WhatsApp</div>
                        <div className="mt-1.5 text-sm font-semibold leading-6 text-slate-700">0722 151 083 / 0703 241 917</div>
                      </div>
                      <div className="rounded-[18px] border border-[#7a0000]/10 bg-white px-3.5 py-3">
                        <div className="text-[11px] font-black uppercase tracking-[0.14em] text-[#7a0000]">Operating Hours</div>
                        <div className="mt-1.5 text-sm leading-6 text-slate-700">
                          Mon-Fri: 9:00 AM - 5:00 PM
                          <br />
                          Sat: 9:00 AM - 3:00 PM
                          <br />
                          Sun & Public Holidays: Closed
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={`${shopStyles.lightCard} p-4 sm:p-5`}>
                    <div className={shopStyles.sectionEyebrow}>Directions from RNG Plaza</div>
                    <div className="mt-4 grid gap-2.5">
                      {directionSteps.map((step, index) => (
                        <div key={step} className="flex items-start gap-3 rounded-[18px] border border-[#7a0000]/8 bg-[#fcfaf7] px-3.5 py-3">
                          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#fff3d8] text-xs font-black text-[#7a0000]">
                            {index + 1}
                          </span>
                          <p className="text-[13px] leading-5 text-slate-600 sm:text-sm sm:leading-6">{step}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <ShopSupportStrip />
            </div>
          </div>
        </section>
      ) : null}

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
