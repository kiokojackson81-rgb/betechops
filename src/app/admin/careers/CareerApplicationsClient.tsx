"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ExternalLink, FileText, LoaderCircle, Mail, MapPin, Phone, Video } from "lucide-react";

const statuses = ["SUBMITTED", "REVIEWING", "SHORTLISTED", "VIDEO_REQUESTED", "INTERVIEWED", "NOT_SELECTED", "HIRED"] as const;
type Status = (typeof statuses)[number];

export type CareerApplicationRow = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  currentLocation: string;
  educationLevel: string;
  courseOfStudy: string;
  graduationStatus: string;
  cvFileUrl: string;
  cvFileName: string;
  coverLetter: string;
  tiktokWorkUrl: string;
  status: Status;
  createdAt: string;
  applicantEmailSentAt: string | null;
  hrEmailSentAt: string | null;
  emailError: string | null;
};

function label(value: string) { return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function statusTone(status: Status) {
  if (["SHORTLISTED", "VIDEO_REQUESTED", "INTERVIEWED"].includes(status)) return "border-cyan-400/25 bg-cyan-400/10 text-cyan-100";
  if (status === "HIRED") return "border-emerald-400/25 bg-emerald-400/10 text-emerald-100";
  if (status === "NOT_SELECTED") return "border-rose-400/25 bg-rose-500/10 text-rose-100";
  if (status === "REVIEWING") return "border-amber-400/25 bg-amber-400/10 text-amber-100";
  return "border-white/15 bg-white/5 text-white";
}

export default function CareerApplicationsClient({ rows }: { rows: CareerApplicationRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [openId, setOpenId] = useState<string | null>(rows[0]?.id || null);

  async function updateStatus(id: string, status: Status) {
    setBusy(id); setNotice("");
    try {
      const response = await fetch(`/api/admin/career-applications/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not update the application.");
      setNotice("Application status updated.");
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not update the application.");
    } finally { setBusy(null); }
  }

  return <div className="space-y-4">
    {notice ? <p role="status" className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-100">{notice}</p> : null}
    {rows.map((item) => {
      const open = openId === item.id;
      return <article key={item.id} className="overflow-hidden rounded-[26px] border border-white/10 bg-slate-900/75 shadow-[0_16px_35px_rgba(0,0,0,.12)]">
        <button type="button" onClick={() => setOpenId(open ? null : item.id)} aria-expanded={open} className="grid w-full gap-4 px-5 py-5 text-left transition hover:bg-white/[0.03] lg:grid-cols-[1.25fr_.8fr_.75fr_auto] lg:items-center lg:px-6">
          <div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[.16em] ${statusTone(item.status)}`}>{label(item.status)}</span><span className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</span></div><h2 className="mt-2 text-xl font-semibold text-white">{item.fullName}</h2><p className="mt-1 text-sm text-slate-400">{item.courseOfStudy} · {item.graduationStatus}</p></div>
          <div className="space-y-1 text-sm text-slate-300"><span className="flex items-center gap-2"><Mail className="h-4 w-4 text-cyan-300" />{item.email}</span><span className="flex items-center gap-2"><Phone className="h-4 w-4 text-cyan-300" />{item.phone}</span></div>
          <div className="flex items-center gap-2 text-sm text-slate-300"><MapPin className="h-4 w-4 text-cyan-300" />{item.currentLocation}</div>
          <ChevronDown className={`h-5 w-5 justify-self-end text-slate-400 transition ${open ? "rotate-180" : ""}`} />
        </button>
        {open ? <div className="border-t border-white/10 px-5 py-5 lg:px-6"><div className="grid gap-6 xl:grid-cols-[.9fr_1.1fr]">
          <div className="space-y-4"><section className="rounded-2xl border border-white/10 bg-slate-950/50 p-4"><h3 className="text-sm font-black uppercase tracking-[.16em] text-slate-400">Candidate details</h3><dl className="mt-3 grid grid-cols-2 gap-3 text-sm"><Detail label="Education" value={item.educationLevel} /><Detail label="Course" value={item.courseOfStudy} /><Detail label="Graduation" value={item.graduationStatus} /><Detail label="Location" value={item.currentLocation} /></dl></section>
          <div className="flex flex-wrap gap-3"><a href={item.cvFileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-black text-slate-950 transition hover:bg-cyan-200"><FileText className="h-4 w-4" /> Open CV <ExternalLink className="h-3.5 w-3.5" /></a><a href={item.tiktokWorkUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/5"><Video className="h-4 w-4" /> View content work <ExternalLink className="h-3.5 w-3.5" /></a></div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4"><h3 className="text-sm font-black uppercase tracking-[.16em] text-slate-400">Email delivery</h3><p className="mt-2 text-sm text-slate-300">Applicant: {item.applicantEmailSentAt ? "Sent" : "Not confirmed"} · HR: {item.hrEmailSentAt ? "Sent" : "Not confirmed"}</p>{item.emailError ? <p className="mt-2 text-xs text-amber-200">An email delivery error was recorded. Review the configured mail service if needed.</p> : null}</div></div>
          <div className="space-y-4"><section className="rounded-2xl border border-white/10 bg-slate-950/50 p-4"><h3 className="text-sm font-black uppercase tracking-[.16em] text-slate-400">Cover letter</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-300">{item.coverLetter}</p></section><label className="block text-sm font-bold text-slate-200">Application status<select value={item.status} disabled={busy === item.id} onChange={(event) => void updateStatus(item.id, event.target.value as Status)} className="mt-2 block w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-white outline-none focus:border-cyan-300 disabled:opacity-60">{statuses.map((status) => <option key={status} value={status}>{label(status)}</option>)}</select></label>{busy === item.id ? <p className="flex items-center gap-2 text-sm text-cyan-200"><LoaderCircle className="h-4 w-4 animate-spin" />Saving status…</p> : null}</div>
        </div></div> : null}
      </article>;
    })}
    {!rows.length ? <div className="rounded-[26px] border border-dashed border-white/15 p-12 text-center text-slate-400"><FileText className="mx-auto h-8 w-8" /><p className="mt-3 font-semibold">No career applications match this filter.</p></div> : null}
  </div>;
}
function Detail({ label: heading, value }: { label: string; value: string }) { return <div><dt className="text-xs uppercase tracking-wider text-slate-500">{heading}</dt><dd className="mt-1 font-medium text-slate-200">{value}</dd></div>; }