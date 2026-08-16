import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, PackageCheck, ScrollText, Search, WalletCards } from "lucide-react";
import ProductSection from "@/app/shop/_components/ProductSection";
import ShopFooter from "@/app/shop/_components/ShopFooter";
import ShopHeader from "@/app/shop/_components/ShopHeader";
import ShopMobileDock from "@/app/shop/_components/ShopMobileDock";
import { shopStyles } from "@/app/shop/_components/shopStyles";
import { getShopProducts } from "@/app/shop/shopApi";
import { shopNavLinks } from "@/app/shop/shopData";
import { SHOP_ACCOUNT_HREF } from "@/app/shop/storefrontPaths";
import { LIPA_POLE_POLE_TERMS_PATH } from "@/lib/lipaPolePoleTerms";

export const metadata: Metadata = {
  title: "Lipa Pole Pole | Betech Solar Solutions",
  description: "Choose an eligible Betech Solar product, pay gradually, and collect after completing payment.",
};

export const dynamic = "force-dynamic";

type LipaPolePolePageProps = {
  searchParams?: Promise<{ q?: string }>;
};

export default async function LipaPolePolePage({ searchParams }: LipaPolePolePageProps) {
  const query = String((await searchParams)?.q ?? "").trim();
  const products = await getShopProducts(query ? { q: query } : undefined);
  const eligibleProducts = products.filter((product) => product.lipaPolePoleEnabled && product.opsProductId);

  return (
    <div className={`${shopStyles.page} pb-40 sm:pb-28`}>
      <ShopHeader navLinks={shopNavLinks} />

      <main>
        <section className="relative overflow-hidden py-8 sm:py-12 lg:py-16">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(242,178,15,0.22),transparent_28%),radial-gradient(circle_at_85%_10%,rgba(122,0,0,0.14),transparent_32%)]" />
          <div className={`${shopStyles.shell} relative`}>
            <div className={`${shopStyles.darkPanel} overflow-hidden p-6 sm:p-9 lg:p-12`}>
              <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
                <div>
                  <div className="inline-flex rounded-full border border-[#ffd761]/30 bg-[#ffd761]/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-[#ffd761]">
                    Betech Lipa Pole Pole
                  </div>
                  <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
                    Choose a product. Pay gradually. Collect when fully paid.
                  </h1>
                  <p className="mt-5 max-w-2xl text-base leading-7 text-white/76 sm:text-lg">
                    Reserve an eligible Betech Solar product with an initial payment from Ksh 500, then continue paying from your customer account. This is not a loan or credit facility.
                  </p>
                  <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                    <a href="#eligible-products" className={shopStyles.goldButton}>
                      Choose a Product <ArrowRight className="h-4 w-4" />
                    </a>
                    <Link href={SHOP_ACCOUNT_HREF} prefetch={false} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/16">
                      <WalletCards className="h-4 w-4" /> View My Lipa Pole Pole
                    </Link>
                    <Link href={LIPA_POLE_POLE_TERMS_PATH} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#ffd761]/45 bg-[#ffd761]/10 px-5 py-3 text-sm font-bold text-[#ffe58f] transition hover:border-[#ffd761]/70 hover:bg-[#ffd761]/16">
                      <ScrollText className="h-4 w-4" /> See Terms &amp; Conditions
                    </Link>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                  {[
                    { icon: BadgeCheck, title: "Select", copy: "Choose a product marked as eligible for Lipa Pole Pole." },
                    { icon: WalletCards, title: "Pay", copy: "Submit M-Pesa payments and track verification in your account." },
                    { icon: PackageCheck, title: "Collect", copy: "The product is released only after full verified payment." },
                  ].map(({ icon: Icon, title, copy }) => (
                    <div key={title} className="rounded-[22px] border border-white/10 bg-white/[0.07] p-4 backdrop-blur">
                      <div className="flex items-start gap-3">
                        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#ffd761] text-[#4a1200]">
                          <Icon className="h-5 w-5" />
                        </span>
                        <div>
                          <div className="font-black text-white">{title}</div>
                          <p className="mt-1 text-sm leading-5 text-white/66">{copy}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-3 sm:py-5">
          <div className={shopStyles.shell}>
            <form action="/lipa-pole-pole" className={`${shopStyles.lightCard} flex flex-col gap-3 p-3 sm:flex-row sm:p-4`}>
              <label className="flex min-h-12 flex-1 items-center gap-3 rounded-2xl border border-[#7a0000]/12 bg-[#fcfaf7] px-4">
                <Search className="h-4 w-4 shrink-0 text-[#7a0000]" />
                <input name="q" defaultValue={query} placeholder="Search eligible products" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
              </label>
              <button type="submit" className={shopStyles.primaryButton}>Search Products</button>
            </form>
          </div>
        </section>

        {eligibleProducts.length ? (
          <ProductSection
            id="eligible-products"
            title={query ? `Eligible products matching “${query}”` : "Eligible Lipa Pole Pole Products"}
            subtitle="Open a product to review its price, deposit, payment schedule, and start your plan securely."
            products={eligibleProducts}
          />
        ) : (
          <section id="eligible-products" className="py-4 sm:py-6">
            <div className={shopStyles.shell}>
              <div className={`${shopStyles.softCard} p-7 text-center sm:p-10`}>
                <div className={shopStyles.sectionEyebrow}>No eligible matches</div>
                <h2 className="mt-4 text-2xl font-black text-slate-950">Try another product search</h2>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">Only products enabled by Betech for Lipa Pole Pole appear here. Our team can also help you find an eligible alternative.</p>
                <Link href="/lipa-pole-pole" className={`${shopStyles.secondaryButton} mt-5`}>View all eligible products</Link>
              </div>
            </div>
          </section>
        )}

        <section className="py-4 sm:py-6">
          <div className={shopStyles.shell}>
            <div className={`${shopStyles.softCard} flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between`}>
              <div>
                <div className={shopStyles.sectionEyebrow}>Before you start</div>
                <h2 className="mt-3 text-xl font-black text-slate-950">Know how reservation, verification, collection, cancellation, and refunds work.</h2>
              </div>
              <Link href={LIPA_POLE_POLE_TERMS_PATH} className={shopStyles.secondaryButton}>Read Terms &amp; Conditions</Link>
            </div>
          </div>
        </section>
      </main>

      <ShopFooter />
      <ShopMobileDock />
    </div>
  );
}
