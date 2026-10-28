import { notFound } from "next/navigation";
import { getSiteVisitById } from "@/lib/siteVisits";
import { verifySiteAssessmentToken } from "@/lib/siteAssessmentLink";
import {
  formatSiteVisitProjectType,
  formatSiteVisitReason,
  getSiteVisitProjectProfile,
} from "@/lib/siteVisitProjectProfiles";

export const dynamic = "force-dynamic";

const dateLabel = (value: string | null) => value
  ? new Intl.DateTimeFormat("en-KE", { dateStyle: "full", timeStyle: "short", timeZone: "Africa/Nairobi" }).format(new Date(value))
  : "To be confirmed by your technician";

export default async function CustomerSiteVisitBriefing({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const payload = verifySiteAssessmentToken(token);
  const visit = payload?.audience === "CUSTOMER" ? await getSiteVisitById(payload.visitId) : null;
  if (!payload || !visit) notFound();

  const profile = getSiteVisitProjectProfile(visit.projectType);
  const location = [visit.location, visit.landmark, visit.town, visit.county].filter(Boolean).join(", ") || "Your site location";
  const checks = [
    profile.usesLoadSizing ? "Your appliances, equipment ratings and normal usage" : null,
    "The installation area, access, measurements and safety considerations",
    "Existing equipment, wiring, plumbing or pump details where relevant",
    ...profile.fields.map((field) => field.label),
  ].filter(Boolean);

  return <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900"><section className="mx-auto max-w-2xl rounded-3xl bg-white p-6 shadow-xl shadow-slate-900/10 sm:p-10">
    <p className="text-sm font-bold tracking-wide text-[#7a0000]">BETECH · SITE VISIT</p>
    <h1 className="mt-2 text-3xl font-black">What your technician will assess</h1>
    <p className="mt-3 leading-7 text-slate-600">This secure page explains the scope of visit <strong>{visit.visitRef}</strong>. No account sign-in is required.</p>
    <dl className="mt-7 grid gap-4 rounded-2xl bg-slate-50 p-5 text-sm sm:grid-cols-2"><div><dt className="font-semibold text-slate-500">Assessment</dt><dd className="mt-1 font-bold">{formatSiteVisitProjectType(visit.projectType)}</dd></div><div><dt className="font-semibold text-slate-500">Visit reason</dt><dd className="mt-1 font-bold">{formatSiteVisitReason(visit.visitReason)}</dd></div><div><dt className="font-semibold text-slate-500">Technician</dt><dd className="mt-1 font-bold">{visit.assignedTechnicianName || "To be confirmed"}</dd></div><div><dt className="font-semibold text-slate-500">Scheduled time</dt><dd className="mt-1 font-bold">{dateLabel(visit.scheduledAt)}</dd></div><div className="sm:col-span-2"><dt className="font-semibold text-slate-500">Location</dt><dd className="mt-1 font-bold">{location}</dd></div></dl>
    <h2 className="mt-8 text-xl font-black">During the visit, we expect to check</h2><ul className="mt-4 space-y-3 text-slate-700">{checks.map((check) => <li key={check} className="flex gap-3"><span className="font-black text-[#7a0000]">•</span><span>{check}</span></li>)}</ul>
    {visit.customerRequirements || visit.specialInstructions ? <section className="mt-8 rounded-2xl border border-[#7a0000]/15 bg-[#fff8f7] p-5"><h2 className="font-black">Your request</h2><p className="mt-2 whitespace-pre-wrap leading-7 text-slate-700">{visit.customerRequirements || visit.specialInstructions}</p></section> : null}
    <p className="mt-8 text-sm leading-6 text-slate-500">Please make the relevant equipment and areas accessible. Your technician will contact you if anything else is needed.</p>
  </section></main>;
}
