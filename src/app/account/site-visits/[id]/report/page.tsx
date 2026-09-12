import Link from "next/link";
import { getCustomerAccountContext } from "@/app/account/_lib/accountData";
import { customerOwnsSiteVisit } from "@/lib/siteVisits";
import { notFound } from "next/navigation";

const list = (title: string, items: string[]) =>
  items.length ? (
    <section className="rounded-2xl border border-[#7a0000]/10 bg-white p-5 shadow-sm">
      <h2 className="font-black text-slate-900">{title}</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-700">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </section>
  ) : null;

export default async function CustomerSiteVisitReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { identity } = await getCustomerAccountContext();
  const visit = await customerOwnsSiteVisit({ visitId: id, ...identity });
  const report = visit?.assessmentReport;
  if (!visit || !report) notFound();
  const recommendation = report.recommendation.type === "CUSTOM_QUOTATION"
    ? "Betech will prepare a custom quotation for your site."
    : report.recommendation.productName || "Recommended Betech system";

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 text-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black uppercase tracking-[.2em] text-[#7a0000]">Betech Solar Solutions</p>
          <h1 className="mt-2 text-3xl font-black text-slate-950">Your site assessment report</h1>
          <p className="mt-2 text-slate-600">{visit.visitRef} · Published {new Date(report.submittedAt).toLocaleDateString("en-KE", { dateStyle: "medium" })}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/account/site-visits" className="rounded-full border border-[#7a0000]/15 bg-white px-4 py-2 font-bold">My site visits</Link>
          <a href={`/api/account/site-visits/${visit.id}/report/pdf`} className="rounded-full bg-[#7a0000] px-4 py-2 font-bold text-white">Download PDF</a>
        </div>
      </div>
      <section className="mt-7 rounded-3xl bg-[#7a0000] p-6 text-white">
        <p className="text-sm font-bold uppercase tracking-[.16em] text-amber-200">Betech recommendation</p>
        <h2 className="mt-2 text-2xl font-black">{recommendation}</h2>
        {report.recommendation.notes ? <p className="mt-3 max-w-3xl leading-7 text-red-50">{report.recommendation.notes}</p> : null}
        {report.recommendation.productUrl ? <a href={report.recommendation.productUrl} className="mt-4 inline-block font-bold underline">View recommended system</a> : null}
        {report.recommendation.tiktokUrl ? <a href={report.recommendation.tiktokUrl} target="_blank" rel="noreferrer" className="ml-5 mt-4 inline-block font-bold underline">Watch a similar project on TikTok</a> : null}
      </section>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Metric label="Daily energy" value={`${report.calculation.dailyKwh.toFixed(2)} kWh`} />
        <Metric label="Indicative inverter" value={`${report.calculation.inverterKw.toFixed(1)} kW`} />
        <Metric label="Indicative storage" value={`${report.calculation.batteryKwh.toFixed(2)} kWh`} />
      </div>
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <section className="rounded-2xl border border-[#7a0000]/10 bg-white p-5 shadow-sm">
          <h2 className="font-black text-slate-900">Assessment summary</h2>
          <p className="mt-3 leading-7 text-slate-700">{report.aiReview?.summary || "Our technician completed the site assessment. Betech will confirm the final scope in your quotation."}</p>
        </section>
        <section className="rounded-2xl border border-[#7a0000]/10 bg-white p-5 shadow-sm">
          <h2 className="font-black text-slate-900">Indicative solar array</h2>
          <p className="mt-3 leading-7 text-slate-700">{report.calculation.pvKw.toFixed(2)} kWp, approximately {report.calculation.panelCount} panels. Final design is confirmed after technical verification and quotation.</p>
        </section>
        {list("Recommended next actions", report.aiReview?.recommendations || [])}
        {list("Items to confirm", [...(report.aiReview?.risks || []), ...(report.aiReview?.dataGaps || [])])}
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-[#7a0000]/10 bg-amber-50 p-5"><p className="text-sm text-slate-600">{label}</p><p className="mt-1 text-xl font-black text-slate-950">{value}</p></div>;
}
