"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SITE_VISIT_STATUSES } from "@/lib/siteVisitShared";
import type {
  SerializedSiteVisitAttachment,
  SerializedSiteVisitEvent,
  SerializedSiteVisit,
  SiteVisitOutcome,
  SiteVisitPaymentStatus,
  SiteVisitStatus,
} from "@/lib/siteVisitShared";
import type { QuoteProjectType } from "@/lib/quoteRequests";

type StaffOption = {
  id: string;
  name: string | null;
  email: string | null;
};

type Props = {
  staffOptions: StaffOption[];
  initialQuoteRef?: string | null;
};

type CreateFormState = {
  quoteRef: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  county: string;
  town: string;
  location: string;
  projectType: QuoteProjectType | "";
  visitReason: string;
  scheduledAt: string;
  assignedStaffId: string;
  assignedTechnicianId: string;
  visitFee: string;
  paymentStatus: SiteVisitPaymentStatus;
  customerRequirements: string;
  internalNotes: string;
};

type EditFormState = {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  county: string;
  town: string;
  location: string;
  scheduledAt: string;
  assignedStaffId: string;
  assignedTechnicianId: string;
  visitFee: string;
  paymentStatus: SiteVisitPaymentStatus;
  status: SiteVisitStatus;
  findings: string;
  assessmentSummary: string;
  recommendedSystem: string;
  recommendedItems: string;
  risks: string;
  nextAction: string;
  outcome: SiteVisitOutcome | "";
  closedReason: string;
  customerRequirements: string;
  internalNotes: string;
};

const statusOptions: Array<SiteVisitStatus | "ALL"> = ["ALL", "PENDING", "SCHEDULED", "VISITED", "CLOSED"];
const projectTypeOptions: QuoteProjectType[] = [
  "SOLAR_HOME_SYSTEM",
  "SOLAR_WATER_PUMP",
  "SOLAR_WATER_HEATER",
  "BOREHOLE_SOLAR_SYSTEM",
  "COMMERCIAL_SOLAR_SYSTEM",
  "CCTV_PLUS_SOLAR",
  "STREET_LIGHTS",
  "OTHER",
];
const visitReasonOptions = [
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
];
const outcomeOptions: SiteVisitOutcome[] = [
  "QUOTATION_CREATED",
  "FURTHER_ASSESSMENT_REQUIRED",
  "CLOSED_WITHOUT_QUOTATION",
];

function defaultCreateForm(initialQuoteRef?: string | null): CreateFormState {
  return {
    quoteRef: initialQuoteRef || "",
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    county: "",
    town: "",
    location: "",
    projectType: "",
    visitReason: "LOAD_ASSESSMENT",
    scheduledAt: "",
    assignedStaffId: "",
    assignedTechnicianId: "",
    visitFee: "",
    paymentStatus: "UNPAID",
    customerRequirements: "",
    internalNotes: "",
  };
}

function buildEditForm(visit: SerializedSiteVisit): EditFormState {
  return {
    customerName: visit.customerName,
    customerPhone: visit.customerPhone,
    customerEmail: visit.customerEmail || "",
    county: visit.county || "",
    town: visit.town || "",
    location: visit.location || "",
    scheduledAt: visit.scheduledAt ? visit.scheduledAt.slice(0, 16) : "",
    assignedStaffId: visit.assignedStaffId || "",
    assignedTechnicianId: visit.assignedTechnicianId || "",
    visitFee: String(visit.visitFee || 0),
    paymentStatus: visit.paymentStatus,
    status: visit.status,
    findings: visit.findings || "",
    assessmentSummary: visit.assessmentSummary || "",
    recommendedSystem: visit.recommendedSystem || "",
    recommendedItems: visit.recommendedItems || "",
    risks: visit.risks || "",
    nextAction: visit.nextAction || "",
    outcome: visit.outcome || "",
    closedReason: visit.closedReason || "",
    customerRequirements: visit.customerRequirements || "",
    internalNotes: visit.internalNotes || "",
  };
}

function formatStatus(status: SiteVisitStatus) {
  return status.toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
}

function formatDateTime(value: string | null) {
  if (!value) return "Not scheduled";
  return new Date(value).toLocaleString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatProjectType(value: string | null | undefined) {
  if (!value) return "General visit";
  return value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatFileSize(value: number | null) {
  if (!value || value <= 0) return null;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SiteVisitsAdminClient({ staffOptions, initialQuoteRef }: Props) {
  const [visits, setVisits] = useState<SerializedSiteVisit[]>([]);
  const [statusFilter, setStatusFilter] = useState<SiteVisitStatus | "ALL">("ALL");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createForm, setCreateForm] = useState<CreateFormState>(() => defaultCreateForm(initialQuoteRef));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedVisit = useMemo(() => visits.find((visit) => visit.id === selectedId) ?? null, [selectedId, visits]);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [events, setEvents] = useState<SerializedSiteVisitEvent[]>([]);
  const [attachments, setAttachments] = useState<SerializedSiteVisitAttachment[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);

  async function loadVisits() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (query.trim()) params.set("q", query.trim());
      const response = await fetch(`/api/admin/site-visits${params.toString() ? `?${params.toString()}` : ""}`, { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error || "Failed to load site visits.");
      setVisits(data.visits || []);
      setSelectedId((current) => (current && data.visits.some((visit: SerializedSiteVisit) => visit.id === current) ? current : data.visits[0]?.id || null));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load site visits.");
    } finally {
      setLoading(false);
    }
  }

  async function loadVisitDetail(visitId: string) {
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/admin/site-visits/${encodeURIComponent(visitId)}`, { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error || "Failed to load site visit details.");
      setEvents(data.events || []);
      setAttachments(data.attachments || []);
    } catch (loadError) {
      setEvents([]);
      setAttachments([]);
      setError(loadError instanceof Error ? loadError.message : "Failed to load site visit details.");
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    void loadVisits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    if (selectedVisit) {
      setEditForm(buildEditForm(selectedVisit));
    } else {
      setEditForm(null);
    }
  }, [selectedVisit]);

  useEffect(() => {
    if (!selectedId) {
      setEvents([]);
      setAttachments([]);
      return;
    }
    void loadVisitDetail(selectedId);
  }, [selectedId]);

  const filteredVisits = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return visits;
    return visits.filter((visit) =>
      [visit.visitRef, visit.quoteRef || "", visit.customerName, visit.customerPhone, visit.county || "", visit.town || ""]
        .some((value) => value.toLowerCase().includes(normalizedQuery)),
    );
  }, [query, visits]);

  const stats = useMemo(() => {
    return {
      pending: visits.filter((visit) => visit.status === "PENDING").length,
      scheduled: visits.filter((visit) => visit.status === "SCHEDULED").length,
      visited: visits.filter((visit) => visit.status === "VISITED").length,
      closed: visits.filter((visit) => visit.status === "CLOSED").length,
    };
  }, [visits]);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/admin/site-visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...createForm,
          scheduledAt: createForm.scheduledAt || undefined,
          visitFee: createForm.visitFee ? Number(createForm.visitFee) : 0,
          projectType: createForm.projectType || undefined,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error || "Failed to create site visit.");
      setCreateForm(defaultCreateForm(initialQuoteRef));
      setMessage(`Site visit ${data.visit.visitRef} created.`);
      await loadVisits();
      setSelectedId(data.visit.id);
      await loadVisitDetail(data.visit.id);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to create site visit.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveEdit() {
    if (!selectedVisit || !editForm) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/admin/site-visits/${encodeURIComponent(selectedVisit.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editForm,
          scheduledAt: editForm.scheduledAt || undefined,
          visitFee: editForm.visitFee ? Number(editForm.visitFee) : 0,
          outcome: editForm.outcome || null,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error || "Failed to update site visit.");
      setMessage(`Site visit ${data.visit.visitRef} updated.`);
      await loadVisits();
      setSelectedId(data.visit.id);
      await loadVisitDetail(data.visit.id);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update site visit.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUploadAttachment() {
    if (!selectedVisit || !attachmentFile) return;
    setUploading(true);
    setMessage(null);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("file", attachmentFile);
      const response = await fetch(`/api/admin/site-visits/${encodeURIComponent(selectedVisit.id)}/attachments`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error || "Failed to upload attachment.");
      setAttachmentFile(null);
      setMessage(
        data.visit?.status === "VISITED"
          ? `Attachment uploaded and ${selectedVisit.visitRef} marked as visited.`
          : `Attachment uploaded to ${selectedVisit.visitRef}.`,
      );
      await loadVisits();
      if (data.visit?.id) {
        setSelectedId(data.visit.id);
      }
      await loadVisitDetail(data.visit?.id || selectedVisit.id);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Failed to upload attachment.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.96),rgba(2,6,23,.98))] p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">Quotation Center</div>
            <h1 className="mt-2 text-3xl font-semibold text-white">Site Visits</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              Schedule site visits, track field outcomes, and keep every visit tied back to quotation follow-up.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/quotation-center" className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 transition hover:border-white/20">
              Quotation Center
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {[
            { label: "Pending", value: stats.pending },
            { label: "Scheduled", value: stats.scheduled },
            { label: "Visited", value: stats.visited },
            { label: "Closed", value: stats.closed },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{item.label}</div>
              <div className="mt-2 text-3xl font-semibold text-white">{item.value}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-slate-950/80 p-6">
        <div className="mb-4 text-lg font-semibold text-white">Schedule new site visit</div>
        <form onSubmit={handleCreate} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <input value={createForm.quoteRef} onChange={(event) => setCreateForm((current) => ({ ...current, quoteRef: event.target.value }))} placeholder="Quotation ref (optional)" className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none" />
          <input required value={createForm.customerName} onChange={(event) => setCreateForm((current) => ({ ...current, customerName: event.target.value }))} placeholder="Customer name" className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none" />
          <input required value={createForm.customerPhone} onChange={(event) => setCreateForm((current) => ({ ...current, customerPhone: event.target.value }))} placeholder="Customer phone" className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none" />
          <input value={createForm.customerEmail} onChange={(event) => setCreateForm((current) => ({ ...current, customerEmail: event.target.value }))} placeholder="Customer email" className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none" />
          <input value={createForm.county} onChange={(event) => setCreateForm((current) => ({ ...current, county: event.target.value }))} placeholder="County" className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none" />
          <input value={createForm.town} onChange={(event) => setCreateForm((current) => ({ ...current, town: event.target.value }))} placeholder="Town" className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none" />
          <input value={createForm.location} onChange={(event) => setCreateForm((current) => ({ ...current, location: event.target.value }))} placeholder="Exact location" className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none md:col-span-2" />
          <select value={createForm.projectType} onChange={(event) => setCreateForm((current) => ({ ...current, projectType: event.target.value as QuoteProjectType | "" }))} className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none">
            <option value="">Project type</option>
            {projectTypeOptions.map((option) => <option key={option} value={option}>{formatProjectType(option)}</option>)}
          </select>
          <select value={createForm.visitReason} onChange={(event) => setCreateForm((current) => ({ ...current, visitReason: event.target.value }))} className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none">
            {visitReasonOptions.map((option) => <option key={option} value={option}>{formatProjectType(option)}</option>)}
          </select>
          <input type="datetime-local" value={createForm.scheduledAt} onChange={(event) => setCreateForm((current) => ({ ...current, scheduledAt: event.target.value }))} className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none" />
          <select value={createForm.assignedStaffId} onChange={(event) => setCreateForm((current) => ({ ...current, assignedStaffId: event.target.value }))} className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none">
            <option value="">Assigned staff</option>
            {staffOptions.map((option) => <option key={option.id} value={option.id}>{option.name || option.email || "Staff"}</option>)}
          </select>
          <select value={createForm.assignedTechnicianId} onChange={(event) => setCreateForm((current) => ({ ...current, assignedTechnicianId: event.target.value }))} className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none">
            <option value="">Assigned technician</option>
            {staffOptions.map((option) => <option key={option.id} value={option.id}>{option.name || option.email || "Technician"}</option>)}
          </select>
          <input value={createForm.visitFee} onChange={(event) => setCreateForm((current) => ({ ...current, visitFee: event.target.value }))} placeholder="Visit fee" className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none" />
          <select value={createForm.paymentStatus} onChange={(event) => setCreateForm((current) => ({ ...current, paymentStatus: event.target.value as SiteVisitPaymentStatus }))} className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none">
            <option value="UNPAID">Unpaid</option>
            <option value="PAID">Paid</option>
            <option value="WAIVED">Waived</option>
          </select>
          <textarea value={createForm.customerRequirements} onChange={(event) => setCreateForm((current) => ({ ...current, customerRequirements: event.target.value }))} placeholder="Customer requirements / appliances to inspect" className="min-h-[120px] rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none md:col-span-2" />
          <textarea value={createForm.internalNotes} onChange={(event) => setCreateForm((current) => ({ ...current, internalNotes: event.target.value }))} placeholder="Internal notes" className="min-h-[120px] rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none md:col-span-2" />
          <div className="md:col-span-2 xl:col-span-4">
            <button type="submit" disabled={submitting} className="rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60">
              {submitting ? "Creating..." : "Schedule Site Visit"}
            </button>
          </div>
        </form>
      </section>

      {message ? <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{message}</div> : null}
      {error ? <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(380px,0.9fr)]">
        <div className="rounded-[28px] border border-white/10 bg-slate-950/80 p-6">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-lg font-semibold text-white">Site visit queue</div>
            <div className="flex flex-wrap gap-2">
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customer, phone, ref, county" className="rounded-full border border-white/10 bg-slate-950 px-4 py-2 text-sm text-slate-100 outline-none" />
              <button type="button" onClick={() => void loadVisits()} className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200">
                Refresh
              </button>
            </div>
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            {statusOptions.map((option) => (
              <button key={option} type="button" onClick={() => setStatusFilter(option)} className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${statusFilter === option ? "bg-cyan-400 text-slate-950" : "border border-white/10 bg-white/[0.03] text-slate-200"}`}>
                {option === "ALL" ? "All" : formatStatus(option)}
              </button>
            ))}
          </div>
          <div className="space-y-3">
            {loading ? <div className="text-sm text-slate-400">Loading site visits...</div> : null}
            {!loading && !filteredVisits.length ? <div className="text-sm text-slate-400">No site visits match the current filters.</div> : null}
            {filteredVisits.map((visit) => (
              <button key={visit.id} type="button" onClick={() => setSelectedId(visit.id)} className={`w-full rounded-2xl border p-4 text-left transition ${selectedId === visit.id ? "border-cyan-400/50 bg-cyan-400/10" : "border-white/10 bg-white/[0.03]"}`}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-white">{visit.visitRef} {visit.quoteRef ? <span className="text-slate-400">· {visit.quoteRef}</span> : null}</div>
                    <div className="mt-1 text-sm text-slate-300">{visit.customerName} · {visit.customerPhone}</div>
                    <div className="mt-1 text-xs text-slate-500">{[visit.town, visit.county].filter(Boolean).join(", ") || "Location pending"} · {formatProjectType(visit.projectType)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{formatStatus(visit.status)}</div>
                    <div className="mt-1 text-sm text-slate-300">{formatDateTime(visit.scheduledAt)}</div>
                    <div className="mt-1 text-xs text-slate-500">{visit.assignedTechnicianName || visit.assignedStaffName || "Unassigned"}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-slate-950/80 p-6">
          <div className="mb-4 text-lg font-semibold text-white">Visit details</div>
          {!selectedVisit || !editForm ? <div className="text-sm text-slate-400">Select a site visit to review or update it.</div> : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-sm font-semibold text-white">{selectedVisit.visitRef}</div>
                <div className="mt-1 text-sm text-slate-300">{selectedVisit.customerName} · {selectedVisit.customerPhone}</div>
                <div className="mt-1 text-xs text-slate-500">{selectedVisit.quoteRef || "No linked quotation"} · {formatProjectType(selectedVisit.projectType)}</div>
                {selectedVisit.quoteRequestId ? (
                  <div className="mt-3">
                    <Link href={`/admin/quotation-center?quoteId=${encodeURIComponent(selectedVisit.quoteRequestId)}`} className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
                      Open linked quotation
                    </Link>
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-white">Attachments</div>
                    <div className="mt-1 text-xs text-slate-500">Upload site photos, signed notes, or supporting files.</div>
                  </div>
                  <div className="flex flex-col gap-2 md:flex-row md:items-center">
                    <input
                      type="file"
                      onChange={(event) => setAttachmentFile(event.target.files?.[0] || null)}
                      className="max-w-full text-xs text-slate-300 file:mr-3 file:rounded-full file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() => void handleUploadAttachment()}
                      disabled={!attachmentFile || uploading}
                      className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
                    >
                      {uploading ? "Uploading..." : "Upload file"}
                    </button>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {detailLoading && !attachments.length ? <div className="text-sm text-slate-500">Loading attachments...</div> : null}
                  {!detailLoading && !attachments.length ? <div className="text-sm text-slate-500">No attachments uploaded yet.</div> : null}
                  {attachments.map((attachment) => (
                    <a
                      key={attachment.id}
                      href={attachment.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 transition hover:border-cyan-400/30"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-white">{attachment.fileName}</div>
                          <div className="mt-1 text-xs text-slate-400">
                            {[attachment.uploadedByName || "Betech Staff", formatDateTime(attachment.createdAt), formatFileSize(attachment.fileSizeBytes)].filter(Boolean).join(" · ")}
                          </div>
                        </div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">Open</div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-sm font-semibold text-white">Visit timeline</div>
                <div className="mt-1 text-xs text-slate-500">Every status change, update, and attachment is recorded here.</div>
                <div className="mt-4 space-y-3">
                  {detailLoading && !events.length ? <div className="text-sm text-slate-500">Loading activity...</div> : null}
                  {!detailLoading && !events.length ? <div className="text-sm text-slate-500">No visit activity recorded yet.</div> : null}
                  {events.map((event) => (
                    <div key={event.id} className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-white">{event.eventLabel}</div>
                          <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-slate-500">{event.eventType.replace(/_/g, " ")}</div>
                        </div>
                        <div className="text-right text-[11px] text-slate-400">
                          <div>{formatDateTime(event.createdAt)}</div>
                          <div>{event.actorName || "System"}</div>
                        </div>
                      </div>
                      {event.eventDetail ? <div className="mt-2 text-xs text-slate-300">{event.eventDetail}</div> : null}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <input value={editForm.customerName} onChange={(event) => setEditForm((current) => current ? { ...current, customerName: event.target.value } : current)} placeholder="Customer name" className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none" />
                <input value={editForm.customerPhone} onChange={(event) => setEditForm((current) => current ? { ...current, customerPhone: event.target.value } : current)} placeholder="Customer phone" className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none" />
                <input value={editForm.customerEmail} onChange={(event) => setEditForm((current) => current ? { ...current, customerEmail: event.target.value } : current)} placeholder="Customer email" className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none" />
                <input value={editForm.scheduledAt} type="datetime-local" onChange={(event) => setEditForm((current) => current ? { ...current, scheduledAt: event.target.value } : current)} className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none" />
                <input value={editForm.county} onChange={(event) => setEditForm((current) => current ? { ...current, county: event.target.value } : current)} placeholder="County" className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none" />
                <input value={editForm.town} onChange={(event) => setEditForm((current) => current ? { ...current, town: event.target.value } : current)} placeholder="Town" className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none" />
                <input value={editForm.location} onChange={(event) => setEditForm((current) => current ? { ...current, location: event.target.value } : current)} placeholder="Location" className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none md:col-span-2" />
                <select value={editForm.assignedStaffId} onChange={(event) => setEditForm((current) => current ? { ...current, assignedStaffId: event.target.value } : current)} className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none">
                  <option value="">Assigned staff</option>
                  {staffOptions.map((option) => <option key={option.id} value={option.id}>{option.name || option.email || "Staff"}</option>)}
                </select>
                <select value={editForm.assignedTechnicianId} onChange={(event) => setEditForm((current) => current ? { ...current, assignedTechnicianId: event.target.value } : current)} className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none">
                  <option value="">Assigned technician</option>
                  {staffOptions.map((option) => <option key={option.id} value={option.id}>{option.name || option.email || "Technician"}</option>)}
                </select>
                <select value={editForm.status} onChange={(event) => setEditForm((current) => current ? { ...current, status: event.target.value as SiteVisitStatus } : current)} className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none">
                  {SITE_VISIT_STATUSES.map((option) => <option key={option} value={option}>{formatStatus(option)}</option>)}
                </select>
                <input value={editForm.visitFee} onChange={(event) => setEditForm((current) => current ? { ...current, visitFee: event.target.value } : current)} placeholder="Visit fee" className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none" />
                <select value={editForm.paymentStatus} onChange={(event) => setEditForm((current) => current ? { ...current, paymentStatus: event.target.value as SiteVisitPaymentStatus } : current)} className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none">
                  <option value="UNPAID">Unpaid</option>
                  <option value="PAID">Paid</option>
                  <option value="WAIVED">Waived</option>
                </select>
                <select value={editForm.outcome} onChange={(event) => setEditForm((current) => current ? { ...current, outcome: event.target.value as SiteVisitOutcome | "" } : current)} className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none">
                  <option value="">Outcome pending</option>
                  {outcomeOptions.map((option) => <option key={option} value={option}>{formatProjectType(option)}</option>)}
                </select>
                <textarea value={editForm.customerRequirements} onChange={(event) => setEditForm((current) => current ? { ...current, customerRequirements: event.target.value } : current)} placeholder="Customer requirements" className="min-h-[110px] rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none md:col-span-2" />
                <textarea value={editForm.findings} onChange={(event) => setEditForm((current) => current ? { ...current, findings: event.target.value } : current)} placeholder="Visit findings" className="min-h-[110px] rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none md:col-span-2" />
                <textarea value={editForm.assessmentSummary} onChange={(event) => setEditForm((current) => current ? { ...current, assessmentSummary: event.target.value } : current)} placeholder="Assessment summary" className="min-h-[110px] rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none md:col-span-2" />
                <textarea value={editForm.recommendedSystem} onChange={(event) => setEditForm((current) => current ? { ...current, recommendedSystem: event.target.value } : current)} placeholder="Recommended system" className="min-h-[100px] rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none" />
                <textarea value={editForm.recommendedItems} onChange={(event) => setEditForm((current) => current ? { ...current, recommendedItems: event.target.value } : current)} placeholder="Recommended items / accessories" className="min-h-[100px] rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none" />
                <textarea value={editForm.risks} onChange={(event) => setEditForm((current) => current ? { ...current, risks: event.target.value } : current)} placeholder="Risks / blockers" className="min-h-[100px] rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none" />
                <textarea value={editForm.nextAction} onChange={(event) => setEditForm((current) => current ? { ...current, nextAction: event.target.value } : current)} placeholder="Next action" className="min-h-[100px] rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none" />
                <textarea value={editForm.closedReason} onChange={(event) => setEditForm((current) => current ? { ...current, closedReason: event.target.value } : current)} placeholder="Closed reason" className="min-h-[100px] rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none md:col-span-2" />
                <textarea value={editForm.internalNotes} onChange={(event) => setEditForm((current) => current ? { ...current, internalNotes: event.target.value } : current)} placeholder="Internal notes" className="min-h-[100px] rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none md:col-span-2" />
              </div>

              <button type="button" onClick={() => void handleSaveEdit()} disabled={saving} className="rounded-full bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60">
                {saving ? "Saving..." : "Save Site Visit"}
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
