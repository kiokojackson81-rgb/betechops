"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ComplaintReplyForm({ reference }: { reference: string }) {
  const router = useRouter(); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  return <form onSubmit={async (event) => { event.preventDefault(); setBusy(true); setError(""); const response = await fetch(`/api/shop/complaints/${encodeURIComponent(reference)}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }) }); const data = await response.json(); if (response.ok) { setMessage(""); router.refresh(); } else setError(data.error || "Could not send message."); setBusy(false); }} className="mt-4">
    <textarea rows={4} required value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Add information or reply to the support team" className="w-full rounded-2xl border border-[#7a0000]/15 bg-white px-4 py-3 outline-none focus:border-[#7a0000]/40" />
    {error ? <p className="mt-2 text-sm font-bold text-red-700">{error}</p> : null}<button disabled={busy} className="mt-3 rounded-2xl bg-[#7a0000] px-5 py-3 text-sm font-black text-white disabled:opacity-60">{busy ? "Sending..." : "Send update"}</button>
  </form>;
}
