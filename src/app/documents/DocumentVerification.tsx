"use client";
import { useState } from "react";

export default function DocumentVerification({ kind, token }: { kind: string; token: string }) {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  async function submit(action: "send" | "verify") {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/documents/${encodeURIComponent(kind)}/${encodeURIComponent(token)}/access`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, code }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Please try again.");
      if (result.next) { window.location.assign(result.next); return; }
      setSent(true);
      setMessage(result.message);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Please try again."); }
    finally { setBusy(false); }
  }
  return <main className="min-h-screen bg-[#f7f4ef] px-4 py-12 text-slate-900"><section className="mx-auto max-w-lg rounded-3xl border border-[#7a0000]/15 bg-white p-6 shadow-sm">
    <p className="text-xs font-black tracking-widest text-[#7a0000]">BETECH SOLAR SOLUTIONS</p>
    <h1 className="mt-4 text-2xl font-bold">Verify to view your documents</h1>
    <p className="mt-3 text-sm text-slate-600">For your privacy, links require verification after 24 hours. We will send a code to the customer phone saved on your receipt.</p>
    <button disabled={busy} onClick={() => submit("send")} className="mt-5 rounded-xl border border-[#7a0000]/30 px-5 py-3 font-bold text-[#7a0000] disabled:opacity-50">{sent ? "Resend code" : "Send verification code"}</button>
    <form className="mt-5" onSubmit={event => { event.preventDefault(); void submit("verify"); }}>
      <label htmlFor="document-code" className="block text-sm font-bold">6-digit verification code</label>
      <input id="document-code" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ""))} className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-lg tracking-widest" />
      <button disabled={busy} className="mt-4 w-full rounded-xl bg-[#7a0000] px-5 py-3 font-bold text-white disabled:opacity-50">{busy ? "Please wait…" : "Verify and open documents"}</button>
    </form>
    <p role="status" className="mt-4 text-sm">{message}</p>
    <p className="mt-4 text-xs text-slate-500">Codes expire in 5 minutes. Verification gives this browser access for 24 hours.</p>
    <a href="https://wa.me/254722151083" className="mt-5 inline-block text-sm font-bold text-[#7a0000]">Need help? Contact Customer Care</a>
  </section></main>;
}
