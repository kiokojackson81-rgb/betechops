"use client";

import { FormEvent, useEffect, useState } from "react";
import ProductDescriptionEditor from "@/components/ProductDescriptionEditor";
import { getShopSubcategoryOptions, SHOP_CATEGORY_DEFINITIONS, SHOP_CATEGORY_OPTIONS } from "@/app/shop/shopCatalogConfig";

type Product = {
  id: string; sku: string; name: string; sellingPrice: number; category: string; shopSubcategory?: string | null; brand?: string | null;
  shortDescription?: string | null; description?: string | null; specifications?: string[] | null;
  warrantyPeriod?: string | null; warrantyNotes?: string | null; tiktokVideoUrl?: string | null; mainImageUrl?: string | null; variableCost?: boolean | null; lastBuyingPrice?: number | null; catalogueConfiguration?: Record<string, unknown> | null;
  galleryImageUrls?: string[] | null; availabilityType?: string | null; stockQuantity?: number | null;
  showInShop: boolean; ecommerceVisible: boolean; updatedAt: string; earningKes: number;
};
type Withdrawal = { id: string; amountKes: number; status: string; paymentReference?: string | null; adminNote?: string | null; requestedAt: string; processedAt?: string | null };
type Balance = { productsCreated: number; totalEarnedKes: number; paidKes: number; pendingKes: number; availableKes: number };

const blank = () => ({
  name: "", sellingPrice: "", category: "", shopSubcategory: "", brand: "", shortDescription: "", description: "", specifications: "",
  warrantyPeriod: "", warrantyNotes: "", tiktokVideoUrl: "", mainImageUrl: "", galleryImageUrls: "", availabilityType: "WAREHOUSE", stockQuantity: "0", variableCost: false, lastBuyingPrice: "",
  requiresInstallation: false, installationIncluded: false, transportIncluded: false, zone1TransportFee: "500", zone2TransportFee: "750", zone3TransportFee: "1000",
});

function money(value: number) { return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(value); }
function toForm(product: Product) {
  const policy = product.catalogueConfiguration && typeof product.catalogueConfiguration === "object" ? product.catalogueConfiguration : {};
  const requiresInstallation = policy.installationType !== "NOT_REQUIRED" && policy.installationFeeMode !== "UNAVAILABLE";
  return {
    name: product.name, sellingPrice: String(product.sellingPrice), category: product.category, shopSubcategory: product.shopSubcategory || "", brand: product.brand || "",
    shortDescription: product.shortDescription || "", description: product.description || "",
    specifications: Array.isArray(product.specifications) ? product.specifications.join("\n") : "",
    warrantyPeriod: product.warrantyPeriod || "", warrantyNotes: product.warrantyNotes || "", tiktokVideoUrl: product.tiktokVideoUrl || "", mainImageUrl: product.mainImageUrl || "",
    galleryImageUrls: Array.isArray(product.galleryImageUrls) ? product.galleryImageUrls.join("\n") : "",
    availabilityType: product.availabilityType || "WAREHOUSE", stockQuantity: String(product.stockQuantity || 0), variableCost: Boolean(product.variableCost), lastBuyingPrice: product.lastBuyingPrice == null ? "" : String(product.lastBuyingPrice),
    requiresInstallation, installationIncluded: policy.installationType === "INCLUDED" || policy.installationFeeMode === "INCLUDED", transportIncluded: policy.transportMode === "INCLUDED" || policy.transportMode === "FREE",
    zone1TransportFee: String(policy.zone1TransportFee ?? 500), zone2TransportFee: String(policy.zone2TransportFee ?? 750), zone3TransportFee: String(policy.zone3TransportFee ?? 1000),
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
  const [recentCategories, setRecentCategories] = useState<string[]>([]);

  async function load() {
    const res = await fetch("/api/contributor/dashboard", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) { setNotice(data.error || "Unable to load your dashboard."); return; }
    setProducts(data.products || []); setWithdrawals(data.withdrawals || []); setBalance(data.balance); setEarning(data.earningPerProductKes || 5);
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => { void fetch("/api/contributor/brands", { cache: "no-store" }).then((res) => res.json()).then((data) => setBrands(data.items || [])).catch(() => undefined); }, []);
  useEffect(() => { try { setRecentCategories(JSON.parse(localStorage.getItem("betech-contributor-recent-categories") || "[]")); } catch { setRecentCategories([]); } }, []);
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const chooseCategory = (category: string, shopSubcategory = "") => { setForm((current) => ({ ...current, category, shopSubcategory })); setCategoryOpen(false); setCategoryQuery(""); setRecentCategories((current) => { const next = [category, ...current.filter((value) => value !== category)].slice(0, 5); localStorage.setItem("betech-contributor-recent-categories", JSON.stringify(next)); return next; }); };
  const filteredBrands = brands.filter((brand) => brand.toLowerCase().includes(form.brand.toLowerCase())).slice(0, 8);
  const categorySearchResults = SHOP_CATEGORY_DEFINITIONS.flatMap((category) => [
    { kind: "category" as const, category: category.value, subcategory: "", label: category.label, detail: "Category" },
    ...category.subcategories.map((subcategory) => ({ kind: "subcategory" as const, category: category.value, subcategory: subcategory.value, label: subcategory.label, detail: category.label })),
  ]).filter((item) => `${item.label} ${item.detail}`.toLowerCase().includes(categoryQuery.toLowerCase()));
  const payload = () => ({
    ...form, sellingPrice: Number(form.sellingPrice), stockQuantity: Number(form.stockQuantity || 0), lastBuyingPrice: form.lastBuyingPrice ? Number(form.lastBuyingPrice) : null,
    tiktokVideoUrl: form.tiktokVideoUrl.trim() || null,
    zone1TransportFee: Number(form.zone1TransportFee || 500), zone2TransportFee: Number(form.zone2TransportFee || 750), zone3TransportFee: Number(form.zone3TransportFee || 1000),
    specifications: form.specifications.split("\n").map((x) => x.trim()).filter(Boolean),
    galleryImageUrls: form.galleryImageUrls.split("\n").map((x) => x.trim()).filter(Boolean),
  });

  async function submitProduct(event: FormEvent) {
    event.preventDefault(); setBusy(true); setNotice(null);
    const url = editingId ? `/api/contributor/products/${editingId}` : "/api/contributor/dashboard";
    const res = await fetch(url, { method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload()) });
    const data = await res.json().catch(() => ({})); setBusy(false);
    if (!res.ok) { setNotice(data.error?.formErrors?.[0] || data.error || "Could not save the product."); return; }
    setNotice(editingId ? "Product updated and published to the website." : `Product created. ${money(earning)} was added to your earnings.`);
    setForm(blank()); setEditingId(null); await load(); window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function uploadImage(file?: File | null, target: "main" | "gallery" = "main") {
    if (!file) return; setBusy(true); setNotice(null);
    const body = new FormData(); body.set("file", file);
    const res = await fetch("/api/contributor/upload", { method: "POST", body }); const data = await res.json().catch(() => ({})); setBusy(false);
    if (!res.ok) { setNotice(data.error || "Image upload failed."); return; }
    if (target === "main") set("mainImageUrl", data.url);
    else set("galleryImageUrls", [form.galleryImageUrls, data.url].filter(Boolean).join("\n"));
    setNotice("Image uploaded. Complete the product details and save it.");
  }
  async function requestWithdrawal(event: FormEvent) {
    event.preventDefault(); setBusy(true); setNotice(null);
    const res = await fetch("/api/contributor/withdrawals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amountKes: Number(withdrawAmount) }) });
    const data = await res.json().catch(() => ({})); setBusy(false);
    if (!res.ok) { setNotice(data.error || "Could not request withdrawal."); return; }
    setWithdrawAmount(""); setNotice("Withdrawal request sent to the administrator."); await load();
  }
  const input = "mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400";
  const label = "block text-sm font-semibold text-slate-200";

  return <main className="min-h-screen bg-[#07121a] px-4 py-8 text-slate-100 sm:px-8">
    <div className="mx-auto max-w-7xl space-y-7">
      <header className="rounded-3xl border border-emerald-400/20 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,.2),transparent_35%),#0b1823] p-7">
        <p className="text-xs font-black uppercase tracking-[.25em] text-emerald-300">Betech product contributor</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Website product desk</h1>
        <p className="mt-2 max-w-2xl text-slate-300">Create complete products for the Betech website. Every product you create earns {money(earning)}. You can edit your work at any time; products cannot be deleted from this workspace.</p>
      </header>
      {notice ? <div className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">{notice}</div> : null}
      <nav className="flex gap-2 rounded-2xl border border-white/10 bg-slate-900/80 p-2"><button onClick={() => setTab("catalogue")} className={`rounded-xl px-5 py-3 font-black ${tab === "catalogue" ? "bg-emerald-400 text-slate-950" : "text-slate-300"}`}>Product catalogue ({products.length})</button><button onClick={() => setTab("earnings")} className={`rounded-xl px-5 py-3 font-black ${tab === "earnings" ? "bg-emerald-400 text-slate-950" : "text-slate-300"}`}>Financial earnings</button></nav>
      {tab === "earnings" ? <><section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[["Products created", balance?.productsCreated ?? 0], ["Total earned", money(balance?.totalEarnedKes ?? 0)], ["Available to withdraw", money(balance?.availableKes ?? 0)], ["Awaiting payment", money(balance?.pendingKes ?? 0)], ["Already paid", money(balance?.paidKes ?? 0)]].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-white/10 bg-slate-900 p-4"><p className="text-xs uppercase tracking-wider text-slate-400">{label}</p><p className="mt-2 text-2xl font-black text-emerald-300">{value}</p></div>)}
      </section><section className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-slate-900/80 p-5"><h2 className="text-xl font-black">Request withdrawal</h2><p className="mt-1 text-sm text-slate-400">Available balance: {money(balance?.availableKes ?? 0)}</p><form onSubmit={requestWithdrawal} className="mt-4 flex gap-2"><input required min="1" max={balance?.availableKes ?? 0} type="number" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} className={input} placeholder="Amount" /><button disabled={busy || !balance?.availableKes} className="rounded-xl bg-cyan-400 px-4 font-black text-slate-950 disabled:opacity-50">Request</button></form><h3 className="mt-6 text-lg font-black">Withdrawal history</h3><div className="mt-3 space-y-3">{withdrawals.length ? withdrawals.map((item) => <div key={item.id} className="rounded-xl border border-white/10 p-3 text-sm"><div className="flex justify-between gap-3"><strong>{money(item.amountKes)}</strong><span className="font-bold text-emerald-300">{item.status}</span></div><p className="mt-1 text-slate-400">{new Date(item.requestedAt).toLocaleDateString("en-KE")}{item.paymentReference ? ` · ${item.paymentReference}` : ""}</p>{item.adminNote ? <p className="mt-1 text-slate-300">{item.adminNote}</p> : null}</div>) : <p className="text-sm text-slate-400">No withdrawal requests yet.</p>}</div></section></> : <><div className="grid gap-7">
        <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-black">{editingId ? "Edit product" : "Create product"}</h2><p className="mt-1 text-sm text-slate-400">The image, price, category, and description are required for a usable website listing.</p></div>{editingId ? <button onClick={() => { setEditingId(null); setForm(blank()); }} className="text-sm font-bold text-cyan-300">Create a new product instead</button> : null}</div>
          <form onSubmit={submitProduct} className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className={label}>Product name<input required value={form.name} onChange={(e) => { const name = e.target.value; set("name", name); if (!form.category) { const match = SHOP_CATEGORY_DEFINITIONS.map((category) => ({ category, score: category.keywords.filter((keyword) => name.toLowerCase().includes(keyword)).length })).sort((a, b) => b.score - a.score)[0]; if (match?.score) setForm((current) => ({ ...current, name, category: match.category.value, shopSubcategory: "" })); } }} className={input} placeholder="e.g. 5kW Hybrid Solar Inverter" /><span className="mt-1 block text-xs text-amber-200">Category is suggested from the product name. You can change it below.</span></label>
            <label className={label}>Selling price (KES)<input required min="0" type="number" value={form.sellingPrice} onChange={(e) => set("sellingPrice", e.target.value)} className={input} /></label>
            <div className={`${label} relative`}>Website category<button type="button" onClick={() => setCategoryOpen(true)} className={`${input} flex items-center justify-between text-left`}>{SHOP_CATEGORY_OPTIONS.find((category) => category.value === form.category)?.label || "Select category"}<span>⌄</span></button></div>
            <div className={`${label} relative`}>Brand<input value={form.brand} onFocus={() => setBrandOpen(true)} onChange={(e) => { set("brand", e.target.value); setBrandOpen(true); }} onBlur={() => window.setTimeout(() => setBrandOpen(false), 150)} className={input} placeholder="Type to select or add a brand" />{brandOpen && form.brand.trim() ? <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-950 shadow-2xl">{filteredBrands.map((brand) => <button type="button" key={brand} onMouseDown={() => { set("brand", brand); setBrandOpen(false); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-emerald-400/10">{brand}</button>)}{!filteredBrands.some((brand) => brand.toLowerCase() === form.brand.trim().toLowerCase()) ? <button type="button" onMouseDown={() => setBrandOpen(false)} className="block w-full border-t border-slate-800 px-3 py-2 text-left text-sm font-bold text-emerald-300">Add “{form.brand.trim()}” as a new brand</button> : null}</div> : null}</div>
            <label className={label}>Website subcategory<select value={form.shopSubcategory} disabled={!form.category} onChange={(e) => set("shopSubcategory", e.target.value)} className={input}><option value="">Select subcategory</option>{getShopSubcategoryOptions(form.category).map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></label>
            <div className="sm:col-span-2"><span className={label}>Product short description</span><div className="mt-1 overflow-hidden rounded-xl border border-slate-700 bg-slate-950"><ProductDescriptionEditor value={form.shortDescription} onChange={(value) => set("shortDescription", value)} disabled={busy} showPreview={false} compact placeholder="Brief customer-facing product summary." /></div></div>
            <div className="sm:col-span-2"><span className={label}>Product long description</span><div className="mt-1 overflow-hidden rounded-xl border border-slate-700 bg-slate-950"><ProductDescriptionEditor value={form.description} onChange={(value) => set("description", value)} disabled={busy} showPreview={false} placeholder="Include only product-related information. Keep it clear, accurate, and consistent with the product images." /></div></div>
            <div className="sm:col-span-2"><span className={label}>Key features</span><div className="mt-1 overflow-hidden rounded-xl border border-slate-700 bg-slate-950"><ProductDescriptionEditor value={form.specifications} onChange={(value) => set("specifications", value)} disabled={busy} showPreview={false} compact placeholder="Add key features as bullets, for example: lightweight design, long battery life, Wi-Fi connectivity." /></div></div>
            <div className="sm:col-span-2 rounded-2xl border border-white/10 bg-slate-950/70 p-4"><label className="flex items-center gap-3 font-bold"><input type="checkbox" checked={form.variableCost} onChange={(e) => setForm((current) => ({ ...current, variableCost: e.target.checked, lastBuyingPrice: e.target.checked ? "" : current.lastBuyingPrice }))} />Variable-cost project</label><label className="mt-3 block text-sm font-semibold text-slate-200">Buying price<input disabled={form.variableCost} min="0" type="number" value={form.lastBuyingPrice} onChange={(e) => set("lastBuyingPrice", e.target.value)} className={input} placeholder="Optional" /></label></div>
            <label className={label}>Warranty period<input value={form.warrantyPeriod} onChange={(e) => set("warrantyPeriod", e.target.value)} className={input} /></label>
            <label className={label}>Stock quantity<input min="0" type="number" value={form.stockQuantity} onChange={(e) => set("stockQuantity", e.target.value)} className={input} /></label>
            <label className={label}>Availability<select value={form.availabilityType} onChange={(e) => set("availabilityType", e.target.value)} className={input}><option value="WAREHOUSE">Available in Warehouse</option><option value="SHOP">Available at Shop</option><option value="ORDER_ON_REQUEST">Order on request</option><option value="OUT_OF_STOCK">Out of stock</option></select></label>
            <label className={label}>Warranty notes<input value={form.warrantyNotes} onChange={(e) => set("warrantyNotes", e.target.value)} className={input} /></label>
            <label className="sm:col-span-2 text-sm font-semibold text-slate-200">TikTok video link<input type="url" value={form.tiktokVideoUrl} onChange={(e) => set("tiktokVideoUrl", e.target.value)} className={input} placeholder="https://www.tiktok.com/@account/video/1234567890" /><span className="mt-1 block text-xs font-normal text-slate-400">Paste the TikTok product video link. It will appear on the product page.</span></label>
            <section className="sm:col-span-2 rounded-2xl border border-amber-300/25 bg-amber-300/5 p-4"><h3 className="font-black text-amber-100">Installation & transport</h3><div className="mt-4 grid gap-3 md:grid-cols-3"><label className="rounded-xl border border-white/10 p-3"><input type="checkbox" checked={form.requiresInstallation} onChange={(e) => setForm((current) => ({ ...current, requiresInstallation: e.target.checked, installationIncluded: e.target.checked ? current.installationIncluded : false }))} /> <b>Requires installation</b><span className="mt-2 block text-xs text-slate-400">The product or system must be installed by a technician.</span></label><label className="rounded-xl border border-white/10 p-3"><input disabled={!form.requiresInstallation} type="checkbox" checked={form.installationIncluded} onChange={(e) => setForm((current) => ({ ...current, installationIncluded: e.target.checked }))} /> <b>Installation included</b><span className="mt-2 block text-xs text-slate-400">The selling price already covers installation.</span></label><label className="rounded-xl border border-white/10 p-3"><input type="checkbox" checked={form.transportIncluded} onChange={(e) => setForm((current) => ({ ...current, transportIncluded: e.target.checked }))} /> <b>Transport included</b><span className="mt-2 block text-xs text-slate-400">No additional delivery or transport fee is charged.</span></label></div>{!form.transportIncluded ? <div className="mt-4"><h4 className="font-bold">Transport fees by service zone</h4><p className="mt-1 text-xs text-slate-400">These fees are shown on the storefront when the customer selects a delivery zone.</p><div className="mt-3 grid gap-3 sm:grid-cols-3"><label className={label}>Zone 1 fee (KES)<input type="number" min="0" value={form.zone1TransportFee} onChange={(e) => set("zone1TransportFee", e.target.value)} className={input} /></label><label className={label}>Zone 2 fee (KES)<input type="number" min="0" value={form.zone2TransportFee} onChange={(e) => set("zone2TransportFee", e.target.value)} className={input} /></label><label className={label}>Zone 3 fee (KES)<input type="number" min="0" value={form.zone3TransportFee} onChange={(e) => set("zone3TransportFee", e.target.value)} className={input} /></label></div></div> : null}</section>
            <div className="sm:col-span-2"><span className={label}>Product images</span><p className="mt-1 text-xs text-slate-400">Add a clear main image, then optional gallery images. JPG, PNG and WebP work best.</p><div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4"><label className="group relative flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-amber-400/60 bg-slate-950 text-center text-sm font-bold text-amber-200">{form.mainImageUrl ? <img src={form.mainImageUrl} alt="Main product" className="h-full w-full object-cover" /> : <span>+<br />Main image</span>}<input required={!form.mainImageUrl} type="file" accept="image/*" disabled={busy} onChange={(e) => void uploadImage(e.target.files?.[0], "main")} className="absolute inset-0 cursor-pointer opacity-0" /></label>{[0, 1, 2].map((index) => { const url = form.galleryImageUrls.split("\n").filter(Boolean)[index]; return <label key={index} className="relative flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-slate-600 bg-slate-950 text-center text-sm font-bold text-slate-300">{url ? <img src={url} alt="Gallery product" className="h-full w-full object-cover" /> : <span>+<br />Image</span>}<input type="file" accept="image/*" disabled={busy} onChange={(e) => void uploadImage(e.target.files?.[0], "gallery")} className="absolute inset-0 cursor-pointer opacity-0" /></label>; })}</div></div>
            <div className="sm:col-span-2 flex justify-end"><button disabled={busy} className="rounded-xl bg-emerald-400 px-5 py-3 font-black text-slate-950 disabled:opacity-60">{busy ? "Saving..." : editingId ? "Save product changes" : "Create product and earn KES 5"}</button></div>
          </form>
        </section>
      </div>
      <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-7"><h2 className="text-2xl font-black">Your products</h2><div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{products.length ? products.map((product) => <article key={product.id} className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950"><div className="aspect-[16/9] bg-slate-800">{product.mainImageUrl ? <img src={product.mainImageUrl} alt="" className="h-full w-full object-cover" /> : null}</div><div className="p-4"><p className="text-xs text-slate-400">{product.sku}</p><h3 className="mt-1 font-black">{product.name}</h3><p className="mt-1 text-sm text-emerald-300">{money(product.sellingPrice)} · {product.showInShop ? "Visible on website" : "Needs image to publish"}</p><button onClick={() => { setEditingId(product.id); setForm(toForm(product)); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="mt-4 rounded-lg border border-cyan-400/40 px-3 py-2 text-sm font-bold text-cyan-300">Edit product</button></div></article>) : <p className="text-slate-400">Your products will appear here after you create them.</p>}</div></section>
      </>}
      {categoryOpen ? <div className="fixed inset-0 z-50 flex justify-end bg-black/60" role="dialog" aria-modal="true" aria-label="Select category"><section className="h-full w-full max-w-lg overflow-y-auto bg-slate-50 p-6 text-slate-900 shadow-2xl"><div className="flex items-center justify-between"><h2 className="text-xl font-black">Categories</h2><button onClick={() => setCategoryOpen(false)} className="text-2xl text-slate-500">×</button></div><input autoFocus value={categoryQuery} onChange={(e) => setCategoryQuery(e.target.value)} className="mt-5 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-amber-500" placeholder="Search category or subcategory" />{recentCategories.length && !categoryQuery ? <div className="mt-6"><h3 className="font-black">Recently used categories</h3><div className="mt-3 space-y-2">{recentCategories.map((value) => { const category = SHOP_CATEGORY_OPTIONS.find((item) => item.value === value); return category ? <button key={value} onClick={() => chooseCategory(value)} className="block w-full rounded-xl border border-slate-200 px-4 py-3 text-left font-semibold hover:border-amber-500">{category.label}</button> : null; })}</div></div> : null}<div className="mt-6"><h3 className="font-black">{categoryQuery ? "Matching categories and subcategories" : "All categories and subcategories"}</h3><p className="mt-1 text-sm text-slate-500">Choose a subcategory to fill both fields at once.</p><div className="mt-3 space-y-1">{categorySearchResults.map((item) => <button key={`${item.category}-${item.subcategory || "all"}`} onClick={() => chooseCategory(item.category, item.subcategory)} className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left hover:bg-amber-50 ${form.category === item.category && form.shopSubcategory === item.subcategory ? "bg-amber-100 font-black" : ""}`}><span><span className="block">{item.label}</span><span className="text-xs font-normal text-slate-500">{item.detail}</span></span><span className="text-amber-600">{item.kind === "subcategory" ? "Select" : "›"}</span></button>)}{!categorySearchResults.length ? <p className="px-4 py-3 text-sm text-slate-500">No matching category or subcategory.</p> : null}</div></div></section></div> : null}
    </div>
  </main>;
}
