"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { CalendarCheck2, CheckCircle2, LoaderCircle, MapPin, X } from "lucide-react";
import type { ShopProduct } from "@/app/shop/shopData";
import { createInstallationProject } from "@/app/shop/shopSubmitApi";
import { trackOrderSubmitted } from "@/app/shop/shopAnalytics";
import { getShopCustomerProfile, saveShopCustomerProfile } from "@/app/shop/shopStorage";
import { formatCurrency } from "@/app/shop/_components/shopStyles";
import { getDeliveryZone, getTownsForCounty, kenyaCountyOptions } from "@/lib/agents/kenyaMarkets";

type InstallationCustomer = {
  isAuthenticated: boolean;
  name: string;
  phone: string;
  email: string;
  county: string;
  town: string;
  estateLandmark: string;
  locationNotes: string;
};

type InstallationPricing = {
  configured: boolean;
  product: number;
  installation: { status: string; amount: number | null } | null;
  transport: { status: string; amount: number | null } | null;
  accessories: { status: string; amount: number; minimum?: number; maximum?: number } | null;
  estimatedTotal: number;
};

type BookInstallationButtonProps = {
  product: ShopProduct;
  customer?: InstallationCustomer;
  className?: string;
};

const emptyCustomer: InstallationCustomer = {
  isAuthenticated: false,
  name: "",
  phone: "",
  email: "",
  county: "",
  town: "",
  estateLandmark: "",
  locationNotes: "",
};

const fieldClass = "min-h-12 w-full rounded-[16px] border border-[#7a0000]/12 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#7a0000]/45 focus:ring-4 focus:ring-[#7a0000]/5";

export default function BookInstallationButton({ product, customer = emptyCustomer, className }: BookInstallationButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricing, setPricing] = useState<InstallationPricing | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    county: customer.county,
    town: customer.town,
    exactLocation: customer.locationNotes || customer.estateLandmark,
    installationDate: "",
    paymentStructure: "DEPOSIT_30" as "DEPOSIT_30" | "FULL_UPFRONT",
  });

  const towns = useMemo(() => getTownsForCounty(form.county), [form.county]);
  const zone = useMemo(() => getDeliveryZone(form.county, form.town), [form.county, form.town]);
  const minimumDate = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + 2);
    return date.toISOString().slice(0, 10);
  }, []);
  const amountDue = form.paymentStructure === "DEPOSIT_30"
    ? Math.round((pricing?.estimatedTotal ?? 0) * 0.3)
    : pricing?.estimatedTotal ?? 0;
  const requiresAssessment = pricing?.installation?.status === "ASSESSMENT";

  useEffect(() => setPortalReady(true), []);

  useEffect(() => {
    if (!open) return;
    const profile = getShopCustomerProfile();
    const [savedCounty = "", savedTown = ""] = String(profile?.countyTown || "").split("/").map((part) => part.trim());
    setForm((current) => ({
      ...current,
      name: customer.name || profile?.fullName || current.name,
      email: customer.email || profile?.email || current.email,
      phone: customer.phone || profile?.phone || current.phone,
      county: customer.county || savedCounty || current.county,
      town: customer.town || savedTown || current.town,
      exactLocation: customer.locationNotes || customer.estateLandmark || profile?.locationNotes || profile?.estateLandmark || current.exactLocation,
    }));
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [customer, open]);

  useEffect(() => {
    if (!open || !zone || !product.opsProductId) {
      setPricing(null);
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setPricingLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/shop/products/${encodeURIComponent(product.opsProductId!)}/pricing`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({ zone: zone.id, includeInstallation: true }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.configured) throw new Error(payload.error || "Installation pricing is not configured for this product.");
        setPricing(payload as InstallationPricing);
      } catch (requestError) {
        if (!controller.signal.aborted) setError(requestError instanceof Error ? requestError.message : "Unable to calculate installation pricing.");
      } finally {
        if (!controller.signal.aborted) setPricingLoading(false);
      }
    }, 200);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [open, product.opsProductId, zone]);

  async function submitBooking(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!form.name.trim() || !form.phone.trim() || !form.email.trim() || !form.county || !form.town || !form.exactLocation.trim() || !form.installationDate) {
      setError("Complete your contact, location, and preferred installation date.");
      return;
    }
    if (!zone || !pricing || requiresAssessment) {
      setError(requiresAssessment ? "This system requires a site assessment before installation can be booked." : "Wait for the installation total to be calculated.");
      return;
    }

    setSubmitting(true);
    try {
      const paymentLabel = form.paymentStructure === "DEPOSIT_30" ? "30% deposit, balance after installation" : "Full payment before installation";
      const response = await createInstallationProject({
        productId: product.id,
        customerName: form.name.trim(),
        customerPhone: form.phone.trim(),
        customerEmail: form.email.trim(),
        county: form.county,
        town: form.town,
        exactLocation: form.exactLocation.trim(),
        zone: zone.id,
        paymentStructure: form.paymentStructure,
        preferredInstallationDate: form.installationDate,
      });

      saveShopCustomerProfile({
        fullName: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        countyTown: `${form.county} / ${form.town}`,
        estateLandmark: form.exactLocation.trim(),
        locationNotes: form.exactLocation.trim(),
      });
      trackOrderSubmitted({
        orderRef: response.projectRef,
        itemCount: 1,
        subtotal: pricing.estimatedTotal,
        deliveryMethod: "Betech installation and delivery",
        paymentPreference: paymentLabel,
        orderIntent: "INSTALLATION_PROJECT",
      });
      router.push(response.successUrl);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Unable to create the installation booking.");
    } finally {
      setSubmitting(false);
    }
  }

  const modal = open ? (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/75 p-2 backdrop-blur-sm sm:p-5" role="dialog" aria-modal="true" aria-labelledby="installation-booking-title">
      <div className="flex max-h-[calc(100dvh-1rem)] w-full max-w-5xl flex-col overflow-hidden rounded-[24px] bg-[#fffdfa] shadow-2xl sm:max-h-[calc(100dvh-2.5rem)] sm:rounded-[32px]">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#7a0000]/10 px-4 py-4 sm:px-7 sm:py-5">
          <div><div className="text-[10px] font-black uppercase tracking-[0.22em] text-[#7a0000]">Betech installation booking</div><h2 id="installation-booking-title" className="mt-1 text-xl font-black text-slate-950 sm:text-2xl">Book installation for your system</h2></div>
          <button type="button" onClick={() => setOpen(false)} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#7a0000]/12 bg-white text-slate-700" aria-label="Close installation booking"><X className="h-5 w-5" /></button>
        </div>

        <form onSubmit={submitBooking} className="min-h-0 overflow-y-auto overscroll-contain">
          <div className="grid gap-5 p-4 sm:p-7 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
            <div className="grid gap-5">
              <section>
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#7a0000]">Customer details</div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-sm font-bold text-slate-700">Full name<input className={fieldClass} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} autoComplete="name" /></label>
                  <label className="grid gap-1.5 text-sm font-bold text-slate-700">Phone number<input className={fieldClass} value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} autoComplete="tel" /></label>
                  <label className="grid gap-1.5 text-sm font-bold text-slate-700 sm:col-span-2">Email address<input type="email" className={fieldClass} value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} autoComplete="email" /></label>
                </div>
              </section>

              <section>
                <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-[#7a0000]"><MapPin className="h-4 w-4" /> Installation location</div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-sm font-bold text-slate-700">County<select className={fieldClass} value={form.county} onChange={(event) => setForm((current) => ({ ...current, county: event.target.value, town: "" }))}><option value="">Select county</option>{kenyaCountyOptions.map((countyName) => <option key={countyName} value={countyName}>{countyName}</option>)}</select></label>
                  <label className="grid gap-1.5 text-sm font-bold text-slate-700">Sub-county / town<select className={fieldClass} value={form.town} onChange={(event) => setForm((current) => ({ ...current, town: event.target.value }))} disabled={!form.county}><option value="">Select area</option>{towns.map((town) => <option key={town} value={town}>{town}</option>)}</select></label>
                  <label className="grid gap-1.5 text-sm font-bold text-slate-700 sm:col-span-2">Exact location<input className={fieldClass} value={form.exactLocation} onChange={(event) => setForm((current) => ({ ...current, exactLocation: event.target.value }))} placeholder="Estate, road, building or nearby landmark" /></label>
                  <label className="grid gap-1.5 text-sm font-bold text-slate-700 sm:col-span-2">Preferred installation date<input type="date" min={minimumDate} className={fieldClass} value={form.installationDate} onChange={(event) => setForm((current) => ({ ...current, installationDate: event.target.value }))} /></label>
                </div>
              </section>

              <section>
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#7a0000]">Payment procedure</div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {([{"value":"DEPOSIT_30","title":"Pay 30% deposit","copy":"Clear the balance after installation."},{"value":"FULL_UPFRONT","title":"Pay in full","copy":"Pay the complete booking total."}] as const).map((option) => <button key={option.value} type="button" onClick={() => setForm((current) => ({ ...current, paymentStructure: option.value }))} className={`rounded-[18px] border p-4 text-left transition ${form.paymentStructure === option.value ? "border-[#7a0000] bg-[#fff3d8] shadow-sm" : "border-[#7a0000]/10 bg-white"}`}><span className="flex items-center gap-2 font-black text-slate-950">{form.paymentStructure === option.value ? <CheckCircle2 className="h-4 w-4 text-[#7a0000]" /> : null}{option.title}</span><span className="mt-1 block text-xs leading-5 text-slate-600">{option.copy}</span></button>)}
                </div>
              </section>
            </div>

            <aside className="h-fit rounded-[22px] bg-[linear-gradient(155deg,#280000_0%,#650000_100%)] p-5 text-white lg:sticky lg:top-4">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">Selected system</div>
              <div className="mt-2 text-lg font-black leading-6">{product.name}</div>
              <div className="mt-4 grid gap-2 border-t border-white/15 pt-4 text-sm">
                <SummaryLine label="Product" value={formatCurrency(product.price)} />
                <SummaryLine label="Installation" value={pricingLoading ? "Calculating..." : formatFee(pricing?.installation)} />
                <SummaryLine label="Transport" value={pricingLoading ? "Calculating..." : formatFee(pricing?.transport)} />
                <SummaryLine label="Accessories estimate" value={pricingLoading ? "Calculating..." : formatAccessories(pricing?.accessories)} />
              </div>
              <div className="mt-4 border-t border-white/15 pt-4">
                <div className="flex items-end justify-between gap-3"><span className="text-sm text-white/70">Estimated total</span><span className="text-xl font-black text-amber-300">{pricing ? formatCurrency(pricing.estimatedTotal) : "Select location"}</span></div>
                <div className="mt-2 flex items-end justify-between gap-3"><span className="text-sm text-white/70">Pay now</span><span className="text-lg font-black">{pricing ? formatCurrency(amountDue) : "-"}</span></div>
                {form.paymentStructure === "DEPOSIT_30" && pricing ? <div className="mt-1 text-right text-xs text-white/65">Balance after deposit: {formatCurrency(pricing.estimatedTotal - amountDue)}</div> : null}
              </div>
              <div className="mt-4 rounded-xl bg-white/10 px-3 py-2 text-xs leading-5 text-white/80">For systems below KES 100,000, a local electrician is usually more economical. Betech technical guidance remains available remotely.</div>
            </aside>
          </div>

          <div className="sticky bottom-0 flex flex-col gap-3 border-t border-[#7a0000]/10 bg-white/95 px-4 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-7">
            <div className="min-h-5 text-sm font-semibold text-red-700">{error || (requiresAssessment ? "A site assessment and custom quotation are required for this system." : "")}</div>
            <button type="submit" disabled={submitting || pricingLoading || !pricing || requiresAssessment} className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-[16px] bg-[#7a0000] px-7 font-black text-white transition hover:bg-[#620000] disabled:cursor-not-allowed disabled:opacity-50">{submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CalendarCheck2 className="h-4 w-4" />}{submitting ? "Creating booking..." : "Book & Pay"}</button>
          </div>
        </form>
      </div>
    </div>
  ) : null;

  return <>
    <button type="button" aria-label={`Book installation for ${product.name}`} className={className} onClick={() => setOpen(true)}><CalendarCheck2 className="h-4 w-4" />Book Installation</button>
    {portalReady && modal ? createPortal(modal, document.body) : null}
  </>;
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-3"><span className="text-white/65">{label}</span><span className="text-right font-bold">{value}</span></div>;
}

function formatFee(value: InstallationPricing["installation"] | InstallationPricing["transport"] | undefined) {
  if (!value) return "Select location";
  if (value.status === "ASSESSMENT") return "Site assessment";
  if (value.status === "INCLUDED" || value.status === "FREE") return "Included";
  return formatCurrency(value.amount ?? 0);
}

function formatAccessories(value: InstallationPricing["accessories"] | undefined) {
  if (!value) return "Select location";
  if (value.status === "INCLUDED") return "Included";
  if (value.minimum != null && value.maximum != null && value.minimum !== value.maximum) return `${formatCurrency(value.minimum)} - ${formatCurrency(value.maximum)}`;
  return formatCurrency(value.amount ?? 0);
}
