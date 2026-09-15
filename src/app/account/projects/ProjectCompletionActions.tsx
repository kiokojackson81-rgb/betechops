"use client";

import { useState } from "react";
import { CheckCircle2, Download } from "lucide-react";
import { shopStyles } from "@/app/shop/_components/shopStyles";

export default function ProjectCompletionActions({ receiptId, acknowledged, warrantyCertificateNo }: { receiptId: string; acknowledged: boolean; warrantyCertificateNo: string | null }) {
  const [completed, setCompleted] = useState(acknowledged);
  const [terms, setTerms] = useState(acknowledged);
  const [saved, setSaved] = useState(acknowledged);
  const [error, setError] = useState("");
  const save = async () => {
    setError("");
    const response = await fetch(`/api/account/projects/${encodeURIComponent(receiptId)}/completion-ack`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ installationCompleted: completed, termsAccepted: terms }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { setError(body.error || "Could not save your confirmation."); return; }
    setSaved(true);
  };
  return <section className={`${shopStyles.lightCard} p-5`}>
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="text-xs font-black uppercase tracking-[.18em] text-[#7a0000]">Installation completed</div>
        <h2 className="mt-2 text-xl font-black">Your project documents</h2>
        <p className="mt-2 text-sm text-slate-600">Issued project documents are kept together and available whenever you sign in.</p>
      </div>
      <CheckCircle2 className="h-6 w-6 shrink-0 text-[#0f9d58]" />
    </div>
    <details className="relative mt-5 w-full sm:w-fit">
      <summary className={`${shopStyles.primaryButton} w-full cursor-pointer list-none sm:w-fit [&::-webkit-details-marker]:hidden`}>
        <Download className="h-4 w-4" /> Documents
      </summary>
      <div className="z-10 mt-2 grid w-full gap-2 rounded-2xl border border-[#7a0000]/15 bg-white p-3 shadow-lg sm:absolute sm:left-0 sm:min-w-[255px] sm:w-auto">
        <a href={`/api/receipts/${encodeURIComponent(receiptId)}/pdf?download=1`} className={shopStyles.secondaryButton}><Download className="h-4 w-4" /> Receipt</a>
        <a href={`/api/account/projects/${encodeURIComponent(receiptId)}/certificate`} className={shopStyles.secondaryButton}><Download className="h-4 w-4" /> Completion certificate</a>
        {warrantyCertificateNo ? <a href={`/api/account/projects/${encodeURIComponent(receiptId)}/warranty`} className={shopStyles.secondaryButton}><Download className="h-4 w-4" /> Warranty certificate</a> : null}
      </div>
    </details>
    {warrantyCertificateNo ? <p className="mt-3 text-xs font-semibold text-[#0f7a43]">Warranty certificate issued: {warrantyCertificateNo}</p> : null}
    <div className="mt-5 space-y-3 rounded-2xl bg-[#fff7e8] p-4 text-sm">
      <label className="flex items-start gap-3"><input className="mt-0.5 shrink-0" type="checkbox" checked={completed} onChange={(event) => setCompleted(event.target.checked)} />I confirm that the installation was completed and I received the handover information.</label>
      <label className="mt-4 flex items-start gap-3"><input className="mt-0.5 shrink-0" type="checkbox" checked={terms} onChange={(event) => setTerms(event.target.checked)} />I have read and accept the <a href="/p/terms" target="_blank" rel="noreferrer" className="font-bold text-[#7a0000] underline">Solar Installation Terms & Conditions</a>.</label>
      <button type="button" disabled={!completed || !terms || saved} onClick={() => void save()} className="w-full rounded-xl border border-[#7a0000] px-4 py-2.5 font-black text-[#7a0000] disabled:opacity-40 sm:w-fit">{saved ? "CONFIRMATION SAVED" : "CONFIRM COMPLETION"}</button>
      {error ? <p className="text-[#b42318]">{error}</p> : null}
    </div>
  </section>;
}
