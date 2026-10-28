import { notFound } from "next/navigation";
import { getSiteVisitById } from "@/lib/siteVisits";
import { verifySiteAssessmentToken } from "@/lib/siteAssessmentLink";

const list = (title: string, items: string[]) => items.length ? <section className="rounded-2xl border border-[#7a0000]/10 bg-white p-5 shadow-sm"><h2 className="font-black text-slate-900">{title}</h2><ul className="mt-3 list-disc space-y-2 pl-5 text-slate-700">{items.map((item) => <li key={item}>{item}</li>)}</ul></section> : null;
const metric = (label: string, value: string) => <div className="rounded-2xl border border-[#7a0000]/10 bg-amber-50 p-5"><p className="text-sm text-slate-600">{label}</p><p className="mt-1 text-xl font-black text-slate-950">{value}</p></div>;

export const dynamic = "force-dynamic";

export default async function PublicSiteAssessmentReport({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const payload = verifySiteAssessmentToken(token);
  const visit = payload?.audience === "CUSTOMER" ? await getSiteVisitById(payload.visitId) : null;
  const report = visit?.assessmentReport;
  if (!visit || !report) notFound();
  const recommendation = report.recommendation.type === "CUSTOM_QUOTATION" ? "Betech will prepare a custom quotation for your site." : report.recommendation.productName || "Recommended Betech system";
  return <main className="mx-auto max-w-4xl px-4 py-10 text-slate-800"><p className="text-sm font-black uppercase tracking-[.2em] text-[#7a0000]">Betech Solar Solutions</p><h1 className="mt-2 text-3xl font-black text-slate-950">Your site assessment report</h1><p className="mt-2 text-slate-600">{visit.visitRef} · Published {new Date(report.submittedAt).toLocaleDateString("en-KE", { dateStyle: "medium" })}</p>
    <section className="mt-7 rounded-3xl bg-[#7a0000] p-6 text-white"><p className="text-sm font-bold uppercase tracking-[.16em] text-amber-200">Betech recommendation</p><h2 className="mt-2 text-2xl font-black">{recommendation}</h2>{report.recommendation.notes ? <p className="mt-3 leading-7 text-red-50">{report.recommendation.notes}</p> : null}{report.recommendation.productUrl ? <a href={report.recommendation.productUrl} className="mt-4 inline-block font-bold underline">View recommended system</a> : null}</section>
    <div className="mt-6 grid gap-4 sm:grid-cols-3">{metric("Daily energy", `${(report.calculation.dailyKwh ?? 0).toFixed(2)} kWh`)}{metric("Indicative inverter", `${(report.calculation.inverterKw ?? 0).toFixed(1)} kW`)}{metric("Indicative storage", `${(report.calculation.batteryKwh ?? 0).toFixed(1)} kWh`)}</div>
    <div className="mt-6 grid gap-5 md:grid-cols-2"><section className="rounded-2xl border border-[#7a0000]/10 bg-white p-5 shadow-sm"><h2 className="font-black text-slate-900">Assessment summary</h2><p className="mt-3 leading-7 text-slate-700">{report.aiReview?.summary || "Our technician completed the site assessment. Betech will confirm the final scope in your quotation."}</p></section>{list("Recommended next actions", report.aiReview?.recommendations || [])}{list("Items to confirm", [...(report.aiReview?.risks || []), ...(report.aiReview?.dataGaps || [])])}</div>
    <div className="mt-6 flex flex-wrap gap-3"><a href={`/api/site-assessment/report/pdf?token=${encodeURIComponent(token)}`} className="rounded-full bg-[#7a0000] px-5 py-3 font-bold text-white">Download PDF report</a>{report.signatures ? <p className="py-3 text-sm text-slate-600">Completed by {report.signatures.technicianName}</p> : null}</div>
  </main>;
}
