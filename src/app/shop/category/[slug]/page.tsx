import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronDown, Filter, SlidersHorizontal, X } from "lucide-react";
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
import { shopCategories, shopNavLinks, type ShopProduct } from "@/app/shop/shopData";

type CategoryPageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{
    sub?: string;
    brand?: string;
    price?: string;
    stock?: string;
    warranty?: string;
    sort?: string;
  }>;
};

type ListingFilters = {
  sub?: string;
  brand?: string;
  price?: string;
  stock?: string;
  warranty?: string;
  sort?: string;
};

const PRICE_OPTIONS = [
  { value: "under-10000", label: "Under Ksh 10,000" },
  { value: "10000-50000", label: "Ksh 10,000 - 50,000" },
  { value: "50000-150000", label: "Ksh 50,000 - 150,000" },
  { value: "above-150000", label: "Above Ksh 150,000" },
] as const;

const STOCK_OPTIONS = [
  { value: "in_stock", label: "In stock" },
  { value: "limited_stock", label: "Limited stock" },
  { value: "quote_only", label: "Request quote" },
] as const;

const SORT_OPTIONS = [
  { value: "featured", label: "Popularity" },
  { value: "price-low", label: "Price low-high" },
  { value: "price-high", label: "Price high-low" },
  { value: "name", label: "Newest" },
] as const;

function buildCategoryDescription(category: ShopCategoryDefinition, subcategoryLabel?: string | null) {
  if (subcategoryLabel) {
    return `${subcategoryLabel} from Betech Solar Solutions. Browse products in ${category.label} and request a quote if you need help sizing the right system.`;
  }

  return `${category.blurb} Browse this Betech Solar Solutions category and request a quote if you need help sizing the right system.`;
}

function filterByPrice(price: number, bucket?: string) {
  switch (bucket) {
    case "under-10000":
      return price < 10000;
    case "10000-50000":
      return price >= 10000 && price <= 50000;
    case "50000-150000":
      return price > 50000 && price <= 150000;
    case "above-150000":
      return price > 150000;
    default:
      return true;
  }
}

function sortProducts(products: ShopProduct[], sort?: string) {
  const items = [...products];

  switch (sort) {
    case "price-low":
      return items.sort((a, b) => a.price - b.price);
    case "price-high":
      return items.sort((a, b) => b.price - a.price);
    case "name":
      return items.sort((a, b) => a.name.localeCompare(b.name));
    default:
      return items.sort((a, b) => {
        const aDiscount = (a.oldPrice || a.price) - a.price;
        const bDiscount = (b.oldPrice || b.price) - b.price;
        return bDiscount - aDiscount;
      });
  }
}

function getFilterHref(categorySlug: string, filters: ListingFilters, patch: Partial<ListingFilters>) {
  const query = new URLSearchParams();
  const next = {
    sub: filters.sub || "",
    brand: filters.brand || "",
    price: filters.price || "",
    stock: filters.stock || "",
    warranty: filters.warranty || "",
    sort: filters.sort || "",
    ...patch,
  };

  Object.entries(next).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });

  const queryString = query.toString();
  return `/shop/category/${categorySlug}${queryString ? `?${queryString}` : ""}`;
}

function getBrandOptions(products: ShopProduct[]) {
  return Array.from(new Set(products.map((product) => product.brand).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function getWarrantyOptions(products: ShopProduct[]) {
  return Array.from(new Set(products.map((product) => product.warranty).filter(Boolean))).slice(0, 5);
}

function CheckboxLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link href={href} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-sm text-slate-700 transition hover:bg-[#fff7ea] hover:text-[#7a0000]">
      <span
        className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border ${
          active ? "border-[#7a0000] bg-[#7a0000]" : "border-slate-300 bg-white"
        }`}
      >
        {active ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
      </span>
      <span className="line-clamp-1">{label}</span>
    </Link>
  );
}

function ActiveFilterChip({
  label,
  href,
}: {
  label: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-[2rem] items-center gap-1.5 rounded-full border border-[#7a0000]/12 bg-[#fff7ea] px-3 py-1 text-xs font-semibold text-[#7a0000] transition hover:border-[#7a0000]/28"
    >
      {label}
      <X className="h-3.5 w-3.5" />
    </Link>
  );
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

  const filters: ListingFilters = {
    sub: resolvedSearchParams?.sub || "",
    brand: resolvedSearchParams?.brand || "",
    price: resolvedSearchParams?.price || "",
    stock: resolvedSearchParams?.stock || "",
    warranty: resolvedSearchParams?.warranty || "",
    sort: resolvedSearchParams?.sort || "featured",
  };

  const activeSubcategory = getShopSubcategoryDefinition(category.value, filters.sub || "");
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

  const brandOptions = getBrandOptions(categoryProducts);
  const warrantyOptions = getWarrantyOptions(categoryProducts);

  const filteredProducts = sortProducts(
    categoryProducts.filter((product) => {
      if (filters.brand && product.brand !== filters.brand) return false;
      if (!filterByPrice(product.price, filters.price)) return false;
      if (filters.stock && product.stockStatus !== filters.stock) return false;
      if (filters.warranty && product.warranty !== filters.warranty) return false;
      return true;
    }),
    filters.sort,
  );

  const activeChips = [
    activeSubcategory ? { label: activeSubcategory.label, href: getFilterHref(category.value, filters, { sub: "" }) } : null,
    filters.brand ? { label: filters.brand, href: getFilterHref(category.value, filters, { brand: "" }) } : null,
    filters.price ? { label: PRICE_OPTIONS.find((option) => option.value === filters.price)?.label || filters.price, href: getFilterHref(category.value, filters, { price: "" }) } : null,
    filters.stock ? { label: STOCK_OPTIONS.find((option) => option.value === filters.stock)?.label || filters.stock, href: getFilterHref(category.value, filters, { stock: "" }) } : null,
    filters.warranty ? { label: filters.warranty, href: getFilterHref(category.value, filters, { warranty: "" }) } : null,
  ].filter(Boolean) as Array<{ label: string; href: string }>;

  return (
    <div className={shopStyles.page}>
      <ShopHeader navLinks={shopNavLinks} />
      <section className="py-4 sm:py-5">
        <div className={shopStyles.shell}>
          <ShopBreadcrumbs
            items={[
              { label: "Shop", href: "/shop" },
              { label: category.label },
              ...(activeSubcategory ? [{ label: activeSubcategory.label }] : []),
            ]}
          />

          <div className="mt-3 rounded-[18px] border border-[#7a0000]/10 bg-white px-4 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#7a0000]">Category</div>
                <h1 className="mt-1.5 text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
                  {activeSubcategory ? activeSubcategory.label : category.label}
                </h1>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Shop genuine solar products with warranty support, Nairobi pickup, and countrywide delivery.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-[auto_auto] sm:items-center">
                <div className="text-sm font-semibold text-slate-600">{filteredProducts.length} products found</div>
                <form className="flex items-center gap-2 rounded-full border border-[#7a0000]/10 bg-[#fcfaf7] px-3 py-1.5">
                  <label htmlFor="sort" className="text-xs font-semibold text-slate-500">
                    Sort by
                  </label>
                  <input type="hidden" name="sub" value={filters.sub || ""} />
                  <input type="hidden" name="brand" value={filters.brand || ""} />
                  <input type="hidden" name="price" value={filters.price || ""} />
                  <input type="hidden" name="stock" value={filters.stock || ""} />
                  <input type="hidden" name="warranty" value={filters.warranty || ""} />
                  <select
                    id="sort"
                    name="sort"
                    defaultValue={filters.sort || "featured"}
                    className="bg-transparent text-sm font-semibold text-slate-700 outline-none"
                  >
                    {SORT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="rounded-full bg-[#7a0000] px-2.5 py-1 text-xs font-bold text-white">
                    Apply
                  </button>
                </form>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-[#7a0000]">Related</span>
              <Link
                href={`/shop/category/${category.value}`}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  !activeSubcategory ? "border-[#7a0000] bg-[#7a0000] text-white" : "border-[#7a0000]/10 bg-[#fcfaf7] text-slate-700 hover:text-[#7a0000]"
                }`}
              >
                All {category.label}
              </Link>
              {category.subcategories.slice(0, 6).map((subcategory) => (
                <Link
                  key={subcategory.value}
                  href={getFilterHref(category.value, filters, { sub: subcategory.value })}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    activeSubcategory?.value === subcategory.value
                      ? "border-[#7a0000] bg-[#7a0000] text-white"
                      : "border-[#7a0000]/10 bg-[#fcfaf7] text-slate-700 hover:text-[#7a0000]"
                  }`}
                >
                  {subcategory.label}
                </Link>
              ))}
            </div>
          </div>

          <details className="mt-3 rounded-[16px] border border-[#7a0000]/10 bg-white p-3 shadow-[0_8px_20px_rgba(15,23,42,0.04)] lg:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold text-slate-900">
              <span className="inline-flex items-center gap-2">
                <Filter className="h-4 w-4 text-[#7a0000]" />
                Filter and sort
              </span>
              <ChevronDown className="h-4 w-4 text-slate-500" />
            </summary>
            <div className="mt-3 grid gap-3">
              <div className="rounded-[14px] border border-[#7a0000]/8 bg-[#fcfaf7] p-3">
                <div className="text-[11px] font-black uppercase tracking-[0.14em] text-[#7a0000]">Subcategories</div>
                <div className="mt-2 grid gap-1">
                  <CheckboxLink href={getFilterHref(category.value, filters, { sub: "" })} label={`All ${category.label}`} active={!activeSubcategory} />
                  {category.subcategories.map((subcategory) => (
                    <CheckboxLink
                      key={subcategory.value}
                      href={getFilterHref(category.value, filters, { sub: subcategory.value })}
                      label={subcategory.label}
                      active={activeSubcategory?.value === subcategory.value}
                    />
                  ))}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[14px] border border-[#7a0000]/8 bg-[#fcfaf7] p-3">
                  <div className="text-[11px] font-black uppercase tracking-[0.14em] text-[#7a0000]">Brand</div>
                  <div className="mt-2 grid gap-1">
                    {brandOptions.map((brand) => (
                      <CheckboxLink key={brand} href={getFilterHref(category.value, filters, { brand })} label={brand} active={filters.brand === brand} />
                    ))}
                  </div>
                </div>
                <div className="rounded-[14px] border border-[#7a0000]/8 bg-[#fcfaf7] p-3">
                  <div className="text-[11px] font-black uppercase tracking-[0.14em] text-[#7a0000]">Price</div>
                  <div className="mt-2 grid gap-1">
                    {PRICE_OPTIONS.map((option) => (
                      <CheckboxLink
                        key={option.value}
                        href={getFilterHref(category.value, filters, { price: option.value })}
                        label={option.label}
                        active={filters.price === option.value}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </details>

          <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)]">
            <aside className="hidden lg:block">
              <div className="sticky top-24 rounded-[18px] border border-[#7a0000]/10 bg-white p-4 shadow-[0_14px_30px_rgba(15,23,42,0.05)]">
                <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.14em] text-[#7a0000]">
                  <SlidersHorizontal className="h-4 w-4" />
                  Filters
                </div>

                <div className="mt-4 grid gap-4 text-sm">
                  <div>
                    <div className="font-black uppercase tracking-[0.14em] text-slate-900">Category</div>
                    <div className="mt-2 rounded-[14px] border border-[#7a0000]/8 bg-[#fcfaf7] p-2">
                      <CheckboxLink href={getFilterHref(category.value, filters, { sub: "" })} label={category.label} active={!activeSubcategory} />
                    </div>
                  </div>

                  <div>
                    <div className="font-black uppercase tracking-[0.14em] text-slate-900">Subcategories</div>
                    <div className="mt-2 grid gap-1">
                      {category.subcategories.map((subcategory) => (
                        <CheckboxLink
                          key={subcategory.value}
                          href={getFilterHref(category.value, filters, { sub: subcategory.value })}
                          label={subcategory.label}
                          active={activeSubcategory?.value === subcategory.value}
                        />
                      ))}
                    </div>
                  </div>

                  {brandOptions.length ? (
                    <div>
                      <div className="font-black uppercase tracking-[0.14em] text-slate-900">Brand</div>
                      <div className="mt-2 grid gap-1">
                        {brandOptions.map((brand) => (
                          <CheckboxLink key={brand} href={getFilterHref(category.value, filters, { brand })} label={brand} active={filters.brand === brand} />
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div>
                    <div className="font-black uppercase tracking-[0.14em] text-slate-900">Price</div>
                    <div className="mt-2 grid gap-1">
                      {PRICE_OPTIONS.map((option) => (
                        <CheckboxLink
                          key={option.value}
                          href={getFilterHref(category.value, filters, { price: option.value })}
                          label={option.label}
                          active={filters.price === option.value}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="font-black uppercase tracking-[0.14em] text-slate-900">Stock</div>
                    <div className="mt-2 grid gap-1">
                      {STOCK_OPTIONS.map((option) => (
                        <CheckboxLink
                          key={option.value}
                          href={getFilterHref(category.value, filters, { stock: option.value })}
                          label={option.label}
                          active={filters.stock === option.value}
                        />
                      ))}
                    </div>
                  </div>

                  {warrantyOptions.length ? (
                    <div>
                      <div className="font-black uppercase tracking-[0.14em] text-slate-900">Warranty</div>
                      <div className="mt-2 grid gap-1">
                        {warrantyOptions.map((warranty) => (
                          <CheckboxLink
                            key={warranty}
                            href={getFilterHref(category.value, filters, { warranty })}
                            label={warranty}
                            active={filters.warranty === warranty}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </aside>

            <div className="grid gap-3">
              {activeChips.length ? (
                <div className="flex flex-wrap gap-2 rounded-[16px] border border-[#7a0000]/8 bg-white px-3 py-2 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
                  {activeChips.map((chip) => (
                    <ActiveFilterChip key={chip.label} label={chip.label} href={chip.href} />
                  ))}
                  <Link href={`/shop/category/${category.value}`} className="inline-flex min-h-[2rem] items-center text-xs font-bold text-slate-500 transition hover:text-[#7a0000]">
                    Clear all
                  </Link>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
                {filteredProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              {!filteredProducts.length ? (
                <ShopStatePanel
                  eyebrow="No matching products"
                  title="Adjust your filters."
                  copy="No products match this filter set yet. Try another subcategory or clear the selected filters to keep browsing the Betech Solar catalogue."
                  primaryHref={`/shop/category/${category.value}`}
                  primaryLabel={`View all ${category.label}`}
                  secondaryHref={`/shop/request-quote?product=${encodeURIComponent(activeSubcategory?.label || category.label)}`}
                  secondaryLabel="Request Quote"
                />
              ) : null}

              <div className={`${shopStyles.darkPanel} mt-1 p-4 sm:p-5`}>
                <div className="inline-flex rounded-full bg-[#fff3d8] px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-[#7a0000]">
                  Need sizing help?
                </div>
                <h2 className="mt-3 text-lg font-black tracking-tight text-white sm:text-xl">
                  Get help choosing the right inverter, battery and panels.
                </h2>
                <p className="mt-2 text-sm leading-6 text-white/78">
                  Our solar team can guide the right system for home backup, biashara, water pumping or security lighting.
                </p>
                <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
                  <Link
                    href={`/shop/request-quote?product=${encodeURIComponent(activeSubcategory?.label || category.label)}`}
                    className={shopStyles.goldButton}
                  >
                    Request Quote
                  </Link>
                  <Link href="/shop" className={`${shopStyles.secondaryButton} bg-white/92`}>
                    Continue shopping
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-5">
            <CategoryScroller categories={shopCategories.slice(0, 6)} />
          </div>
        </div>
      </section>
      <ShopFooter />
      <FloatingWhatsApp />
    </div>
  );
}
