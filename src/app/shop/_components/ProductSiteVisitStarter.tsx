"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CalendarCheck2,
  Check,
  ChevronLeft,
  ChevronRight,
  MapPin,
  X,
} from "lucide-react";
import type { ShopProduct } from "@/app/shop/shopData";
import { trackSiteVisitEvent } from "@/app/shop/shopAnalytics";
import {
  kenyaCountyOptions,
  getTownsForCounty,
} from "@/lib/agents/kenyaMarkets";

type Customer = {
  isAuthenticated: boolean;
  name: string;
  phone: string;
  email: string;
  county: string;
  town: string;
  estateLandmark: string;
  locationNotes: string;
};

type Pricing = {
  siteVisitFee: number;
  totalPayable: number;
  eligibleSiteVisitCredit: number;
  zone: { id: string; name: string };
  dataLogger: {
    requested: boolean;
    days: number;
    dailyRate: number;
    fee: number;
  };
};

const money = (value: number) =>
  `KES ${Number(value || 0).toLocaleString("en-KE")}`;

function inferProjectType(category: string) {
  const value = category.toLowerCase();
  if (value.includes("water pump")) return "SOLAR_WATER_PUMP";
  if (value.includes("water heater")) return "SOLAR_WATER_HEATER";
  if (
    value.includes("battery") ||
    value.includes("inverter") ||
    value.includes("kit")
  )
    return "SOLAR_HOME_SYSTEM";
  return "OTHER";
}

export default function ProductSiteVisitStarter({
  product,
  customer,
  loginHref,
  autoOpen = false,
}: {
  product: ShopProduct;
  customer: Customer;
  loginHref: string;
  autoOpen?: boolean;
}) {
  const [open, setOpen] = useState(autoOpen && customer.isAuthenticated);
  const [step, setStep] = useState(1);
  const [county, setCounty] = useState(customer.county || "");
  const [town, setTown] = useState(customer.town || "");
  const [location, setLocation] = useState(customer.locationNotes || "");
  const [landmark, setLandmark] = useState(customer.estateLandmark || "");
  const [mapUrl, setMapUrl] = useState("");
  const [loggerRequested, setLoggerRequested] = useState(false);
  const [loggerDays, setLoggerDays] = useState(1);
  const [propertyType, setPropertyType] = useState("Residential");
  const [requirements, setRequirements] = useState(
    `Assess site suitability and installation requirements for ${product.name}.`,
  );
  const [appliances, setAppliances] = useState("");
  const [accessInstructions, setAccessInstructions] = useState("");
  const [alternativePhone, setAlternativePhone] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTimeLabel, setPreferredTimeLabel] = useState<
    "MORNING" | "AFTERNOON"
  >("MORNING");
  const [pricing, setPricing] = useState<Pricing | null>(null);
  const [pricingError, setPricingError] = useState("");
  const [loadingPricing, setLoadingPricing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [createdVisit, setCreatedVisit] = useState<{
    id: string;
    visitRef: string;
  } | null>(null);
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentSubmitted, setPaymentSubmitted] = useState(false);
  const [bookingAttemptId] = useState(() => crypto.randomUUID());

  const productId = product.opsProductId || product.id;
  const towns = getTownsForCounty(county);
  const minDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) =>
      event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !county || !town) {
      setPricing(null);
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoadingPricing(true);
      setPricingError("");
      try {
        const response = await fetch("/api/shop/site-visits/pricing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            county,
            town,
            originProductId: productId,
            originProductSlug: product.slug,
            dataLoggerRequested: loggerRequested,
            dataLoggerDays: loggerDays,
          }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.ok)
          throw new Error(payload.error || "Unable to calculate the fee.");
        setPricing(payload as Pricing);
        trackSiteVisitEvent("site_visit_fee_shown", {
          productId,
          zone: payload.zone.id,
          totalPayable: payload.totalPayable,
        });
      } catch (requestError) {
        if (!controller.signal.aborted)
          setPricingError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to calculate the fee.",
          );
      } finally {
        if (!controller.signal.aborted) setLoadingPricing(false);
      }
    }, 250);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [
    county,
    loggerDays,
    loggerRequested,
    open,
    product.slug,
    productId,
    town,
  ]);

  function launch() {
    setOpen(true);
    trackSiteVisitEvent("site_visit_clicked", {
      productId,
      productPrice: product.price,
    });
    trackSiteVisitEvent("site_visit_started", { productId });
  }

  function canContinue() {
    if (step === 1)
      return Boolean(county && town && location.trim().length >= 2 && pricing);
    if (step === 3) return requirements.trim().length >= 10;
    if (step === 4) return Boolean(preferredDate && preferredDate >= minDate);
    return true;
  }

  function next() {
    if (!canContinue()) {
      setError(
        step === 1
          ? "Select a county and town, enter the site location, and wait for the fee."
          : "Complete the required details before continuing.",
      );
      return;
    }
    setError("");
    if (step === 1)
      trackSiteVisitEvent("site_visit_location_selected", {
        county,
        town,
        zone: pricing?.zone.id,
      });
    if (step === 2 && loggerRequested)
      trackSiteVisitEvent("data_logger_added", { days: loggerDays });
    setStep((value) => Math.min(5, value + 1));
  }

  async function createBooking() {
    if (!pricing || !termsAccepted || createdVisit || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/shop/site-visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingAttemptId,
          projectType: inferProjectType(product.category),
          visitReason: "INSTALLATION_PLANNING",
          customerRequirements: requirements,
          county,
          town,
          location,
          landmark,
          mapUrl,
          propertyType,
          alternativePhone,
          appliancesToInspect: appliances,
          accessInstructions,
          preferredDate,
          preferredTimeLabel,
          originProductId: productId,
          originProductSlug: product.slug,
          dataLoggerRequested: loggerRequested,
          dataLoggerDays: loggerDays,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok)
        throw new Error(payload.error || "Unable to create the booking.");
      setCreatedVisit({
        id: payload.visit.id,
        visitRef: payload.visit.visitRef,
      });
      trackSiteVisitEvent("site_visit_booking_completed", {
        productId,
        visitRef: payload.visit.visitRef,
        totalPayable: pricing.totalPayable,
      });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to create the booking.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function submitPayment() {
    if (!createdVisit || paymentSubmitted || submitting) return;
    setSubmitting(true);
    setError("");
    trackSiteVisitEvent("site_visit_payment_started", {
      productId,
      visitRef: createdVisit.visitRef,
    });
    try {
      const response = await fetch(`/api/shop/site-visits/${createdVisit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SUBMIT_PAYMENT",
          paymentMethod: "MPESA",
          paymentReference,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok)
        throw new Error(payload.error || "Unable to submit payment.");
      setPaymentSubmitted(true);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to submit payment.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const triggerClass =
    "inline-flex min-h-[3.35rem] items-center justify-center gap-2 rounded-[20px] border border-amber-500/50 bg-amber-50 px-4 py-3 text-sm font-bold text-[#7a0000] shadow-[0_14px_30px_rgba(242,178,15,0.12)] transition hover:-translate-y-0.5 hover:bg-amber-100";
  if (!customer.isAuthenticated) {
    return (
      <Link
        href={loginHref}
        className={triggerClass}
        onClick={() =>
          trackSiteVisitEvent("site_visit_clicked", {
            productId,
            authenticated: false,
          })
        }
      >
        <CalendarCheck2 className="h-4 w-4" />
        Request Site Visit
      </Link>
    );
  }

  return (
    <>
      <button type="button" className={triggerClass} onClick={launch}>
        <CalendarCheck2 className="h-4 w-4" />
        Request Site Visit
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-label="Book product site visit"
        >
          <div className="flex max-h-[96dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-[28px] bg-[#fffdf9] shadow-2xl sm:max-h-[92dvh] sm:rounded-[32px]">
            <header className="flex items-start justify-between gap-4 border-b border-[#7a0000]/10 px-5 py-4 sm:px-7">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[#7a0000]">
                  Product-linked site visit
                </div>
                <h2 className="mt-1 text-xl font-black text-slate-950 sm:text-2xl">
                  Plan your site assessment
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-slate-200 bg-white"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </header>
            <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[0.36fr_0.64fr] lg:overflow-hidden">
              <aside className="border-b border-[#7a0000]/10 bg-[linear-gradient(150deg,#fff5df,#fffdf8)] p-5 lg:overflow-y-auto lg:border-b-0 lg:border-r lg:p-7">
                <div className="rounded-[24px] border border-amber-300/40 bg-white p-4">
                  <div className="text-xs font-black uppercase tracking-[0.14em] text-[#7a0000]">
                    Selected product
                  </div>
                  <h3 className="mt-2 text-lg font-black leading-6 text-slate-950">
                    {product.name}
                  </h3>
                  <div className="mt-3 text-2xl font-black text-[#7a0000]">
                    {money(product.price)}
                  </div>
                  <div className="mt-2 text-sm text-slate-600">
                    {product.category}
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-5 gap-1.5 lg:grid-cols-1">
                  {[
                    "Location",
                    "Data logger",
                    "Details",
                    "Schedule",
                    "Review",
                  ].map((label, index) => (
                    <div
                      key={label}
                      className={`rounded-xl px-2 py-2 text-center text-[10px] font-bold sm:text-xs lg:text-left ${step === index + 1 ? "bg-[#7a0000] text-white" : "bg-white/70 text-slate-500"}`}
                    >
                      {index + 1}. {label}
                    </div>
                  ))}
                </div>
              </aside>
              <main className="min-h-[32rem] p-5 sm:p-7 lg:overflow-y-auto">
                {createdVisit ? (
                  <div className="mx-auto max-w-2xl py-4">
                    <div className="grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                      <Check className="h-7 w-7" />
                    </div>
                    <h3 className="mt-5 text-2xl font-black text-slate-950">
                      Booking {createdVisit.visitRef} created
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Pay {money(pricing?.totalPayable || 0)} and enter only the
                      10-character M-Pesa transaction code. The visit is
                      confirmed after verification.
                    </p>
                    {paymentSubmitted ? (
                      <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
                        <strong>Payment submitted.</strong> Our team will verify
                        it and update your booking status.
                      </div>
                    ) : (
                      <div className="mt-6 grid gap-3">
                        <label className="text-sm font-bold text-slate-800">
                          M-Pesa transaction code
                          <input
                            value={paymentReference}
                            onChange={(event) =>
                              setPaymentReference(
                                event.target.value.toUpperCase(),
                              )
                            }
                            placeholder="e.g. UHG3K3STB0"
                            className="mt-2 min-h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-bold uppercase outline-none focus:border-[#7a0000]"
                          />
                        </label>
                        <button
                          type="button"
                          disabled={
                            submitting || paymentReference.trim().length < 10
                          }
                          onClick={submitPayment}
                          className="min-h-14 rounded-2xl bg-[#7a0000] px-5 font-bold text-white disabled:opacity-50"
                        >
                          {submitting
                            ? "Submitting..."
                            : "Submit payment for verification"}
                        </button>
                      </div>
                    )}
                    <Link
                      href="/account/site-visits"
                      className="mt-4 inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 font-bold text-slate-900"
                    >
                      Open my Site Visits
                    </Link>
                    {error ? (
                      <p className="mt-3 text-sm font-semibold text-red-700">
                        {error}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <>
                    {step === 1 ? (
                      <section className="grid gap-4">
                        <StepTitle
                          title="Where is the site?"
                          copy="Location determines the service zone and site visit fee."
                        />
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field label="County">
                            <select
                              value={county}
                              onChange={(event) => {
                                setCounty(event.target.value);
                                setTown("");
                              }}
                              className="input"
                            >
                              <option value="">Select county</option>
                              {kenyaCountyOptions.map((item) => (
                                <option key={item}>{item}</option>
                              ))}
                            </select>
                          </Field>
                          <Field label="Town / service area">
                            <select
                              value={town}
                              onChange={(event) => setTown(event.target.value)}
                              disabled={!county}
                              className="input"
                            >
                              <option value="">Select town</option>
                              {towns.map((item) => (
                                <option key={item}>{item}</option>
                              ))}
                            </select>
                          </Field>
                        </div>
                        <Field label="Site location / estate">
                          <input
                            value={location}
                            onChange={(event) =>
                              setLocation(event.target.value)
                            }
                            className="input"
                            placeholder="Estate, road, building or village"
                          />
                        </Field>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field label="Nearby landmark">
                            <input
                              value={landmark}
                              onChange={(event) =>
                                setLandmark(event.target.value)
                              }
                              className="input"
                            />
                          </Field>
                          <Field label="Google Maps link (optional)">
                            <input
                              value={mapUrl}
                              onChange={(event) =>
                                setMapUrl(event.target.value)
                              }
                              className="input"
                              placeholder="https://maps.google.com/..."
                            />
                          </Field>
                        </div>
                        {loadingPricing ? (
                          <FeeCard text="Calculating your fee..." />
                        ) : pricing ? (
                          <FeeCard
                            text={`${pricing.zone.name} · Site Visit ${money(pricing.siteVisitFee)}`}
                          />
                        ) : pricingError ? (
                          <p className="text-sm font-semibold text-red-700">
                            {pricingError}
                          </p>
                        ) : null}
                      </section>
                    ) : null}
                    {step === 2 ? (
                      <section className="grid gap-5">
                        <StepTitle
                          title="Optional Data Logger"
                          copy="Monitor real site performance before final system recommendations."
                        />
                        <label
                          className={`flex cursor-pointer gap-4 rounded-3xl border p-5 ${loggerRequested ? "border-[#7a0000] bg-red-50" : "border-slate-200 bg-white"}`}
                        >
                          <input
                            type="checkbox"
                            checked={loggerRequested}
                            onChange={(event) =>
                              setLoggerRequested(event.target.checked)
                            }
                            className="mt-1 h-5 w-5"
                          />
                          <span>
                            <strong className="block text-lg text-slate-950">
                              Add Data Logger monitoring
                            </strong>
                            <span className="mt-1 block text-sm leading-6 text-slate-600">
                              KES 5,000 per day. This fee is separate and is not
                              credited to a future quotation.
                            </span>
                          </span>
                        </label>
                        {loggerRequested ? (
                          <Field label="Monitoring days">
                            <select
                              value={loggerDays}
                              onChange={(event) =>
                                setLoggerDays(Number(event.target.value))
                              }
                              className="input"
                            >
                              {[1, 2, 3].map((day) => (
                                <option key={day} value={day}>
                                  {day} day{day > 1 ? "s" : ""} ·{" "}
                                  {money(day * 5000)}
                                </option>
                              ))}
                            </select>
                          </Field>
                        ) : null}
                        <FeeCard
                          text={`Current total: ${money(pricing?.totalPayable || 0)}`}
                        />
                      </section>
                    ) : null}
                    {step === 3 ? (
                      <section className="grid gap-4">
                        <StepTitle
                          title="Tell us about the property"
                          copy="These details help the technician prepare before travelling."
                        />
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field label="Property type">
                            <select
                              value={propertyType}
                              onChange={(event) =>
                                setPropertyType(event.target.value)
                              }
                              className="input"
                            >
                              <option>Residential</option>
                              <option>Commercial</option>
                              <option>Farm</option>
                              <option>Institution</option>
                              <option>Industrial</option>
                            </select>
                          </Field>
                          <Field label="Alternative phone (optional)">
                            <input
                              value={alternativePhone}
                              onChange={(event) =>
                                setAlternativePhone(event.target.value)
                              }
                              className="input"
                            />
                          </Field>
                        </div>
                        <Field label="What should we assess?">
                          <textarea
                            value={requirements}
                            onChange={(event) =>
                              setRequirements(event.target.value)
                            }
                            className="input min-h-28 py-3"
                          />
                        </Field>
                        <Field label="Appliances / loads to inspect (optional)">
                          <textarea
                            value={appliances}
                            onChange={(event) =>
                              setAppliances(event.target.value)
                            }
                            className="input min-h-24 py-3"
                          />
                        </Field>
                        <Field label="Access instructions (optional)">
                          <input
                            value={accessInstructions}
                            onChange={(event) =>
                              setAccessInstructions(event.target.value)
                            }
                            className="input"
                          />
                        </Field>
                      </section>
                    ) : null}
                    {step === 4 ? (
                      <section className="grid gap-5">
                        <StepTitle
                          title="Preferred schedule"
                          copy="Choose your preferred visit date and time window. Our team will confirm availability."
                        />
                        <Field label="Preferred date">
                          <input
                            type="date"
                            min={minDate}
                            value={preferredDate}
                            onChange={(event) =>
                              setPreferredDate(event.target.value)
                            }
                            className="input"
                          />
                        </Field>
                        <div className="grid grid-cols-2 gap-3">
                          {(["MORNING", "AFTERNOON"] as const).map((time) => (
                            <button
                              key={time}
                              type="button"
                              onClick={() => setPreferredTimeLabel(time)}
                              className={`min-h-16 rounded-2xl border font-bold ${preferredTimeLabel === time ? "border-[#7a0000] bg-[#7a0000] text-white" : "border-slate-200 bg-white text-slate-800"}`}
                            >
                              {time === "MORNING"
                                ? "Morning · 8am–12pm"
                                : "Afternoon · 12pm–5pm"}
                            </button>
                          ))}
                        </div>
                      </section>
                    ) : null}
                    {step === 5 ? (
                      <section className="grid gap-5">
                        <StepTitle
                          title="Review and book"
                          copy="Confirm the service and payment breakdown before creating the booking."
                        />
                        <div className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-5 text-sm">
                          <Summary
                            label="Customer"
                            value={`${customer.name} · ${customer.phone}`}
                          />
                          <Summary
                            label="Product"
                            value={`${product.name} · ${money(product.price)}`}
                          />
                          <Summary
                            label="Location"
                            value={`${location}, ${town}, ${county}`}
                          />
                          <Summary
                            label="Schedule"
                            value={`${preferredDate} · ${preferredTimeLabel.toLowerCase()}`}
                          />
                          <Summary
                            label="Site Visit fee"
                            value={money(pricing?.siteVisitFee || 0)}
                          />
                          <Summary
                            label="Data Logger"
                            value={
                              loggerRequested
                                ? `${loggerDays} day(s) · ${money(pricing?.dataLogger.fee || 0)}`
                                : "Not requested"
                            }
                          />
                          <Summary
                            label="Total payable"
                            value={money(pricing?.totalPayable || 0)}
                            strong
                          />
                        </div>
                        <div className="rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">
                          The Site Visit fee of{" "}
                          {money(pricing?.eligibleSiteVisitCredit || 0)} may be
                          credited according to the applicable quotation policy.
                          Data Logger fees are separate and non-creditable.
                        </div>
                        <label className="flex gap-3 text-sm leading-6 text-slate-700">
                          <input
                            type="checkbox"
                            checked={termsAccepted}
                            onChange={(event) =>
                              setTermsAccepted(event.target.checked)
                            }
                            className="mt-1 h-5 w-5"
                          />
                          <span>
                            I confirm these details and accept the{" "}
                            <Link
                              href="/p/terms"
                              target="_blank"
                              className="font-bold text-[#7a0000] underline"
                            >
                              service terms
                            </Link>
                            .
                          </span>
                        </label>
                      </section>
                    ) : null}
                    {error ? (
                      <p className="mt-5 text-sm font-semibold text-red-700">
                        {error}
                      </p>
                    ) : null}
                    <footer className="mt-7 flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-between">
                      <button
                        type="button"
                        onClick={() =>
                          step === 1
                            ? setOpen(false)
                            : setStep((value) => value - 1)
                        }
                        className="inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 font-bold"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        {step === 1 ? "Cancel" : "Back"}
                      </button>
                      {step < 5 ? (
                        <button
                          type="button"
                          onClick={next}
                          className="inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-[#7a0000] px-6 font-bold text-white"
                        >
                          Continue
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={!termsAccepted || submitting}
                          onClick={createBooking}
                          className="min-h-13 rounded-2xl bg-[#7a0000] px-6 font-bold text-white disabled:opacity-50"
                        >
                          {submitting
                            ? "Creating booking..."
                            : `Create booking · ${money(pricing?.totalPayable || 0)}`}
                        </button>
                      )}
                    </footer>
                  </>
                )}
              </main>
            </div>
          </div>
          <style jsx>{`
            .input {
              min-height: 3.5rem;
              width: 100%;
              border: 1px solid rgb(226 232 240);
              border-radius: 1rem;
              background: white;
              padding: 0 1rem;
              color: rgb(15 23 42);
              outline: none;
            }
            .input:focus {
              border-color: #7a0000;
            }
          `}</style>
        </div>
      ) : null}
    </>
  );
}

function StepTitle({ title, copy }: { title: string; copy: string }) {
  return (
    <div>
      <h3 className="text-2xl font-black text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p>
    </div>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold text-slate-800">
      {label}
      {children}
    </label>
  );
}
function FeeCard({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-amber-300/50 bg-amber-50 p-4 font-bold text-amber-950">
      <MapPin className="h-5 w-5 shrink-0" />
      {text}
    </div>
  );
}
function Summary({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
      <span className="text-slate-500">{label}</span>
      <span
        className={`max-w-[65%] text-right ${strong ? "text-lg font-black text-[#7a0000]" : "font-bold text-slate-950"}`}
      >
        {value}
      </span>
    </div>
  );
}
