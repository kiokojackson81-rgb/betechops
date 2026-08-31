"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  ExternalLink,
  FileUp,
  MapPin,
  Phone,
  Save,
} from "lucide-react";
import type {
  SerializedSiteVisit,
  SerializedSiteVisitAttachment,
  SerializedSiteVisitEvent,
  SiteVisitOutcome,
  SiteVisitPaymentStatus,
} from "@/lib/siteVisitShared";

type StaffOption = { id: string; name: string | null; email: string | null };
type ExternalTechnicianOption = { id: string; name: string; whatsappNumber: string };
type Tab = "overview" | "assessment" | "attachments" | "timeline" | "internal";
const tabs: Tab[] = [
  "overview",
  "assessment",
  "attachments",
  "timeline",
  "internal",
];
const label = (value: string | null | undefined) =>
  String(value || "Not set")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
const money = (value: number) => `KES ${value.toLocaleString("en-KE")}`;

function Field({
  name,
  children,
  wide = false,
}: {
  name: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={`space-y-2 ${wide ? "md:col-span-2" : ""}`}>
      <span className="text-[11px] font-bold uppercase tracking-[.18em] text-slate-400">
        {name}
      </span>
      {children}
    </label>
  );
}

export default function SiteVisitDetailClient({
  initialVisit,
  initialEvents,
  initialAttachments,
  staffOptions,
  canManageCommercials,
  canAssignTechnicians,
  externalTechnicians,
  backPath,
}: {
  initialVisit: SerializedSiteVisit;
  initialEvents: SerializedSiteVisitEvent[];
  initialAttachments: SerializedSiteVisitAttachment[];
  staffOptions: StaffOption[];
  canManageCommercials: boolean;
  canAssignTechnicians: boolean;
  externalTechnicians: ExternalTechnicianOption[];
  backPath: string;
}) {
  const [visit, setVisit] = useState(initialVisit);
  const [events, setEvents] = useState(initialEvents);
  const [attachments, setAttachments] = useState(initialAttachments);
  const [tab, setTab] = useState<Tab>("overview");
  const [draft, setDraft] = useState({
    ...initialVisit,
    scheduledAt: initialVisit.scheduledAt?.slice(0, 16) || "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input =
    "w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-cyan-400/60 disabled:opacity-60";

  async function refresh() {
    const response = await fetch(`/api/admin/site-visits/${visit.id}`, {
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to refresh visit.");
    setVisit(data.visit);
    setDraft({
      ...data.visit,
      scheduledAt: data.visit.scheduledAt?.slice(0, 16) || "",
    });
    setEvents(data.events || []);
    setAttachments(data.attachments || []);
  }
  async function save(patch: Record<string, unknown> = {}) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const body = {
        ...draft,
        ...patch,
        scheduledAt: (patch.scheduledAt ?? draft.scheduledAt) || undefined,
      };
      const response = await fetch(`/api/admin/site-visits/${visit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Unable to save changes.");
      await refresh();
      setMessage("Site visit changes saved.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save changes.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function upload(file: File | null) {
    if (!file) return;
    setSaving(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch(
        `/api/admin/site-visits/${visit.id}/attachments`,
        { method: "POST", body: form },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Upload failed.");
      await refresh();
      setMessage("Attachment uploaded. Visit status was not changed.");
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "Upload failed.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function createQuotation() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/site-visits/${visit.id}/quotation`,
        { method: "POST" },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Unable to create quotation draft.");
      await refresh();
      setMessage(`Quotation ${data.quotation?.quoteRef || "draft"} created.`);
    } catch (quotationError) {
      setError(
        quotationError instanceof Error
          ? quotationError.message
          : "Unable to create quotation draft.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function applyCredit() {
    if (
      !window.confirm(
        `Apply ${money(visit.visitFee)} as a one-time credit to ${visit.quoteRef}?`,
      )
    )
      return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/site-visits/${visit.id}/credit`,
        { method: "POST" },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Unable to apply Site Visit credit.");
      await refresh();
      setMessage("Site Visit Fee Credit applied to the approved quotation.");
    } catch (creditError) {
      setError(
        creditError instanceof Error
          ? creditError.message
          : "Unable to apply Site Visit credit.",
      );
    } finally {
      setSaving(false);
    }
  }
  const patchDraft = (patch: Record<string, unknown>) =>
    setDraft((current) => ({ ...current, ...patch }));
  const inconsistency =
    (visit.status === "PENDING" || visit.status === "SCHEDULED") &&
    visit.outcome;

  return (
    <div className="min-w-0 space-y-5 overflow-x-hidden text-slate-100">
      <header className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,.14),transparent_35%),#0b1625] p-5 sm:p-7">
        <Link
          href={backPath}
          className="inline-flex items-center gap-2 text-sm text-cyan-300"
        >
          <ArrowLeft className="h-4 w-4" /> Back to queue
        </Link>
        <div className="mt-5 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-semibold sm:text-4xl">
                {visit.visitRef}
              </h1>
              <span className="rounded-full border border-cyan-400/30 px-3 py-1 text-xs font-bold text-cyan-200">
                {visit.status}
              </span>
              <span className="rounded-full bg-amber-400/15 px-3 py-1 text-xs font-bold text-amber-200">
                {visit.paymentStatus} · {money(visit.visitFee)}
              </span>
              {visit.quotationCreditStatus !== "NOT_ELIGIBLE" ? (
                <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-bold text-emerald-200">
                  CREDIT {visit.quotationCreditStatus}
                </span>
              ) : null}
            </div>
            <div className="mt-3 text-xl font-semibold">
              {visit.customerName}
            </div>
            <div className="mt-1 text-sm text-slate-400">
              {visit.customerPhone} ·{" "}
              {[visit.location, visit.town, visit.county]
                .filter(Boolean)
                .join(", ")}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={`tel:${visit.customerPhone}`}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm"
            >
              <Phone className="h-4 w-4" /> Call customer
            </a>
            {visit.mapUrl ? (
              <a
                href={visit.mapUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm"
              >
                <MapPin className="h-4 w-4" /> Open maps
              </a>
            ) : null}
            <Link
              href={`/technical/site-visits/${visit.id}`}
              className="inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-100"
            >
              <ExternalLink className="h-4 w-4" /> Open technician assessment
            </Link>
            {visit.quoteRequestId ? (
              <Link
                href={`/admin/quotation-center?quoteId=${visit.quoteRequestId}`}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm"
              >
                <ExternalLink className="h-4 w-4" /> View quotation
              </Link>
            ) : (
              <button
                disabled={saving}
                onClick={() => void createQuotation()}
                className="rounded-full bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50"
              >
                Create quotation draft
              </button>
            )}
            {canManageCommercials &&
            visit.quoteRequestId &&
            visit.quotationCreditStatus === "AVAILABLE" ? (
              <button
                disabled={saving}
                onClick={() => void applyCredit()}
                className="rounded-full bg-amber-300 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50"
              >
                Apply Site Visit Fee Credit
              </button>
            ) : null}
          </div>
        </div>
        {inconsistency ? (
          <div className="mt-5 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">
            Legacy lifecycle warning: this open visit has a final outcome. Save
            a valid workflow transition to resolve it.
          </div>
        ) : null}
      </header>
      {visit.originProductName || visit.dataLoggerRequested ? (
        <section className="grid gap-4 rounded-[24px] border border-cyan-400/20 bg-[linear-gradient(135deg,rgba(34,211,238,.08),rgba(15,23,42,.7))] p-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[.2em] text-cyan-300">
              Product-linked visit
            </div>
            <div className="mt-2 text-lg font-semibold">
              {visit.originProductName || "Site assessment"}
            </div>
            <div className="mt-1 text-sm text-slate-400">
              {visit.originProductCategory || "Catalogue product"}
              {visit.originProductPrice
                ? ` · Product price ${money(visit.originProductPrice)}`
                : ""}
            </div>
            {visit.originProductUrl ? (
              <Link
                href={visit.originProductUrl}
                target="_blank"
                className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-cyan-300"
              >
                Open product <ExternalLink className="h-4 w-4" />
              </Link>
            ) : null}
          </div>
          <div className="grid min-w-[18rem] gap-2 rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">Site Visit fee / credit</span>
              <strong>{money(visit.visitFee)}</strong>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">Data Logger</span>
              <strong>
                {visit.dataLoggerRequested
                  ? `${visit.dataLoggerDays} day(s) · ${money(visit.dataLoggerFee)}`
                  : "Not requested"}
              </strong>
            </div>
            {visit.dataLoggerRequested ? (
              <div className="flex justify-between gap-4">
                <span className="text-slate-400">Logger status</span>
                <strong className="text-amber-200">
                  {label(visit.dataLoggerStatus)}
                </strong>
              </div>
            ) : null}
            <div className="flex justify-between gap-4 border-t border-white/10 pt-2">
              <span className="text-slate-300">Total payable</span>
              <strong className="text-cyan-300">
                {money(visit.totalPayable)}
              </strong>
            </div>
          </div>
        </section>
      ) : null}
      <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/80 p-2">
        {tabs.map((item) => (
          <button
            key={item}
            onClick={() => setTab(item)}
            className={`shrink-0 rounded-xl px-4 py-3 text-sm font-bold ${tab === item ? "bg-cyan-400 text-slate-950" : "text-slate-300"}`}
          >
            {label(item)}
          </button>
        ))}
      </nav>
      {message ? (
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-200">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <section className="rounded-[28px] border border-white/10 bg-[#0b1524] p-5 sm:p-7">
        {tab === "overview" ? (
          <div className="space-y-7">
            <div>
              <h2 className="text-xl font-semibold">
                Customer, location and schedule
              </h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Field name="Customer name">
                  <input
                    className={input}
                    value={draft.customerName}
                    onChange={(e) =>
                      patchDraft({ customerName: e.target.value })
                    }
                  />
                </Field>
                <Field name="Phone number">
                  <input
                    className={input}
                    value={draft.customerPhone}
                    onChange={(e) =>
                      patchDraft({ customerPhone: e.target.value })
                    }
                  />
                </Field>
                <Field name="Email">
                  <input
                    className={input}
                    value={draft.customerEmail || ""}
                    onChange={(e) =>
                      patchDraft({ customerEmail: e.target.value })
                    }
                  />
                </Field>
                <Field name="Company">
                  <input
                    className={input}
                    value={draft.companyName || ""}
                    onChange={(e) =>
                      patchDraft({ companyName: e.target.value })
                    }
                  />
                </Field>
                <Field name="County">
                  <input
                    className={input}
                    value={draft.county || ""}
                    onChange={(e) => patchDraft({ county: e.target.value })}
                  />
                </Field>
                <Field name="Town / area">
                  <input
                    className={input}
                    value={draft.town || ""}
                    onChange={(e) => patchDraft({ town: e.target.value })}
                  />
                </Field>
                <Field name="Exact location" wide>
                  <input
                    className={input}
                    value={draft.location || ""}
                    onChange={(e) => patchDraft({ location: e.target.value })}
                  />
                </Field>
                <Field name="Landmark">
                  <input
                    className={input}
                    value={draft.landmark || ""}
                    onChange={(e) => patchDraft({ landmark: e.target.value })}
                  />
                </Field>
                <Field name="Google Maps URL">
                  <input
                    className={input}
                    value={draft.mapUrl || ""}
                    onChange={(e) => patchDraft({ mapUrl: e.target.value })}
                  />
                </Field>
                <Field name="Access instructions" wide>
                  <textarea
                    className={`${input} min-h-24`}
                    value={draft.accessInstructions || ""}
                    onChange={(e) =>
                      patchDraft({ accessInstructions: e.target.value })
                    }
                  />
                </Field>
                <Field name="Confirmed schedule">
                  <input
                    type="datetime-local"
                    className={input}
                    value={String(draft.scheduledAt || "")}
                    onChange={(e) =>
                      patchDraft({ scheduledAt: e.target.value })
                    }
                  />
                </Field>
                <Field name="Expected duration (minutes)">
                  <input
                    type="number"
                    className={input}
                    value={draft.estimatedDurationMinutes || 0}
                    onChange={(e) =>
                      patchDraft({
                        estimatedDurationMinutes: Number(e.target.value),
                      })
                    }
                  />
                </Field>
                <Field name="Assigned staff">
                  <select
                    disabled={!canAssignTechnicians}
                    className={input}
                    value={draft.assignedStaffId || ""}
                    onChange={(e) =>
                      patchDraft({ assignedStaffId: e.target.value })
                    }
                  >
                    <option value="">Unassigned</option>
                    {staffOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name || item.email}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field name="Assigned technician">
                  <select
                    disabled={!canAssignTechnicians}
                    className={input}
                    value={draft.assignedTechnicianId || ""}
                    onChange={(e) =>
                      patchDraft({ assignedTechnicianId: e.target.value })
                    }
                  >
                    <option value="">Unassigned</option>
                    {staffOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name || item.email}
                      </option>
                    ))}
                    <optgroup label="External technicians">
                      {externalTechnicians.map((item) => (
                        <option key={item.id} value={`external:${item.id}`}>
                          {item.name} · {item.whatsappNumber}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </Field>
              </div>
            </div>
            <div className="border-t border-white/10 pt-6">
              <h2 className="text-xl font-semibold">Visit fee</h2>
              <p className="mt-1 text-sm text-slate-400">
                Paid fees become an available quotation credit. They are not
                automatically deducted.
              </p>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Field name="Visit fee">
                  <input
                    disabled={!canManageCommercials}
                    type="number"
                    className={input}
                    value={draft.visitFee}
                    onChange={(e) =>
                      patchDraft({ visitFee: Number(e.target.value) })
                    }
                  />
                </Field>
                <Field name="Payment status">
                  <select
                    disabled={!canManageCommercials}
                    className={input}
                    value={draft.paymentStatus}
                    onChange={(e) =>
                      patchDraft({
                        paymentStatus: e.target.value as SiteVisitPaymentStatus,
                      })
                    }
                  >
                    <option>UNPAID</option>
                    <option>COLLECT_ON_SITE</option>
                    <option>PAID</option>
                    <option>WAIVED</option>
                  </select>
                </Field>
                <Field name="Payment method">
                  <input
                    disabled={!canManageCommercials}
                    className={input}
                    value={draft.paymentMethod || ""}
                    onChange={(e) =>
                      patchDraft({ paymentMethod: e.target.value })
                    }
                  />
                </Field>
                <Field name="Payment reference">
                  <input
                    disabled={!canManageCommercials}
                    className={input}
                    value={draft.paymentReference || ""}
                    onChange={(e) =>
                      patchDraft({ paymentReference: e.target.value })
                    }
                  />
                </Field>
                <Field name="Fee override reason">
                  <textarea
                    disabled={!canManageCommercials}
                    className={input}
                    value={draft.feeOverrideReason || ""}
                    onChange={(e) =>
                      patchDraft({ feeOverrideReason: e.target.value })
                    }
                  />
                </Field>
                <Field name="Waiver reason">
                  <textarea
                    disabled={!canManageCommercials}
                    className={input}
                    value={draft.waiverReason || ""}
                    onChange={(e) =>
                      patchDraft({ waiverReason: e.target.value })
                    }
                  />
                </Field>
                {visit.dataLoggerRequested ? (
                  <Field name="Data Logger status">
                    <select
                      className={input}
                      value={draft.dataLoggerStatus}
                      onChange={(event) => patchDraft({ dataLoggerStatus: event.target.value })}
                    >
                      <option value="REQUESTED">Requested</option>
                      <option value="SCHEDULED">Scheduled</option>
                      <option value="INSTALLED">Installed</option>
                      <option value="MONITORING">Monitoring</option>
                      <option value="COMPLETED">Completed</option>
                    </select>
                  </Field>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
        {tab === "assessment" ? (
          <div>
            <h2 className="text-xl font-semibold">Structured assessment</h2>
            <p className="mt-1 text-sm text-slate-400">
              Capture evidence for quotation preparation. The layout leaves room
              for future appliance load rows.
            </p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {[
                ["Customer requirements", "customerRequirements"],
                ["Equipment / appliances inspected", "appliancesToInspect"],
                ["Visit findings", "findings"],
                ["Assessment summary", "assessmentSummary"],
                ["Recommended system", "recommendedSystem"],
                ["Recommended products / accessories", "recommendedItems"],
                ["Risks / blockers", "risks"],
                ["Next action", "nextAction"],
              ].map(([name, key]) => (
                <Field key={key} name={name}>
                  <textarea
                    className={`${input} min-h-32`}
                    value={String(draft[key as keyof typeof draft] || "")}
                    onChange={(e) => patchDraft({ [key]: e.target.value })}
                  />
                </Field>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {visit.status === "PENDING" ? (
                <button
                  onClick={() =>
                    void save({ status: "SCHEDULED", outcome: null })
                  }
                  className="rounded-full border border-cyan-400/40 px-4 py-2 text-sm font-bold text-cyan-200"
                >
                  Schedule visit
                </button>
              ) : null}
              {visit.status === "SCHEDULED" ? (
                <button
                  onClick={() =>
                    void save({ status: "VISITED", outcome: null })
                  }
                  className="rounded-full bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950"
                >
                  Mark visit completed
                </button>
              ) : null}
              {visit.status === "VISITED" ? (
                <>
                  {(
                    [
                      "QUOTATION_CREATED",
                      "FURTHER_ASSESSMENT_REQUIRED",
                      "CLOSED_WITHOUT_QUOTATION",
                    ] as SiteVisitOutcome[]
                  ).map((outcome) => (
                    <button
                      key={outcome}
                      onClick={() => void save({ outcome })}
                      className="rounded-full border border-white/15 px-4 py-2 text-sm font-bold"
                    >
                      {label(outcome)}
                    </button>
                  ))}
                  <button
                    onClick={() =>
                      void save({
                        status: "CLOSED",
                        closedReason:
                          draft.closedReason || "Assessment completed",
                      })
                    }
                    className="rounded-full border border-rose-400/30 px-4 py-2 text-sm font-bold text-rose-200"
                  >
                    Close visit
                  </button>
                </>
              ) : null}
            </div>
          </div>
        ) : null}
        {tab === "attachments" ? (
          <div>
            <h2 className="text-xl font-semibold">Site photos & documents</h2>
            <p className="mt-1 text-sm text-slate-400">
              JPG, PNG, WebP, PDF, DOC or DOCX. Maximum 10 MB. Uploading
              evidence does not complete a visit.
            </p>
            <label className="mt-5 flex cursor-pointer flex-col items-center rounded-2xl border border-dashed border-cyan-400/30 bg-cyan-400/[.04] p-8 text-center">
              <FileUp className="h-8 w-8 text-cyan-300" />
              <span className="mt-3 font-bold">Choose a file to upload</span>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx"
                className="hidden"
                onChange={(e) => void upload(e.target.files?.[0] || null)}
              />
            </label>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {attachments.map((file) => (
                <a
                  key={file.id}
                  href={file.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-2xl border border-white/10 p-4"
                >
                  <div className="truncate font-bold">{file.fileName}</div>
                  <div className="mt-2 text-xs text-slate-400">
                    {file.contentType} ·{" "}
                    {file.fileSizeBytes
                      ? `${(file.fileSizeBytes / 1024 / 1024).toFixed(2)} MB`
                      : "Size unavailable"}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {file.uploadedByName} ·{" "}
                    {new Date(file.createdAt).toLocaleString("en-KE")}
                  </div>
                </a>
              ))}
            </div>
          </div>
        ) : null}
        {tab === "timeline" ? (
          <div>
            <h2 className="text-xl font-semibold">Audit timeline</h2>
            <div className="mt-5 space-y-3">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="rounded-2xl border border-white/10 p-4"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                    <div className="font-bold">{event.eventLabel}</div>
                    <div className="text-xs text-slate-400">
                      {new Date(event.createdAt).toLocaleString("en-KE")} ·{" "}
                      {event.actorName || "System"}
                    </div>
                  </div>
                  {event.eventDetail ? (
                    <div className="mt-2 text-sm text-slate-300">
                      {event.eventDetail}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {tab === "internal" ? (
          <div>
            <h2 className="text-xl font-semibold">Internal administration</h2>
            <p className="mt-1 text-sm text-slate-400">
              Never shown in the customer Site Visit API.
            </p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Field name="Internal notes" wide>
                <textarea
                  className={`${input} min-h-40`}
                  value={draft.internalNotes || ""}
                  onChange={(e) =>
                    patchDraft({ internalNotes: e.target.value })
                  }
                />
              </Field>
              <Field name="Closure reason" wide>
                <textarea
                  className={`${input} min-h-28`}
                  value={draft.closedReason || ""}
                  onChange={(e) => patchDraft({ closedReason: e.target.value })}
                />
              </Field>
            </div>
          </div>
        ) : null}
        {tab === "overview" || tab === "assessment" || tab === "internal" ? (
          <div className="sticky bottom-3 mt-7 flex justify-end">
            <button
              disabled={saving}
              onClick={() => void save()}
              className="inline-flex items-center gap-2 rounded-full bg-cyan-400 px-6 py-3 font-bold text-slate-950 shadow-xl disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
