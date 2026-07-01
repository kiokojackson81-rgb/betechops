"use client";

import Link from "next/link";
import { AlertCircle, CheckCircle2, Headphones, ArrowRight } from "lucide-react";
import FloatingWhatsApp from "@/app/shop/_components/FloatingWhatsApp";
import ProductCard from "@/app/shop/_components/ProductCard";
import ShopFooter from "@/app/shop/_components/ShopFooter";
import ShopHeader from "@/app/shop/_components/ShopHeader";
import TrackedWhatsAppLink from "@/app/shop/_components/TrackedWhatsAppLink";
import { shopStyles } from "@/app/shop/_components/shopStyles";
import { shopNavLinks, type ShopProduct } from "@/app/shop/shopData";
import { SHOP_ALL_PRODUCTS_HREF, SHOP_HOME_HREF } from "@/app/shop/storefrontPaths";

type PublicCallRequestClientProps = {
  state: "requested" | "expired" | "invalid";
  popularProducts: ShopProduct[];
};

export default function PublicCallRequestClient({ state, popularProducts }: PublicCallRequestClientProps) {
  const isInvalid = state === "invalid";
  const isExpired = state === "expired";

  return (
    <div className={shopStyles.page}>
      <ShopHeader navLinks={shopNavLinks} />
      <main className="py-6 sm:py-8">
        <div className={shopStyles.shell}>
          <div className="mx-auto max-w-[1320px]">
            <section className={`${shopStyles.softCard} mx-auto max-w-[760px] overflow-hidden p-5 sm:p-7`}>
              {state === "requested" ? <RequestedCard /> : <UnavailableCard isExpired={isExpired} isInvalid={isInvalid} />}
            </section>

            <section className={`${shopStyles.softCard} mt-6 overflow-hidden p-0`}>
              <div className="flex flex-col gap-3 border-b border-[#7a0000]/10 px-5 py-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className={shopStyles.sectionEyebrow}>Popular Solar Picks</div>
                  <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950">Explore Betech Solar products</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                    Popular customer picks across recent purchases, enquiries, and demand in our solar catalogue.
                  </p>
                </div>
                <Link href={SHOP_ALL_PRODUCTS_HREF} className="inline-flex items-center gap-2 text-sm font-black text-[#7a0000] transition hover:text-[#560000]">
                  See all products
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:grid-cols-4">
                {popularProducts.slice(0, 8).map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>
      <ShopFooter />
      <FloatingWhatsApp />
    </div>
  );
}

function RequestedCard() {
  return (
    <div className={shopStyles.lightCard + " p-5 sm:p-6"}>
      <div className="flex items-start gap-3">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#effcf4] text-[#0f9d58]">
          <CheckCircle2 className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-black text-slate-950">Thank you. We will call you shortly.</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            We are sorry your earlier call did not go through successfully. Your callback request has been received and assigned to our team.
          </p>
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Link href={SHOP_HOME_HREF} className={`${shopStyles.primaryButton} flex-1`}>
          Shop Solar Products
        </Link>
        <TrackedWhatsAppLink
          href="https://wa.me/254722151083?text=Hello%20Betech%20Solar%20Solution"
          className={`${shopStyles.whatsappButton} flex-1`}
          label="Voice callback request whatsapp support"
          context="voice_callback_request"
          ariaLabel="Talk to Betech Solar on WhatsApp"
        >
          WhatsApp Support
        </TrackedWhatsAppLink>
        <TrackedWhatsAppLink
          href="https://wa.me/254722151083?text=Hello%20Betech%20Solar%20Solution"
          className={`${shopStyles.whatsappButton} flex-1`}
          label="Voice callback request whatsapp products"
          context="voice_callback_request"
          ariaLabel="Shop Betech Solar products on WhatsApp"
        >
          Shop WhatsApp Products
        </TrackedWhatsAppLink>
        <Link
          href="https://www.tiktok.com/@betechsolarsolutionske"
          target="_blank"
          rel="noreferrer"
          className={`${shopStyles.goldButton} flex-1`}
        >
          See Our Recent Projects
        </Link>
      </div>
    </div>
  );
}

function UnavailableCard({ isExpired, isInvalid }: { isExpired: boolean; isInvalid: boolean }) {
  return (
    <div className={shopStyles.lightCard + " p-5 sm:p-6"}>
      <div className="flex items-start gap-3">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
          <AlertCircle className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-black text-slate-950">
            {isExpired ? "This callback link has expired." : isInvalid ? "This callback link is invalid." : "This callback link is unavailable."}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Please call Betech Solar Solutions again, use WhatsApp support, or browse our product catalogue while we help you.
          </p>
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <TrackedWhatsAppLink
          href="https://wa.me/254722151083?text=Hello%20Betech%20Solar%20Solution"
          className={`${shopStyles.whatsappButton} flex-1`}
          label="Voice callback invalid whatsapp support"
          context="voice_callback_invalid"
          ariaLabel="Talk to Betech Solar on WhatsApp"
        >
          WhatsApp Support
        </TrackedWhatsAppLink>
        <Link href={SHOP_HOME_HREF} className={`${shopStyles.primaryButton} flex-1`}>
          Shop Solar Products
        </Link>
        <Link
          href="https://www.tiktok.com/@betechsolarsolutionske"
          target="_blank"
          rel="noreferrer"
          className={`${shopStyles.goldButton} flex-1 sm:col-span-2`}
        >
          Follow us on TikTok
        </Link>
      </div>
    </div>
  );
}
