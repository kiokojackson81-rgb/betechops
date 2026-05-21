import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CategoryScroller from "@/app/shop/_components/CategoryScroller";
import FloatingWhatsApp from "@/app/shop/_components/FloatingWhatsApp";
import ProductCard from "@/app/shop/_components/ProductCard";
import ShopBreadcrumbs from "@/app/shop/_components/ShopBreadcrumbs";
import ShopFooter from "@/app/shop/_components/ShopFooter";
import ShopHeader from "@/app/shop/_components/ShopHeader";
import ShopStatePanel from "@/app/shop/_components/ShopStatePanel";
import { shopStyles } from "@/app/shop/_components/shopStyles";
import { getShopProducts } from "@/app/shop/shopApi";
import { buildShopMetadata } from "@/app/shop/shopMetadata";
import { shopCategories, shopNavLinks } from "@/app/shop/shopData";

function normalizeCategory(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const category = shopCategories.find((item) => item.slug === slug || normalizeCategory(item.title) === slug);

  if (!category) {
    return buildShopMetadata({
      title: "Shop Category",
      description: "Browse solar categories in the Betech Solar online store preview.",
    });
  }

  return buildShopMetadata({
    title: `${category.title}`,
    description: `${category.blurb} Browse this Betech Solar Solutions category and request a quote if you need help sizing the right system.`,
  });
}

export default async function ShopCategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const products = await getShopProducts();
  const category = shopCategories.find((item) => item.slug === slug || normalizeCategory(item.title) === slug);

  if (!category) notFound();

  const categoryProducts = products.filter(
    (product) => normalizeCategory(product.category) === slug || normalizeCategory(product.category) === normalizeCategory(category.title),
  );

  return (
    <div className={shopStyles.page}>
      <ShopHeader navLinks={shopNavLinks} />
      <section className="py-8 sm:py-10">
        <div className={shopStyles.shell}>
          <ShopBreadcrumbs items={[{ label: "Shop", href: "/shop" }, { label: category.title }]} />

          <div className="mt-5 grid gap-5 lg:grid-cols-[1.02fr_0.98fr]">
            <div className={`${shopStyles.lightCard} p-5 sm:p-6`}>
              <div className={shopStyles.sectionEyebrow}>Category</div>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{category.title}</h1>
              <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">{category.blurb}</p>
            </div>
            <div className={`${shopStyles.darkPanel} p-5 sm:p-6`}>
              <div className="inline-flex rounded-full bg-[#fff3d8] px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-[#7a0000]">
                Not sure what you need?
              </div>
              <h2 className="mt-4 text-2xl font-black tracking-tight text-white">Request a solar quote and our team will help size your system.</h2>
              <p className="mt-3 text-sm leading-7 text-white/76">
                If you are not sure which {category.title.toLowerCase()} setup fits your needs, Betech Solar Solutions can guide the right combination.
              </p>
              <div className="mt-5">
                <Link href={`/shop/request-quote?product=${encodeURIComponent(category.title)}`} className={shopStyles.goldButton}>
                  Request Quote
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[0.72fr_1.28fr]">
            <div className={`${shopStyles.softCard} p-5`}>
              <div className="text-sm font-black uppercase tracking-[0.18em] text-[#7a0000]">Filter & Sort</div>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Placeholder UI for future category filtering and sorting. This will stay isolated from live ops data until integration starts.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                <button type="button" className="rounded-2xl border border-[#7a0000]/10 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                  Sort: Featured
                </button>
                <button type="button" className="rounded-2xl border border-[#7a0000]/10 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                  Filter: Brand
                </button>
                <button type="button" className="rounded-2xl border border-[#7a0000]/10 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                  Filter: Price
                </button>
              </div>
            </div>

            <div className="grid gap-4">
              {categoryProducts.length ? (
                <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
                  {categoryProducts.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              ) : (
                <ShopStatePanel
                  eyebrow="Category pending"
                  title="Products will appear here."
                  copy="This category is already planned in the Betech Solar store structure, but its mock products are not populated yet."
                  primaryHref="/shop/request-quote"
                  primaryLabel="Request Quote"
                  secondaryHref="/shop"
                  secondaryLabel="Back to Store"
                />
              )}
            </div>
          </div>

          <div className="pt-12">
            <CategoryScroller categories={shopCategories.slice(0, 6)} />
          </div>
        </div>
      </section>
      <ShopFooter />
      <FloatingWhatsApp />
    </div>
  );
}
