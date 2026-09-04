"use client";

import { FormEvent, useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import ProductDescriptionEditor from "@/components/ProductDescriptionEditor";
import {
  detectShopCategoryAndSubcategory,
  getShopSubcategoryOptions,
  SHOP_CATEGORY_DEFINITIONS,
  SHOP_CATEGORY_OPTIONS,
} from "@/app/shop/shopCatalogConfig";
import { getShopProductHref } from "@/app/shop/storefrontPaths";

type Product = {
  id: string;
  sku: string;
  name: string;
  sellingPrice: number;
  category: string;
  shopSubcategory?: string | null;
  productType?: string | null;
  brand?: string | null;
  shortDescription?: string | null;
  description?: string | null;
  warrantyPeriod?: string | null;
  tiktokVideoUrl?: string | null;
  purchaseLink?: string | null;
  mainImageUrl?: string | null;
  variableCost?: boolean | null;
  lastBuyingPrice?: number | null;
  catalogueConfiguration?: Record<string, unknown> | null;
  galleryImageUrls?: string[] | null;
  availabilityType?: string | null;
  stockQuantity?: number | null;
  showInShop: boolean;
  ecommerceVisible: boolean;
  updatedAt: string;
  earningKes: number;
};
type Withdrawal = {
  id: string;
  amountKes: number;
  status: string;
  paymentReference?: string | null;
  adminNote?: string | null;
  requestedAt: string;
  processedAt?: string | null;
};
type Balance = {
  productsCreated: number;
  totalEarnedKes: number;
  paidKes: number;
  pendingKes: number;
  availableKes: number;
};

const blank = () => ({
  name: "",
  sellingPrice: "",
  category: "",
  shopSubcategory: "",
  productType: "",
  brand: "",
  shortDescription: "",
  description: "",
  warrantyPeriod: "No warranty",
  tiktokVideoUrl: "https://www.tiktok.com/@betechsolarsolutionske",
  purchaseLink: "",
  mainImageUrl: "",
  galleryImageUrls: "",
  availabilityType: "WAREHOUSE",
  stockQuantity: "10000",
  variableCost: false,
  lastBuyingPrice: "",
  requiresInstallation: false,
  installationIncluded: false,
  transportIncluded: false,
  zone1TransportFee: "500",
  zone2TransportFee: "750",
  zone3TransportFee: "1000",
});

const warrantyOptions = [
  "No warranty",
  "1 year",
  "2 years",
  "3 years",
  "5 years",
  "6 years",
  "10 years",
  "15 years",
  "25 years",
];
const PUBLIC_SHOP_ORIGIN = "https://www.betech.co.ke";

function money(value: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(value);
}
function productSlug(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "product"
  );
}
function productWebsiteUrl(product: Product) {
  return `${PUBLIC_SHOP_ORIGIN}${getShopProductHref(productSlug(product.name), product.id)}`;
}
function toForm(product: Product) {
  const policy =
    product.catalogueConfiguration &&
    typeof product.catalogueConfiguration === "object"
      ? product.catalogueConfiguration
      : {};
  const requiresInstallation =
    policy.installationType !== "NOT_REQUIRED" &&
    policy.installationFeeMode !== "UNAVAILABLE";
  return {
    name: product.name,
    sellingPrice: String(product.sellingPrice),
    category: product.category,
    shopSubcategory: product.shopSubcategory || "",
    productType: product.productType || "",
    brand: product.brand || "",
    shortDescription: product.shortDescription || "",
    description: product.description || "",
    warrantyPeriod: product.warrantyPeriod || "No warranty",
    tiktokVideoUrl:
      product.tiktokVideoUrl ||
      "https://www.tiktok.com/@betechsolarsolutionske",
    purchaseLink: product.purchaseLink || "",
    mainImageUrl: product.mainImageUrl || "",
    galleryImageUrls: Array.isArray(product.galleryImageUrls)
      ? product.galleryImageUrls.join("\n")
      : "",
    availabilityType: product.availabilityType || "WAREHOUSE",
    stockQuantity: String(product.stockQuantity ?? 10000),
    variableCost: Boolean(product.variableCost),
    lastBuyingPrice:
      product.lastBuyingPrice == null ? "" : String(product.lastBuyingPrice),
    requiresInstallation,
    installationIncluded:
      policy.installationType === "INCLUDED" ||
      policy.installationFeeMode === "INCLUDED",
    transportIncluded:
      policy.transportMode === "INCLUDED" || policy.transportMode === "FREE",
    zone1TransportFee: String(policy.zone1TransportFee ?? 500),
    zone2TransportFee: String(policy.zone2TransportFee ?? 750),
    zone3TransportFee: String(policy.zone3TransportFee ?? 1000),
  };
}

export default function ContributorDashboard() {
  const [products, setProducts] = useState<Product[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [earning, setEarning] = useState(5);
  const [form, setForm] = useState(blank());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<"catalogue" | "earnings">("catalogue");
  const [brands, setBrands] = useState<string[]>([]);
  const [brandOpen, setBrandOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryQuery, setCategoryQuery] = useState("");
  const [pickerCategory, setPickerCategory] = useState<string | null>(null);
  const [recentCategories, setRecentCategories] = useState<string[]>([]);

  async function load() {
    const res = await fetch("/api/contributor/dashboard", {
      cache: "no-store",
    });
    const data = await res.json();
    if (!res.ok) {
      setNotice(data.error || "Unable to load your dashboard.");
      return;
    }
    setProducts(data.products || []);
    setWithdrawals(data.withdrawals || []);
    setBalance(data.balance);
    setEarning(data.earningPerProductKes || 5);
  }
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    const query = form.brand.trim();
    if (!query) return;
    const timeout = window.setTimeout(() => {
      void fetch(`/api/contributor/brands?q=${encodeURIComponent(query)}`, {
        cache: "no-store",
      })
        .then((res) => res.json())
        .then((data) => setBrands(data.items || []))
        .catch(() => undefined);
    }, 180);
    return () => window.clearTimeout(timeout);
  }, [form.brand]);
  useEffect(() => {
    void fetch("/api/contributor/brands", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setBrands(data.items || []))
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    const title = form.name.trim();
    if (!title || form.brand.trim()) return;
    const timeout = window.setTimeout(() => {
      void fetch(
        `/api/contributor/brands?title=${encodeURIComponent(title)}`,
        { cache: "no-store" },
      )
        .then((res) => res.json())
        .then((data) => {
          const brand = typeof data.item === "string" ? data.item.trim() : "";
          if (!brand) return;
          setForm((current) =>
            current.name.trim() === title && !current.brand.trim()
              ? { ...current, brand }
              : current,
          );
        })
        .catch(() => undefined);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [form.brand, form.name]);
  useEffect(() => {
    try {
      setRecentCategories(
        JSON.parse(
          localStorage.getItem("betech-contributor-recent-categories") || "[]",
        ),
      );
    } catch {
      setRecentCategories([]);
    }
  }, []);
  const set = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const selectCategory = (category: string) => {
    setForm((current) => ({
      ...current,
      category,
      shopSubcategory: "",
      productType: "",
    }));
    setPickerCategory(category);
    setCategoryQuery("");
    setRecentCategories((current) => {
      const next = [
        category,
        ...current.filter((value) => value !== category),
      ].slice(0, 5);
      localStorage.setItem(
        "betech-contributor-recent-categories",
        JSON.stringify(next),
      );
      return next;
    });
  };
  const filteredBrands = brands
    .filter((brand) => brand.toLowerCase().includes(form.brand.toLowerCase()))
    .slice(0, 8);
  const mostRecentProduct = [...products].sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )[0];
  const previousTaxonomySuggestion =
    mostRecentProduct?.category && mostRecentProduct?.shopSubcategory
      ? {
          category: mostRecentProduct.category,
          subcategory: mostRecentProduct.shopSubcategory,
        }
      : null;
  const previousBrandSuggestion = [...products]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .find((product) => product.brand?.trim())?.brand?.trim();
  const pickerCategoryDefinition =
    SHOP_CATEGORY_DEFINITIONS.find(
      (category) => category.value === pickerCategory,
    ) ?? null;
  const categorySearchResults = SHOP_CATEGORY_DEFINITIONS.filter((category) =>
    category.label.toLowerCase().includes(categoryQuery.toLowerCase()),
  );
  const categoryPickerItems = pickerCategoryDefinition
    ? pickerCategoryDefinition.subcategories.map((subcategory) => ({
        type: "subcategory" as const,
        category: pickerCategoryDefinition,
        subcategory,
      }))
    : categoryQuery.trim()
      ? SHOP_CATEGORY_DEFINITIONS.flatMap((category) => {
          const query = categoryQuery.trim().toLowerCase();
          const matchingSubcategories = category.subcategories.filter(
            (subcategory) =>
              [
                subcategory.label,
                ...(subcategory.productTypes || []).map(
                  (productType) => productType.label,
                ),
              ]
                .join(" ")
                .toLowerCase()
                .includes(query),
          );
          return [
            ...(categorySearchResults.includes(category)
              ? [{ type: "category" as const, category }]
              : []),
            ...matchingSubcategories.map((subcategory) => ({
              type: "subcategory" as const,
              category,
              subcategory,
            })),
          ];
        })
      : SHOP_CATEGORY_DEFINITIONS.map((category) => ({
          type: "category" as const,
          category,
        }));
  const chooseCategoryAndSubcategory = (
    category: string,
    shopSubcategory: string,
  ) => {
    setForm((current) => ({
      ...current,
      category,
      shopSubcategory,
      productType: "",
    }));
    setCategoryOpen(false);
    setPickerCategory(null);
    setCategoryQuery("");
  };
  const payload = () => ({
    ...form,
    sellingPrice: Number(form.sellingPrice),
    stockQuantity: Number(form.stockQuantity || 0),
    lastBuyingPrice: form.lastBuyingPrice ? Number(form.lastBuyingPrice) : null,
    tiktokVideoUrl: form.tiktokVideoUrl.trim() || null,
    purchaseLink: form.purchaseLink.trim() || null,
    zone1TransportFee: Number(form.zone1TransportFee || 500),
    zone2TransportFee: Number(form.zone2TransportFee || 750),
    zone3TransportFee: Number(form.zone3TransportFee || 1000),
    galleryImageUrls: form.galleryImageUrls
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean),
  });

  async function submitProduct(event: FormEvent) {
    event.preventDefault();
    if (!form.category || !form.shopSubcategory) {
      setNotice("Select both a website category and subcategory.");
      return;
    }
    setBusy(true);
    setNotice(null);
    const url = editingId
      ? `/api/contributor/products/${editingId}`
      : "/api/contributor/dashboard";
    const res = await fetch(url, {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload()),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setNotice(
        data.error?.formErrors?.[0] ||
          data.error ||
          "Could not save the product.",
      );
      return;
    }
    setNotice(
      editingId
        ? "Product updated and published to the website."
        : `Product created. ${money(earning)} was added to your earnings.`,
    );
    setForm(blank());
    setEditingId(null);
    await load();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function uploadImage(
    file?: File | null,
    target: "main" | "gallery" = "main",
  ) {
    if (!file) return;
    setBusy(true);
    setNotice(null);
    const body = new FormData();
    body.set("file", file);
    const res = await fetch("/api/contributor/upload", {
      method: "POST",
      body,
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setNotice(data.error || "Image upload failed.");
      return;
    }
    if (target === "main") set("mainImageUrl", data.url);
    else
      set(
        "galleryImageUrls",
        [form.galleryImageUrls, data.url].filter(Boolean).join("\n"),
      );
    setNotice("Image uploaded. Complete the product details and save it.");
  }
  async function requestWithdrawal(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    const res = await fetch("/api/contributor/withdrawals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountKes: Number(withdrawAmount) }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setNotice(data.error || "Could not request withdrawal.");
      return;
    }
    setWithdrawAmount("");
    setNotice("Withdrawal request sent to the administrator.");
    await load();
  }
  const input =
    "mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400";
  const label = "block text-sm font-semibold text-slate-200";

  return (
    <main className="min-h-screen bg-[#07121a] px-4 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="flex flex-wrap items-start justify-between gap-5 rounded-3xl border border-emerald-400/20 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,.2),transparent_35%),#0b1823] p-7">
          <div>
            <p className="text-xs font-black uppercase tracking-[.25em] text-emerald-300">
              Betech product contributor
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              Website product desk
            </h1>
            <p className="mt-2 max-w-2xl text-slate-300">
              Create complete products for the Betech website. Every product you
              create earns {money(earning)}. You can edit your work at any time;
              products cannot be deleted from this workspace.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void signOut({ callbackUrl: "/attendant/login" })}
            className="rounded-xl border border-rose-400/35 px-4 py-2.5 text-sm font-bold text-rose-200 transition hover:bg-rose-400/10"
          >
            Log out
          </button>
        </header>
        {notice ? (
          <div className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
            {notice}
          </div>
        ) : null}
        <nav className="flex gap-2 rounded-2xl border border-white/10 bg-slate-900/80 p-2">
          <button
            onClick={() => setTab("catalogue")}
            className={`rounded-xl px-5 py-3 font-black ${tab === "catalogue" ? "bg-emerald-400 text-slate-950" : "text-slate-300"}`}
          >
            Product catalogue ({products.length})
          </button>
          <button
            onClick={() => setTab("earnings")}
            className={`rounded-xl px-5 py-3 font-black ${tab === "earnings" ? "bg-emerald-400 text-slate-950" : "text-slate-300"}`}
          >
            Financial earnings
          </button>
        </nav>
        {tab === "earnings" ? (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              {[
                ["Products created", balance?.productsCreated ?? 0],
                ["Total earned", money(balance?.totalEarnedKes ?? 0)],
                ["Available to withdraw", money(balance?.availableKes ?? 0)],
                ["Awaiting payment", money(balance?.pendingKes ?? 0)],
                ["Already paid", money(balance?.paidKes ?? 0)],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  className="rounded-2xl border border-white/10 bg-slate-900 p-4"
                >
                  <p className="text-xs uppercase tracking-wider text-slate-400">
                    {label}
                  </p>
                  <p className="mt-2 text-2xl font-black text-emerald-300">
                    {value}
                  </p>
                </div>
              ))}
            </section>
            <section className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-slate-900/80 p-5">
              <h2 className="text-xl font-black">Request withdrawal</h2>
              <p className="mt-1 text-sm text-slate-400">
                Available balance: {money(balance?.availableKes ?? 0)}
              </p>
              <form onSubmit={requestWithdrawal} className="mt-4 flex gap-2">
                <input
                  required
                  min="1"
                  max={balance?.availableKes ?? 0}
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className={input}
                  placeholder="Amount"
                />
                <button
                  disabled={busy || !balance?.availableKes}
                  className="rounded-xl bg-cyan-400 px-4 font-black text-slate-950 disabled:opacity-50"
                >
                  Request
                </button>
              </form>
              <h3 className="mt-6 text-lg font-black">Withdrawal history</h3>
              <div className="mt-3 space-y-3">
                {withdrawals.length ? (
                  withdrawals.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-white/10 p-3 text-sm"
                    >
                      <div className="flex justify-between gap-3">
                        <strong>{money(item.amountKes)}</strong>
                        <span className="font-bold text-emerald-300">
                          {item.status}
                        </span>
                      </div>
                      <p className="mt-1 text-slate-400">
                        {new Date(item.requestedAt).toLocaleDateString("en-KE")}
                        {item.paymentReference
                          ? ` · ${item.paymentReference}`
                          : ""}
                      </p>
                      {item.adminNote ? (
                        <p className="mt-1 text-slate-300">{item.adminNote}</p>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400">
                    No withdrawal requests yet.
                  </p>
                )}
              </div>
            </section>
          </>
        ) : (
          <>
            <div className="grid gap-7">
              <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-7">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-black">
                      {editingId ? "Edit product" : "Create product"}
                    </h2>
                    <p className="mt-1 text-sm text-slate-400">
                      The image, price, category, and description are required
                      for a usable website listing.
                    </p>
                  </div>
                  {editingId ? (
                    <button
                      onClick={() => {
                        setEditingId(null);
                        setForm(blank());
                      }}
                      className="text-sm font-bold text-cyan-300"
                    >
                      Create a new product instead
                    </button>
                  ) : null}
                </div>
                <form
                  onSubmit={submitProduct}
                  className="mt-6 grid gap-4 sm:grid-cols-2"
                >
                  <label className={label}>
                    Product name
                    <input
                      required
                      value={form.name}
                      onChange={(e) => {
                        const name = e.target.value;
                        setForm((current) => {
                          if (current.category) return { ...current, name };
                          const suggestion = detectShopCategoryAndSubcategory({
                            name,
                            brand: current.brand,
                            shopCategory: current.category,
                          });
                          return {
                            ...current,
                            name,
                            category: suggestion.shopCategory,
                            shopSubcategory: suggestion.shopSubcategory,
                          };
                        });
                      }}
                      className={input}
                      placeholder="e.g. 5kW Hybrid Solar Inverter"
                    />
                    <span className="mt-1 block text-xs text-amber-200">
                      Category and subcategory are suggested from the product
                      name. You can change them below.
                    </span>
                  </label>
                  <label className={label}>
                    Selling price (KES)
                    <input
                      required
                      min="0"
                      type="number"
                      value={form.sellingPrice}
                      onChange={(e) => set("sellingPrice", e.target.value)}
                      className={input}
                    />
                  </label>
                  <div className={`${label} relative`}>
                    Website category
                    <button
                      type="button"
                      onClick={() => setCategoryOpen(true)}
                      className={`${input} flex items-center justify-between text-left`}
                    >
                      {SHOP_CATEGORY_OPTIONS.find(
                        (category) => category.value === form.category,
                      )?.label || "Select category"}
                      <span>⌄</span>
                    </button>
                    {!form.category && previousTaxonomySuggestion ? (
                      <button
                        type="button"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            category: previousTaxonomySuggestion.category,
                            shopSubcategory:
                              previousTaxonomySuggestion.subcategory,
                            productType: "",
                          }))
                        }
                        className="mt-2 text-left text-xs font-semibold text-amber-200 hover:text-amber-100"
                      >
                        Use previous: {SHOP_CATEGORY_OPTIONS.find(
                          (category) =>
                            category.value === previousTaxonomySuggestion.category,
                        )?.label || previousTaxonomySuggestion.category}
                        {" · "}
                        {getShopSubcategoryOptions(
                          previousTaxonomySuggestion.category,
                        ).find(
                          (subcategory) =>
                            subcategory.value ===
                            previousTaxonomySuggestion.subcategory,
                        )?.label || previousTaxonomySuggestion.subcategory}
                      </button>
                    ) : null}
                  </div>
                  <div className={`${label} relative`}>
                    Brand
                    <input
                      value={form.brand}
                      onFocus={() => setBrandOpen(true)}
                      onChange={(e) => {
                        set("brand", e.target.value);
                        setBrandOpen(true);
                      }}
                      onBlur={() =>
                        window.setTimeout(() => setBrandOpen(false), 150)
                      }
                      className={input}
                      placeholder="Type to select or add a brand"
                    />
                    {!form.brand && previousBrandSuggestion ? (
                      <button
                        type="button"
                        onClick={() => set("brand", previousBrandSuggestion)}
                        className="mt-2 text-left text-xs font-semibold text-amber-200 hover:text-amber-100"
                      >
                        Use last brand: {previousBrandSuggestion}
                      </button>
                    ) : null}
                    {brandOpen && form.brand.trim() ? (
                      <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-950 shadow-2xl">
                        {filteredBrands.map((brand) => (
                          <button
                            type="button"
                            key={brand}
                            onMouseDown={() => {
                              set("brand", brand);
                              setBrandOpen(false);
                            }}
                            className="block w-full px-3 py-2 text-left text-sm hover:bg-emerald-400/10"
                          >
                            {brand}
                          </button>
                        ))}
                        {!filteredBrands.some(
                          (brand) =>
                            brand.toLowerCase() ===
                            form.brand.trim().toLowerCase(),
                        ) ? (
                          <button
                            type="button"
                            onMouseDown={() => setBrandOpen(false)}
                            className="block w-full border-t border-slate-800 px-3 py-2 text-left text-sm font-bold text-emerald-300"
                          >
                            Add “{form.brand.trim()}” as a new brand
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <div className={`${label} relative`}>
                    Website subcategory
                    <button
                      type="button"
                      disabled={!form.category}
                      onClick={() => {
                        setPickerCategory(form.category);
                        setCategoryQuery("");
                        setCategoryOpen(true);
                      }}
                      className={`${input} flex items-center justify-between text-left disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      {getShopSubcategoryOptions(form.category).find(
                        (subcategory) =>
                          subcategory.value === form.shopSubcategory,
                      )?.label || "Select subcategory"}
                      <span>⌄</span>
                    </button>
                    <span className="mt-1 block text-xs font-normal text-slate-400">
                      Choose from the selected category only.
                    </span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className={label}>Product short description</span>
                    <div className="mt-1 overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
                      <ProductDescriptionEditor
                        value={form.shortDescription}
                        onChange={(value) => set("shortDescription", value)}
                        disabled={busy}
                        showPreview={false}
                        compact
                        placeholder="Brief customer-facing product summary."
                      />
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <span className={label}>Product long description</span>
                    <div className="mt-1 overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
                      <ProductDescriptionEditor
                        value={form.description}
                        onChange={(value) => set("description", value)}
                        disabled={busy}
                        showPreview={false}
                        placeholder="Include only product-related information. Keep it clear, accurate, and consistent with the product images."
                      />
                    </div>
                  </div>
                  <div className="sm:col-span-2 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                    <label className="flex items-center gap-3 font-bold">
                      <input
                        type="checkbox"
                        checked={form.variableCost}
                        onChange={(e) =>
                          setForm((current) => ({
                            ...current,
                            variableCost: e.target.checked,
                            lastBuyingPrice: e.target.checked
                              ? ""
                              : current.lastBuyingPrice,
                          }))
                        }
                      />
                      Variable-cost project
                    </label>
                    <label className="mt-3 block text-sm font-semibold text-slate-200">
                      Buying price
                      <input
                        disabled={form.variableCost}
                        min="0"
                        type="number"
                        value={form.lastBuyingPrice}
                        onChange={(e) => set("lastBuyingPrice", e.target.value)}
                        className={input}
                        placeholder="Optional"
                      />
                    </label>
                  </div>
                  <label className={label}>
                    Warranty period
                    <select
                      value={form.warrantyPeriod}
                      onChange={(e) => set("warrantyPeriod", e.target.value)}
                      className={input}
                    >
                      {!warrantyOptions.includes(form.warrantyPeriod) ? (
                        <option value={form.warrantyPeriod}>
                          {form.warrantyPeriod}
                        </option>
                      ) : null}
                      {warrantyOptions.map((period) => (
                        <option key={period} value={period}>
                          {period}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={label}>
                    Stock quantity
                    <input
                      min="0"
                      type="number"
                      value={form.stockQuantity}
                      onChange={(e) => set("stockQuantity", e.target.value)}
                      className={input}
                    />
                  </label>
                  <label className={label}>
                    Availability
                    <select
                      value={form.availabilityType}
                      onChange={(e) => set("availabilityType", e.target.value)}
                      className={input}
                    >
                      <option value="WAREHOUSE">Available in Warehouse</option>
                      <option value="SHOP">Available at Shop</option>
                      <option value="ORDER_ON_REQUEST">Order on request</option>
                      <option value="OUT_OF_STOCK">Out of stock</option>
                    </select>
                  </label>
                  <label className="sm:col-span-2 text-sm font-semibold text-slate-200">
                    TikTok video link
                    <input
                      type="url"
                      value={form.tiktokVideoUrl}
                      onChange={(e) => set("tiktokVideoUrl", e.target.value)}
                      className={input}
                      placeholder="https://www.tiktok.com/@account/video/1234567890"
                    />
                    <span className="mt-1 block text-xs font-normal text-slate-400">
                      Paste the TikTok product video link. It will appear on the
                      product page.
                    </span>
                  </label>
                  <label className="sm:col-span-2 text-sm font-semibold text-slate-200">
                    Purchase link
                    <input
                      type="url"
                      value={form.purchaseLink}
                      onChange={(e) => set("purchaseLink", e.target.value)}
                      className={input}
                      placeholder="https://supplier.example.com/product"
                    />
                    <span className="mt-1 block text-xs font-normal text-slate-400">
                      Internal source link for the product listing. It is not shown to customers.
                    </span>
                  </label>
                  <section className="sm:col-span-2 rounded-2xl border border-amber-300/25 bg-amber-300/5 p-4">
                    <h3 className="font-black text-amber-100">
                      Installation & transport
                    </h3>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <label className="rounded-xl border border-white/10 p-3">
                        <input
                          type="checkbox"
                          checked={form.requiresInstallation}
                          onChange={(e) =>
                            setForm((current) => ({
                              ...current,
                              requiresInstallation: e.target.checked,
                              installationIncluded: e.target.checked
                                ? current.installationIncluded
                                : false,
                            }))
                          }
                        />{" "}
                        <b>Requires installation</b>
                        <span className="mt-2 block text-xs text-slate-400">
                          The product or system must be installed by a
                          technician.
                        </span>
                      </label>
                      <label className="rounded-xl border border-white/10 p-3">
                        <input
                          disabled={!form.requiresInstallation}
                          type="checkbox"
                          checked={form.installationIncluded}
                          onChange={(e) =>
                            setForm((current) => ({
                              ...current,
                              installationIncluded: e.target.checked,
                            }))
                          }
                        />{" "}
                        <b>Installation included</b>
                        <span className="mt-2 block text-xs text-slate-400">
                          The selling price already covers installation.
                        </span>
                      </label>
                      <label className="rounded-xl border border-white/10 p-3">
                        <input
                          type="checkbox"
                          checked={form.transportIncluded}
                          onChange={(e) =>
                            setForm((current) => ({
                              ...current,
                              transportIncluded: e.target.checked,
                            }))
                          }
                        />{" "}
                        <b>Transport included</b>
                        <span className="mt-2 block text-xs text-slate-400">
                          No additional delivery or transport fee is charged.
                        </span>
                      </label>
                    </div>
                    {!form.transportIncluded ? (
                      <div className="mt-4">
                        <h4 className="font-bold">
                          Transport fees by service zone
                        </h4>
                        <p className="mt-1 text-xs text-slate-400">
                          These fees are shown on the storefront when the
                          customer selects a delivery zone.
                        </p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-3">
                          <label className={label}>
                            Zone 1 fee (KES)
                            <input
                              type="number"
                              min="0"
                              value={form.zone1TransportFee}
                              onChange={(e) =>
                                set("zone1TransportFee", e.target.value)
                              }
                              className={input}
                            />
                          </label>
                          <label className={label}>
                            Zone 2 fee (KES)
                            <input
                              type="number"
                              min="0"
                              value={form.zone2TransportFee}
                              onChange={(e) =>
                                set("zone2TransportFee", e.target.value)
                              }
                              className={input}
                            />
                          </label>
                          <label className={label}>
                            Zone 3 fee (KES)
                            <input
                              type="number"
                              min="0"
                              value={form.zone3TransportFee}
                              onChange={(e) =>
                                set("zone3TransportFee", e.target.value)
                              }
                              className={input}
                            />
                          </label>
                        </div>
                      </div>
                    ) : null}
                  </section>
                  <div className="sm:col-span-2">
                    <span className={label}>Product images</span>
                    <p className="mt-1 text-xs text-slate-400">
                      Add a clear main image, then optional gallery images. JPG,
                      PNG and WebP work best.
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <label className="group relative flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-amber-400/60 bg-slate-950 text-center text-sm font-bold text-amber-200">
                        {form.mainImageUrl ? (
                          <img
                            src={form.mainImageUrl}
                            alt="Main product"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span>
                            +<br />
                            Main image
                          </span>
                        )}
                        <input
                          required={!form.mainImageUrl}
                          type="file"
                          accept="image/*"
                          disabled={busy}
                          onChange={(e) =>
                            void uploadImage(e.target.files?.[0], "main")
                          }
                          className="absolute inset-0 cursor-pointer opacity-0"
                        />
                      </label>
                      {[0, 1, 2].map((index) => {
                        const url = form.galleryImageUrls
                          .split("\n")
                          .filter(Boolean)[index];
                        return (
                          <label
                            key={index}
                            className="relative flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-slate-600 bg-slate-950 text-center text-sm font-bold text-slate-300"
                          >
                            {url ? (
                              <img
                                src={url}
                                alt="Gallery product"
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span>
                                +<br />
                                Image
                              </span>
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              disabled={busy}
                              onChange={(e) =>
                                void uploadImage(e.target.files?.[0], "gallery")
                              }
                              className="absolute inset-0 cursor-pointer opacity-0"
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <div className="sm:col-span-2 flex justify-end">
                    <button
                      disabled={busy}
                      className="rounded-xl bg-emerald-400 px-5 py-3 font-black text-slate-950 disabled:opacity-60"
                    >
                      {busy
                        ? "Saving..."
                        : editingId
                          ? "Save product changes"
                          : "Create product and earn KES 5"}
                    </button>
                  </div>
                </form>
              </section>
            </div>
            <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-7">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-black">Your products</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Published products can be opened directly on the Betech
                    website.
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-sm font-bold text-emerald-200">
                  {products.length} product{products.length === 1 ? "" : "s"}{" "}
                  created
                </div>
              </div>
              {!products.length ? (
                <p className="mt-5 text-slate-400">
                  Your products will appear here after you create them.
                </p>
              ) : (
                <>
                  <div className="mt-5 grid gap-3 md:hidden">
                    {products.map((product) => {
                      const published =
                        product.showInShop && product.ecommerceVisible;
                      const href = productWebsiteUrl(product);
                      return (
                        <article
                          key={product.id}
                          className="rounded-2xl border border-white/10 bg-slate-950 p-4"
                        >
                          <div className="flex gap-3">
                            {product.mainImageUrl ? (
                              <img
                                src={product.mainImageUrl}
                                alt=""
                                className="h-16 w-16 rounded-xl object-cover"
                              />
                            ) : (
                              <div className="grid h-16 w-16 place-items-center rounded-xl bg-slate-800 text-xs font-black text-slate-400">
                                {product.name.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-xs text-slate-400">
                                {product.sku}
                              </p>
                              {published ? (
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-1 block truncate font-black text-white hover:text-emerald-200 hover:underline"
                                >
                                  {product.name}
                                </a>
                              ) : (
                                <h3 className="mt-1 truncate font-black">
                                  {product.name}
                                </h3>
                              )}
                              <p className="mt-1 text-sm font-bold text-emerald-300">
                                {money(product.sellingPrice)}
                              </p>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs">
                            <span className="rounded-full bg-slate-800 px-2.5 py-1 text-slate-300">
                              {SHOP_CATEGORY_OPTIONS.find(
                                (item) => item.value === product.category,
                              )?.label || product.category}
                            </span>
                            <span
                              className={`rounded-full px-2.5 py-1 font-bold ${published ? "bg-emerald-400/15 text-emerald-200" : "bg-amber-400/15 text-amber-100"}`}
                            >
                              {published
                                ? "Live on website"
                                : "Needs image to publish"}
                            </span>
                          </div>
                          <div className="mt-4 flex gap-2">
                            {published ? (
                              <a
                                href={href}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-lg border border-emerald-400/40 px-3 py-2 text-sm font-bold text-emerald-200"
                              >
                                Preview website
                              </a>
                            ) : null}
                            <button
                              onClick={() => {
                                setEditingId(product.id);
                                setForm(toForm(product));
                                window.scrollTo({ top: 0, behavior: "smooth" });
                              }}
                              className="rounded-lg border border-cyan-400/40 px-3 py-2 text-sm font-bold text-cyan-300"
                            >
                              Edit product
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                  <div className="mt-5 hidden overflow-x-auto rounded-2xl border border-white/10 md:block">
                    <table className="w-full min-w-[860px] text-sm">
                      <thead className="border-b border-white/10 bg-slate-950/70 text-left text-xs uppercase tracking-wider text-slate-400">
                        <tr>
                          <th className="px-4 py-3">Product</th>
                          <th className="px-4 py-3">Category</th>
                          <th className="px-4 py-3">Price</th>
                          <th className="px-4 py-3">Website</th>
                          <th className="px-4 py-3">Updated</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.map((product) => {
                          const published =
                            product.showInShop && product.ecommerceVisible;
                          const href = productWebsiteUrl(product);
                          const category =
                            SHOP_CATEGORY_OPTIONS.find(
                              (item) => item.value === product.category,
                            )?.label || product.category;
                          return (
                            <tr
                              key={product.id}
                              className="border-b border-white/10 last:border-0 hover:bg-white/[0.025]"
                            >
                              <td className="px-4 py-4">
                                <div className="flex items-center gap-3">
                                  {product.mainImageUrl ? (
                                    <img
                                      src={product.mainImageUrl}
                                      alt=""
                                      className="h-14 w-14 rounded-xl object-cover"
                                    />
                                  ) : (
                                    <div className="grid h-14 w-14 place-items-center rounded-xl bg-slate-800 text-xs font-black text-slate-400">
                                      {product.name.slice(0, 2).toUpperCase()}
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <p className="font-mono text-[11px] text-slate-500">
                                      {product.sku}
                                    </p>
                                    {published ? (
                                      <a
                                        href={href}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="block max-w-[260px] truncate font-bold text-white hover:text-emerald-200 hover:underline"
                                      >
                                        {product.name}
                                      </a>
                                    ) : (
                                      <p className="max-w-[260px] truncate font-bold text-white">
                                        {product.name}
                                      </p>
                                    )}
                                    <p className="mt-1 text-xs text-slate-400">
                                      {product.brand || "No brand"}
                                      {product.warrantyPeriod
                                        ? ` · ${product.warrantyPeriod}`
                                        : ""}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-4 text-slate-300">
                                <p>{category}</p>
                                {product.shopSubcategory ? (
                                  <p className="mt-1 text-xs text-slate-500">
                                    {product.shopSubcategory}
                                  </p>
                                ) : null}
                              </td>
                              <td className="px-4 py-4 font-black text-emerald-300">
                                {money(product.sellingPrice)}
                              </td>
                              <td className="px-4 py-4">
                                <span
                                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${published ? "bg-emerald-400/15 text-emerald-200" : "bg-amber-400/15 text-amber-100"}`}
                                >
                                  {published
                                    ? "Live on website"
                                    : "Needs image"}
                                </span>
                              </td>
                              <td className="px-4 py-4 text-slate-400">
                                {new Date(product.updatedAt).toLocaleDateString(
                                  "en-KE",
                                )}
                              </td>
                              <td className="px-4 py-4">
                                <div className="flex justify-end gap-2">
                                  {published ? (
                                    <a
                                      href={href}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="rounded-lg border border-emerald-400/40 px-3 py-2 text-xs font-bold text-emerald-200"
                                    >
                                      Preview
                                    </a>
                                  ) : null}
                                  <button
                                    onClick={() => {
                                      setEditingId(product.id);
                                      setForm(toForm(product));
                                      window.scrollTo({
                                        top: 0,
                                        behavior: "smooth",
                                      });
                                    }}
                                    className="rounded-lg border border-cyan-400/40 px-3 py-2 text-xs font-bold text-cyan-300"
                                  >
                                    Edit
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>
          </>
        )}
        {categoryOpen ? (
          <div
            className="fixed inset-0 z-50 flex justify-end bg-black/60"
            role="dialog"
            aria-modal="true"
            aria-label="Select category"
          >
            <section className="h-full w-full max-w-lg overflow-y-auto bg-slate-50 p-6 text-slate-900 shadow-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black">
                    {pickerCategoryDefinition
                      ? pickerCategoryDefinition.label
                      : "Categories"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {pickerCategoryDefinition
                      ? "Choose a subcategory"
                      : "Choose a category first"}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setCategoryOpen(false);
                    setPickerCategory(null);
                  }}
                  className="text-2xl text-slate-500"
                >
                  ×
                </button>
              </div>
              {pickerCategoryDefinition ? (
                <button
                  type="button"
                  onClick={() => {
                    setPickerCategory(null);
                    setCategoryQuery("");
                  }}
                  className="mt-5 text-sm font-bold text-amber-700"
                >
                  ← All categories
                </button>
              ) : (
                <input
                  autoFocus
                  value={categoryQuery}
                  onChange={(e) => setCategoryQuery(e.target.value)}
                  className="mt-5 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-amber-500"
                  placeholder="Search category or subcategory"
                />
              )}
              {!pickerCategoryDefinition &&
              recentCategories.length &&
              !categoryQuery ? (
                <div className="mt-6">
                  <h3 className="font-black">Recently used categories</h3>
                  <div className="mt-3 space-y-2">
                    {recentCategories.map((value) => {
                      const category = SHOP_CATEGORY_OPTIONS.find(
                        (item) => item.value === value,
                      );
                      return category ? (
                        <button
                          key={value}
                          onClick={() => selectCategory(value)}
                          className="block w-full rounded-xl border border-slate-200 px-4 py-3 text-left font-semibold hover:border-amber-500"
                        >
                          {category.label}
                        </button>
                      ) : null;
                    })}
                  </div>
                </div>
              ) : null}
              <div className="mt-6">
                <h3 className="font-black">
                  {pickerCategoryDefinition
                    ? "Subcategories"
                    : categoryQuery
                      ? "Matching categories and subcategories"
                      : "All categories"}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {pickerCategoryDefinition
                    ? "Only the selected category's subcategories are shown."
                    : "Choose a category to continue, or select a subcategory directly."}
                </p>
                <div className="mt-3 space-y-1">
                  {categoryPickerItems.map((item) => (
                    <button
                      key={`${item.type}-${item.category.value}-${item.type === "subcategory" ? item.subcategory.value : ""}`}
                      onClick={() => {
                        if (item.type === "subcategory") {
                          chooseCategoryAndSubcategory(
                            item.category.value,
                            item.subcategory.value,
                          );
                          return;
                        }
                        selectCategory(item.category.value);
                      }}
                      className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left hover:bg-amber-50 ${item.type === "subcategory" ? (form.category === item.category.value && form.shopSubcategory === item.subcategory.value ? "bg-amber-100 font-black" : "") : form.category === item.category.value ? "bg-amber-100 font-black" : ""}`}
                    >
                      <span>
                        <span className="block">
                          {item.type === "subcategory"
                            ? item.subcategory.label
                            : item.category.label}
                        </span>
                        {item.type === "subcategory" ? (
                          <span className="text-xs font-normal text-slate-500">
                            {item.category.label}
                            {item.subcategory.productTypes?.length
                              ? ` · ${item.subcategory.productTypes.map((productType) => productType.label).join(" · ")}`
                              : ""}
                          </span>
                        ) : null}
                      </span>
                      <span className="text-amber-600">
                        {item.type === "subcategory" ? "Select" : "›"}
                      </span>
                    </button>
                  ))}
                  {!categoryPickerItems.length ? (
                    <p className="px-4 py-3 text-sm text-slate-500">
                      No matching category.
                    </p>
                  ) : null}
                </div>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}
