"use client";
import { useState } from "react";

type Recipient = { name: string; phone: string; message: string | null; ready?: boolean };
type SmsState = { technician: Recipient | null; customer: Recipient | null; error: string | null; history: Array<{ id: string; recipientName: string; phone: string; kind: string; status: string; error: string | null; createdAt: string; message: string }> };

export default function ProjectSmsPanel({ receiptId }: { receiptId: string }) {
  const [data, setData] = useState<SmsState | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const endpoint = `/api/receipts/${encodeURIComponent(receiptId)}/commissioning/sms`;
  async function load() {
    const response = await fetch(endpoint, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Unable to load SMS details.");
    setData(payload);
  }
  async function open() { setBusy(true); setMessage(""); try { await load(); } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to load SMS details."); } finally { setBusy(false); } }
  async function send(action: "technician" | "customer" | "prepare") {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const payload = await response.json();
      await load();
      if (!response.ok) throw new Error(payload.error || "SMS could not be sent.");
      setMessage(action === "prepare" ? "Documents prepared. Review the message below and send." : "SMS accepted by the provider. See SMS history below.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to send SMS."); }
    finally { setBusy(false); }
  }
  return <section className="mt-4 space-y-3 rounded-xl border border-cyan-400/20 p-4 text-sm text-slate-200">
    <button type="button" disabled={busy} onClick={() => void open()} className="rounded-lg border border-cyan-300/40 px-3 py-2 font-bold text-cyan-100 disabled:opacity-40">SMS links, previews &amp; history</button>
    {message ? <p role="status">{message}</p> : null}
    {data?.error ? <p role="alert" className="rounded-lg bg-amber-950/40 p-3 text-amber-200">Document preparation needs attention: {data.error}</p> : null}
    {(["technician", "customer"] as const).map(kind => {
      const recipient = data?.[kind];
      if (!recipient) return null;
      return <article key={kind} className="space-y-3 rounded-xl bg-slate-950 p-4"><h3 className="font-bold">{kind === "technician" ? "Technician commissioning link" : "Customer project documents"}</h3><p>To: {recipient.name}<br />Mobile: {recipient.phone || "No phone number saved"}</p>{recipient.message ? <p className="break-words rounded-lg border border-white/10 p-3 leading-6">{recipient.message}</p> : null}{kind === "customer" && !recipient.ready ? <button disabled={busy} type="button" onClick={() => void send("prepare")} className="rounded-lg bg-amber-300 px-3 py-2 font-bold text-slate-950">Prepare / retry customer documents</button> : <button type="button" disabled={busy || !recipient.phone || !recipient.message} onClick={() => void send(kind)} className="rounded-lg bg-cyan-300 px-3 py-2 font-bold text-slate-950 disabled:opacity-40">Send / Resend {kind === "technician" ? "Technician Link SMS" : "Customer Documents SMS"}</button>}</article>;
    })}
    {data ? <details><summary className="cursor-pointer font-bold">SMS history ({data.history.length})</summary><p className="mt-2 text-xs text-slate-400">SENT means accepted by the SMS provider; handset delivery is not confirmed. SENDING may need investigation before resending.</p><div className="mt-3 space-y-2">{data.history.map(log => <details key={log.id} className="rounded-lg bg-slate-950 p-3"><summary className="cursor-pointer">{log.recipientName} · {log.phone || "Missing phone"} · {log.status}<span className="block text-xs text-slate-400">{new Date(log.createdAt).toLocaleString()}</span></summary><p className="mt-2 break-words text-xs leading-5">{log.message}</p>{log.error ? <p className="mt-2 text-xs text-amber-200">{log.error}</p> : null}</details>)}</div></details> : null}
  </section>;
}
