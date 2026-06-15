import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ChevronDown, Filter, SlidersHorizontal, X } from "lucide-react";
import FloatingWhatsApp from "@/app/shop/_components/FloatingWhatsApp";
import ShopMobileCatalogueActions from "@/app/shop/_components/ShopMobileCatalogueActions";
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
import { shopNavLinks, type ShopProduct } from "@/app/shop/shopData";
import { getShopCategoryHref, getShopRequestQuoteHref } from "@/app/shop/storefrontPaths";
import {
  compareProductsByLatest,
  compareProductsByPopularity,
  getPopularitySignalsForProducts,
  type ProductPopularitySignal,
} from "@/lib/productPopularity";

type CategoryPageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{
    sub?: string;
    brand?: string;
    price?: string;
    minPrice?: string;
    maxPrice?: string;
    stock?: string;
    warranty?: string;
    sort?: string;
  }>;
};

type ListingFilters = {
  sub?: string;
  brand?: string;
  price?: string;
  minPrice?: string;
  maxPrice?: string;
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
  { value: "latest", label: "Latest" },
  { value: "price-low", label: "Price: Low to High" },
  { value: "price-high", label: "Price: High to Low" },
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

function normalizePriceRange(minPrice?: string, maxPrice?: string) {
  const parsedMin = Number(minPrice);
  const parsedMax = Number(maxPrice);
  const hasMin = Number.isFinite(parsedMin) && parsedMin >= 0;
  const hasMax = Number.isFinite(parsedMax) && parsedMax >= 0;

  if (hasMin && hasMax) {
    return {
      min: Math.min(parsedMin, parsedMax),
      max: Math.max(parsedMin, parsedMax),
    };
  }

  return {
    min: hasMin ? parsedMin : undefined,
    max: hasMax ? parsedMax : undefined,
  };
}

function filterByManualPrice(price: number, minPrice?: number, maxPrice?: number) {
  if (typeof minPrice === "number" && price < minPrice) return false;
  if (typeof maxPrice === "number" && price > maxPrice) return false;
  return true;
}

function formatPriceInput(value?: string) {
  if (!value) return "";
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? String(parsed) : "";
}

function formatPriceRangeLabel(minPrice?: number, maxPrice?: number) {
  const money = (value: number) => `Ksh ${new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 }).format(value)}`;
  if (typeof minPrice === "number" && typeof maxPrice === "number") {
    return `${money(minPrice)} - ${money(maxPrice)}`;
  }
  if (typeof minPrice === "number") return `From ${money(minPrice)}`;
  if (typeof maxPrice === "number") return `Up to ${money(maxPrice)}`;
  return "";
}

function sortProducts(
  products: ShopProduct[],
  popularitySignals: Map<string, ProductPopularitySignal>,
  sort?: string,
) {
  const items = [...products];

  switch (sort) {
    case "price-low":
      return items.sort((a, b) => a.price - b.price);
    case "price-high":
      return items.sort((a, b) => b.price - a.price);
    case "latest":
    case "name":
      return items.sort((a, b) => compareProductsByLatest(a, b, popularitySignals));
    default:
      return items.sort((a, b) => compareProductsByPopularity(a, b, popularitySignals));
  }
}

function getFilterHref(categorySlug: string, filters: ListingFilters, patch: Partial<ListingFilters>) {
  const query = new URLSearchParams();
  const next = {
    sub: filters.sub || "",
    brand: filters.brand || "",
    price: filters.price || "",
    minPrice: filters.minPrice || "",
    maxPrice: filters.maxPrice || "",
    stock: filters.stock || "",
    warranty: filters.warranty || "",
    sort: filters.sort || "",
    ...patch,
  };

  Object.entries(next).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });

  const queryString = query.toString();
  return `${getShopCategoryHref(categorySlug)}${queryString ? `?${queryString}` : ""}`;
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
  nested = false,
}: {
  href: string;
  label: string;
  active: boolean;
  nested?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 rounded-md px-1.5 py-1 text-xs text-slate-700 transition hover:text-[#7a0000] ${nested ? "pl-4" : ""}`}
    >
      <span
        className={`inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border ${
          active ? "border-[#7a0000] bg-[#7a0000]" : "border-slate-300 bg-white"
        }`}
      >
        {active ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
      </span>
      <span className="line-clamp-1">{label}</span>
    </Link>
  );
}

function ActiveFilterChip({ label, href }: { label: string; href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-[1.85rem] items-center gap-1 rounded-full border border-[#7a0000]/10 bg-[#fff7ea] px-2.5 py-1 text-[11px] font-semibold text-[#7a0000]"
    >
      {label}
      <X className="h-3 w-3" />
    </Link>
  );
}

function FilterSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="border-b border-[#7a0000]/8 pb-3 last:border-b-0 last:pb-0">
      <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-900">{title}</div>
      <div className="mt-2 grid gap-0.5">{children}</div>
    </div>
  );
}

export async function generateMetadata({ params, searchParams }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const category = getShopCategoryDefinition(slug);

  if (!category) {
    return buildShopMetadata({
      title: "Shop Category",
      description: "Browse solar categories in the Betech Solar online store.",
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
    minPrice: resolvedSearchParams?.minPrice || "",
    maxPrice: resolvedSearchParams?.maxPrice || "",
    stock: resolvedSearchParams?.stock || "",
    warranty: resolvedSearchParams?.warranty || "",
    sort: resolvedSearchParams?.sort || "featured",
  };
  const manualPriceRange = normalizePriceRange(filters.minPrice, filters.maxPrice);

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
  const popularitySignals = await getPopularitySignalsForProducts(categoryProducts);

  const filteredProducts = sortProducts(
    categoryProducts.filter((product) => {
      if (filters.brand && product.brand !== filters.brand) return false;
      if (!filterByPrice(product.price, filters.price)) return false;
      if (!filterByManualPrice(product.price, manualPriceRange.min, manualPriceRange.max)) return false;
      if (filters.stock && product.stockStatus !== filters.stock) return false;
      if (filters.warranty && product.warranty !== filters.warranty) return false;
      return true;
    }),
    popularitySignals,
    filters.sort,
  );

  const activeChips = [
    activeSubcategory ? { label: activeSubcategory.label, href: getFilterHref(category.value, filters, { sub: "" }) } : null,
    filters.brand ? { label: filters.brand, href: getFilterHref(category.value, filters, { brand: "" }) } : null,
    filters.price ? { label: PRICE_OPTIONS.find((option) => option.value === filters.price)?.label || filters.price, href: getFilterHref(category.value, filters, { price: "" }) } : null,
    manualPriceRange.min !== undefined || manualPriceRange.max !== undefined
      ? { label: formatPriceRangeLabel(manualPriceRange.min, manualPriceRange.max), href: getFilterHref(category.value, filters, { minPrice: "", maxPrice: "" }) }
      : null,
    filters.stock ? { label: STOCK_OPTIONS.find((option) => option.value === filters.stock)?.label || filters.stock, href: getFilterHref(category.value, filters, { stock: "" }) } : null,
    filters.warranty ? { label: filters.warranty, href: getFilterHref(category.value, filters, { warranty: "" }) } : null,
  ].filter(Boolean) as Array<{ label: string; href: string }>;

  return (
    <div className={`${shopStyles.page} pb-28 lg:pb-0`}>
      <ShopHeader navLinks={shopNavLinks} />
      <section className="py-2.5 sm:py-4">
        <div className={shopStyles.shell}>
          <ShopBreadcrumbs
            items={[
              { label: "Shop", href: "/shop" },
              { label: category.label },
              ...(activeSubcategory ? [{ label: activeSubcategory.label }] : []),
            ]}
          />

          <details id="mobile-category-filters" className="mt-2 rounded-[14px] border border-[#7a0000]/10 bg-white px-3 py-2.5 shadow-[0_6px_16px_rgba(15,23,42,0.04)] lg:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold text-slate-900">
              <span className="inline-flex items-center gap-2">
                <Filter className="h-4 w-4 text-[#7a0000]" />
                Filter / Sort
              </span>
              <ChevronDown className="h-4 w-4 text-slate-500" />
            </summary>
            <div className="mt-3 grid gap-3">
              <div id="mobile-category-sort">
                <FilterSection title="Sort">
                  <form method="GET" className="grid gap-2 rounded-xl border border-[#7a0000]/10 bg-[#fcfaf7] p-2.5">
                    <input type="hidden" name="sub" value={filters.sub || ""} />
                    <input type="hidden" name="brand" value={filters.brand || ""} />
                    <input type="hidden" name="price" value={filters.price || ""} />
                    <input type="hidden" name="minPrice" value={filters.minPrice || ""} />
                    <input type="hidden" name="maxPrice" value={filters.maxPrice || ""} />
                    <input type="hidden" name="stock" value={filters.stock || ""} />
                    <input type="hidden" name="warranty" value={filters.warranty || ""} />
                    <select
                      name="sort"
                      defaultValue={filters.sort || "featured"}
                      className="rounded-xl border border-[#7a0000]/10 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none"
                    >
                      {SORT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="rounded-xl bg-[#7a0000] px-3 py-2 text-sm font-bold text-white">
                      Apply sort
                    </button>
                  </form>
                </FilterSection>
              </div>
              <div id="mobile-category-filter-section">
              <FilterSection title="Category">
                <CheckboxLink href={getFilterHref(category.value, filters, { sub: "" })} label={category.label} active={!activeSubcategory} />
                {category.subcategories.map((subcategory) => (
                  <CheckboxLink
                    key={subcategory.value}
                    href={getFilterHref(category.value, filters, { sub: subcategory.value })}
                    label={subcategory.label}
                    active={activeSubcategory?.value === subcategory.value}
                    nested
                  />
                ))}
              </FilterSection>
              </div>
              {brandOptions.length ? (
                <FilterSection title="Brand">
                  {brandOptions.map((brand) => (
                    <CheckboxLink key={brand} href={getFilterHref(category.value, filters, { brand })} label={brand} active={filters.brand === brand} />
                  ))}
                </FilterSection>
              ) : null}
              <FilterSection title="Price">
                {PRICE_OPTIONS.map((option) => (
                  <CheckboxLink
                    key={option.value}
                    href={getFilterHref(category.value, filters, { price: option.value })}
                    label={option.label}
                    active={filters.price === option.value}
                  />
                ))}
                <form method="GET" className="mt-2 grid gap-2 rounded-xl border border-[#7a0000]/10 bg-[#fcfaf7] p-2.5">
                  <input type="hidden" name="sub" value={filters.sub || ""} />
                  <input type="hidden" name="brand" value={filters.brand || ""} />
                  <input type="hidden" name="price" value={filters.price || ""} />
                  <input type="hidden" name="stock" value={filters.stock || ""} />
                  <input type="hidden" name="warranty" value={filters.warranty || ""} />
                  <input type="hidden" name="sort" value={filters.sort || "featured"} />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      name="minPrice"
                      min="0"
                      defaultValue={formatPriceInput(filters.minPrice)}
                      placeholder="Min Ksh"
                      className="rounded-xl border border-[#7a0000]/10 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none"
                    />
                    <input
                      type="number"
                      name="maxPrice"
                      min="0"
                      defaultValue={formatPriceInput(filters.maxPrice)}
                      placeholder="Max Ksh"
                      className="rounded-xl border border-[#7a0000]/10 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none"
                    />
                  </div>
                  <button type="submit" className="rounded-xl bg-[#7a0000] px-3 py-2 text-sm font-bold text-white">
                    Apply range
                  </button>
                </form>
              </FilterSection>
              <FilterSection title="Stock">
                {STOCK_OPTIONS.map((option) => (
                  <CheckboxLink
                    key={option.value}
                    href={getFilterHref(category.value, filters, { stock: option.value })}
                    label={option.label}
                    active={filters.stock === option.value}
                  />
                ))}
              </FilterSection>
            </div>
          </details>

          <div className="mt-3 grid items-start gap-3 lg:grid-cols-[250px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)]">
            <aside className="hidden lg:block">
              <div className="sticky top-24 rounded-[14px] border border-[#7a0000]/10 bg-white p-3 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#7a0000]">
                  <SlidersHorizontal className="h-4 w-4" />
                  Filters
                </div>

                <div className="grid gap-3">
                  <FilterSection title="Category">
                    <CheckboxLink href={getFilterHref(category.value, filters, { sub: "" })} label={category.label} active={!activeSubcategory} />
                    {category.subcategories.map((subcategory) => (
                      <CheckboxLink
                        key={subcategory.value}
                        href={getFilterHref(category.value, filters, { sub: subcategory.value })}
                        label={subcategory.label}
                        active={activeSubcategory?.value === subcategory.value}
                        nested
                      />
                    ))}
                  </FilterSection>

                  {brandOptions.length ? (
                    <FilterSection title="Brand">
                      {brandOptions.map((brand) => (
                        <CheckboxLink key={brand} href={getFilterHref(category.value, filters, { brand })} label={brand} active={filters.brand === brand} />
                      ))}
                    </FilterSection>
                  ) : null}

                  <FilterSection title="Price">
                    {PRICE_OPTIONS.map((option) => (
                      <CheckboxLink
                        key={option.value}
                        href={getFilterHref(category.value, filters, { price: option.value })}
                        label={option.label}
                        active={filters.price === option.value}
                      />
                    ))}
                    <form method="GET" className="mt-2 grid gap-2 rounded-xl border border-[#7a0000]/10 bg-[#fcfaf7] p-2.5">
                      <input type="hidden" name="sub" value={filters.sub || ""} />
                      <input type="hidden" name="brand" value={filters.brand || ""} />
                      <input type="hidden" name="price" value={filters.price || ""} />
                      <input type="hidden" name="stock" value={filters.stock || ""} />
                      <input type="hidden" name="warranty" value={filters.warranty || ""} />
                      <input type="hidden" name="sort" value={filters.sort || "featured"} />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          name="minPrice"
                          min="0"
                          defaultValue={formatPriceInput(filters.minPrice)}
                          placeholder="Min Ksh"
                          className="rounded-xl border border-[#7a0000]/10 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none"
                        />
                        <input
                          type="number"
                          name="maxPrice"
                          min="0"
                          defaultValue={formatPriceInput(filters.maxPrice)}
                          placeholder="Max Ksh"
                          className="rounded-xl border border-[#7a0000]/10 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none"
                        />
                      </div>
                      <button type="submit" className="rounded-xl bg-[#7a0000] px-3 py-2 text-sm font-bold text-white">
                        Apply range
                      </button>
                    </form>
                  </FilterSection>

                  <FilterSection title="Stock">
                    {STOCK_OPTIONS.map((option) => (
                      <CheckboxLink
                        key={option.value}
                        href={getFilterHref(category.value, filters, { stock: option.value })}
                        label={option.label}
                        active={filters.stock === option.value}
                      />
                    ))}
                  </FilterSection>

                  {warrantyOptions.length ? (
                    <FilterSection title="Warranty">
                      {warrantyOptions.map((warranty) => (
                        <CheckboxLink
                          key={warranty}
                          href={getFilterHref(category.value, filters, { warranty })}
                          label={warranty}
                          active={filters.warranty === warranty}
                        />
                      ))}
                    </FilterSection>
                  ) : null}
                </div>
              </div>
            </aside>

            <div className="min-w-0">
              <div className="rounded-[16px] border border-[#7a0000]/10 bg-white px-3 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.04)] sm:rounded-[14px]">
                <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h1 className="text-lg font-black tracking-tight text-slate-950 sm:text-xl">
                      {activeSubcategory ? activeSubcategory.label : category.label}
                    </h1>
                    <div className="mt-0.5 text-xs font-semibold text-slate-500">{filteredProducts.length} products found</div>
                  </div>

                  <form id="desktop-category-sort" className="hidden flex-wrap items-center gap-2 rounded-md border border-[#7a0000]/10 bg-[#fcfaf7] px-2.5 py-2 sm:flex-nowrap sm:py-1.5 lg:flex">
                    <label htmlFor="sort" className="text-xs font-semibold text-slate-500">
                      Sort by
                    </label>
                    <input type="hidden" name="sub" value={filters.sub || ""} />
                    <input type="hidden" name="brand" value={filters.brand || ""} />
                    <input type="hidden" name="price" value={filters.price || ""} />
                    <input type="hidden" name="minPrice" value={filters.minPrice || ""} />
                    <input type="hidden" name="maxPrice" value={filters.maxPrice || ""} />
                    <input type="hidden" name="stock" value={filters.stock || ""} />
                    <input type="hidden" name="warranty" value={filters.warranty || ""} />
                    <select
                      id="sort"
                      name="sort"
                      defaultValue={filters.sort || "featured"}
                      className="bg-transparent text-xs font-semibold text-slate-700 outline-none sm:text-sm"
                    >
                      {SORT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="w-full rounded-md bg-[#7a0000] px-2 py-1.5 text-[11px] font-bold text-white sm:w-auto sm:py-1">
                      Apply
                    </button>
                  </form>
                </div>

                <div className="mt-2.5 -mx-1 flex flex-nowrap items-center gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
                  <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[#7a0000]">Related</span>
                  <Link
                    href={getShopCategoryHref(category.value)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                      !activeSubcategory ? "border-[#7a0000] bg-[#7a0000] text-white" : "border-[#7a0000]/10 bg-[#fcfaf7] text-slate-700 hover:text-[#7a0000]"
                    }`}
                  >
                    All
                  </Link>
                  {category.subcategories.slice(0, 6).map((subcategory) => (
                    <Link
                      key={subcategory.value}
                      href={getFilterHref(category.value, filters, { sub: subcategory.value })}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                        activeSubcategory?.value === subcategory.value
                          ? "border-[#7a0000] bg-[#7a0000] text-white"
                          : "border-[#7a0000]/10 bg-[#fcfaf7] text-slate-700 hover:text-[#7a0000]"
                      }`}
                    >
                      {subcategory.label}
                    </Link>
                  ))}
                </div>

                {activeChips.length ? (
                  <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-[#7a0000]/8 pt-2.5">
                    {activeChips.map((chip) => (
                      <ActiveFilterChip key={chip.label} label={chip.label} href={chip.href} />
                    ))}
                    <Link href={getShopCategoryHref(category.value)} className="inline-flex min-h-[1.85rem] items-center text-[11px] font-bold text-slate-500 hover:text-[#7a0000]">
                      Clear all
                    </Link>
                  </div>
                ) : null}
              </div>

              {filteredProducts.length ? (
                <div className="mt-3 grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
                  {filteredProducts.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              ) : (
                <div className="mt-3">
                  <ShopStatePanel
                    eyebrow="No matching products"
                    title="Adjust your filters."
                    copy="No products match this filter set yet. Try another subcategory or clear the selected filters to keep browsing the Betech Solar catalogue."
                    primaryHref={getShopCategoryHref(category.value)}
                    primaryLabel={`View all ${category.label}`}
                    secondaryHref={getShopRequestQuoteHref(activeSubcategory?.label || category.label)}
                    secondaryLabel="Request Quote"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
      <ShopFooter />
      <ShopMobileCatalogueActions filterTargetId="mobile-category-filter-section" sortTargetId="mobile-category-sort" />
      <FloatingWhatsApp hideOnMobile />
    </div>
  );
}
