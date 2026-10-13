"use client";

import { useState } from "react";

type CustomerSmsComposerProps = {
  customerName?: string | null;
  customerPhone?: string | null;
  entityType?: string;
  entityId?: string;
  reference?: string | null;
  label?: string;
  className?: string;
};

const MAX_MESSAGE_LENGTH = 1000;

export default function CustomerSmsComposer({
  customerName,
  customerPhone,
  entityType,
  entityId,
  reference,
  label = "Send SMS",
  className = "",
}: CustomerSmsComposerProps) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState(customerPhone || "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const openComposer = () => {
    setPhone(customerPhone || "");
    setMessage("");
    setNotice("");
    setOpen(true);
  };

  const send = async () => {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/customer-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          phone,
          message,
          entityType,
          entityId,
          reference,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "SMS could not be sent.");
      setNotice(`Sent to ${payload.phone || phone}. Africa's Talking accepted the message.`);
      setMessage("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "SMS could not be sent.");
    } finally {
      setBusy(false);
    }
  };

  return <>
    <button type="button" onClick={(event) => { event.stopPropagation(); openComposer(); }} className={className}>
      {label}
    </button>
    {open ? <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4" role="dialog" aria-modal="true" aria-label="Send customer SMS">
      <div className="w-full max-w-lg rounded-2xl border border-cyan-400/25 bg-[#081321] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-bold text-white">Send customer SMS</h2><p className="mt-1 text-sm text-slate-400">Compose a personalised message. It will be sent through Africa&apos;s Talking and recorded in the activity log.</p></div><button type="button" onClick={() => setOpen(false)} className="rounded-lg px-2 py-1 text-slate-300 hover:bg-white/10">Close</button></div>
        <label className="mt-4 block text-sm font-medium text-slate-200">Customer phone<input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="0717 241 877" className="mt-1 w-full rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-400" /></label>
        <label className="mt-3 block text-sm font-medium text-slate-200">Message<textarea value={message} onChange={(event) => setMessage(event.target.value.slice(0, MAX_MESSAGE_LENGTH))} placeholder={customerName ? `Hello ${customerName},` : "Type your message"} rows={7} className="mt-1 w-full resize-y rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-400" /></label>
        <div className="mt-1 text-right text-xs text-slate-500">{message.length}/{MAX_MESSAGE_LENGTH}</div>
        {notice ? <p role="status" className="mt-3 rounded-lg border border-cyan-400/20 bg-cyan-400/10 p-3 text-sm text-cyan-100">{notice}</p> : null}
        <div className="mt-4 flex justify-end gap-3"><button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white">Cancel</button><button type="button" disabled={busy || !phone.trim() || !message.trim()} onClick={() => void send()} className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Sending..." : "Send SMS"}</button></div>
      </div>
    </div> : null}
  </>;
}
