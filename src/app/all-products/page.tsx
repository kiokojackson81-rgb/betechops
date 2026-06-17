import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronDown, Filter, SlidersHorizontal, X } from "lucide-react";
import FloatingWhatsApp from "@/app/shop/_components/FloatingWhatsApp";
import ProductCard from "@/app/shop/_components/ProductCard";
import ShopBreadcrumbs from "@/app/shop/_components/ShopBreadcrumbs";
import ShopFooter from "@/app/shop/_components/ShopFooter";
import ShopHeader from "@/app/shop/_components/ShopHeader";
import ShopMobileCatalogueActions from "@/app/shop/_components/ShopMobileCatalogueActions";
import ShopStatePanel from "@/app/shop/_components/ShopStatePanel";
import { shopStyles } from "@/app/shop/_components/shopStyles";
import {
  getShopCategoryDefinition,
  getShopSubcategoryDefinition,
  SHOP_CATEGORY_DEFINITIONS,
} from "@/app/shop/shopCatalogConfig";
import { getShopProducts } from "@/app/shop/shopApi";
import { buildShopMetadata } from "@/app/shop/shopMetadata";
import { shopNavLinks, type ShopProduct } from "@/app/shop/shopData";
import { SHOP_ALL_PRODUCTS_HREF, SHOP_HOME_HREF, getShopRequestQuoteHref } from "@/app/shop/storefrontPaths";
import {
  compareProductsByLatest,
  compareProductsByPopularity,
  getPopularitySignalsForProducts,
  type ProductPopularitySignal,
} from "@/lib/productPopularity";

type AllProductsPageProps = {
  searchParams?: Promise<{
    category?: string;
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
  category?: string;
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
  { value: "featured", label: "Most popular" },
  { value: "latest", label: "Latest" },
  { value: "price-low", label: "Price: Low to High" },
  { value: "price-high", label: "Price: High to Low" },
] as const;

function normalizeSortValue(sort?: string) {
  return sort && sort !== "featured" ? sort : "";
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
  const normalizedMin = minPrice?.trim();
  const normalizedMax = maxPrice?.trim();
  const parsedMin = normalizedMin ? Number(normalizedMin) : Number.NaN;
  const parsedMax = normalizedMax ? Number(normalizedMax) : Number.NaN;
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

function sortProducts(products: ShopProduct[], popularitySignals: Map<string, ProductPopularitySignal>, sort?: string) {
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

function getFilterHref(filters: ListingFilters, patch: Partial<ListingFilters>) {
  const query = new URLSearchParams();
  const next = {
    category: filters.category || "",
    sub: filters.sub || "",
    brand: filters.brand || "",
    price: filters.price || "",
    minPrice: filters.minPrice || "",
    maxPrice: filters.maxPrice || "",
    stock: filters.stock || "",
    warranty: filters.warranty || "",
    sort: normalizeSortValue(filters.sort),
    ...patch,
  };

  if (!next.category) {
    next.sub = "";
  } else if (patch.category && patch.category !== filters.category) {
    next.sub = "";
  }

  Object.entries(next).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });

  const queryString = query.toString();
  return `${SHOP_ALL_PRODUCTS_HREF}${queryString ? `?${queryString}` : ""}`;
}

function getBrandOptions(products: ShopProduct[]) {
  return Array.from(new Set(products.map((product) => product.brand).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function getWarrantyOptions(products: ShopProduct[]) {
  return Array.from(new Set(products.map((product) => product.warranty).filter(Boolean))).slice(0, 8);
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

export async function generateMetadata(): Promise<Metadata> {
  return buildShopMetadata({
    title: "All Products",
    description:
      "Browse all Betech Solar products in one place, with filters for category, brand, price, stock and warranty.",
  });
}

export default async function AllProductsPage({ searchParams }: AllProductsPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const filters: ListingFilters = {
    category: resolvedSearchParams?.category || "",
    sub: resolvedSearchParams?.sub || "",
    brand: resolvedSearchParams?.brand || "",
    price: resolvedSearchParams?.price || "",
    minPrice: resolvedSearchParams?.minPrice || "",
    maxPrice: resolvedSearchParams?.maxPrice || "",
    stock: resolvedSearchParams?.stock || "",
    warranty: resolvedSearchParams?.warranty || "",
    sort: normalizeSortValue(resolvedSearchParams?.sort),
  };
  const manualPriceRange = normalizePriceRange(filters.minPrice, filters.maxPrice);

  const activeCategory = getShopCategoryDefinition(filters.category || "");
  const activeSubcategory = activeCategory ? getShopSubcategoryDefinition(activeCategory.value, filters.sub || "") : null;

  const products = await getShopProducts({
    category: activeCategory?.value,
    subcategory: activeSubcategory?.value,
  });

  const categoryScopedProducts = products.filter((product) => {
    if (!activeCategory) return true;
    if (String(product.category || "").toLowerCase() !== activeCategory.label.toLowerCase()) return false;
    if (!activeSubcategory) return true;

    const normalizedSubcategory = activeSubcategory.label.toLowerCase();
    return (
      String(product.subcategory || "").toLowerCase() === normalizedSubcategory ||
      product.tags.some(
        (tag) =>
          tag.toLowerCase() === activeSubcategory.value.toLowerCase() || tag.toLowerCase() === normalizedSubcategory,
      )
    );
  });

  const brandOptions = getBrandOptions(categoryScopedProducts);
  const warrantyOptions = getWarrantyOptions(categoryScopedProducts);
  const popularitySignals = await getPopularitySignalsForProducts(categoryScopedProducts);

  const filteredProducts = sortProducts(
    categoryScopedProducts.filter((product) => {
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
    activeCategory ? { label: activeCategory.label, href: getFilterHref(filters, { category: "", sub: "" }) } : null,
    activeSubcategory ? { label: activeSubcategory.label, href: getFilterHref(filters, { sub: "" }) } : null,
    filters.brand ? { label: filters.brand, href: getFilterHref(filters, { brand: "" }) } : null,
    filters.price
      ? {
          label: PRICE_OPTIONS.find((option) => option.value === filters.price)?.label || filters.price,
          href: getFilterHref(filters, { price: "" }),
        }
      : null,
    manualPriceRange.min !== undefined || manualPriceRange.max !== undefined
      ? {
          label: formatPriceRangeLabel(manualPriceRange.min, manualPriceRange.max),
          href: getFilterHref(filters, { minPrice: "", maxPrice: "" }),
        }
      : null,
    filters.stock
      ? {
          label: STOCK_OPTIONS.find((option) => option.value === filters.stock)?.label || filters.stock,
          href: getFilterHref(filters, { stock: "" }),
        }
      : null,
    filters.warranty ? { label: filters.warranty, href: getFilterHref(filters, { warranty: "" }) } : null,
  ].filter(Boolean) as Array<{ label: string; href: string }>;

  const currentSubcategories = activeCategory?.subcategories ?? [];

  return (
    <div className={`${shopStyles.page} pb-28 lg:pb-0`}>
      <ShopHeader navLinks={shopNavLinks} />
      <section className="py-2.5 sm:py-4">
        <div className={shopStyles.shell}>
          <ShopBreadcrumbs
            items={[
              { label: "Shop", href: SHOP_HOME_HREF },
              { label: "All Products" },
            ]}
          />

          <details id="mobile-all-products-filters" className="mt-2 rounded-[14px] border border-[#7a0000]/10 bg-white px-3 py-2.5 shadow-[0_6px_16px_rgba(15,23,42,0.04)] lg:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold text-slate-900">
              <span className="inline-flex items-center gap-2">
                <Filter className="h-4 w-4 text-[#7a0000]" />
                Filter / Sort
              </span>
              <ChevronDown className="h-4 w-4 text-slate-500" />
            </summary>
            <div className="mt-3 grid gap-3">
              <div id="mobile-all-products-sort">
                <FilterSection title="Sort">
                  <form method="GET" className="grid gap-2 rounded-xl border border-[#7a0000]/10 bg-[#fcfaf7] p-2.5">
                    <input type="hidden" name="category" value={filters.category || ""} />
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
              <div id="mobile-all-products-filter-section">
              <FilterSection title="Category">
                <CheckboxLink href={getFilterHref(filters, { category: "", sub: "" })} label="All categories" active={!activeCategory} />
                {SHOP_CATEGORY_DEFINITIONS.map((category) => (
                  <CheckboxLink
                    key={category.value}
                    href={getFilterHref(filters, { category: category.value, sub: "" })}
                    label={category.label}
                    active={activeCategory?.value === category.value}
                  />
                ))}
              </FilterSection>
              </div>
              {activeCategory && currentSubcategories.length ? (
                <FilterSection title="Subcategory">
                  <CheckboxLink href={getFilterHref(filters, { sub: "" })} label={`All ${activeCategory.label}`} active={!activeSubcategory} />
                  {currentSubcategories.map((subcategory) => (
                    <CheckboxLink
                      key={subcategory.value}
                      href={getFilterHref(filters, { sub: subcategory.value })}
                      label={subcategory.label}
                      active={activeSubcategory?.value === subcategory.value}
                      nested
                    />
                  ))}
                </FilterSection>
              ) : null}
              {brandOptions.length ? (
                <FilterSection title="Brand">
                  {brandOptions.map((brand) => (
                    <CheckboxLink key={brand} href={getFilterHref(filters, { brand })} label={brand} active={filters.brand === brand} />
                  ))}
                </FilterSection>
              ) : null}
              <FilterSection title="Price">
                {PRICE_OPTIONS.map((option) => (
                  <CheckboxLink
                    key={option.value}
                    href={getFilterHref(filters, { price: option.value })}
                    label={option.label}
                    active={filters.price === option.value}
                  />
                ))}
                <form method="GET" action={SHOP_ALL_PRODUCTS_HREF} className="mt-2 grid gap-2 rounded-xl border border-[#7a0000]/10 bg-[#fcfaf7] p-2.5">
                  <input type="hidden" name="category" value={filters.category || ""} />
                  <input type="hidden" name="sub" value={filters.sub || ""} />
                  <input type="hidden" name="brand" value={filters.brand || ""} />
                  <input type="hidden" name="price" value={filters.price || ""} />
                  <input type="hidden" name="stock" value={filters.stock || ""} />
                  <input type="hidden" name="warranty" value={filters.warranty || ""} />
                  {filters.sort ? <input type="hidden" name="sort" value={filters.sort} /> : null}
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
                    href={getFilterHref(filters, { stock: option.value })}
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
                    <CheckboxLink href={getFilterHref(filters, { category: "", sub: "" })} label="All categories" active={!activeCategory} />
                    {SHOP_CATEGORY_DEFINITIONS.map((category) => (
                      <CheckboxLink
                        key={category.value}
                        href={getFilterHref(filters, { category: category.value, sub: "" })}
                        label={category.label}
                        active={activeCategory?.value === category.value}
                      />
                    ))}
                  </FilterSection>

                  {activeCategory && currentSubcategories.length ? (
                    <FilterSection title="Subcategory">
                      <CheckboxLink href={getFilterHref(filters, { sub: "" })} label={`All ${activeCategory.label}`} active={!activeSubcategory} />
                      {currentSubcategories.map((subcategory) => (
                        <CheckboxLink
                          key={subcategory.value}
                          href={getFilterHref(filters, { sub: subcategory.value })}
                          label={subcategory.label}
                          active={activeSubcategory?.value === subcategory.value}
                          nested
                        />
                      ))}
                    </FilterSection>
                  ) : null}

                  {brandOptions.length ? (
                    <FilterSection title="Brand">
                      {brandOptions.map((brand) => (
                        <CheckboxLink key={brand} href={getFilterHref(filters, { brand })} label={brand} active={filters.brand === brand} />
                      ))}
                    </FilterSection>
                  ) : null}

                  <FilterSection title="Price">
                    {PRICE_OPTIONS.map((option) => (
                      <CheckboxLink
                        key={option.value}
                        href={getFilterHref(filters, { price: option.value })}
                        label={option.label}
                        active={filters.price === option.value}
                      />
                    ))}
                    <form method="GET" action={SHOP_ALL_PRODUCTS_HREF} className="mt-2 grid gap-2 rounded-xl border border-[#7a0000]/10 bg-[#fcfaf7] p-2.5">
                      <input type="hidden" name="category" value={filters.category || ""} />
                      <input type="hidden" name="sub" value={filters.sub || ""} />
                      <input type="hidden" name="brand" value={filters.brand || ""} />
                      <input type="hidden" name="price" value={filters.price || ""} />
                      <input type="hidden" name="stock" value={filters.stock || ""} />
                      <input type="hidden" name="warranty" value={filters.warranty || ""} />
                      {filters.sort ? <input type="hidden" name="sort" value={filters.sort} /> : null}
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
                        href={getFilterHref(filters, { stock: option.value })}
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
                          href={getFilterHref(filters, { warranty })}
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
                    <div className={shopStyles.sectionEyebrow}>Storefront Catalogue</div>
                    <h1 className="mt-1 text-lg font-black tracking-tight text-slate-950 sm:text-xl">All Products</h1>
                    <div className="mt-0.5 text-xs font-semibold text-slate-500">
                      {filteredProducts.length} product{filteredProducts.length === 1 ? "" : "s"} found
                    </div>
                  </div>

                  <form id="desktop-all-products-sort" className="hidden flex-wrap items-center gap-2 rounded-md border border-[#7a0000]/10 bg-[#fcfaf7] px-2.5 py-2 sm:flex-nowrap sm:py-1.5 lg:flex">
                    <label htmlFor="sort" className="text-xs font-semibold text-slate-500">
                      Sort by
                    </label>
                    <input type="hidden" name="category" value={filters.category || ""} />
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
                    <button type="submit" className="rounded-full bg-[#7a0000] px-3 py-1 text-[11px] font-bold text-white">
                      Apply
                    </button>
                  </form>
                </div>

                {activeChips.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {activeChips.map((chip) => (
                      <ActiveFilterChip key={`${chip.label}-${chip.href}`} label={chip.label} href={chip.href} />
                    ))}
                    <Link href={SHOP_ALL_PRODUCTS_HREF} className="inline-flex min-h-[1.85rem] items-center rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                      Clear filters
                    </Link>
                  </div>
                ) : null}
              </div>

              {filteredProducts.length ? (
                <div className="mt-3 grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 xl:grid-cols-3">
                  {filteredProducts.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              ) : (
                <div className="mt-3">
                  <ShopStatePanel
                    eyebrow="No matches"
                    title="No products match these filters"
                    copy="Try clearing one or two filters, or browse our full catalogue instead."
                    primaryHref={SHOP_ALL_PRODUCTS_HREF}
                    primaryLabel="View all products"
                    secondaryHref={getShopRequestQuoteHref("I need help choosing the right solar products")}
                    secondaryLabel="Request help"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
      <ShopFooter />
      <ShopMobileCatalogueActions filterTargetId="mobile-all-products-filter-section" sortTargetId="mobile-all-products-sort" />
      <FloatingWhatsApp hideOnMobile />
    </div>
  );
}
