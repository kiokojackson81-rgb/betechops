"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useMemo, useState } from "react";
import { CalendarDays, CircleDollarSign, MapPin, Plus, Search, X } from "lucide-react";
import type { QuoteProjectType } from "@/lib/quoteRequests";
import type { SerializedSiteVisit, SiteVisitPaymentStatus, SiteVisitStatus } from "@/lib/siteVisitShared";
import { getStandardSiteVisitFee } from "@/lib/siteVisitPolicy";
import { getServiceZone, getTownsForCounty, kenyaCountyOptions } from "@/lib/agents/kenyaMarkets";

type StaffOption = { id: string; name: string | null; email: string | null };
type Props = { staffOptions: StaffOption[]; initialQuoteRef?: string | null; basePath?: string };

const statuses: Array<SiteVisitStatus | "ALL"> = ["ALL", "PENDING", "SCHEDULED", "VISITED", "CLOSED"];
const projectTypes: QuoteProjectType[] = ["SOLAR_HOME_SYSTEM", "SOLAR_WATER_PUMP", "SOLAR_WATER_HEATER", "BOREHOLE_SOLAR_SYSTEM", "COMMERCIAL_SOLAR_SYSTEM", "CCTV_PLUS_SOLAR", "STREET_LIGHTS", "OTHER"];
const reasons = ["LOAD_ASSESSMENT", "ROOF_INSPECTION", "PUMP_ASSESSMENT", "INSTALLATION_PLANNING", "FAULT_DIAGNOSIS", "FINAL_MEASUREMENTS", "QUOTATION_VERIFICATION", "MAINTENANCE_VISIT", "CUSTOMER_CONSULTATION", "OTHER"];
const label = (value: string) => value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const money = (value: number) => `KES ${value.toLocaleString("en-KE")}`;
const dateTime = (value: string | null) => value ? new Date(value).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" }) : "Awaiting schedule";

const emptyForm = (quoteRef = "") => ({
  quoteRef, customerName: "", customerPhone: "", customerEmail: "", companyName: "", alternativePhone: "",
  county: "", town: "", location: "", landmark: "", mapUrl: "", propertyType: "", accessInstructions: "",
  projectType: "" as QuoteProjectType | "", visitReason: "LOAD_ASSESSMENT", preferredDate: "", preferredTimeLabel: "MORNING",
  scheduledAt: "", estimatedDurationMinutes: "60", assignedStaffId: "", assignedTechnicianId: "", transportMethod: "",
  visitFee: "", paymentStatus: "UNPAID" as SiteVisitPaymentStatus, paymentReference: "", feeOverrideReason: "",
  customerRequirements: "", appliancesToInspect: "", specialInstructions: "", internalNotes: "",
});

function Field({ label: fieldLabel, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <label className={wide ? "space-y-2 md:col-span-2" : "space-y-2"}><span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{fieldLabel}</span>{children}</label>;
}

export default function SiteVisitsWorkspaceClient({ staffOptions, initialQuoteRef, basePath = "/admin/quotation-center/site-visits" }: Props) {
  const [visits, setVisits] = useState<SerializedSiteVisit[]>([]);
  const [status, setStatus] = useState<SiteVisitStatus | "ALL">("ALL");
  const [query, setQuery] = useState("");
  const [technician, setTechnician] = useState("");
  const [project, setProject] = useState("");
  const [payment, setPayment] = useState("");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(Boolean(initialQuoteRef));
  const [form, setForm] = useState(() => emptyForm(initialQuoteRef || ""));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useEffectEvent(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status });
      if (query.trim()) params.set("q", query.trim());
      const response = await fetch(`/api/admin/site-visits?${params}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load site visits.");
      setVisits(data.visits || []);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Unable to load site visits."); }
    finally { setLoading(false); }
  });
  // load is an Effect Event, so it intentionally stays outside the dependency list.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [status]);

  const availableTowns = useMemo(() => getTownsForCounty(form.county), [form.county]);
  const zone = getServiceZone(form.county, form.town);
  const fee = getStandardSiteVisitFee(form.county, form.town);
  useEffect(() => {
    if (fee != null && (!form.visitFee || [2_000, 5_000, 10_000].includes(Number(form.visitFee)))) {
      setForm((current) => ({ ...current, visitFee: String(fee) }));
    }
  }, [fee, form.visitFee]);

  const visible = useMemo(() => visits.filter((visit) => {
    if (technician && visit.assignedTechnicianId !== technician) return false;
    if (project && visit.projectType !== project) return false;
    if (payment && visit.paymentStatus !== payment) return false;
    if (date && !(visit.scheduledAt || visit.preferredDate || "").startsWith(date)) return false;
    return true;
  }), [visits, technician, project, payment, date]);

  const stats = useMemo(() => ({
    PENDING: visits.filter((visit) => visit.status === "PENDING").length,
    SCHEDULED: visits.filter((visit) => visit.status === "SCHEDULED").length,
    VISITED: visits.filter((visit) => visit.status === "VISITED").length,
    CLOSED: visits.filter((visit) => visit.status === "CLOSED").length,
  }), [visits]);

  async function createVisit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError(null);
    try {
      const response = await fetch("/api/admin/site-visits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, projectType: form.projectType || undefined, scheduledAt: form.scheduledAt || undefined, preferredDate: form.preferredDate || undefined, estimatedDurationMinutes: Number(form.estimatedDurationMinutes || 0), visitFee: Number(form.visitFee || 0) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to create site visit.");
      window.location.href = `${basePath}/${data.visit.id}`;
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Unable to create site visit."); setSaving(false); }
  }

  const inputClass = "w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-cyan-400/60";
  return <div className="min-w-0 space-y-5 overflow-x-hidden">
    <header className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,.15),transparent_35%),linear-gradient(145deg,#111d2d,#07111f)] p-5 sm:p-7">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><div className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-300">Field service control</div><h1 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">Site Visits</h1><p className="mt-2 text-sm text-slate-300">Schedule visits, manage field assessments and convert findings into quotations.</p></div><button onClick={() => setShowCreate(true)} className="inline-flex items-center justify-center gap-2 rounded-full bg-cyan-400 px-5 py-3 font-bold text-slate-950"><Plus className="h-4 w-4" /> New Site Visit</button></div>
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">{statuses.slice(1).map((item) => <button key={item} onClick={() => setStatus(item)} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left"><div className="text-xs uppercase tracking-wider text-slate-400">{item === "VISITED" ? "Visited / completed" : label(item)}</div><div className="mt-2 text-3xl font-semibold text-white">{stats[item]}</div></button>)}</div>
    </header>

    <section className="rounded-[28px] border border-white/10 bg-slate-950/80 p-4 sm:p-6">
      <div className="grid gap-3 xl:grid-cols-[minmax(260px,1fr)_repeat(4,minmax(140px,.45fr))_auto]"><div className="relative"><Search className="absolute left-4 top-3.5 h-4 w-4 text-slate-500" /><input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void load()} placeholder="Search ref, customer, phone, email or location" className={`${inputClass} pl-11`} /></div><select value={technician} onChange={(e) => setTechnician(e.target.value)} className={inputClass}><option value="">All technicians</option>{staffOptions.map((option) => <option key={option.id} value={option.id}>{option.name || option.email}</option>)}</select><select value={project} onChange={(e) => setProject(e.target.value)} className={inputClass}><option value="">All projects</option>{projectTypes.map((item) => <option key={item}>{item}</option>)}</select><select value={payment} onChange={(e) => setPayment(e.target.value)} className={inputClass}><option value="">All payments</option><option>UNPAID</option><option>PAID</option><option>WAIVED</option></select><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} /><button onClick={() => void load()} className="rounded-xl border border-white/10 px-5 py-3 text-sm font-bold text-white">Search</button></div>
      <div className="mt-4 flex flex-wrap gap-2">{statuses.map((item) => <button key={item} onClick={() => setStatus(item)} className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider ${status === item ? "bg-cyan-400 text-slate-950" : "border border-white/10 text-slate-300"}`}>{item}</button>)}</div>
    </section>

    <section className="space-y-3">{loading ? <div className="rounded-2xl border border-white/10 p-8 text-slate-400">Loading site visits...</div> : null}{!loading && !visible.length ? <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-slate-400">No visits match these filters.</div> : visible.map((visit) => <Link key={visit.id} href={`${basePath}/${visit.id}`} className="grid min-w-0 gap-4 rounded-[24px] border border-white/10 bg-[#0b1524] p-5 transition hover:border-cyan-400/40 lg:grid-cols-[minmax(0,1.2fr)_minmax(180px,.6fr)_minmax(180px,.6fr)_auto] lg:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-bold text-white">{visit.visitRef}</span>{visit.source === "CUSTOMER_REQUEST" ? <span className="rounded-full bg-amber-400/15 px-2 py-1 text-[10px] font-bold text-amber-300">CUSTOMER REQUEST</span> : null}</div><div className="mt-2 truncate text-lg font-semibold text-white">{visit.customerName}</div><div className="text-sm text-slate-400">{visit.customerPhone}</div></div><div className="min-w-0 text-sm text-slate-300"><div className="flex gap-2"><MapPin className="h-4 w-4 shrink-0 text-cyan-300" /><span className="truncate">{[visit.location, visit.town, visit.county].filter(Boolean).join(", ") || "Location pending"}</span></div><div className="mt-2 truncate">{label(visit.projectType || "GENERAL_VISIT")} · {label(visit.visitReason || "OTHER")}</div></div><div className="text-sm text-slate-300"><div className="flex gap-2"><CalendarDays className="h-4 w-4 text-cyan-300" />{dateTime(visit.scheduledAt || visit.preferredDate)}</div><div className="mt-2">{visit.assignedTechnicianName || visit.assignedStaffName || "Unassigned"}</div></div><div className="flex flex-row gap-2 lg:flex-col lg:items-end"><span className="rounded-full border border-cyan-400/30 px-3 py-1 text-xs font-bold text-cyan-200">{visit.status}</span><span className={`rounded-full px-3 py-1 text-xs font-bold ${visit.paymentStatus === "PAID" ? "bg-emerald-400/15 text-emerald-300" : "bg-amber-400/15 text-amber-300"}`}><CircleDollarSign className="mr-1 inline h-3 w-3" />{visit.paymentStatus} · {money(visit.visitFee)}</span></div></Link>)}</section>

    {showCreate ? <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/80 p-0 backdrop-blur-sm sm:items-center sm:p-4"><form onSubmit={createVisit} className="max-h-[96vh] w-full max-w-6xl overflow-y-auto rounded-t-[28px] border border-white/10 bg-[#0a1422] p-5 text-white shadow-2xl sm:rounded-[28px] sm:p-7"><div className="sticky top-0 z-10 flex items-start justify-between bg-[#0a1422] pb-5"><div><div className="text-xs font-bold uppercase tracking-[.25em] text-cyan-300">New field visit</div><h2 className="mt-2 text-2xl font-semibold">Create Site Visit</h2></div><button type="button" onClick={() => setShowCreate(false)} className="rounded-full border border-white/10 p-3"><X className="h-5 w-5" /></button></div>
      {error ? <div className="mb-4 rounded-xl border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</div> : null}
      <div className="space-y-7">{[
        ["Customer", <><Field label="Quotation reference"><input className={inputClass} value={form.quoteRef} onChange={(e) => setForm({...form, quoteRef:e.target.value})} /></Field><Field label="Customer name"><input required className={inputClass} value={form.customerName} onChange={(e) => setForm({...form, customerName:e.target.value})} /></Field><Field label="Phone number"><input required className={inputClass} value={form.customerPhone} onChange={(e) => setForm({...form, customerPhone:e.target.value})} /></Field><Field label="Email"><input type="email" className={inputClass} value={form.customerEmail} onChange={(e) => setForm({...form, customerEmail:e.target.value})} /></Field><Field label="Company"><input className={inputClass} value={form.companyName} onChange={(e) => setForm({...form, companyName:e.target.value})} /></Field><Field label="Alternative contact"><input className={inputClass} value={form.alternativePhone} onChange={(e) => setForm({...form, alternativePhone:e.target.value})} /></Field></>],
        ["Location", <><Field label="County"><select required className={inputClass} value={form.county} onChange={(e) => { const county=e.target.value; setForm((current)=>({...current,county,town:getTownsForCounty(county).includes(current.town)?current.town:""})); }}><option value="">Select county</option>{kenyaCountyOptions.map((county)=><option key={county} value={county}>{county}</option>)}</select></Field><Field label="Town / area"><select required disabled={!form.county} className={inputClass} value={form.town} onChange={(e) => setForm({...form, town:e.target.value})}><option value="">{form.county ? "Select town / area" : "Choose county first"}</option>{availableTowns.map((town)=><option key={town} value={town}>{town}</option>)}</select></Field>{zone ? <div className="rounded-xl border border-cyan-400/25 bg-cyan-400/10 p-4 text-sm text-cyan-100 md:col-span-2"><b>{form.town}, {form.county} County</b><div>{zone.name} · Site Visit Fee {money(zone.siteVisitFee)}</div></div> : null}<Field label="Exact location" wide><input required className={inputClass} value={form.location} onChange={(e) => setForm({...form, location:e.target.value})} /></Field><Field label="Landmark"><input className={inputClass} value={form.landmark} onChange={(e) => setForm({...form, landmark:e.target.value})} /></Field><Field label="Google Maps URL"><input className={inputClass} value={form.mapUrl} onChange={(e) => setForm({...form, mapUrl:e.target.value})} /></Field><Field label="Property type"><input className={inputClass} value={form.propertyType} onChange={(e) => setForm({...form, propertyType:e.target.value})} /></Field><Field label="Access instructions"><input className={inputClass} value={form.accessInstructions} onChange={(e) => setForm({...form, accessInstructions:e.target.value})} /></Field></>],
        ["Visit & assignment", <><Field label="Project type"><select required className={inputClass} value={form.projectType} onChange={(e) => setForm({...form, projectType:e.target.value as QuoteProjectType})}><option value="">Select project</option>{projectTypes.map((item)=><option key={item}>{item}</option>)}</select></Field><Field label="Visit reason"><select className={inputClass} value={form.visitReason} onChange={(e)=>setForm({...form,visitReason:e.target.value})}>{reasons.map((item)=><option key={item}>{item}</option>)}</select></Field><Field label="Preferred date"><input type="date" className={inputClass} value={form.preferredDate} onChange={(e)=>setForm({...form,preferredDate:e.target.value})}/></Field><Field label="Preferred time"><select className={inputClass} value={form.preferredTimeLabel} onChange={(e)=>setForm({...form,preferredTimeLabel:e.target.value})}><option>MORNING</option><option>AFTERNOON</option></select></Field><Field label="Confirmed schedule"><input type="datetime-local" className={inputClass} value={form.scheduledAt} onChange={(e)=>setForm({...form,scheduledAt:e.target.value})}/></Field><Field label="Duration (minutes)"><input type="number" className={inputClass} value={form.estimatedDurationMinutes} onChange={(e)=>setForm({...form,estimatedDurationMinutes:e.target.value})}/></Field><Field label="Assigned staff"><select className={inputClass} value={form.assignedStaffId} onChange={(e)=>setForm({...form,assignedStaffId:e.target.value})}><option value="">Unassigned</option>{staffOptions.map((item)=><option key={item.id} value={item.id}>{item.name||item.email}</option>)}</select></Field><Field label="Assigned technician"><select className={inputClass} value={form.assignedTechnicianId} onChange={(e)=>setForm({...form,assignedTechnicianId:e.target.value})}><option value="">Unassigned</option>{staffOptions.map((item)=><option key={item.id} value={item.id}>{item.name||item.email}</option>)}</select></Field></>],
        ["Payment & requirements", <><Field label="Visit fee"><input type="number" className={inputClass} value={form.visitFee} onChange={(e)=>setForm({...form,visitFee:e.target.value})}/><span className="text-xs text-amber-200">Standard: {fee ? money(fee) : "select county"}. Deductible if customer proceeds.</span></Field><Field label="Payment status"><select className={inputClass} value={form.paymentStatus} onChange={(e)=>setForm({...form,paymentStatus:e.target.value as SiteVisitPaymentStatus})}><option>UNPAID</option><option>PAID</option><option>WAIVED</option></select></Field><Field label="Payment reference"><input className={inputClass} value={form.paymentReference} onChange={(e)=>setForm({...form,paymentReference:e.target.value})}/></Field><Field label="Fee override / waiver reason"><input className={inputClass} value={form.feeOverrideReason} onChange={(e)=>setForm({...form,feeOverrideReason:e.target.value})}/></Field><Field label="Customer requirements" wide><textarea required className={`${inputClass} min-h-24`} value={form.customerRequirements} onChange={(e)=>setForm({...form,customerRequirements:e.target.value})}/></Field><Field label="Equipment / appliances" wide><textarea className={`${inputClass} min-h-24`} value={form.appliancesToInspect} onChange={(e)=>setForm({...form,appliancesToInspect:e.target.value})}/></Field><Field label="Special instructions"><textarea className={`${inputClass} min-h-24`} value={form.specialInstructions} onChange={(e)=>setForm({...form,specialInstructions:e.target.value})}/></Field><Field label="Internal notes"><textarea className={`${inputClass} min-h-24`} value={form.internalNotes} onChange={(e)=>setForm({...form,internalNotes:e.target.value})}/></Field></>],
      ].map(([title,fields])=><section key={String(title)}><h3 className="mb-4 border-b border-white/10 pb-2 text-lg font-semibold">{title}</h3><div className="grid gap-4 md:grid-cols-2">{fields}</div></section>)}</div><div className="sticky bottom-0 mt-7 flex justify-end gap-3 border-t border-white/10 bg-[#0a1422] pt-5"><button type="button" onClick={()=>setShowCreate(false)} className="rounded-full border border-white/10 px-5 py-3">Cancel</button><button disabled={saving} className="rounded-full bg-cyan-400 px-6 py-3 font-bold text-slate-950 disabled:opacity-50">{saving?"Creating...":"Create Site Visit"}</button></div></form></div> : null}
  </div>;
}
