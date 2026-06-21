import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, Filter, SlidersHorizontal, X } from "lucide-react";
import AgentCatalogueProductCard from "@/app/agents/_components/AgentCatalogueProductCard";
import {
  AGENT_PRICE_OPTIONS,
  AGENT_SORT_OPTIONS,
  AGENT_STOCK_OPTIONS,
  type AgentListingFilters,
  filterByManualPrice,
  filterByPrice,
  getAgentCommissionValue,
  getBrandOptions,
  getPopularitySignalsByProduct,
  getWarrantyOptions,
  normalizePriceRange,
  sortAgentProductsBySignals,
} from "@/app/agents/agentCatalogue";
import FloatingWhatsApp from "@/app/shop/_components/FloatingWhatsApp";
import ShopMobileCatalogueActions from "@/app/shop/_components/ShopMobileCatalogueActions";
import { shopStyles } from "@/app/shop/_components/shopStyles";
import {
  getShopCategoryDefinition,
  getShopSubcategoryDefinition,
  SHOP_CATEGORY_DEFINITIONS,
} from "@/app/shop/shopCatalogConfig";
import { getShopProducts } from "@/app/shop/shopApi";
import { agentPath } from "@/lib/agents/host";

type AgentProductsPageProps = {
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
  useRootPaths?: boolean;
};

function getProductsHref(filters: AgentListingFilters, useRootPaths: boolean, patch: Partial<AgentListingFilters>) {
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
    sort: filters.sort || "",
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

  const base = agentPath("/products", useRootPaths);
  const queryString = query.toString();
  return `${base}${queryString ? `?${queryString}` : ""}`;
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

function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-b border-[#7a0000]/8 pb-3 last:border-b-0 last:pb-0">
      <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-900">{title}</div>
      <div className="mt-2 grid gap-0.5">{children}</div>
    </div>
  );
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

export default async function AgentProductsPage({
  searchParams,
  useRootPaths = false,
}: AgentProductsPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const filters: AgentListingFilters = {
    category: resolvedSearchParams?.category || "",
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

  const otpHref = `/login/phone?callbackUrl=${encodeURIComponent(agentPath("/dashboard", useRootPaths))}`;
  const registerHref = otpHref;
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
  const popularitySignals = await getPopularitySignalsByProduct(categoryScopedProducts);

  const filteredProducts = sortAgentProductsBySignals(
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
    activeCategory ? { label: activeCategory.label, href: getProductsHref(filters, useRootPaths, { category: "", sub: "" }) } : null,
    activeSubcategory ? { label: activeSubcategory.label, href: getProductsHref(filters, useRootPaths, { sub: "" }) } : null,
    filters.brand ? { label: filters.brand, href: getProductsHref(filters, useRootPaths, { brand: "" }) } : null,
    filters.price
      ? {
          label: AGENT_PRICE_OPTIONS.find((option) => option.value === filters.price)?.label || filters.price,
          href: getProductsHref(filters, useRootPaths, { price: "" }),
        }
      : null,
    manualPriceRange.min !== undefined || manualPriceRange.max !== undefined
      ? {
          label: formatPriceRangeLabel(manualPriceRange.min, manualPriceRange.max),
          href: getProductsHref(filters, useRootPaths, { minPrice: "", maxPrice: "" }),
        }
      : null,
    filters.stock
      ? {
          label: AGENT_STOCK_OPTIONS.find((option) => option.value === filters.stock)?.label || filters.stock,
          href: getProductsHref(filters, useRootPaths, { stock: "" }),
        }
      : null,
    filters.warranty ? { label: filters.warranty, href: getProductsHref(filters, useRootPaths, { warranty: "" }) } : null,
  ].filter(Boolean) as Array<{ label: string; href: string }>;

  const currentSubcategories = activeCategory?.subcategories ?? [];
  const commissionVisibleCount = filteredProducts.filter((product) => getAgentCommissionValue(product) > 0).length;

  return (
    <div className={`${shopStyles.page} pb-28 lg:pb-0`}>
      <section className="border-b border-[#7a0000]/10 bg-white/90 py-4 backdrop-blur-xl">
        <div className={shopStyles.shell}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex rounded-full bg-[#fff3d8] px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-[#7a0000]">
                Agent Catalogue
              </div>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                Mirror the Betech shop and see your commission clearly
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-[15px]">
                This agent catalogue reflects the same live products from betech.co.ke, but surfaces your earning opportunity on every product so you can pitch with confidence.
              </p>
            </div>
            <div className="flex flex-col gap-3 lg:items-end">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[20px] border border-[#7a0000]/10 bg-[#fffaf2] px-4 py-3">
                  <div className="text-[11px] font-black uppercase tracking-[0.14em] text-[#7a0000]">Products shown</div>
                  <div className="mt-1 text-2xl font-black text-slate-950">{filteredProducts.length}</div>
                </div>
                <div className="rounded-[20px] border border-[#f2b20f]/20 bg-[#fff6df] px-4 py-3">
                  <div className="text-[11px] font-black uppercase tracking-[0.14em] text-[#7a0000]">With commission visible</div>
                  <div className="mt-1 text-2xl font-black text-slate-950">{commissionVisibleCount}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-5 sm:py-7">
        <div className={shopStyles.shell}>
          <details
            id="mobile-agent-products-filters"
            className="rounded-[14px] border border-[#7a0000]/10 bg-white px-3 py-2.5 shadow-[0_6px_16px_rgba(15,23,42,0.04)] lg:hidden"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold text-slate-900">
              <span className="inline-flex items-center gap-2">
                <Filter className="h-4 w-4 text-[#7a0000]" />
                Filter / Sort
              </span>
              <ChevronDown className="h-4 w-4 text-slate-500" />
            </summary>
            <div className="mt-3 grid gap-3">
              <div id="mobile-agent-products-sort">
                <FilterSection title="Sort">
                  {AGENT_SORT_OPTIONS.map((option) => (
                    <CheckboxLink
                      key={option.value}
                      href={getProductsHref(filters, useRootPaths, { sort: option.value })}
                      label={option.label}
                      active={filters.sort === option.value}
                    />
                  ))}
                </FilterSection>
              </div>
              <div id="mobile-agent-products-filter-section" className="grid gap-3">
                <FilterSection title="Categories">
                  {SHOP_CATEGORY_DEFINITIONS.map((category) => (
                    <div key={category.value}>
                      <CheckboxLink
                        href={getProductsHref(filters, useRootPaths, { category: category.value, sub: "" })}
                        label={category.label}
                        active={filters.category === category.value}
                      />
                      {filters.category === category.value
                        ? category.subcategories.map((subcategory) => (
                            <CheckboxLink
                              key={subcategory.value}
                              href={getProductsHref(filters, useRootPaths, { sub: subcategory.value })}
                              label={subcategory.label}
                              active={filters.sub === subcategory.value}
                              nested
                            />
                          ))
                        : null}
                    </div>
                  ))}
                </FilterSection>

                <FilterSection title="Brand">
                  {brandOptions.map((brand) => (
                    <CheckboxLink
                      key={brand}
                      href={getProductsHref(filters, useRootPaths, { brand })}
                      label={brand}
                      active={filters.brand === brand}
                    />
                  ))}
                </FilterSection>

                <FilterSection title="Price">
                  {AGENT_PRICE_OPTIONS.map((option) => (
                    <CheckboxLink
                      key={option.value}
                      href={getProductsHref(filters, useRootPaths, { price: option.value })}
                      label={option.label}
                      active={filters.price === option.value}
                    />
                  ))}
                  <form method="GET" action={agentPath("/products", useRootPaths)} className="mt-2 grid gap-2 rounded-xl border border-[#7a0000]/10 bg-[#fcfaf7] p-2.5">
                    <input type="hidden" name="category" value={filters.category || ""} />
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
                  {AGENT_STOCK_OPTIONS.map((option) => (
                    <CheckboxLink
                      key={option.value}
                      href={getProductsHref(filters, useRootPaths, { stock: option.value })}
                      label={option.label}
                      active={filters.stock === option.value}
                    />
                  ))}
                </FilterSection>

                <FilterSection title="Warranty">
                  {warrantyOptions.map((warranty) => (
                    <CheckboxLink
                      key={warranty}
                      href={getProductsHref(filters, useRootPaths, { warranty })}
                      label={warranty}
                      active={filters.warranty === warranty}
                    />
                  ))}
                </FilterSection>
              </div>
            </div>
          </details>

          <div className="mt-4 grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="hidden lg:block">
              <div className="sticky top-4 rounded-[24px] border border-[#7a0000]/10 bg-white p-4 shadow-[0_16px_34px_rgba(15,23,42,0.05)]">
                <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.14em] text-[#7a0000]">
                  <SlidersHorizontal className="h-4 w-4" />
                  Filter catalogue
                </div>
                <div className="mt-4 grid gap-4">
                  <FilterSection title="Categories">
                    {SHOP_CATEGORY_DEFINITIONS.map((category) => (
                      <div key={category.value}>
                        <CheckboxLink
                          href={getProductsHref(filters, useRootPaths, { category: category.value, sub: "" })}
                          label={category.label}
                          active={filters.category === category.value}
                        />
                        {filters.category === category.value
                          ? category.subcategories.map((subcategory) => (
                              <CheckboxLink
                                key={subcategory.value}
                                href={getProductsHref(filters, useRootPaths, { sub: subcategory.value })}
                                label={subcategory.label}
                                active={filters.sub === subcategory.value}
                                nested
                              />
                            ))
                          : null}
                      </div>
                    ))}
                  </FilterSection>

                  <FilterSection title="Brand">
                    {brandOptions.map((brand) => (
                      <CheckboxLink
                        key={brand}
                        href={getProductsHref(filters, useRootPaths, { brand })}
                        label={brand}
                        active={filters.brand === brand}
                      />
                    ))}
                  </FilterSection>

                  <FilterSection title="Price">
                    {AGENT_PRICE_OPTIONS.map((option) => (
                      <CheckboxLink
                        key={option.value}
                        href={getProductsHref(filters, useRootPaths, { price: option.value })}
                        label={option.label}
                        active={filters.price === option.value}
                      />
                    ))}
                    <form method="GET" action={agentPath("/products", useRootPaths)} className="mt-2 grid gap-2 rounded-xl border border-[#7a0000]/10 bg-[#fcfaf7] p-2.5">
                      <input type="hidden" name="category" value={filters.category || ""} />
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
                    {AGENT_STOCK_OPTIONS.map((option) => (
                      <CheckboxLink
                        key={option.value}
                        href={getProductsHref(filters, useRootPaths, { stock: option.value })}
                        label={option.label}
                        active={filters.stock === option.value}
                      />
                    ))}
                  </FilterSection>

                  <FilterSection title="Warranty">
                    {warrantyOptions.map((warranty) => (
                      <CheckboxLink
                        key={warranty}
                        href={getProductsHref(filters, useRootPaths, { warranty })}
                        label={warranty}
                        active={filters.warranty === warranty}
                      />
                    ))}
                  </FilterSection>
                </div>
              </div>
            </aside>

            <div className="grid gap-4">
              <div className="rounded-[24px] border border-[#7a0000]/10 bg-white p-4 shadow-[0_16px_34px_rgba(15,23,42,0.05)]">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.14em] text-[#7a0000]">
                      {activeCategory ? `${activeCategory.label} catalogue` : "All live agent products"}
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      Browse the same public catalogue categories, now with commission shown for agents.
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {AGENT_SORT_OPTIONS.map((option) => (
                      <Link
                        key={option.value}
                        href={getProductsHref(filters, useRootPaths, { sort: option.value })}
                        className={`inline-flex min-h-[1.95rem] items-center rounded-full px-3 py-1 text-[11px] font-bold ${
                          filters.sort === option.value
                            ? "bg-[#7a0000] text-white"
                            : "border border-[#7a0000]/10 bg-[#fcfaf7] text-slate-700"
                        }`}
                      >
                        {option.label}
                      </Link>
                    ))}
                  </div>
                </div>

                {activeChips.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {activeChips.map((chip) => (
                      <ActiveFilterChip key={`${chip.label}-${chip.href}`} label={chip.label} href={chip.href} />
                    ))}
                    <Link
                      href={agentPath("/products", useRootPaths)}
                      className="inline-flex min-h-[1.85rem] items-center rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600"
                    >
                      Clear all
                    </Link>
                  </div>
                ) : null}

                {activeCategory && currentSubcategories.length ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {currentSubcategories.map((subcategory) => (
                      <Link
                        key={subcategory.value}
                        href={getProductsHref(filters, useRootPaths, { sub: subcategory.value })}
                        className={`inline-flex min-h-[2rem] items-center rounded-full px-3 py-1 text-[11px] font-bold ${
                          filters.sub === subcategory.value
                            ? "bg-[#f2b20f] text-slate-950"
                            : "border border-[#7a0000]/10 bg-[#fffaf2] text-slate-700"
                        }`}
                      >
                        {subcategory.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>

              {filteredProducts.length ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredProducts.map((product) => (
                    <AgentCatalogueProductCard
                      key={product.id}
                      product={product}
                      primaryHref={registerHref}
                      useRootPaths={useRootPaths}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-[28px] border border-[#7a0000]/10 bg-white px-6 py-10 text-center shadow-[0_16px_34px_rgba(15,23,42,0.05)]">
                  <div className="text-sm font-black uppercase tracking-[0.18em] text-[#7a0000]">No matching products</div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    Adjust the filters or switch back to the full live catalogue to see more products with commission opportunities.
                  </p>
                  <div className="mt-5 flex justify-center">
                    <Link href={agentPath("/products", useRootPaths)} className={shopStyles.primaryButton}>
                      View full agent catalogue
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
      <ShopMobileCatalogueActions filterTargetId="mobile-agent-products-filter-section" sortTargetId="mobile-agent-products-sort" />
      <FloatingWhatsApp />
    </div>
  );
}
