"use client";

import { useEffect, useState } from "react";
import { ArrowRight, BookOpenCheck, CircleDollarSign, ExternalLink, Gift, Headphones, MessageSquareWarning, ShieldCheck, Share2, Star } from "lucide-react";

type ProjectDocuments = {
  certificateNo: string; issuedAt: string; documentsReady: boolean;
  reviewUrl: string | null;
  referralReward: {
    productName: string;
    commissionType: "PERCENTAGE" | "FIXED";
    commissionRate: number | null;
    fixedAmount: number | null;
    potentialCommission: number;
    trackingDays: number;
    requiresFullPayment: boolean;
  } | null;
  project: { reference: string; customerName: string; location: string };
  documents: Array<{ kind: string; label: string; available: boolean; url: string }>;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatTrackingPeriod(days: number) {
  const months = days / 30;
  return Number.isInteger(months) ? `Up to ${months} months` : `Up to ${days} days`;
}

export default function CertificateCustomerClient({ token }: { token: string }) {
  const [project, setProject] = useState<ProjectDocuments | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/certificate/${encodeURIComponent(token)}`, { cache: "no-store", signal: controller.signal }).then(async response => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Documents unavailable.");
      setProject(body);
    }).catch(error => { if (error.name !== "AbortError") setError(error.message || "Documents unavailable."); });
    return () => controller.abort();
  }, [token]);
  return <main className="min-h-screen bg-[#f7f4ef] px-4 py-8 text-slate-900"><article className="mx-auto max-w-2xl rounded-3xl border border-[#7a0000]/15 bg-white p-5 shadow-sm sm:p-8">
    <header className="border-b border-[#7a0000]/15 pb-5"><p className="text-xs font-black tracking-[.18em] text-[#7a0000]">BETECH SOLAR SOLUTIONS</p><h1 className="mt-3 text-2xl font-black sm:text-3xl">Your project documents</h1></header>
    {!project ? <p role="status" className="py-6">{error || "Loading your documents..."}</p> : <>
      <div className="mt-5 rounded-2xl bg-emerald-50 p-4"><p className="text-xs font-black tracking-wider text-emerald-800">COMPLETED &amp; CERTIFIED</p><p className="mt-2 font-bold">{project.project.customerName}</p><p className="mt-1 text-sm">Project {project.project.reference}<br />{project.project.location}</p><p className="mt-2 text-sm text-emerald-800">Certified on {new Date(project.issuedAt).toLocaleDateString("en-KE", { timeZone: "Africa/Nairobi", day: "numeric", month: "long", year: "numeric" })}</p></div>
      {!project.documentsReady ? <p role="status" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Some documents are still being prepared. Please check again shortly or contact Betech.</p> : null}
      <ol className="mt-6 space-y-4">{project.documents.map((document, index) => <li key={document.kind} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-center gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#7a0000]/10 font-black text-[#7a0000]">{index + 1}</span><h2 className="font-bold">{document.label}</h2></div>{document.available ? <div className="mt-4 flex flex-wrap gap-3"><a href={document.url} target="_blank" rel="noreferrer" className="rounded-xl bg-[#7a0000] px-5 py-3 text-sm font-bold text-white">View PDF</a><a href={`${document.url}?download=1`} className="rounded-xl border border-[#7a0000]/30 px-5 py-3 text-sm font-bold text-[#7a0000]">Download PDF</a></div> : <p className="mt-3 text-sm text-slate-500">Being prepared</p>}</li>)}</ol>
    </>}
    <footer className="mt-6 border-t border-slate-100 pt-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-black text-slate-900">Support &amp; customer care</p>
          <p className="mt-1 text-sm text-slate-600">Help, warranty information, and useful next steps for your Betech system.</p>
        </div>
        <a className="inline-flex min-h-11 items-center gap-2 font-bold text-[#7a0000]" href="tel:+254722151083"><Headphones className="h-4 w-4" /> 0722 151 083</a>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <a href="https://www.betech.co.ke/p/terms" target="_blank" rel="noreferrer" className="group flex min-h-20 items-start gap-3 rounded-2xl border border-slate-200 bg-[#fcfaf7] p-4 transition hover:border-[#7a0000]/30 hover:bg-white"><BookOpenCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#7a0000]" /><span className="min-w-0"><span className="flex items-center gap-1 font-bold text-slate-900">Terms &amp; Conditions <ExternalLink className="h-3.5 w-3.5" /></span><span className="mt-1 block text-xs leading-5 text-slate-600">Read the installation and service terms.</span></span></a>
        <a href="https://www.betech.co.ke/warranty-support" target="_blank" rel="noreferrer" className="group flex min-h-20 items-start gap-3 rounded-2xl border border-slate-200 bg-[#fcfaf7] p-4 transition hover:border-[#7a0000]/30 hover:bg-white"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" /><span className="min-w-0"><span className="flex items-center gap-1 font-bold text-slate-900">Warranty Support <ExternalLink className="h-3.5 w-3.5" /></span><span className="mt-1 block text-xs leading-5 text-slate-600">Learn about coverage and warranty assistance.</span></span></a>
        <a href="https://wa.me/254722151083?text=Hello%20Betech%20Customer%20Care%2C%20I%20need%20help%20with%20my%20solar%20project." target="_blank" rel="noreferrer" className="group flex min-h-20 items-start gap-3 rounded-2xl border border-slate-200 bg-[#fcfaf7] p-4 transition hover:border-[#7a0000]/30 hover:bg-white"><Headphones className="mt-0.5 h-5 w-5 shrink-0 text-[#0f9d58]" /><span className="min-w-0"><span className="flex items-center gap-1 font-bold text-slate-900">Betech Customer Care <ExternalLink className="h-3.5 w-3.5" /></span><span className="mt-1 block text-xs leading-5 text-slate-600">Chat with our customer care team on WhatsApp.</span></span></a>
        <a href="https://www.betech.co.ke/support/report-issue" target="_blank" rel="noreferrer" className="group flex min-h-20 items-start gap-3 rounded-2xl border border-slate-200 bg-[#fcfaf7] p-4 transition hover:border-[#7a0000]/30 hover:bg-white"><MessageSquareWarning className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" /><span className="min-w-0"><span className="flex items-center gap-1 font-bold text-slate-900">Report an Issue <ExternalLink className="h-3.5 w-3.5" /></span><span className="mt-1 block text-xs leading-5 text-slate-600">Tell us about a product, installation, or service issue.</span></span></a>
        {project?.reviewUrl ? <a href={project.reviewUrl} target="_blank" rel="noreferrer" className="group flex min-h-20 items-start gap-3 rounded-2xl border border-slate-200 bg-[#fcfaf7] p-4 transition hover:border-[#7a0000]/30 hover:bg-white"><Star className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" /><span className="min-w-0"><span className="flex items-center gap-1 font-bold text-slate-900">Leave a Review <ExternalLink className="h-3.5 w-3.5" /></span><span className="mt-1 block text-xs leading-5 text-slate-600">Share feedback about your verified purchase.</span></span></a> : <div className="flex min-h-20 items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-500"><Star className="mt-0.5 h-5 w-5 shrink-0" /><span className="text-xs leading-5">Your review link will be available once a product is linked to this project.</span></div>}
        {project?.reviewUrl && project.referralReward ? <a href={project.reviewUrl} target="_blank" rel="noreferrer" className="group flex min-h-20 items-start gap-3 rounded-2xl border border-[#f2b20f]/30 bg-[#fff8e7] p-4 transition hover:border-[#f2b20f]/60 hover:bg-[#fff3d8]"><Gift className="mt-0.5 h-5 w-5 shrink-0 text-[#a65f00]" /><span className="min-w-0"><span className="flex items-center gap-1 font-bold text-slate-900">Refer &amp; Earn <ExternalLink className="h-3.5 w-3.5" /></span><span className="mt-1 block text-xs leading-5 text-slate-600">Create a tracked referral linked to your verified purchase.</span></span></a> : <div className="flex min-h-20 items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-500"><Gift className="mt-0.5 h-5 w-5 shrink-0" /><span className="text-xs leading-5">Referral rewards will appear when this project has an eligible product.</span></div>}
      </div>
      {project?.reviewUrl && project.referralReward ? <section className="mt-5 overflow-hidden rounded-3xl border border-amber-300/40 bg-[linear-gradient(180deg,#fff7df_0%,#ffedc0_100%)] p-5 shadow-[0_14px_32px_rgba(180,112,0,0.10)] sm:p-6">
        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_12rem] sm:items-start">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[.16em] text-[#7a0000]">Referral reward for {project.referralReward.productName}</p>
            <p className="mt-4 text-sm font-bold uppercase tracking-[.1em] text-[#7a0000]/80">Earn up to</p>
            <p className="mt-1 break-words text-4xl font-black tracking-tight text-[#7a0000] sm:text-5xl">{formatMoney(project.referralReward.potentialCommission)}</p>
            <p className="mt-4 max-w-xl text-sm leading-6 text-[#6b3d00]">Refer someone who may benefit from the same product or service. When they complete a qualifying purchase during the tracking period, your commission is calculated automatically.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-1">
            <div className="rounded-2xl border border-white/70 bg-white/80 p-4"><p className="text-xs font-black uppercase tracking-[.14em] text-slate-500">{project.referralReward.commissionType === "PERCENTAGE" ? "Commission rate" : "Commission reward"}</p><p className="mt-2 text-2xl font-black text-[#7a0000]">{project.referralReward.commissionType === "PERCENTAGE" ? `${project.referralReward.commissionRate || 0}%` : formatMoney(project.referralReward.fixedAmount || 0)}</p></div>
            <div className="rounded-2xl border border-white/70 bg-white/80 p-4"><p className="text-xs font-black uppercase tracking-[.14em] text-slate-500">Tracking period</p><p className="mt-2 text-lg font-black text-slate-900">{formatTrackingPeriod(project.referralReward.trackingDays)}</p></div>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-4 gap-2 rounded-2xl border border-[#e8c486] bg-white/60 p-3 text-center text-xs font-bold text-slate-700 sm:text-sm"><span>1. Refer</span><span>2. Share</span><span>3. Purchase</span><span>4. Earn</span></div>
        <p className="mt-3 text-xs leading-5 text-[#6b3d00]">{project.referralReward.requiresFullPayment ? "Commission is released after the referred purchase is fully paid and the qualifying period is complete." : "Commission is released after the qualifying period is complete."}</p>
        <a href={project.reviewUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#7a0000] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#5f0000]"><CircleDollarSign className="h-5 w-5" /> Start your referral <ArrowRight className="h-4 w-4" /></a>
        <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-[#6b3d00]"><Share2 className="mt-0.5 h-4 w-4 shrink-0" /> We will create a unique link you can share by WhatsApp, SMS, email, phone, or copy it directly.</p>
      </section> : null}
      <p className="mt-5 text-xs leading-5 text-slate-500">Keep this secure link for your receipt, warranty and service records.</p>
    </footer>
  </article></main>;
}
