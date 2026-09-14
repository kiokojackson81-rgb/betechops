"use client";

import { useEffect, useState } from "react";

type ProjectDocuments = {
  certificateNo: string; issuedAt: string; documentsReady: boolean;
  project: { reference: string; customerName: string; location: string };
  documents: Array<{ kind: string; label: string; available: boolean; url: string }>;
};

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
    <footer className="mt-6 border-t border-slate-100 pt-5 text-sm text-slate-600">Need help? <a className="font-bold text-[#7a0000]" href="tel:+254722151083">0722 151 083</a><p className="mt-2 text-xs">Keep this secure link for your receipt, warranty and service records.</p></footer>
  </article></main>;
}
