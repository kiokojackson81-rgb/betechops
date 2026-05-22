"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getMockOrderHistory,
  getMockQuoteHistory,
  getShopCustomerProfile,
  saveShopCustomerProfile,
  type MockOrderRecord,
  type MockQuoteRecord,
} from "@/app/shop/shopStorage";
import { formatCurrency, shopStyles } from "@/app/shop/_components/shopStyles";

export default function AccountClient() {
  const [loaded, setLoaded] = useState(false);
  const [orders, setOrders] = useState<MockOrderRecord[]>([]);
  const [quotes, setQuotes] = useState<MockQuoteRecord[]>([]);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    whatsappNumber: "",
    email: "",
    countyTown: "",
    estateLandmark: "",
    locationNotes: "",
  });

  useEffect(() => {
    const profile = getShopCustomerProfile();
    setOrders(getMockOrderHistory());
    setQuotes(getMockQuoteHistory());
    if (profile) {
      setForm({
        fullName: profile.fullName || "",
        phone: profile.phone || "",
        whatsappNumber: profile.whatsappNumber || "",
        email: profile.email || "",
        countyTown: profile.countyTown || "",
        estateLandmark: profile.estateLandmark || "",
        locationNotes: profile.locationNotes || "",
      });
    }
    setLoaded(true);
  }, []);

  if (!loaded) {
    return <div className="rounded-[20px] border border-[#7a0000]/10 bg-white p-5 text-sm text-slate-600 shadow-[0_14px_32px_rgba(15,23,42,0.05)]">Loading your Betech Solar customer profile preview...</div>;
  }

  const hasProfile = Boolean(form.fullName || form.phone || form.email || form.countyTown);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_0.95fr]">
      <section className="rounded-[20px] border border-[#7a0000]/10 bg-white p-4 shadow-[0_14px_32px_rgba(15,23,42,0.05)] sm:p-5">
        <div className={shopStyles.sectionEyebrow}>Customer profile</div>
        <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-950">Create your Betech Solar customer profile</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Save your contact and delivery details locally for preview testing. Checkout can reuse this information automatically.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Full name
            <input value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} className="min-h-[3rem] rounded-[16px] border border-[#7a0000]/10 bg-white px-4 outline-none" />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Phone number
            <input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} className="min-h-[3rem] rounded-[16px] border border-[#7a0000]/10 bg-white px-4 outline-none" />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            WhatsApp number
            <input value={form.whatsappNumber} onChange={(event) => setForm((current) => ({ ...current, whatsappNumber: event.target.value }))} className="min-h-[3rem] rounded-[16px] border border-[#7a0000]/10 bg-white px-4 outline-none" />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Email
            <input value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} className="min-h-[3rem] rounded-[16px] border border-[#7a0000]/10 bg-white px-4 outline-none" />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            County / town
            <input value={form.countyTown} onChange={(event) => setForm((current) => ({ ...current, countyTown: event.target.value }))} className="min-h-[3rem] rounded-[16px] border border-[#7a0000]/10 bg-white px-4 outline-none" />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Estate / landmark
            <input value={form.estateLandmark} onChange={(event) => setForm((current) => ({ ...current, estateLandmark: event.target.value }))} className="min-h-[3rem] rounded-[16px] border border-[#7a0000]/10 bg-white px-4 outline-none" />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700 sm:col-span-2">
            Delivery notes
            <textarea rows={3} value={form.locationNotes} onChange={(event) => setForm((current) => ({ ...current, locationNotes: event.target.value }))} className="rounded-[16px] border border-[#7a0000]/10 bg-white px-4 py-3 outline-none" />
          </label>
        </div>

        <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <button
            type="button"
            className={shopStyles.primaryButton}
            onClick={() => {
              saveShopCustomerProfile({
                fullName: form.fullName.trim(),
                phone: form.phone.trim(),
                whatsappNumber: form.whatsappNumber.trim() || undefined,
                email: form.email.trim() || undefined,
                countyTown: form.countyTown.trim() || undefined,
                estateLandmark: form.estateLandmark.trim() || undefined,
                locationNotes: form.locationNotes.trim() || undefined,
              });
              setSaved(true);
              setTimeout(() => setSaved(false), 2400);
            }}
          >
            Save Profile
          </button>
          <Link href="/shop/checkout" className={shopStyles.secondaryButton}>
            Use at Checkout
          </Link>
          {saved ? <div className="text-sm font-semibold text-[#0f9d58]">Profile saved locally for preview.</div> : null}
        </div>
      </section>

      <div className="grid gap-4">
        <section className="rounded-[20px] border border-[#7a0000]/10 bg-[linear-gradient(180deg,#fffaf2_0%,#ffffff_100%)] p-4 shadow-[0_14px_32px_rgba(15,23,42,0.06)]">
          <div className={shopStyles.sectionEyebrow}>Preview account status</div>
          <div className="mt-3 text-sm leading-6 text-slate-600">
            {hasProfile
              ? "This local preview profile will prefill checkout forms on this device."
              : "No customer profile saved yet. Create your Betech Solar customer profile to speed up checkout testing."}
          </div>
        </section>

        <section className="rounded-[20px] border border-[#7a0000]/10 bg-white p-4 shadow-[0_14px_32px_rgba(15,23,42,0.05)]">
          <div className={shopStyles.sectionEyebrow}>Recent preview orders</div>
          <div className="mt-3 grid gap-3">
            {orders.length ? orders.slice(0, 5).map((order) => (
              <div key={order.orderRef} className="rounded-[16px] border border-[#7a0000]/10 bg-[#fcfaf7] p-3">
                <div className="text-sm font-black text-slate-950">{order.orderRef}</div>
                <div className="mt-1 text-xs text-slate-500">{order.customerName} • {order.deliveryMethod}</div>
                <div className="mt-1 text-xs text-slate-500">{formatCurrency(order.subtotal)} • {order.items.length} items</div>
              </div>
            )) : <div className="text-sm text-slate-500">No preview orders saved yet.</div>}
          </div>
        </section>

        <section className="rounded-[20px] border border-[#7a0000]/10 bg-white p-4 shadow-[0_14px_32px_rgba(15,23,42,0.05)]">
          <div className={shopStyles.sectionEyebrow}>Recent quote requests</div>
          <div className="mt-3 grid gap-3">
            {quotes.length ? quotes.slice(0, 5).map((quote) => (
              <div key={quote.quoteRef} className="rounded-[16px] border border-[#7a0000]/10 bg-[#fcfaf7] p-3">
                <div className="text-sm font-black text-slate-950">{quote.quoteRef}</div>
                <div className="mt-1 text-xs text-slate-500">{quote.customerName} • {quote.propertyType || "Solar quote"}</div>
                <div className="mt-1 text-xs text-slate-500">{quote.location || "Location pending"}</div>
              </div>
            )) : <div className="text-sm text-slate-500">No preview quote requests saved yet.</div>}
          </div>
        </section>
      </div>
    </div>
  );
}
