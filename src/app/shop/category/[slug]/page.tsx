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
import {
  getShopCategoryDefinition,
  getShopSubcategoryDefinition,
  type ShopCategoryDefinition,
} from "@/app/shop/shopCatalogConfig";
import { getShopProducts } from "@/app/shop/shopApi";
import { buildShopMetadata } from "@/app/shop/shopMetadata";
import { shopCategories, shopNavLinks } from "@/app/shop/shopData";

type CategoryPageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ sub?: string }>;
};

function buildCategoryDescription(category: ShopCategoryDefinition, subcategoryLabel?: string | null) {
  if (subcategoryLabel) {
    return `${subcategoryLabel} from Betech Solar Solutions. Browse products in ${category.label} and request a quote if you need help sizing the right system.`;
  }

  return `${category.blurb} Browse this Betech Solar Solutions category and request a quote if you need help sizing the right system.`;
}

export async function generateMetadata({ params, searchParams }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const category = getShopCategoryDefinition(slug);

  if (!category) {
    return buildShopMetadata({
      title: "Shop Category",
      description: "Browse solar categories in the Betech Solar online store preview.",
    });
  }

  const subcategory = getShopSubcategoryDefinition(category.value, resolvedSearchParams?.sub || "");
  const title = subcategory ? `${subcategory.label} | ${category.label}` : category.label;

  return buildShopMetadata({
    title,
    description: buildCategoryDescription(category, subcategory?.label),
  });
}

export default async function ShopCategoryPage({ params, searchParams }: CategoryPageProps) {
  const { slug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const category = getShopCategoryDefinition(slug);

  if (!category) notFound();

  const activeSubcategory = getShopSubcategoryDefinition(category.value, resolvedSearchParams?.sub || "");
  const products = await getShopProducts({
    category: category.value,
    subcategory: activeSubcategory?.value,
  });
  const categoryProducts = products.filter((product) => {
    if (product.category.toLowerCase() !== category.label.toLowerCase()) return false;
    if (!activeSubcategory) return true;

    const normalizedSubcategory = activeSubcategory.label.toLowerCase();
    return (
      String(product.subcategory || "").toLowerCase() === normalizedSubcategory ||
      product.tags.some((tag) => tag.toLowerCase() === activeSubcategory.value.toLowerCase() || tag.toLowerCase() === normalizedSubcategory)
    );
  });

  return (
    <div className={shopStyles.page}>
      <ShopHeader navLinks={shopNavLinks} />
      <section className="py-5 sm:py-6">
        <div className={shopStyles.shell}>
          <ShopBreadcrumbs
            items={[
              { label: "Shop", href: "/shop" },
              { label: category.label },
              ...(activeSubcategory ? [{ label: activeSubcategory.label }] : []),
            ]}
          />

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
            <div className={`${shopStyles.lightCard} p-4 sm:p-5`}>
              <div className={shopStyles.sectionEyebrow}>Category</div>
              <h1 className="mt-2.5 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                {activeSubcategory ? activeSubcategory.label : category.label}
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">{buildCategoryDescription(category, activeSubcategory?.label)}</p>

              {category.subcategories.length ? (
                <div className="mt-4">
                  <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#7a0000]">Browse subcategories</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Link
                      href={`/shop/category/${category.value}`}
                      className={`inline-flex min-h-[2.3rem] items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition sm:text-sm ${
                        !activeSubcategory
                          ? "border-[#7a0000] bg-[#7a0000] text-white"
                          : "border-[#7a0000]/10 bg-white text-slate-700 hover:border-[#7a0000]/25 hover:text-[#7a0000]"
                      }`}
                    >
                      All {category.label}
                    </Link>
                    {category.subcategories.map((subcategory) => (
                      <Link
                        key={subcategory.value}
                        href={`/shop/category/${category.value}?sub=${subcategory.value}`}
                        className={`inline-flex min-h-[2.3rem] items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition sm:text-sm ${
                          activeSubcategory?.value === subcategory.value
                            ? "border-[#7a0000] bg-[#7a0000] text-white"
                            : "border-[#7a0000]/10 bg-white text-slate-700 hover:border-[#7a0000]/25 hover:text-[#7a0000]"
                        }`}
                      >
                        {subcategory.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className={`${shopStyles.darkPanel} p-4 sm:p-5`}>
              <div className="inline-flex rounded-full bg-[#fff3d8] px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-[#7a0000]">
                Request Quote
              </div>
              <h2 className="mt-3 text-xl font-black tracking-tight text-white sm:text-2xl">
                Get help choosing the right inverter, battery and panels.
              </h2>
              <p className="mt-2 text-sm leading-6 text-white/78">
                Not sure which {activeSubcategory?.label.toLowerCase() || category.label.toLowerCase()} product fits your home, biashara or pumping setup? Our solar team can guide you.
              </p>
              <div className="mt-4">
                <Link
                  href={`/shop/request-quote?product=${encodeURIComponent(activeSubcategory?.label || category.label)}`}
                  className={shopStyles.goldButton}
                >
                  Request Quote
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[0.78fr_1.22fr]">
            <div className={`${shopStyles.softCard} p-4`}>
              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#7a0000]">Filter and sort</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Filter chips are active for subcategories. Brand, price and stock sorting can plug into ops catalogue filters later without changing the route structure.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
                <button type="button" className="rounded-2xl border border-[#7a0000]/10 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">
                  Sort: Featured
                </button>
                <button type="button" className="rounded-2xl border border-[#7a0000]/10 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">
                  Filter: Brand
                </button>
                <button type="button" className="rounded-2xl border border-[#7a0000]/10 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">
                  Filter: Price
                </button>
              </div>
            </div>

            <div className="grid gap-4">
              {categoryProducts.length ? (
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 xl:grid-cols-4">
                  {categoryProducts.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              ) : (
                <ShopStatePanel
                  eyebrow="Category pending"
                  title="Products will appear here."
                  copy="This category structure is ready for Betech Solar ecommerce. Add or enable matching products in POS Catalogue, then review catalogue preview before switching customers to live ops mode."
                  primaryHref="/shop/request-quote"
                  primaryLabel="Request Quote"
                  secondaryHref="/shop"
                  secondaryLabel="Back to Store"
                />
              )}
            </div>
          </div>

          <div className="pt-6">
            <CategoryScroller categories={shopCategories.slice(0, 6)} />
          </div>
        </div>
      </section>
      <ShopFooter />
      <FloatingWhatsApp />
    </div>
  );
}
