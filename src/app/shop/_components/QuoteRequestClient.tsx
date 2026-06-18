"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { createQuoteRequest } from "@/app/shop/shopSubmitApi";
import { trackQuoteSubmitted } from "@/app/shop/shopAnalytics";
import { shopStyles } from "@/app/shop/_components/shopStyles";
import { getShopQuoteSuccessHref, SHOP_HOME_HREF } from "@/app/shop/storefrontPaths";
import { getTownsForCounty, kenyaCountyOptions } from "@/lib/agents/kenyaMarkets";

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
    email?: string;
    county?: string;
    town?: string;
    propertyType?: string;
  }>({});
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    county: "",
    town: "",
    specificLocation: "",
    propertyType: "",
    load: "",
    budgetRange: "",
    preferredProducts: preferredProduct,
    notes: "",
  });
  const availableTowns = useMemo(() => getTownsForCounty(form.county), [form.county]);
  const inputBaseClass = "min-h-[3.4rem] rounded-2xl border bg-white px-4 outline-none transition";
  const resolveFieldClass = (fieldError?: string) =>
    `${inputBaseClass} ${fieldError ? "border-red-300 ring-2 ring-red-100" : "border-[#7a0000]/10 focus:border-[#7a0000]/30"}`;
  const resolvedLocation = [form.town.trim(), form.county.trim(), form.specificLocation.trim()].filter(Boolean).join(" - ");

  function validateForm() {
    const nextErrors: { name?: string; phone?: string; email?: string; county?: string; town?: string; propertyType?: string } = {};
    if (!form.name.trim()) nextErrors.name = "Please enter your name so Betech Solar can prepare this quote.";
    if (!form.phone.trim()) nextErrors.phone = "Please enter a phone number so our solar sizing team can reach you.";
    if (form.email.trim() && !/\S+@\S+\.\S+/.test(form.email.trim())) {
      nextErrors.email = "Enter a valid email address or leave it blank.";
    }
    if (!form.county.trim()) nextErrors.county = "Please select the county for this quote request.";
    if (!form.town.trim()) nextErrors.town = "Please select the town or area for this quote request.";
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
          const result = await createQuoteRequest({
            name: form.name,
            phone: form.phone,
            email: form.email,
            location: resolvedLocation,
            county: form.county,
            town: form.town,
            specificLocation: form.specificLocation,
            propertyType: form.propertyType,
            load: form.load,
            budgetRange: form.budgetRange,
            preferredProducts: form.preferredProducts,
            notes: form.notes,
          });

          trackQuoteSubmitted({
            quoteRef: result.quoteRef,
            propertyType: form.propertyType,
            location: resolvedLocation,
            preferredProducts: form.preferredProducts.trim(),
          });
          router.push(getShopQuoteSuccessHref(result.quoteRef));
        } catch (submissionError) {
          setError(submissionError instanceof Error ? submissionError.message : "Unable to send the quote request.");
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
        <label className="grid gap-2 text-sm font-semibold text-slate-700 sm:col-span-2">
          Email address
          <input
            type="email"
            value={form.email}
            onChange={(event) => {
              const value = event.target.value;
              setForm((current) => ({ ...current, email: value }));
              if (fieldErrors.email) setFieldErrors((current) => ({ ...current, email: undefined }));
            }}
            className={resolveFieldClass(fieldErrors.email)}
            placeholder="Optional, for quotation delivery and follow-up"
          />
          {fieldErrors.email ? <span className="text-xs font-semibold text-red-600">{fieldErrors.email}</span> : null}
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          County
          <select
            value={form.county}
            onChange={(event) => {
              const nextCounty = event.target.value;
              const nextTowns = getTownsForCounty(nextCounty);
              setForm((current) => ({
                ...current,
                county: nextCounty,
                town: nextTowns.some((town) => town === current.town) ? current.town : "",
              }));
              if (fieldErrors.county || fieldErrors.town) {
                setFieldErrors((current) => ({ ...current, county: undefined, town: undefined }));
              }
            }}
            className={resolveFieldClass(fieldErrors.county)}
          >
            <option value="">Select county</option>
            {kenyaCountyOptions.map((county) => (
              <option key={county} value={county}>
                {county}
              </option>
            ))}
          </select>
          {fieldErrors.county ? <span className="text-xs font-semibold text-red-600">{fieldErrors.county}</span> : null}
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Town / area
          <select
            value={form.town}
            onChange={(event) => {
              const value = event.target.value;
              setForm((current) => ({ ...current, town: value }));
              if (fieldErrors.town) setFieldErrors((current) => ({ ...current, town: undefined }));
            }}
            disabled={!form.county}
            className={resolveFieldClass(fieldErrors.town)}
          >
            <option value="">{form.county ? "Select town / area" : "Choose county first"}</option>
            {availableTowns.map((town) => (
              <option key={town} value={town}>
                {town}
              </option>
            ))}
          </select>
          {fieldErrors.town ? <span className="text-xs font-semibold text-red-600">{fieldErrors.town}</span> : null}
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700 sm:col-span-2">
          Specific location / estate / landmark
          <input
            value={form.specificLocation}
            onChange={(event) => setForm((current) => ({ ...current, specificLocation: event.target.value }))}
            placeholder="Estate, building, road, centre, or nearby landmark"
            className={resolveFieldClass()}
          />
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
        <Link href={SHOP_HOME_HREF} className={shopStyles.secondaryButton}>
          Back to Shop
        </Link>
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-500">
        Quote requests are assigned directly to the Betech Solar quotation desk for follow-up.
      </p>
    </form>
  );
}
