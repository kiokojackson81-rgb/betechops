import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Clock3, Headphones, MessageCircleMore } from "lucide-react";
import CategoryScroller from "@/app/shop/_components/CategoryScroller";
import FloatingWhatsApp from "@/app/shop/_components/FloatingWhatsApp";
import ProductSection from "@/app/shop/_components/ProductSection";
import ShopFooter from "@/app/shop/_components/ShopFooter";
import ShopHeader from "@/app/shop/_components/ShopHeader";
import ShopHero from "@/app/shop/_components/ShopHero";
import { shopStyles } from "@/app/shop/_components/shopStyles";
import { heroHighlights, shopCategories, shopNavLinks, shopProductSections, trustBadges } from "@/app/shop/shopData";

export const metadata: Metadata = {
  title: "Shop",
  description: "Responsive Betech Solar ecommerce storefront mock built for mobile and desktop from the start.",
};

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
              <div className={shopStyles.sectionEyebrow}>Why this storefront works</div>
              <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Responsive from the first component, not patched later.</h2>
              <p className="mt-3 text-base leading-7 text-slate-600">
                Every major shop component is already structured for single-column mobile, balanced tablet layouts, and full-width desktop browsing.
              </p>
              <div className="mt-5 grid gap-3 text-sm text-slate-700">
                <div className="flex items-center gap-3 rounded-2xl border border-[#7a0000]/8 bg-white px-4 py-3">
                  <BadgeCheck className="h-5 w-5 text-[#7a0000]" />
                  Product cards scale from thumb-friendly mobile tiles to hover-ready desktop cards.
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-[#7a0000]/8 bg-white px-4 py-3">
                  <Clock3 className="h-5 w-5 text-[#7a0000]" />
                  Mock data is extracted cleanly so future ops catalogue integration stays straightforward.
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-[#7a0000]/8 bg-white px-4 py-3">
                  <Headphones className="h-5 w-5 text-[#7a0000]" />
                  Existing `agents` and `ops` experiences remain isolated because `/shop` is added as a new route only.
                </div>
              </div>
            </div>

            <div id="quote" className={`${shopStyles.darkPanel} p-5 sm:p-6`}>
              <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
                <div>
                  <div className="inline-flex rounded-full bg-[#fff3d8] px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-[#7a0000]">
                    Request System Quote
                  </div>
                  <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">Need the right kit for your home, biashara, or farm?</h2>
                  <p className="mt-4 text-base leading-7 text-white/76">
                    Send your load requirements or site use-case and Betech Solar can recommend a fitting system before checkout flows are connected.
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
                    Request System Quote
                  </Link>
                  <Link href="#best-selling-solar-kits" className={`${shopStyles.secondaryButton} min-h-[3.5rem] bg-white/92`}>
                    Shop Solar Products
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
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
