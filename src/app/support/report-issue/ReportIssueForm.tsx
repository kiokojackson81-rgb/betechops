"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, FileUp, Send, ShieldCheck } from "lucide-react";
import { COMPLAINT_CATEGORIES, complaintCategoryLabels } from "@/lib/complaintsShared";

type OrderOption = { routeId: string; orderRef: string; source: string; createdAt: string; itemPreview: Array<{ productName: string }> };

export default function ReportIssueForm({ orders }: { orders: OrderOption[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [duplicate, setDuplicate] = useState<{ reference: string; title: string } | null>(null);
  const [payload, setPayload] = useState({ category: "PRODUCT_NOT_WORKING", title: "", description: "", problemStartedAt: "", systemStatus: "UNKNOWN", errorCode: "", relatedRecordId: "" });
  const [files, setFiles] = useState<File[]>([]);

  async function submit(forceDuplicate = false) {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/shop/complaints", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, forceDuplicate }) });
      const data = await response.json();
      if (response.status === 409 && data.duplicate) { setDuplicate(data.duplicate); return; }
      if (!response.ok) throw new Error(data.error || "Could not submit your complaint.");
      const reference = data.complaint.reference as string;
      for (const file of files) {
        const form = new FormData(); form.append("file", file);
        const upload = await fetch(`/api/shop/complaints/${encodeURIComponent(reference)}/attachments`, { method: "POST", body: form });
        if (!upload.ok) { const uploadData = await upload.json(); throw new Error(`${file.name}: ${uploadData.error || "upload failed"}`); }
      }
      router.push(`/account/complaints/${encodeURIComponent(reference)}?created=1`);
      router.refresh();
    } catch (value) { setError(value instanceof Error ? value.message : "Could not submit your complaint."); }
    finally { setBusy(false); }
  }

  const field = "mt-2 w-full rounded-2xl border border-[#7a0000]/15 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-[#7a0000]/45 focus:ring-4 focus:ring-[#7a0000]/5";
  return (
    <form onSubmit={(event) => { event.preventDefault(); void submit(false); }} className="grid gap-5 lg:grid-cols-2">
      <label className="text-sm font-bold text-slate-800">Issue category
        <select value={payload.category} onChange={(event) => setPayload({ ...payload, category: event.target.value })} className={field}>
          {COMPLAINT_CATEGORIES.map((category) => <option key={category} value={category}>{complaintCategoryLabels[category]}</option>)}
        </select>
      </label>
      <label className="text-sm font-bold text-slate-800">Related order, project or receipt
        <select value={payload.relatedRecordId} onChange={(event) => setPayload({ ...payload, relatedRecordId: event.target.value })} className={field}>
          <option value="">Not linked to a transaction</option>
          {orders.map((order) => <option key={order.routeId} value={order.routeId}>{order.orderRef} · {order.itemPreview[0]?.productName || order.source}</option>)}
        </select>
      </label>
      <label className="text-sm font-bold text-slate-800 lg:col-span-2">Short issue title
        <input value={payload.title} onChange={(event) => setPayload({ ...payload, title: event.target.value })} maxLength={140} required placeholder="Example: Inverter switches off during daytime" className={field} />
      </label>
      <label className="text-sm font-bold text-slate-800 lg:col-span-2">Describe what happened
        <textarea value={payload.description} onChange={(event) => setPayload({ ...payload, description: event.target.value })} minLength={20} maxLength={5000} required rows={6} placeholder="Include what you expected, what happened, and troubleshooting already attempted." className={field} />
      </label>
      <label className="text-sm font-bold text-slate-800">When did the problem start?
        <input type="date" value={payload.problemStartedAt} onChange={(event) => setPayload({ ...payload, problemStartedAt: event.target.value })} className={field} />
      </label>
      <label className="text-sm font-bold text-slate-800">Current product/system status
        <select value={payload.systemStatus} onChange={(event) => setPayload({ ...payload, systemStatus: event.target.value })} className={field}>
          <option value="NOT_WORKING">Not working</option><option value="INTERMITTENT">Works intermittently</option><option value="DEGRADED">Working with reduced performance</option><option value="UNKNOWN">Not sure</option>
        </select>
      </label>
      <label className="text-sm font-bold text-slate-800">Error code (optional)
        <input value={payload.errorCode} onChange={(event) => setPayload({ ...payload, errorCode: event.target.value })} maxLength={120} placeholder="Code shown on equipment" className={field} />
      </label>
      <label className="text-sm font-bold text-slate-800">Photos, video or documents (up to 5)
        <span className={`${field} flex cursor-pointer items-center gap-3`}><FileUp className="h-5 w-5 text-[#7a0000]" />{files.length ? `${files.length} file(s) selected` : "Choose evidence"}<input className="sr-only" type="file" multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,application/pdf,.doc,.docx" onChange={(event) => setFiles(Array.from(event.target.files || []).slice(0, 5))} /></span>
      </label>
      {duplicate ? <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 lg:col-span-2"><div className="flex gap-3"><AlertTriangle className="h-5 w-5 shrink-0 text-amber-700" /><div><div className="font-black text-amber-950">A similar open case already exists</div><p className="mt-1 text-sm text-amber-900">{duplicate.reference}: {duplicate.title}</p><div className="mt-3 flex flex-wrap gap-2"><a href={`/account/complaints/${duplicate.reference}`} className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-amber-950">Open existing case</a><button type="button" onClick={() => void submit(true)} className="rounded-xl bg-amber-800 px-4 py-2 text-sm font-bold text-white">Submit another case</button></div></div></div></div> : null}
      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800 lg:col-span-2">{error}</div> : null}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#fff8ea] p-4 lg:col-span-2"><div className="flex max-w-xl gap-3 text-sm text-slate-700"><ShieldCheck className="h-5 w-5 shrink-0 text-[#0f9d58]" /><span>Your case is linked securely to your account. Only authorized Betech staff can access internal handling notes.</span></div><button disabled={busy} className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-[#7a0000] px-6 py-3 font-black text-white disabled:opacity-60"><Send className="h-4 w-4" />{busy ? "Submitting..." : "Submit complaint"}</button></div>
    </form>
  );
}
