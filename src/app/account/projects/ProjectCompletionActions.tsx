"use client";

import { useState } from "react";
import { CheckCircle2, Download } from "lucide-react";
import { shopStyles } from "@/app/shop/_components/shopStyles";

export default function ProjectCompletionActions({ receiptId, acknowledged }: { receiptId: string; acknowledged: boolean }) {
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
  return <section className={`${shopStyles.lightCard} p-5`}><div className="flex items-start justify-between gap-4"><div><div className="text-xs font-black uppercase tracking-[.18em] text-[#7a0000]">Installation completed</div><h2 className="mt-2 text-xl font-black">Your completion certificate</h2><p className="mt-2 text-sm text-slate-600">Download your certificate and confirm the completed installation.</p></div><CheckCircle2 className="h-6 w-6 shrink-0 text-[#0f9d58]" /></div><a href={`/api/account/projects/${encodeURIComponent(receiptId)}/certificate`} className={`${shopStyles.primaryButton} mt-5`}><Download className="h-4 w-4" /> Download certificate PDF</a><div className="mt-5 space-y-3 rounded-2xl bg-[#fff7e8] p-4 text-sm"><label className="flex gap-3"><input type="checkbox" checked={completed} onChange={(event) => setCompleted(event.target.checked)} />I confirm that the installation was completed and I received the handover information.</label><label className="flex gap-3"><input type="checkbox" checked={terms} onChange={(event) => setTerms(event.target.checked)} />I have read and accept the <a href="/p/terms" target="_blank" rel="noreferrer" className="font-bold text-[#7a0000] underline">Solar Installation Terms & Conditions</a>.</label><button type="button" disabled={!completed || !terms || saved} onClick={() => void save()} className="rounded-xl border border-[#7a0000] px-4 py-2.5 font-black text-[#7a0000] disabled:opacity-40">{saved ? "CONFIRMATION SAVED" : "CONFIRM COMPLETION"}</button>{error ? <p className="text-[#b42318]">{error}</p> : null}</div></section>;
}
