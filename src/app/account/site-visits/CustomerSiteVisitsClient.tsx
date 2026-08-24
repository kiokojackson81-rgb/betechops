"use client";

import { useMemo, useState } from "react";
import { CalendarCheck2, CreditCard, MapPin, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  getServiceZone,
  getTownsForCounty,
  kenyaCountyOptions,
} from "@/lib/agents/kenyaMarkets";
import type { CustomerSiteVisit } from "@/lib/siteVisitShared";

type Profile = {
  name: string;
  phone: string;
  email: string;
  county: string;
  town: string;
  estateLandmark: string;
};
type FormState = {
  projectType: string;
  visitReason: string;
  customerRequirements: string;
  county: string;
  town: string;
  location: string;
  landmark: string;
  mapUrl: string;
  propertyType: string;
  accessInstructions: string;
  preferredDate: string;
  preferredTimeLabel: "MORNING" | "AFTERNOON";
};

const emptyForm = (profile: Profile): FormState => ({
  projectType: "SOLAR_HOME_SYSTEM",
  visitReason: "LOAD_ASSESSMENT",
  customerRequirements: "",
  county: profile.county,
  town: profile.town,
  location: profile.estateLandmark,
  landmark: "",
  mapUrl: "",
  propertyType: "RESIDENTIAL",
  accessInstructions: "",
  preferredDate: "",
  preferredTimeLabel: "MORNING",
});
const money = (value: number) => `KES ${value.toLocaleString("en-KE")}`;
const label = (value?: string | null, fallback = "Pending") =>
  (value || fallback)
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
const displayDate = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-KE", {
        dateStyle: "medium",
        timeStyle: value.includes("T") ? "short" : undefined,
      }).format(new Date(value))
    : "Awaiting confirmation";

export default function CustomerSiteVisitsClient({
  initialVisits,
  profile,
  initialOpenBooking = false,
}: {
  initialVisits: CustomerSiteVisit[];
  profile: Profile;
  initialOpenBooking?: boolean;
}) {
  const router = useRouter();
  const [visits, setVisits] = useState(initialVisits);
  const [open, setOpen] = useState(initialOpenBooking);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(() => emptyForm(profile));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const availableTowns = useMemo(
    () => getTownsForCounty(form.county),
    [form.county],
  );
  const serviceZone = getServiceZone(form.county, form.town);
  const fee = serviceZone?.siteVisitFee ?? 0;
  const update = (key: keyof FormState, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  function openBooking() {
    setMessage("");
    setOpen(true);
  }

  function closeBooking() {
    setOpen(false);
    if (initialOpenBooking) {
      router.replace("/account/site-visits", { scroll: false });
    }
  }

  async function createVisit() {
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/shop/site-visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const payload = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok || !payload.visit)
      return setMessage(payload.error || "Unable to request the visit.");
    setVisits((current) => [payload.visit, ...current]);
    setOpen(false);
    setStep(1);
    setForm(emptyForm(profile));
    setMessage(
      `${payload.visit.visitRef} was submitted successfully. Complete payment to confirm scheduling.`,
    );
    router.replace("/account/site-visits", { scroll: false });
  }

  async function action(id: string, body: Record<string, string>) {
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/shop/site-visits/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok)
      return setMessage(payload.error || "Unable to update the visit.");
    setVisits((current) =>
      current.map((visit) => (visit.id === id ? payload.visit : visit)),
    );
  }

  function submitPayment(visit: CustomerSiteVisit) {
    const reference = window.prompt("Enter the M-Pesa or payment reference");
    if (reference?.trim())
      void action(visit.id, {
        action: "SUBMIT_PAYMENT",
        paymentMethod: "MPESA",
        paymentReference: reference.trim(),
      });
  }

  function requestReschedule(visit: CustomerSiteVisit) {
    const preferredDate = window.prompt(
      "Preferred date (YYYY-MM-DD)",
      visit.preferredDate?.slice(0, 10) || "",
    );
    if (preferredDate?.trim())
      void action(visit.id, {
        action: "REQUEST_RESCHEDULE",
        preferredDate: preferredDate.trim(),
        preferredTimeLabel: visit.preferredTimeLabel || "MORNING",
      });
  }

  return (
    <section className="w-full min-w-0 rounded-[28px] border border-[#7a0000]/10 bg-white p-5 shadow-[0_24px_70px_rgba(57,18,0,.08)] sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <CalendarCheck2 className="h-7 w-7 text-[#7a0000]" />
          <div>
            <div className="text-xs font-black uppercase tracking-[.2em] text-[#8f1212]">
              Site visits
            </div>
            <h1 className="mt-1 text-2xl font-black sm:text-3xl">
              Assessments and installations
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Request, pay, reschedule and track your Betech technical visit.
            </p>
          </div>
        </div>
        <button
          onClick={openBooking}
          className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#8f0000] px-5 font-black text-white"
        >
          <Plus className="h-5 w-5" /> Request site visit
        </button>
      </div>
      {message ? (
        <div className="mt-5 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900">
          {message}
        </div>
      ) : null}
      <div className="mt-7 grid gap-5 xl:grid-cols-2">
        {visits.length ? (
          visits.map((visit) => (
            <article
              key={visit.id}
              className="rounded-[24px] border border-[#7a0000]/10 bg-[#fcfaf7] p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-black">{visit.visitRef}</div>
                  <div className="mt-1 text-sm text-slate-500">
                    {label(visit.projectType, "Solar project")} · requested{" "}
                    {displayDate(visit.createdAt)}
                  </div>
                </div>
                <span className="rounded-full bg-[#fff0cf] px-3 py-1 text-[11px] font-black uppercase tracking-wider text-[#7a0000]">
                  {label(visit.status)}
                </span>
              </div>
              {visit.originProductName ? (
                <div className="mt-4 rounded-2xl border border-[#7a0000]/10 bg-white p-4">
                  <div className="text-[10px] font-black uppercase tracking-[.18em] text-[#7a0000]">
                    Selected product
                  </div>
                  <div className="mt-1 font-black text-slate-950">
                    {visit.originProductName}
                  </div>
                  {visit.originProductPrice ? (
                    <div className="mt-1 text-sm font-bold text-slate-600">
                      {money(visit.originProductPrice)}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl bg-white p-3">
                  <div className="text-xs text-slate-500">Site Visit fee</div>
                  <b>{money(visit.visitFee)}</b>
                </div>
                <div className="rounded-2xl bg-white p-3">
                  <div className="text-xs text-slate-500">Data Logger</div>
                  <b>
                    {visit.dataLoggerRequested
                      ? `${visit.dataLoggerDays} day(s) · ${money(visit.dataLoggerFee)}`
                      : "Not requested"}
                  </b>
                </div>
                <div className="rounded-2xl bg-white p-3">
                  <div className="text-xs text-slate-500">Total / payment</div>
                  <b>
                    {money(visit.totalPayable)} ·{" "}
                    {label(
                      visit.paymentVerificationStatus === "PENDING"
                        ? "VERIFYING"
                        : visit.paymentStatus,
                    )}
                  </b>
                </div>
                <div className="rounded-2xl bg-white p-3">
                  <div className="text-xs text-slate-500">Schedule</div>
                  <b>{displayDate(visit.scheduledAt || visit.preferredDate)}</b>
                </div>
              </div>
              <div className="mt-4 flex gap-2 text-sm text-slate-600">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#7a0000]" />
                <span>
                  {[visit.location, visit.town, visit.county]
                    .filter(Boolean)
                    .join(", ")}
                  {visit.serviceZoneLabel ? ` · ${visit.serviceZoneLabel}` : ""}
                </span>
              </div>
              {visit.quoteRef ? (
                <div className="mt-3 text-sm">
                  <b>Quotation:</b> {visit.quoteRef} · credit{" "}
                  {label(visit.quotationCreditStatus)}
                </div>
              ) : null}
              <div className="mt-5 flex flex-wrap gap-2">
                {visit.paymentStatus === "UNPAID" &&
                visit.paymentVerificationStatus !== "PENDING" ? (
                  <button
                    disabled={busy}
                    onClick={() => submitPayment(visit)}
                    className="rounded-full bg-[#8f0000] px-4 py-2 text-sm font-black text-white"
                  >
                    <CreditCard className="mr-2 inline h-4 w-4" />
                    Submit payment
                  </button>
                ) : null}
                <button
                  disabled={busy || visit.status === "CLOSED"}
                  onClick={() => requestReschedule(visit)}
                  className="rounded-full border border-[#7a0000]/15 bg-white px-4 py-2 text-sm font-bold"
                >
                  Request reschedule
                </button>
                {visit.status !== "CLOSED" && !visit.cancellationRequestedAt ? (
                  <button
                    disabled={busy}
                    onClick={() => {
                      const reason = window.prompt(
                        "Why would you like to cancel?",
                      );
                      if (reason?.trim())
                        void action(visit.id, {
                          action: "REQUEST_CANCELLATION",
                          reason: reason.trim(),
                        });
                    }}
                    className="rounded-full border border-red-200 px-4 py-2 text-sm font-bold text-red-700"
                  >
                    Request cancellation
                  </button>
                ) : null}
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-[22px] border border-dashed border-[#7a0000]/15 p-9 text-sm text-slate-500 xl:col-span-2">
            No site visits yet. Request an assessment and choose your preferred
            date.
          </div>
        )}
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/65 p-3"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-[28px] bg-[#fffdf9] shadow-2xl">
            <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-5 py-4">
              <div>
                <div className="text-xs font-black uppercase tracking-[.2em] text-[#8f0000]">
                  Step {step} of 4
                </div>
                <h2 className="text-xl font-black">Request a site visit</h2>
              </div>
              <button
                onClick={closeBooking}
                aria-label="Close"
                className="rounded-full border p-3"
              >
                <X className="h-5 w-5" />
              </button>
            </header>
            <div className="p-5 sm:p-7">
              {message ? (
                <div
                  role="alert"
                  className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800"
                >
                  {message}
                </div>
              ) : null}
              {step === 1 ? (
                <div className="grid gap-4">
                  <Field label="Project type">
                    <select
                      value={form.projectType}
                      onChange={(e) => update("projectType", e.target.value)}
                      className="field"
                    >
                      <option value="SOLAR_HOME_SYSTEM">
                        Solar home system
                      </option>
                      <option value="SOLAR_WATER_PUMP">Solar water pump</option>
                      <option value="SOLAR_WATER_HEATER">
                        Solar water heater
                      </option>
                      <option value="COMMERCIAL_SOLAR_SYSTEM">
                        Commercial solar system
                      </option>
                      <option value="OTHER">Other</option>
                    </select>
                  </Field>
                  <Field label="Reason for visit">
                    <select
                      value={form.visitReason}
                      onChange={(e) => update("visitReason", e.target.value)}
                      className="field"
                    >
                      <option value="LOAD_ASSESSMENT">Load assessment</option>
                      <option value="ROOF_INSPECTION">Roof inspection</option>
                      <option value="PUMP_ASSESSMENT">Pump assessment</option>
                      <option value="INSTALLATION_PLANNING">
                        Installation planning
                      </option>
                      <option value="FAULT_DIAGNOSIS">Fault diagnosis</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </Field>
                  <Field label="What should our technician assess?">
                    <textarea
                      rows={5}
                      value={form.customerRequirements}
                      onChange={(e) =>
                        update("customerRequirements", e.target.value)
                      }
                      className="field"
                      placeholder="Describe the site, appliances, project or technical issue..."
                    />
                  </Field>
                </div>
              ) : null}
              {step === 2 ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="County">
                    <select
                      value={form.county}
                      onChange={(e) => {
                        const county = e.target.value;
                        setForm((current) => ({
                          ...current,
                          county,
                          town: getTownsForCounty(county).includes(current.town)
                            ? current.town
                            : "",
                        }));
                      }}
                      className="field"
                    >
                      <option value="">Select county</option>
                      {kenyaCountyOptions.map((county) => (
                        <option key={county} value={county}>
                          {county}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Town / area">
                    <select
                      value={form.town}
                      onChange={(e) => update("town", e.target.value)}
                      disabled={!form.county}
                      className="field"
                    >
                      <option value="">
                        {form.county
                          ? "Select town / area"
                          : "Choose county first"}
                      </option>
                      {availableTowns.map((town) => (
                        <option key={town} value={town}>
                          {town}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {serviceZone ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 sm:col-span-2">
                      <b>
                        {form.town}, {form.county} County
                      </b>
                      <div className="mt-1">{serviceZone.name}</div>
                      <div className="mt-1 text-lg font-black">
                        Site Visit Fee: {money(serviceZone.siteVisitFee)}
                      </div>
                    </div>
                  ) : null}
                  <Field label="Exact location">
                    <input
                      value={form.location}
                      onChange={(e) => update("location", e.target.value)}
                      className="field"
                    />
                  </Field>
                  <Field label="Landmark">
                    <input
                      value={form.landmark}
                      onChange={(e) => update("landmark", e.target.value)}
                      className="field"
                    />
                  </Field>
                  <Field label="Google Maps link">
                    <input
                      value={form.mapUrl}
                      onChange={(e) => update("mapUrl", e.target.value)}
                      className="field"
                    />
                  </Field>
                  <Field label="Property type">
                    <input
                      value={form.propertyType}
                      onChange={(e) => update("propertyType", e.target.value)}
                      className="field"
                    />
                  </Field>
                </div>
              ) : null}
              {step === 3 ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Preferred date">
                    <input
                      type="date"
                      min={new Date().toISOString().slice(0, 10)}
                      value={form.preferredDate}
                      onChange={(e) => update("preferredDate", e.target.value)}
                      className="field"
                    />
                  </Field>
                  <Field label="Preferred time">
                    <select
                      value={form.preferredTimeLabel}
                      onChange={(e) =>
                        update("preferredTimeLabel", e.target.value)
                      }
                      className="field"
                    >
                      <option value="MORNING">Morning</option>
                      <option value="AFTERNOON">Afternoon</option>
                    </select>
                  </Field>
                  <Field label="Access instructions">
                    <textarea
                      rows={4}
                      value={form.accessInstructions}
                      onChange={(e) =>
                        update("accessInstructions", e.target.value)
                      }
                      className="field"
                      placeholder="Gate, security or access guidance"
                    />
                  </Field>
                  <p className="self-end rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
                    This is your preferred slot. Betech will confirm the
                    technician and final appointment time.
                  </p>
                </div>
              ) : null}
              {step === 4 ? (
                <div className="space-y-5">
                  <div className="rounded-[22px] bg-[#140a08] p-6 text-white">
                    <div className="text-xs font-black uppercase tracking-[.2em] text-amber-300">
                      Booking summary
                    </div>
                    <div className="mt-4 grid gap-4 sm:grid-cols-3">
                      <div>
                        <small className="text-slate-400">Project</small>
                        <div className="font-black">
                          {label(form.projectType)}
                        </div>
                      </div>
                      <div>
                        <small className="text-slate-400">Preferred slot</small>
                        <div className="font-black">
                          {displayDate(form.preferredDate)} ·{" "}
                          {label(form.preferredTimeLabel)}
                        </div>
                      </div>
                      <div>
                        <small className="text-slate-400">Visit fee</small>
                        <div className="text-xl font-black text-amber-300">
                          {money(fee)}
                        </div>
                        <small className="text-slate-300">
                          {serviceZone?.name}
                        </small>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600">
                    The fee is determined by the selected service zone: Zone 1
                    is KES 2,000, Zone 2 is KES 5,000, and Zone 3 is KES 10,000.
                    It is deductible from your final quotation if Betech
                    receives the installation job. The team verifies payment
                    before scheduling.
                  </p>
                </div>
              ) : null}
              <div className="mt-7 flex justify-between gap-3">
                <button
                  disabled={step === 1 || busy}
                  onClick={() => setStep((current) => current - 1)}
                  className="rounded-full border px-5 py-3 font-bold disabled:opacity-40"
                >
                  Back
                </button>
                {step < 4 ? (
                  <button
                    disabled={
                      (step === 1 && !form.customerRequirements.trim()) ||
                      (step === 2 && (!serviceZone || !form.location.trim())) ||
                      (step === 3 && !form.preferredDate)
                    }
                    onClick={() => setStep((current) => current + 1)}
                    className="rounded-full bg-[#8f0000] px-6 py-3 font-black text-white disabled:opacity-40"
                  >
                    Continue
                  </button>
                ) : (
                  <button
                    disabled={busy || !serviceZone}
                    onClick={createVisit}
                    className="rounded-full bg-[#8f0000] px-6 py-3 font-black text-white disabled:opacity-50"
                  >
                    {busy ? "Submitting..." : "Submit request"}
                  </button>
                )}
              </div>
            </div>
            <style jsx>{`
              .field {
                width: 100%;
                min-height: 52px;
                border: 1px solid rgba(122, 0, 0, 0.15);
                border-radius: 16px;
                background: white;
                padding: 12px 14px;
                outline: none;
              }
              .field:focus {
                border-color: #8f0000;
                box-shadow: 0 0 0 3px rgba(143, 0, 0, 0.08);
              }
            `}</style>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Field({
  label: fieldLabel,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold text-slate-700">
      {fieldLabel}
      {children}
    </label>
  );
}
