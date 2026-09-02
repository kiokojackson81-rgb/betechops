"use client";

import { FormEvent, useEffect, useState } from "react";

type Product = {
  id: string; sku: string; name: string; sellingPrice: number; category: string; brand?: string | null;
  shortDescription?: string | null; description?: string | null; specifications?: string[] | null;
  warrantyPeriod?: string | null; warrantyNotes?: string | null; mainImageUrl?: string | null;
  galleryImageUrls?: string[] | null; availabilityType?: string | null; stockQuantity?: number | null;
  showInShop: boolean; ecommerceVisible: boolean; updatedAt: string; earningKes: number;
};
type Withdrawal = { id: string; amountKes: number; status: string; paymentReference?: string | null; adminNote?: string | null; requestedAt: string; processedAt?: string | null };
type Balance = { productsCreated: number; totalEarnedKes: number; paidKes: number; pendingKes: number; availableKes: number };

const blank = () => ({
  name: "", sellingPrice: "", category: "", brand: "", shortDescription: "", description: "", specifications: "",
  warrantyPeriod: "", warrantyNotes: "", mainImageUrl: "", galleryImageUrls: "", availabilityType: "SHOP", stockQuantity: "0",
});

function money(value: number) { return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(value); }
function toForm(product: Product) {
  return {
    name: product.name, sellingPrice: String(product.sellingPrice), category: product.category, brand: product.brand || "",
    shortDescription: product.shortDescription || "", description: product.description || "",
    specifications: Array.isArray(product.specifications) ? product.specifications.join("\n") : "",
    warrantyPeriod: product.warrantyPeriod || "", warrantyNotes: product.warrantyNotes || "", mainImageUrl: product.mainImageUrl || "",
    galleryImageUrls: Array.isArray(product.galleryImageUrls) ? product.galleryImageUrls.join("\n") : "",
    availabilityType: product.availabilityType || "SHOP", stockQuantity: String(product.stockQuantity || 0),
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

  async function load() {
    const res = await fetch("/api/contributor/dashboard", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) { setNotice(data.error || "Unable to load your dashboard."); return; }
    setProducts(data.products || []); setWithdrawals(data.withdrawals || []); setBalance(data.balance); setEarning(data.earningPerProductKes || 5);
  }
  useEffect(() => { void load(); }, []);
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const payload = () => ({
    ...form, sellingPrice: Number(form.sellingPrice), stockQuantity: Number(form.stockQuantity || 0),
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
  async function uploadImage(file?: File | null) {
    if (!file) return; setBusy(true); setNotice(null);
    const body = new FormData(); body.set("file", file);
    const res = await fetch("/api/contributor/upload", { method: "POST", body }); const data = await res.json().catch(() => ({})); setBusy(false);
    if (!res.ok) { setNotice(data.error || "Image upload failed."); return; }
    set("mainImageUrl", data.url); setNotice("Image uploaded. Complete the product details and save it.");
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
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[["Products created", balance?.productsCreated ?? 0], ["Total earned", money(balance?.totalEarnedKes ?? 0)], ["Available to withdraw", money(balance?.availableKes ?? 0)], ["Awaiting payment", money(balance?.pendingKes ?? 0)], ["Already paid", money(balance?.paidKes ?? 0)]].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-white/10 bg-slate-900 p-4"><p className="text-xs uppercase tracking-wider text-slate-400">{label}</p><p className="mt-2 text-2xl font-black text-emerald-300">{value}</p></div>)}
      </section>
      <div className="grid gap-7 xl:grid-cols-[1.25fr_.75fr]">
        <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-black">{editingId ? "Edit product" : "Create product"}</h2><p className="mt-1 text-sm text-slate-400">The image, price, category, and description are required for a usable website listing.</p></div>{editingId ? <button onClick={() => { setEditingId(null); setForm(blank()); }} className="text-sm font-bold text-cyan-300">Create a new product instead</button> : null}</div>
          <form onSubmit={submitProduct} className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className={label}>Product name<input required value={form.name} onChange={(e) => set("name", e.target.value)} className={input} /></label>
            <label className={label}>Selling price (KES)<input required min="0" type="number" value={form.sellingPrice} onChange={(e) => set("sellingPrice", e.target.value)} className={input} /></label>
            <label className={label}>Website category<input required placeholder="e.g. Solar full kits" value={form.category} onChange={(e) => set("category", e.target.value)} className={input} /></label>
            <label className={label}>Brand<input value={form.brand} onChange={(e) => set("brand", e.target.value)} className={input} /></label>
            <label className={`${label} sm:col-span-2`}>Short description<textarea value={form.shortDescription} onChange={(e) => set("shortDescription", e.target.value)} className={input} rows={2} /></label>
            <label className={`${label} sm:col-span-2`}>Full rich-text description<textarea value={form.description} onChange={(e) => set("description", e.target.value)} className={input} rows={6} placeholder="Use the admin rich-text conventions: paragraphs, headings, bullets and links are supported." /></label>
            <label className={`${label} sm:col-span-2`}>Specifications, one per line<textarea value={form.specifications} onChange={(e) => set("specifications", e.target.value)} className={input} rows={4} placeholder="Inverter capacity: 3kW&#10;Battery: 5.12kWh" /></label>
            <label className={label}>Warranty period<input value={form.warrantyPeriod} onChange={(e) => set("warrantyPeriod", e.target.value)} className={input} /></label>
            <label className={label}>Stock quantity<input min="0" type="number" value={form.stockQuantity} onChange={(e) => set("stockQuantity", e.target.value)} className={input} /></label>
            <label className={label}>Availability<select value={form.availabilityType} onChange={(e) => set("availabilityType", e.target.value)} className={input}><option value="SHOP">In shop</option><option value="WAREHOUSE">Warehouse</option><option value="ORDER_ON_REQUEST">Order on request</option><option value="OUT_OF_STOCK">Out of stock</option></select></label>
            <label className={label}>Warranty notes<input value={form.warrantyNotes} onChange={(e) => set("warrantyNotes", e.target.value)} className={input} /></label>
            <label className={`${label} sm:col-span-2`}>Main product image<input required type="url" value={form.mainImageUrl} onChange={(e) => set("mainImageUrl", e.target.value)} className={input} placeholder="Image URL" /><input type="file" accept="image/*" disabled={busy} onChange={(e) => void uploadImage(e.target.files?.[0])} className="mt-2 block text-xs text-slate-300" /></label>
            <label className={`${label} sm:col-span-2`}>Gallery image URLs, one per line<textarea value={form.galleryImageUrls} onChange={(e) => set("galleryImageUrls", e.target.value)} className={input} rows={3} /></label>
            <div className="sm:col-span-2 flex justify-end"><button disabled={busy} className="rounded-xl bg-emerald-400 px-5 py-3 font-black text-slate-950 disabled:opacity-60">{busy ? "Saving..." : editingId ? "Save product changes" : "Create product and earn KES 5"}</button></div>
          </form>
        </section>
        <aside className="space-y-7">
          <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5"><h2 className="text-xl font-black">Request withdrawal</h2><p className="mt-1 text-sm text-slate-400">Available balance: {money(balance?.availableKes ?? 0)}</p><form onSubmit={requestWithdrawal} className="mt-4 flex gap-2"><input required min="1" max={balance?.availableKes ?? 0} type="number" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} className={input} placeholder="Amount" /><button disabled={busy || !balance?.availableKes} className="rounded-xl bg-cyan-400 px-4 font-black text-slate-950 disabled:opacity-50">Request</button></form></section>
          <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5"><h2 className="text-xl font-black">Withdrawal history</h2><div className="mt-4 space-y-3">{withdrawals.length ? withdrawals.map((item) => <div key={item.id} className="rounded-xl border border-white/10 p-3 text-sm"><div className="flex justify-between gap-3"><strong>{money(item.amountKes)}</strong><span className="font-bold text-emerald-300">{item.status}</span></div><p className="mt-1 text-slate-400">{new Date(item.requestedAt).toLocaleDateString("en-KE")}{item.paymentReference ? ` · ${item.paymentReference}` : ""}</p>{item.adminNote ? <p className="mt-1 text-slate-300">{item.adminNote}</p> : null}</div>) : <p className="text-sm text-slate-400">No withdrawal requests yet.</p>}</div></section>
        </aside>
      </div>
      <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-7"><h2 className="text-2xl font-black">Your products</h2><div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{products.length ? products.map((product) => <article key={product.id} className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950"><div className="aspect-[16/9] bg-slate-800">{product.mainImageUrl ? <img src={product.mainImageUrl} alt="" className="h-full w-full object-cover" /> : null}</div><div className="p-4"><p className="text-xs text-slate-400">{product.sku}</p><h3 className="mt-1 font-black">{product.name}</h3><p className="mt-1 text-sm text-emerald-300">{money(product.sellingPrice)} · {product.showInShop ? "Visible on website" : "Needs image to publish"}</p><button onClick={() => { setEditingId(product.id); setForm(toForm(product)); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="mt-4 rounded-lg border border-cyan-400/40 px-3 py-2 text-sm font-bold text-cyan-300">Edit product</button></div></article>) : <p className="text-slate-400">Your products will appear here after you create them.</p>}</div></section>
    </div>
  </main>;
}
