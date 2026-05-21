"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createQuoteRequest } from "@/app/shop/shopApi";
import { trackQuoteSubmitted } from "@/app/shop/shopAnalytics";
import { shopStyles } from "@/app/shop/_components/shopStyles";
import { saveMockQuote } from "@/app/shop/shopStorage";

type QuoteRequestClientProps = {
  preferredProduct?: string;
};

export default function QuoteRequestClient({ preferredProduct = "" }: QuoteRequestClientProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    phone?: string;
    location?: string;
    propertyType?: string;
  }>({});
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
  const inputBaseClass = "min-h-[3.4rem] rounded-2xl border bg-white px-4 outline-none transition";
  const resolveFieldClass = (fieldError?: string) =>
    `${inputBaseClass} ${fieldError ? "border-red-300 ring-2 ring-red-100" : "border-[#7a0000]/10 focus:border-[#7a0000]/30"}`;

  function validateForm() {
    const nextErrors: { name?: string; phone?: string; location?: string; propertyType?: string } = {};
    if (!form.name.trim()) nextErrors.name = "Please enter your name so Betech Solar can prepare this quote.";
    if (!form.phone.trim()) nextErrors.phone = "Please enter a phone number so our solar sizing team can reach you.";
    if (!form.location.trim()) nextErrors.location = "Please tell us where the system will be installed or delivered.";
    if (!form.propertyType.trim()) nextErrors.propertyType = "Please choose the property type for this quote.";
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  return (
    <form
      className={`${shopStyles.lightCard} p-5 sm:p-6`}
      onSubmit={async (event) => {
        event.preventDefault();
        if (!validateForm()) return;
        setSubmitting(true);
        setError(null);
        try {
          await createQuoteRequest({
            name: form.name,
            phone: form.phone,
            location: form.location,
            propertyType: form.propertyType,
            load: form.load,
            budgetRange: form.budgetRange,
            preferredProducts: form.preferredProducts,
            notes: form.notes,
          });

          const savedQuote = saveMockQuote({
            customerName: form.name.trim(),
            phone: form.phone.trim(),
            location: form.location.trim(),
            propertyType: form.propertyType,
            loadDescription: form.load.trim(),
            budgetRange: form.budgetRange,
            preferredProducts: form.preferredProducts.trim(),
            notes: form.notes.trim() || undefined,
          });

          trackQuoteSubmitted({
            quoteRef: savedQuote.quoteRef,
            propertyType: savedQuote.propertyType,
            location: savedQuote.location,
            preferredProducts: savedQuote.preferredProducts,
          });
          router.push(`/shop/quote-success?ref=${encodeURIComponent(savedQuote.quoteRef)}`);
        } catch (submissionError) {
          setError(submissionError instanceof Error ? submissionError.message : "Unable to send mock quote request.");
        } finally {
          setSubmitting(false);
        }
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
            value={form.name}
            onChange={(event) => {
              const value = event.target.value;
              setForm((current) => ({ ...current, name: value }));
              if (fieldErrors.name) setFieldErrors((current) => ({ ...current, name: undefined }));
            }}
            className={resolveFieldClass(fieldErrors.name)}
          />
          {fieldErrors.name ? <span className="text-xs font-semibold text-red-600">{fieldErrors.name}</span> : null}
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Phone number
          <input
            value={form.phone}
            onChange={(event) => {
              const value = event.target.value;
              setForm((current) => ({ ...current, phone: value }));
              if (fieldErrors.phone) setFieldErrors((current) => ({ ...current, phone: undefined }));
            }}
            className={resolveFieldClass(fieldErrors.phone)}
          />
          {fieldErrors.phone ? <span className="text-xs font-semibold text-red-600">{fieldErrors.phone}</span> : null}
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Location
          <input
            value={form.location}
            onChange={(event) => {
              const value = event.target.value;
              setForm((current) => ({ ...current, location: value }));
              if (fieldErrors.location) setFieldErrors((current) => ({ ...current, location: undefined }));
            }}
            className={resolveFieldClass(fieldErrors.location)}
          />
          {fieldErrors.location ? <span className="text-xs font-semibold text-red-600">{fieldErrors.location}</span> : null}
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Property type
          <select
            value={form.propertyType}
            onChange={(event) => {
              const value = event.target.value;
              setForm((current) => ({ ...current, propertyType: value }));
              if (fieldErrors.propertyType) setFieldErrors((current) => ({ ...current, propertyType: undefined }));
            }}
            className={resolveFieldClass(fieldErrors.propertyType)}
          >
            <option value="">Select property type</option>
            <option>Home</option>
            <option>Shop / biashara</option>
            <option>Farm</option>
            <option>Office</option>
            <option>School / institution</option>
          </select>
          {fieldErrors.propertyType ? <span className="text-xs font-semibold text-red-600">{fieldErrors.propertyType}</span> : null}
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

      {error ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
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
