"use client";
import { useState } from "react";

export default function ProjectDocuments({ receiptId }: { receiptId: string }) {
  const [documents, setDocuments] = useState<Array<{ label: string; url: string }> | null>(null);
  const [error, setError] = useState("");
  async function load() {
    setError("");
    try {
      const response = await fetch(`/api/receipts/${encodeURIComponent(receiptId)}/documents`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to load documents.");
      setDocuments(payload.documents);
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to load documents."); }
  }
  return <details onToggle={event => { if (event.currentTarget.open) void load(); }} className="relative"><summary className="cursor-pointer rounded-xl border border-cyan-300/40 px-3 py-2 text-xs font-semibold text-cyan-100">Documents</summary><div className="absolute right-0 z-20 mt-2 grid min-w-56 gap-2 rounded-xl border border-white/15 bg-slate-950 p-3 shadow-xl">{error ? <p role="alert" className="text-xs text-amber-200">{error}</p> : documents ? documents.map(document => <a key={document.label} href={document.url} className="rounded-lg px-3 py-2 text-sm text-cyan-100 hover:bg-slate-800">{document.label}</a>) : <p className="text-xs text-slate-300">Loading documents…</p>}</div></details>;
}
