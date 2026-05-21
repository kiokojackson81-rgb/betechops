"use client";

import Link from "next/link";
import { useState } from "react";
import { createQuoteRequest } from "@/app/shop/shopApi";
import { shopStyles } from "@/app/shop/_components/shopStyles";

type QuoteRequestClientProps = {
  preferredProduct?: string;
};

export default function QuoteRequestClient({ preferredProduct = "" }: QuoteRequestClientProps) {
  const [submitted, setSubmitted] = useState<{ reference: string; name: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    location: "",
    propertyType: "",
    load: "",
    budgetRange: "",
    preferredProducts: preferredProduct,
    notes: "",
  });

  if (submitted) {
    return (
      <div className={`${shopStyles.darkPanel} p-6 sm:p-8`}>
        <div className="inline-flex rounded-full bg-[#fff3d8] px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-[#7a0000]">
          Quote Request Sent
        </div>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-white">Thanks, {submitted.name}.</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-white/76">
          Our solar sizing team will contact you shortly. Your mock quote request reference is <span className="font-black text-white">{submitted.reference}</span>.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link href="/shop" className={shopStyles.goldButton}>
            Back to Shop
          </Link>
          <Link href="https://wa.me/254722151083" target="_blank" rel="noreferrer" className={shopStyles.whatsappButton}>
            Talk to our solar team on WhatsApp
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      className={`${shopStyles.lightCard} p-5 sm:p-6`}
      onSubmit={async (event) => {
        event.preventDefault();
        setSubmitting(true);
        const result = await createQuoteRequest({
          name: form.name,
          phone: form.phone,
          location: form.location,
          propertyType: form.propertyType,
          load: form.load,
          budgetRange: form.budgetRange,
          preferredProducts: form.preferredProducts,
          notes: form.notes,
        });
        setSubmitted({ reference: result.reference, name: form.name });
        setSubmitting(false);
      }}
    >
      <div className={shopStyles.sectionEyebrow}>Request a Solar System Quote</div>
      <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950">Our team will help size the right panels, inverter, battery and accessories for your needs.</h1>
      <p className="mt-3 text-base leading-7 text-slate-600">
        Share your location, appliances, budget, and preferred products so Betech Solar Solutions can guide the right system direction.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Customer name
          <input
            required
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            className="min-h-[3.4rem] rounded-2xl border border-[#7a0000]/10 bg-white px-4 outline-none"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Phone number
          <input
            required
            value={form.phone}
            onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
            className="min-h-[3.4rem] rounded-2xl border border-[#7a0000]/10 bg-white px-4 outline-none"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Location
          <input
            required
            value={form.location}
            onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
            className="min-h-[3.4rem] rounded-2xl border border-[#7a0000]/10 bg-white px-4 outline-none"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Property type
          <select
            required
            value={form.propertyType}
            onChange={(event) => setForm((current) => ({ ...current, propertyType: event.target.value }))}
            className="min-h-[3.4rem] rounded-2xl border border-[#7a0000]/10 bg-white px-4 outline-none"
          >
            <option value="">Select property type</option>
            <option>Home</option>
            <option>Shop / biashara</option>
            <option>Farm</option>
            <option>Office</option>
            <option>School / institution</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700 sm:col-span-2">
          Load / appliances
          <textarea
            rows={4}
            value={form.load}
            onChange={(event) => setForm((current) => ({ ...current, load: event.target.value }))}
            className="rounded-[24px] border border-[#7a0000]/10 bg-white px-4 py-3 outline-none"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Budget range
          <select
            value={form.budgetRange}
            onChange={(event) => setForm((current) => ({ ...current, budgetRange: event.target.value }))}
            className="min-h-[3.4rem] rounded-2xl border border-[#7a0000]/10 bg-white px-4 outline-none"
          >
            <option value="">Select budget</option>
            <option>Under Ksh 30,000</option>
            <option>Ksh 30,000 - 80,000</option>
            <option>Ksh 80,000 - 200,000</option>
            <option>Ksh 200,000 - 500,000</option>
            <option>Above Ksh 500,000</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Preferred products
          <input
            value={form.preferredProducts}
            onChange={(event) => setForm((current) => ({ ...current, preferredProducts: event.target.value }))}
            className="min-h-[3.4rem] rounded-2xl border border-[#7a0000]/10 bg-white px-4 outline-none"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700 sm:col-span-2">
          Notes
          <textarea
            rows={5}
            value={form.notes}
            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            className="rounded-[24px] border border-[#7a0000]/10 bg-white px-4 py-3 outline-none"
          />
        </label>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button type="submit" disabled={submitting} className={shopStyles.primaryButton}>
          {submitting ? "Sending..." : "Submit Quote Request"}
        </button>
        <Link href="/shop" className={shopStyles.secondaryButton}>
          Back to Shop
        </Link>
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-500">
        Safe flag: <code>NEXT_PUBLIC_SHOP_USE_OPS_API=false</code> keeps quote submission in mock fallback mode.
      </p>
    </form>
  );
}
