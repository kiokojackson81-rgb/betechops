import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Clock3, Headphones, MapPin, MessageCircleMore, ShieldCheck, Truck } from "lucide-react";
import CategoryScroller from "@/app/shop/_components/CategoryScroller";
import FloatingWhatsApp from "@/app/shop/_components/FloatingWhatsApp";
import ProductSection from "@/app/shop/_components/ProductSection";
import ShopFooter from "@/app/shop/_components/ShopFooter";
import ShopHeader from "@/app/shop/_components/ShopHeader";
import ShopHero from "@/app/shop/_components/ShopHero";
import ShopStatePanel from "@/app/shop/_components/ShopStatePanel";
import { shopStyles } from "@/app/shop/_components/shopStyles";
import { deliveryPaymentSteps, heroHighlights, shopCategories, shopNavLinks, shopProductSections, shopReasons, trustBadges } from "@/app/shop/shopData";

export const metadata: Metadata = {
  title: "Betech Solar Online Store | Solar Panels, Batteries, Inverters & Kits",
  description:
    "Shop genuine solar panels, inverters, batteries, lithium batteries, full solar kits, water pumps, lights and accessories from Betech Solar Solutions. Delivery countrywide.",
};

// Route planning for future isolated ecommerce expansion:
// - /shop/product/[slug]
// - /shop/category/[slug]
// - /shop/cart
// - /shop/checkout
// - /shop/request-quote
// - /shop/order-success
// TODO: Replace mock data with ops catalogue API.
// TODO: Checkout should create pending ecommerce order in ops.
// TODO: Link customer to existing customer database.
// TODO: Link completed order to receipt system.
export default function ShopPage() {
  return (
    <div className={shopStyles.page}>
      <ShopHeader navLinks={shopNavLinks} />
      <ShopHero highlights={heroHighlights} trustBadges={trustBadges} />
      <CategoryScroller categories={shopCategories} />

      <section className="pb-4">
        <div className={shopStyles.shell}>
          <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
            <div className={`${shopStyles.softCard} p-5 sm:p-6`}>
              <div className={shopStyles.sectionEyebrow}>Why customers can trust this store</div>
              <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Built around real Betech Solar Solutions buying journeys.</h2>
              <p className="mt-3 text-base leading-7 text-slate-600">
                The store highlights product discovery, quote requests, Nairobi CBD trust, WhatsApp support, and future ops integration without changing core ops logic yet.
              </p>
              <div className="mt-5 grid gap-3 text-sm text-slate-700">
                <div className="flex items-center gap-3 rounded-2xl border border-[#7a0000]/8 bg-white px-4 py-3">
                  <BadgeCheck className="h-5 w-5 text-[#7a0000]" />
                  Shop genuine solar products with a layout optimized for both desktop browsing and thumb use on mobile.
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-[#7a0000]/8 bg-white px-4 py-3">
                  <Clock3 className="h-5 w-5 text-[#7a0000]" />
                  Request a Solar System Quote early if you need help with sizing before checkout flows go live.
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-[#7a0000]/8 bg-white px-4 py-3">
                  <Headphones className="h-5 w-5 text-[#7a0000]" />
                  Existing `agents` and `ops` experiences remain isolated because `/shop` stays separate from core operations logic.
                </div>
              </div>
            </div>

            <div id="quote" className={`${shopStyles.darkPanel} p-5 sm:p-6`}>
              <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
                <div>
                  <div className="inline-flex rounded-full bg-[#fff3d8] px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-[#7a0000]">
                    Request a Solar System Quote
                  </div>
                  <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">Need help choosing the right solar solution?</h2>
                  <p className="mt-4 text-base leading-7 text-white/76">
                    Tell Betech Solar Solutions about your load, home, biashara, farm, or pumping needs and our team can guide you before live checkout is connected.
                  </p>
                </div>
                <div className="grid gap-3">
                  <Link
                    href="https://wa.me/254722151083?text=Hello%20Betech%20Solar%2C%20I%20need%20a%20custom%20system%20quotation."
                    target="_blank"
                    rel="noreferrer"
                    className={`${shopStyles.whatsappButton} min-h-[3.5rem]`}
                  >
                    <MessageCircleMore className="h-4 w-4" />
                    Request Free Quote
                  </Link>
                  <Link href="#best-selling-solar-kits" className={`${shopStyles.secondaryButton} min-h-[3.5rem] bg-white/92`}>
                    Shop Products
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="pb-4 pt-8 sm:pt-12">
        <div className={shopStyles.shell}>
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto h-1 w-16 rounded-full bg-gradient-to-r from-[#f2b20f] to-[#7a0000]" />
            <h2 className="mt-5 text-3xl font-black tracking-tight text-slate-950 md:text-5xl">Why shop with Betech Solar?</h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              The Betech Solar Online Store is designed around real customer trust signals, practical support, and guided solar buying.
            </p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {shopReasons.map((reason, index) => {
              const icons = [ShieldCheck, BadgeCheck, Clock3, MapPin, Truck, Headphones];
              const Icon = icons[index % icons.length];
              return (
                <div key={reason} className={`${shopStyles.lightCard} p-5 sm:p-6`}>
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff3d8] text-[#7a0000] shadow-[0_16px_30px_rgba(242,178,15,0.16)]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-xl font-black tracking-tight text-slate-950">{reason}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {reason === "Expert system sizing"
                      ? "If you are not sure about system size, our team can guide the right mix of panel, inverter, battery and accessories."
                      : `Betech Solar Solutions supports ${reason.toLowerCase()} for customers testing the store today.`}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="pb-4 pt-8">
        <div className={shopStyles.shell}>
          <div className="grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
            <div className={`${shopStyles.softCard} p-5 sm:p-6`}>
              <div className={shopStyles.sectionEyebrow}>How delivery and payment works</div>
              <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950">Simple buying guidance before live ops integration.</h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {deliveryPaymentSteps.map((step) => (
                  <div key={step.title} className="rounded-[24px] border border-[#7a0000]/10 bg-white p-4 shadow-[0_14px_26px_rgba(15,23,42,0.05)]">
                    <div className="text-sm font-black uppercase tracking-[0.16em] text-[#7a0000]">{step.title}</div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{step.copy}</p>
                  </div>
                ))}
              </div>
            </div>
            <ShopStatePanel
              eyebrow="Not sure what you need?"
              title="Request a solar quote and our team will help size your system."
              copy="Solar customers often need help choosing the right panel wattage, inverter size, battery capacity, and delivery plan. Start with a quote request if you want guided sizing."
              primaryHref="/shop/request-quote"
              primaryLabel="Request a Solar Quote"
              secondaryHref="/shop#best-selling-solar-kits"
              secondaryLabel="Browse Products"
              tone="dark"
            />
          </div>
        </div>
      </section>

      {shopProductSections.map((section) => (
        <ProductSection key={section.slug} section={section} />
      ))}

      <ShopFooter />
      <FloatingWhatsApp />
    </div>
  );
}
