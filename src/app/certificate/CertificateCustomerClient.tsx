"use client";

import { useEffect, useState } from "react";

type Certificate = {
  certificateNo: string | null;
  issuedAt: string | null;
  technicianName: string;
  project: { reference: string; customerName: string; location: string; system: string };
  acknowledgedAt: string | null;
  termsAcceptedAt: string | null;
};

export default function CertificateCustomerClient({ token }: { token: string }) {
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [completed, setCompleted] = useState(false);
  const [terms, setTerms] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch(`/api/certificate/${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || "Certificate unavailable.");
        setCertificate(body);
        setCompleted(Boolean(body.acknowledgedAt));
        setTerms(Boolean(body.termsAcceptedAt));
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Certificate unavailable."));
  }, [token]);

  const acknowledge = async () => {
    setSaving(true); setMessage("");
    try {
      const response = await fetch(`/api/certificate/${encodeURIComponent(token)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ installationCompleted: completed, termsAccepted: terms }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Confirmation could not be saved.");
      setMessage("Thank you — your installation completion and terms acknowledgement have been recorded.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Confirmation could not be saved."); }
    finally { setSaving(false); }
  };

  if (!certificate) return <main className="min-h-screen bg-slate-950 p-6 text-white"><div className="mx-auto max-w-xl rounded-3xl bg-slate-900 p-6">{message || "Loading certificate…"}</div></main>;
  const download = `/api/certificate/${encodeURIComponent(token)}/download`;
  return <main className="min-h-screen bg-[#f7f4ef] p-4 text-slate-900"><article className="mx-auto max-w-xl rounded-3xl border border-[#7a0000]/15 bg-white p-6 shadow-sm"><div className="border-b border-[#7a0000]/15 pb-5"><p className="text-xs font-black tracking-[.2em] text-[#7a0000]">BETECH SOLAR SOLUTIONS</p><h1 className="mt-3 text-2xl font-black">Completion certificate ready</h1><p className="mt-2 text-sm text-slate-600">Your Solar PV Completion & Commissioning Certificate is ready to download.</p></div><dl className="mt-6 space-y-3 text-sm"><div><dt className="text-slate-500">Certificate</dt><dd className="font-black">{certificate.certificateNo}</dd></div><div><dt className="text-slate-500">Project</dt><dd className="font-bold">{certificate.project.reference}</dd></div><div><dt className="text-slate-500">Installation</dt><dd className="font-bold">{certificate.project.system}</dd></div><div><dt className="text-slate-500">Location</dt><dd className="font-bold">{certificate.project.location}</dd></div><div><dt className="text-slate-500">Technician</dt><dd className="font-bold">{certificate.technicianName}</dd></div></dl><a href={download} className="mt-6 block rounded-2xl bg-[#7a0000] px-5 py-4 text-center font-black text-white">DOWNLOAD CERTIFICATE (PDF)</a><section className="mt-6 rounded-2xl bg-[#fff7e8] p-4"><h2 className="font-black text-[#7a0000]">Installation completion acknowledgement</h2><label className="mt-4 flex gap-3 text-sm leading-6"><input type="checkbox" checked={completed} onChange={(event) => setCompleted(event.target.checked)} />I confirm that the installation was completed and I received the handover information.</label><label className="mt-4 flex gap-3 text-sm leading-6"><input type="checkbox" checked={terms} onChange={(event) => setTerms(event.target.checked)} />I have read and accept the <a className="font-bold text-[#7a0000] underline" href="/p/terms" target="_blank" rel="noreferrer">Solar Installation Terms & Conditions</a>.</label><button type="button" disabled={!completed || !terms || saving} onClick={() => void acknowledge()} className="mt-5 w-full rounded-xl border border-[#7a0000] px-4 py-3 font-black text-[#7a0000] disabled:opacity-40">{saving ? "Saving…" : "CONFIRM COMPLETION"}</button>{message ? <p className="mt-3 text-sm text-[#0f6b43]">{message}</p> : null}</section><p className="mt-6 text-xs leading-5 text-slate-500">Keep this certificate for your warranty and service records. It is also available whenever you sign in to your Betech account.</p></article></main>;
}
