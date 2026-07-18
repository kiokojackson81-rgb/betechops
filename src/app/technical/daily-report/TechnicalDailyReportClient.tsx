"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type TechnicalFormState = {
  fieldVisitsCompleted: number;
  customerCallsMade: number;
  routesConfirmed: boolean;
  visitNotesUploaded: boolean;
  installationsWorkedOn: number;
  projectsUpdated: number;
  handoversCompleted: number;
  testingCompleted: boolean;
  serviceCallsHandled: number;
  faultsDiagnosed: number;
  returnVisitsBooked: number;
  quotationsSupported: number;
  materialsRequested: number;
  toolsChecked: boolean;
  ppeConfirmed: boolean;
  incidentsReported: number;
  keyWorkCompleted: string;
  blockers: string;
  materialsNeeded: string;
  customerIssues: string;
  nextSteps: string;
  weeklySummary: string;
};

type QuickStats = {
  assignedSiteVisits: number;
  activeProjects: number;
  serviceCallsPending: number;
  quotationsAssigned: number;
  completedProjects: number;
  periodReceipts: number;
  periodSales: number;
};

type EarningsLine = {
  label: string;
  amount: number;
  kind: "earning" | "deduction";
};

type Props = {
  viewerName: string;
  roleLabel: string;
  periodLabel: string;
  payslipHref: string;
  initialImpersonateId?: string | null;
  quickStats: QuickStats;
  earnings: {
    netPay: number;
    lines: EarningsLine[];
  };
};

const kenyaTimeZone = "Africa/Nairobi";

const cardClasses =
  "rounded-[24px] border border-white/10 bg-white/[0.03] shadow-[0_24px_70px_rgba(0,0,0,0.28)]";

const sectionPanelClasses =
  "rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.96),rgba(2,6,23,.98))] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.35)]";

const technicalDayNotes: Record<string, string> = {
  Monday: "Plan field routes, confirm customer appointments, and prepare tools and materials for the week.",
  Tuesday: "Track installation execution, progress updates, and any site blockers that need intervention.",
  Wednesday: "Capture survey outcomes, technical clarifications, and quotation support activities.",
  Thursday: "Focus on diagnostics, return visits, and service follow-up that needs closure.",
  Friday: "Confirm testing, commissioning, handover status, and completion evidence before weekend close.",
  Saturday: "Submit the weekly technical summary, pending issues, materials needs, and next-step action items.",
  Sunday: "Record any emergency technical support, standby work, or exception field activity.",
};

const defaultFormState = (): TechnicalFormState => ({
  fieldVisitsCompleted: 0,
  customerCallsMade: 0,
  routesConfirmed: false,
  visitNotesUploaded: false,
  installationsWorkedOn: 0,
  projectsUpdated: 0,
  handoversCompleted: 0,
  testingCompleted: false,
  serviceCallsHandled: 0,
  faultsDiagnosed: 0,
  returnVisitsBooked: 0,
  quotationsSupported: 0,
  materialsRequested: 0,
  toolsChecked: false,
  ppeConfirmed: false,
  incidentsReported: 0,
  keyWorkCompleted: "",
  blockers: "",
  materialsNeeded: "",
  customerIssues: "",
  nextSteps: "",
  weeklySummary: "",
});

function formatKES(value: number) {
  return `KES ${Number(value || 0).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
}

function toKenyaIsoDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: kenyaTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function getKenyaWeekday(isoDate: string) {
  const date = new Date(`${isoDate}T12:00:00Z`);
  return date.toLocaleDateString("en-KE", {
    weekday: "long",
    timeZone: kenyaTimeZone,
  });
}

function shiftIsoDate(isoDate: string, days: number) {
  const shifted = new Date(`${isoDate}T12:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return toKenyaIsoDate(shifted);
}

function StatCard({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-slate-950/45 p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</div>
      <div className="mt-3 text-3xl font-semibold text-white">{value}</div>
      <div className="mt-2 text-sm text-slate-400">{hint}</div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="space-y-2">
      <div className="text-sm font-medium text-slate-200">{label}</div>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(event) => onChange(Math.max(0, Number(event.target.value || 0)))}
        className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-400/40"
      />
    </label>
  );
}

function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3 text-sm text-slate-200">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4" />
      <span>{label}</span>
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  rows?: number;
}) {
  return (
    <label className="space-y-2">
      <div className="text-sm font-medium text-slate-200">{label}</div>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400/40"
      />
    </label>
  );
}

export default function TechnicalDailyReportClient({
  viewerName,
  roleLabel,
  periodLabel,
  payslipHref,
  initialImpersonateId,
  quickStats,
  earnings,
}: Props) {
  const todayIso = useMemo(() => toKenyaIsoDate(new Date()), []);
  const [date, setDate] = useState(todayIso);
  const [dayOfWeek, setDayOfWeek] = useState(getKenyaWeekday(todayIso));
  const [form, setForm] = useState<TechnicalFormState>(defaultFormState);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDayOfWeek(getKenyaWeekday(date));
  }, [date]);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ date });
    if (initialImpersonateId) {
      params.set("impersonateId", initialImpersonateId);
    }

    async function loadReport() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/technical/daily-report?${params.toString()}`, {
          cache: "no-store",
          credentials: "same-origin",
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error || "Failed to load technical daily report.");
        }
        if (cancelled) return;
        setForm(payload.report?.technicalReport || defaultFormState());
      } catch (loadError) {
        if (cancelled) return;
        setForm(defaultFormState());
        setError(loadError instanceof Error ? loadError.message : "Failed to load technical daily report.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadReport();
    return () => {
      cancelled = true;
    };
  }, [date, initialImpersonateId]);

  const dayNote = technicalDayNotes[dayOfWeek] || technicalDayNotes.Monday;

  const totalActions =
    form.fieldVisitsCompleted +
    form.installationsWorkedOn +
    form.projectsUpdated +
    form.serviceCallsHandled +
    form.quotationsSupported;

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const params = new URLSearchParams();
      if (initialImpersonateId) {
        params.set("impersonateId", initialImpersonateId);
      }

      const response = await fetch(`/api/technical/daily-report${params.toString() ? `?${params.toString()}` : ""}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          date,
          day: dayOfWeek,
          technicalReport: form,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Failed to save technical daily report.");
      }
      setMessage("Technical daily report submitted successfully.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save technical daily report.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className={sectionPanelClasses}>
        <div className="mb-5">
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Staff Report & Payroll</div>
          <h1 className="mt-2 text-3xl font-semibold text-white">Technical daily reporting, field stats, and earnings tools</h1>
          <p className="mt-1 max-w-4xl text-sm text-slate-400">
            Record site visits, project execution, service follow-up, safety checks, and technical blockers from one integrated section.
          </p>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-slate-950/40 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Statistics Period</div>
              <div className="mt-2 text-3xl font-semibold text-white">{periodLabel}</div>
              <div className="mt-2 text-sm text-slate-400">{viewerName} · {roleLabel}</div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/technical/earnings" className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white transition hover:bg-white/5">
                View earnings
              </Link>
              <Link href={payslipHref} className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-black transition hover:brightness-95">
                Download payslip
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-5 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_430px]">
          <div className="min-w-0 space-y-5">
            <section className={`${cardClasses} p-5`}>
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Reporting Day</div>
                  <h2 className="mt-2 text-2xl font-semibold text-white">{dayOfWeek} technical checklist</h2>
                  <p className="mt-1 max-w-2xl text-sm text-slate-400">
                    {dayNote}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[540px]">
                  <label className="space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Date</div>
                    <input
                      type="date"
                      value={date}
                      onChange={(event) => setDate(event.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-400/40"
                    />
                  </label>
                  <label className="space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Day of week</div>
                    <input
                      value={dayOfWeek}
                      readOnly
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none"
                    />
                  </label>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setDate(todayIso)}
                  className="rounded-full border border-white/10 bg-slate-950/40 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-white/30 hover:bg-white/[0.05]"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setDate(shiftIsoDate(todayIso, -1))}
                  className="rounded-full border border-white/10 bg-slate-950/40 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-white/30 hover:bg-white/[0.05]"
                >
                  Yesterday
                </button>
                <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-100">
                  Auto-loaded from selected day
                </div>
                {loading ? (
                  <div className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1.5 text-xs font-semibold text-sky-100">
                    Loading saved report
                  </div>
                ) : null}
              </div>
            </section>

            <section className={`${cardClasses} p-5`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Day Checklist</div>
                  <h2 className="mt-2 text-2xl font-semibold text-white">{dayOfWeek}</h2>
                </div>
                <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-100">
                  Technical operations checklist
                </div>
              </div>

              <div className="mt-5 space-y-6">
                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="rounded-[24px] border border-white/10 bg-slate-950/35 p-4">
                    <div className="text-lg font-semibold text-white">Field Visits</div>
                    <div className="mt-1 text-sm text-slate-400">Site surveys, customer coordination, and visit reporting.</div>
                    <div className="mt-4 grid gap-4">
                      <NumberField label="Site visits / surveys completed" value={form.fieldVisitsCompleted} onChange={(value) => setForm((current) => ({ ...current, fieldVisitsCompleted: value }))} />
                      <NumberField label="Customer calls / confirmations made" value={form.customerCallsMade} onChange={(value) => setForm((current) => ({ ...current, customerCallsMade: value }))} />
                      <CheckboxField label="Routes and locations confirmed" checked={form.routesConfirmed} onChange={(value) => setForm((current) => ({ ...current, routesConfirmed: value }))} />
                      <CheckboxField label="Visit notes / findings uploaded" checked={form.visitNotesUploaded} onChange={(value) => setForm((current) => ({ ...current, visitNotesUploaded: value }))} />
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-white/10 bg-slate-950/35 p-4">
                    <div className="text-lg font-semibold text-white">Projects & Installations</div>
                    <div className="mt-1 text-sm text-slate-400">Project execution, installation progress, testing, and handover.</div>
                    <div className="mt-4 grid gap-4">
                      <NumberField label="Installations worked on" value={form.installationsWorkedOn} onChange={(value) => setForm((current) => ({ ...current, installationsWorkedOn: value }))} />
                      <NumberField label="Project updates completed" value={form.projectsUpdated} onChange={(value) => setForm((current) => ({ ...current, projectsUpdated: value }))} />
                      <NumberField label="Handovers completed" value={form.handoversCompleted} onChange={(value) => setForm((current) => ({ ...current, handoversCompleted: value }))} />
                      <CheckboxField label="Testing / commissioning completed" checked={form.testingCompleted} onChange={(value) => setForm((current) => ({ ...current, testingCompleted: value }))} />
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="rounded-[24px] border border-white/10 bg-slate-950/35 p-4">
                    <div className="text-lg font-semibold text-white">Service & Maintenance</div>
                    <div className="mt-1 text-sm text-slate-400">Fault diagnosis, customer support, and return technical visits.</div>
                    <div className="mt-4 grid gap-4">
                      <NumberField label="Service calls handled" value={form.serviceCallsHandled} onChange={(value) => setForm((current) => ({ ...current, serviceCallsHandled: value }))} />
                      <NumberField label="Faults diagnosed / resolved" value={form.faultsDiagnosed} onChange={(value) => setForm((current) => ({ ...current, faultsDiagnosed: value }))} />
                      <NumberField label="Return visits scheduled" value={form.returnVisitsBooked} onChange={(value) => setForm((current) => ({ ...current, returnVisitsBooked: value }))} />
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-white/10 bg-slate-950/35 p-4">
                    <div className="text-lg font-semibold text-white">Materials, Quotations & Safety</div>
                    <div className="mt-1 text-sm text-slate-400">Materials escalation, technical quotation support, and field safety controls.</div>
                    <div className="mt-4 grid gap-4">
                      <NumberField label="Technical quotations supported" value={form.quotationsSupported} onChange={(value) => setForm((current) => ({ ...current, quotationsSupported: value }))} />
                      <NumberField label="Materials / tools requested" value={form.materialsRequested} onChange={(value) => setForm((current) => ({ ...current, materialsRequested: value }))} />
                      <NumberField label="Incidents / safety concerns reported" value={form.incidentsReported} onChange={(value) => setForm((current) => ({ ...current, incidentsReported: value }))} />
                      <CheckboxField label="Tools and equipment checked" checked={form.toolsChecked} onChange={(value) => setForm((current) => ({ ...current, toolsChecked: value }))} />
                      <CheckboxField label="PPE and safety compliance confirmed" checked={form.ppeConfirmed} onChange={(value) => setForm((current) => ({ ...current, ppeConfirmed: value }))} />
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-slate-950/35 p-4">
                  <div className="text-lg font-semibold text-white">Daily Summary</div>
                  <div className="mt-1 text-sm text-slate-400">Capture the actual technical work completed, blockers, support needs, and next action items.</div>
                  <div className="mt-4 grid gap-4 xl:grid-cols-2">
                    <TextAreaField label="Key work completed today" value={form.keyWorkCompleted} onChange={(value) => setForm((current) => ({ ...current, keyWorkCompleted: value }))} placeholder="Installations completed, site visits covered, diagnostics handled, documents submitted..." />
                    <TextAreaField label="Blockers or delays" value={form.blockers} onChange={(value) => setForm((current) => ({ ...current, blockers: value }))} placeholder="Customer unavailable, missing materials, weather delays, access issues, approvals pending..." />
                    <TextAreaField label="Materials / tools needed" value={form.materialsNeeded} onChange={(value) => setForm((current) => ({ ...current, materialsNeeded: value }))} placeholder="Panels, mounting hardware, cable, batteries, meters, transport, PPE, ladders..." />
                    <TextAreaField label="Customer issues / follow-up needed" value={form.customerIssues} onChange={(value) => setForm((current) => ({ ...current, customerIssues: value }))} placeholder="Complaints, pending clarifications, warranty checks, return visit requirements..." />
                    <TextAreaField label="Next steps / tomorrow plan" value={form.nextSteps} onChange={(value) => setForm((current) => ({ ...current, nextSteps: value }))} placeholder="Next site to visit, work to continue, customer to call, materials to collect..." />
                    <TextAreaField label="Weekly technical summary" value={form.weeklySummary} onChange={(value) => setForm((current) => ({ ...current, weeklySummary: value }))} placeholder="Weekly performance, recurring issues, process improvements, support needed from management..." rows={5} />
                  </div>
                </div>
              </div>
            </section>

            {message ? (
              <div className="rounded-[20px] border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">{message}</div>
            ) : null}
            {error ? (
              <div className="rounded-[20px] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</div>
            ) : null}

            <div className="flex flex-wrap items-center justify-end gap-3 rounded-[24px] border border-white/10 bg-slate-950/70 p-4">
              <button
                type="button"
                onClick={() => setForm(defaultFormState())}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:border-white/30 hover:bg-white/5"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="rounded-xl bg-emerald-500 px-6 py-2 text-sm font-semibold text-black transition hover:brightness-95 disabled:opacity-60"
              >
                {saving ? "Submitting..." : "Submit report"}
              </button>
            </div>
          </div>

          <aside className="space-y-5 lg:sticky lg:top-6">
            <div className={`${cardClasses} p-5`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Quick stats</div>
                  <h2 className="mt-2 text-xl font-semibold text-white">{periodLabel}</h2>
                </div>
                <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                  {totalActions} logged today
                </div>
              </div>
              <div className="mt-5 grid gap-3">
                <StatCard label="Assigned site visits" value={quickStats.assignedSiteVisits} hint="Open surveys, scheduled site visits, and technical follow-up." />
                <StatCard label="Active projects" value={quickStats.activeProjects} hint="Project receipts still in progress under your technical flow." />
                <StatCard label="Open service calls" value={quickStats.serviceCallsPending} hint="Fault diagnosis or service work still awaiting closure." />
                <StatCard label="Assigned quotations" value={quickStats.quotationsAssigned} hint="Technical quotations or clarifications assigned to this profile." />
                <StatCard label="Projects completed" value={quickStats.completedProjects} hint="Completed and posted project receipts in the current period." />
                <StatCard label="Linked receipt value" value={formatKES(quickStats.periodSales)} hint={`${quickStats.periodReceipts} technical-linked receipts in this period.`} />
              </div>
            </div>

            <div className={`${cardClasses} p-5`}>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Earnings summary</div>
              <div className="mt-3 text-3xl font-semibold text-emerald-300">{formatKES(earnings.netPay)}</div>
              <div className="mt-1 text-sm text-slate-400">Net pay for {periodLabel}</div>
              <div className="mt-5 space-y-3">
                {earnings.lines.length ? earnings.lines.map((line) => (
                  <div key={`${line.kind}:${line.label}`} className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3 text-sm">
                    <span className="text-slate-300">{line.label}</span>
                    <span className={line.kind === "deduction" ? "font-semibold text-rose-300" : "font-semibold text-white"}>
                      {line.kind === "deduction" ? "-" : ""}{formatKES(Math.abs(line.amount))}
                    </span>
                  </div>
                )) : (
                  <div className="rounded-2xl border border-dashed border-white/10 px-4 py-4 text-sm text-slate-400">
                    No earnings lines available in this period yet.
                  </div>
                )}
              </div>
              <div className="mt-5 grid gap-3">
                <Link href={payslipHref} className="rounded-2xl bg-emerald-500 px-4 py-3 text-center text-sm font-semibold text-black transition hover:brightness-95">
                  Download payslip
                </Link>
                <Link href="/technical/earnings" className="rounded-2xl border border-white/10 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-white/5">
                  Open earnings workspace
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
