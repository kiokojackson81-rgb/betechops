"use client";

import { useEffect, useEffectEvent, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  Database,
  MapPin,
  UserRoundCheck,
  Wrench,
} from "lucide-react";
import { getServiceZone, getTownsForCounty, kenyaCountyOptions } from "@/lib/agents/kenyaMarkets";
import { DATA_LOGGER_DAILY_RATE } from "@/lib/siteVisitPolicy";
import type { SerializedSiteVisit } from "@/lib/siteVisitShared";

type StaffOption = {
  id: string;
  name: string | null;
  email: string | null;
  attendantCategory?: string | null;
};

type Props = { staffOptions: StaffOption[]; staffLoading?: boolean };
type PaymentStatus = "UNPAID" | "PAID" | "WAIVED";

const projectTypes = [
  "SOLAR_HOME_SYSTEM",
  "SOLAR_WATER_PUMP",
  "SOLAR_WATER_HEATER",
  "BOREHOLE_SOLAR_SYSTEM",
  "COMMERCIAL_SOLAR_SYSTEM",
  "CCTV_PLUS_SOLAR",
  "STREET_LIGHTS",
  "OTHER",
] as const;
const visitReasons = [
  "LOAD_ASSESSMENT",
  "ROOF_INSPECTION",
  "PUMP_ASSESSMENT",
  "INSTALLATION_PLANNING",
  "FAULT_DIAGNOSIS",
  "FINAL_MEASUREMENTS",
  "QUOTATION_VERIFICATION",
  "MAINTENANCE_VISIT",
  "CUSTOMER_CONSULTATION",
  "OTHER",
] as const;
const label = (value: string) => value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const money = (value: number) => `KES ${value.toLocaleString("en-KE")}`;
const inputClass = "mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400/60";

function nextDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  if (date.getDay() === 0) date.setDate(date.getDate() + 1);
  return date.toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });
}

function emptyForm() {
  return {
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    quoteRef: "",
    county: "",
    town: "",
    location: "",
    landmark: "",
    projectType: "SOLAR_HOME_SYSTEM",
    visitReason: "LOAD_ASSESSMENT",
    customerRequirements: "",
    appliancesToInspect: "",
    preferredDate: nextDate(),
    preferredTimeLabel: "MORNING",
    assignedTechnicianId: "",
    dataLoggerRequested: false,
    dataLoggerDays: "1",
    paymentStatus: "UNPAID" as PaymentStatus,
    paymentMethod: "M-PESA",
    paymentReference: "",
  };
}

function apiPath() {
  if (typeof window === "undefined") return "/api/receipts/site-visits";
  const impersonateId = new URLSearchParams(window.location.search).get("impersonateId");
  return impersonateId
    ? `/api/receipts/site-visits?impersonateId=${encodeURIComponent(impersonateId)}`
    : "/api/receipts/site-visits";
}

function Field({ title, children, wide = false }: { title: string; children: React.ReactNode; wide?: boolean }) {
  return <label className={`text-sm font-medium text-slate-200 ${wide ? "md:col-span-2" : ""}`}>{title}{children}</label>;
}

export default function StaffSiteVisitBookingClient({ staffOptions, staffLoading = false }: Props) {
  const [form, setForm] = useState(emptyForm);
  const [visits, setVisits] = useState<SerializedSiteVisit[]>([]);
  const [ownerName, setOwnerName] = useState("Current staff member");
  const [canWaive, setCanWaive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<SerializedSiteVisit | null>(null);

  const technicians = staffOptions.filter((member) => member.attendantCategory === "TECHNICAL_TEAM");
  const towns = getTownsForCounty(form.county);
  const zone = getServiceZone(form.county, form.town);
  const visitFee = zone?.siteVisitFee || 0;
  const loggerFee = form.dataLoggerRequested ? Number(form.dataLoggerDays) * DATA_LOGGER_DAILY_RATE : 0;
  const totalPayable = visitFee + loggerFee;

  const loadVisits = useEffectEvent(async () => {
    setLoading(true);
    try {
      const response = await fetch(apiPath(), { cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Unable to load site visits.");
      setVisits(Array.isArray(payload?.visits) ? payload.visits : []);
      setOwnerName(payload?.actor?.name || "Current staff member");
      setCanWaive(Boolean(payload?.canWaive));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load site visits.");
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    void loadVisits();
    // loadVisits is an Effect Event and intentionally stays outside dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess(null);
    try {
      const response = await fetch(apiPath(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          customerEmail: form.customerEmail || undefined,
          quoteRef: form.quoteRef || undefined,
          landmark: form.landmark || undefined,
          assignedTechnicianId: form.assignedTechnicianId || undefined,
          dataLoggerDays: form.dataLoggerRequested ? Number(form.dataLoggerDays) : undefined,
          paymentReference: form.paymentStatus === "PAID" ? form.paymentReference : undefined,
          paymentMethod: form.paymentStatus === "PAID" ? form.paymentMethod : undefined,
          waiverReason: form.paymentStatus === "WAIVED" ? "Approved by management at receipts desk" : undefined,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Unable to book the site visit.");
      setSuccess(payload.visit);
      setVisits((current) => [payload.visit, ...current.filter((visit) => visit.id !== payload.visit.id)]);
      setForm(emptyForm());
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to book the site visit.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300"><CalendarDays className="h-4 w-4" /> Site visit desk</div>
          <h2 className="mt-2 text-2xl font-semibold text-white">Book a customer site visit</h2>
          <p className="mt-1 text-sm text-slate-400">Creates one shared visit for sales, admin and technical teams. The customer remains assigned to the staff member who books it.</p>
        </div>
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-emerald-300"><UserRoundCheck className="h-4 w-4" /> Customer owner</div>
          <div className="mt-1 font-semibold text-white">{ownerName}</div>
        </div>
      </div>

      {error ? <div role="alert" className="rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}
      {success ? (
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-50">
          <div className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-5 w-5" /> {success.visitRef} booked successfully</div>
          <p className="mt-1">{success.customerName} · {money(success.totalPayable)} · {success.assignedTechnicianName || "Technician assignment pending"}. Admin and technical queues have been updated.</p>
        </div>
      ) : null}

      <form onSubmit={submit} className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/35">
        <section className="border-b border-white/10 p-4 sm:p-5">
          <h3 className="flex items-center gap-2 font-semibold text-white"><ClipboardCheck className="h-5 w-5 text-cyan-300" /> Customer and purpose</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field title="Customer name"><input required minLength={2} className={inputClass} value={form.customerName} onChange={(event) => setForm({ ...form, customerName: event.target.value })} /></Field>
            <Field title="Phone number"><input required inputMode="tel" placeholder="07xx xxx xxx" className={inputClass} value={form.customerPhone} onChange={(event) => setForm({ ...form, customerPhone: event.target.value })} /></Field>
            <Field title="Email (optional)"><input type="email" className={inputClass} value={form.customerEmail} onChange={(event) => setForm({ ...form, customerEmail: event.target.value })} /></Field>
            <Field title="Existing quotation reference (optional)"><input placeholder="QT-..." className={inputClass} value={form.quoteRef} onChange={(event) => setForm({ ...form, quoteRef: event.target.value })} /></Field>
            <Field title="Project type"><select className={inputClass} value={form.projectType} onChange={(event) => setForm({ ...form, projectType: event.target.value })}>{projectTypes.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></Field>
            <Field title="Visit purpose"><select className={inputClass} value={form.visitReason} onChange={(event) => setForm({ ...form, visitReason: event.target.value })}>{visitReasons.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></Field>
            <Field title="What should the team assess?" wide><textarea required minLength={10} rows={3} className={inputClass} placeholder="Customer requirements, system concern or work to assess" value={form.customerRequirements} onChange={(event) => setForm({ ...form, customerRequirements: event.target.value })} /></Field>
            <Field title="Appliances or equipment to inspect (optional)" wide><textarea rows={2} className={inputClass} value={form.appliancesToInspect} onChange={(event) => setForm({ ...form, appliancesToInspect: event.target.value })} /></Field>
          </div>
        </section>

        <section className="border-b border-white/10 p-4 sm:p-5">
          <h3 className="flex items-center gap-2 font-semibold text-white"><MapPin className="h-5 w-5 text-cyan-300" /> Site and schedule</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field title="County"><select required className={inputClass} value={form.county} onChange={(event) => setForm({ ...form, county: event.target.value, town: "" })}><option value="">Select county</option>{kenyaCountyOptions.map((county) => <option key={county}>{county}</option>)}</select></Field>
            <Field title="Town / service area"><select required disabled={!form.county} className={inputClass} value={form.town} onChange={(event) => setForm({ ...form, town: event.target.value })}><option value="">Select town</option>{towns.map((town) => <option key={town}>{town}</option>)}</select></Field>
            <Field title="Exact location" wide><input required placeholder="Estate, road, building or village" className={inputClass} value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></Field>
            <Field title="Nearby landmark (optional)"><input className={inputClass} value={form.landmark} onChange={(event) => setForm({ ...form, landmark: event.target.value })} /></Field>
            <Field title="Preferred date"><input required type="date" min={new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" })} className={inputClass} value={form.preferredDate} onChange={(event) => setForm({ ...form, preferredDate: event.target.value })} /></Field>
            <Field title="Preferred time"><select className={inputClass} value={form.preferredTimeLabel} onChange={(event) => setForm({ ...form, preferredTimeLabel: event.target.value })}><option value="MORNING">Morning</option><option value="AFTERNOON">Afternoon</option></select></Field>
            <Field title="Assign technician now (optional)" wide><select disabled={staffLoading} className={inputClass} value={form.assignedTechnicianId} onChange={(event) => setForm({ ...form, assignedTechnicianId: event.target.value })}><option value="">Admin / technical manager will assign</option>{technicians.map((member) => <option key={member.id} value={member.id}>{member.name || member.email || "Technical team"}</option>)}</select></Field>
          </div>
        </section>

        <section className="p-4 sm:p-5">
          <h3 className="flex items-center gap-2 font-semibold text-white"><CircleDollarSign className="h-5 w-5 text-cyan-300" /> Add-ons and payment</h3>
          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr_0.9fr]">
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" className="mt-1 h-4 w-4 accent-cyan-400" checked={form.dataLoggerRequested} onChange={(event) => setForm({ ...form, dataLoggerRequested: event.target.checked })} />
                <span><span className="flex items-center gap-2 font-semibold text-white"><Database className="h-4 w-4 text-cyan-300" /> Add data logger</span><span className="mt-1 block text-xs text-slate-400">{money(DATA_LOGGER_DAILY_RATE)} per day, maximum 3 days.</span></span>
              </label>
              {form.dataLoggerRequested ? <label className="mt-4 block text-sm text-slate-200">Monitoring days<select className={inputClass} value={form.dataLoggerDays} onChange={(event) => setForm({ ...form, dataLoggerDays: event.target.value })}><option value="1">1 day</option><option value="2">2 days</option><option value="3">3 days</option></select></label> : null}
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
              <label className="text-sm font-medium text-slate-200">Payment status<select className={inputClass} value={form.paymentStatus} onChange={(event) => setForm({ ...form, paymentStatus: event.target.value as PaymentStatus })}><option value="UNPAID">Awaiting payment</option><option value="PAID">Paid at desk</option>{canWaive ? <option value="WAIVED">Waived by management</option> : null}</select></label>
              {form.paymentStatus === "PAID" ? <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm text-slate-200">Method<select className={inputClass} value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value })}><option>M-PESA</option><option>CASH</option><option>BANK</option><option>CARD</option></select></label><label className="text-sm text-slate-200">Reference<input required className={inputClass} value={form.paymentReference} onChange={(event) => setForm({ ...form, paymentReference: event.target.value })} /></label></div> : null}
            </div>
            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4">
              <div className="text-xs uppercase tracking-wide text-cyan-200">Booking total</div>
              <div className="mt-3 space-y-2 text-sm"><div className="flex justify-between gap-3 text-slate-300"><span>Site visit</span><strong className="text-white">{zone ? money(visitFee) : "Select location"}</strong></div><div className="flex justify-between gap-3 text-slate-300"><span>Data logger</span><strong className="text-white">{money(loggerFee)}</strong></div><div className="flex justify-between gap-3 border-t border-white/10 pt-2 text-base"><span className="font-semibold text-white">Total</span><strong className="text-cyan-200">{money(totalPayable)}</strong></div></div>
              {zone ? <p className="mt-3 text-xs text-slate-400">{zone.name}</p> : null}
            </div>
          </div>
          <div className="mt-5 flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-2xl text-xs text-slate-400">The customer receives a confirmation. Admin and technical teams receive the same request, and any later quotation remains assigned to {ownerName}.</p>
            <button disabled={saving || !zone} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-cyan-400 px-6 py-3 font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"><Wrench className="h-5 w-5" /> {saving ? "Booking..." : "Book site visit"}</button>
          </div>
        </section>
      </form>

      <section className="rounded-3xl border border-white/10 bg-slate-950/35 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold text-white">My recent site visits</h3><p className="text-xs text-slate-400">Track payment, technician assignment and quotation linkage.</p></div><button type="button" onClick={() => void loadVisits()} className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-white/5">Refresh</button></div>
        {loading ? <p className="mt-4 text-sm text-slate-400">Loading site visits...</p> : visits.length ? <div className="mt-4 grid gap-3 xl:grid-cols-2">{visits.map((visit) => <article key={visit.id} className="rounded-2xl border border-white/10 bg-slate-900/60 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><div className="font-semibold text-white">{visit.visitRef} · {visit.customerName}</div><div className="mt-1 text-xs text-slate-400">{[visit.town, visit.county].filter(Boolean).join(", ")} · {visit.preferredDate ? new Date(visit.preferredDate).toLocaleDateString("en-KE") : "Date pending"}</div></div><span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-200">{label(visit.status)}</span></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs"><div className="rounded-xl bg-slate-950/60 p-3 text-slate-400">Payment<strong className="mt-1 block text-sm text-white">{label(visit.paymentStatus)} · {money(visit.totalPayable)}</strong></div><div className="rounded-xl bg-slate-950/60 p-3 text-slate-400">Technician<strong className="mt-1 block text-sm text-white">{visit.assignedTechnicianName || "Awaiting assignment"}</strong></div><div className="rounded-xl bg-slate-950/60 p-3 text-slate-400">Data logger<strong className="mt-1 block text-sm text-white">{visit.dataLoggerRequested ? `${visit.dataLoggerDays} day(s) · ${label(visit.dataLoggerStatus)}` : "Not requested"}</strong></div><div className="rounded-xl bg-slate-950/60 p-3 text-slate-400">Quotation<strong className="mt-1 block text-sm text-white">{visit.quoteRef || "Created after assessment"}</strong></div></div></article>)}</div> : <p className="mt-4 rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-slate-400">No site visits booked from this desk yet.</p>}
      </section>
    </div>
  );
}
