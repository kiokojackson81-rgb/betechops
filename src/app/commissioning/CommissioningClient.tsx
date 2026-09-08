"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Evidence = { url: string; fileName?: string; capturedAt?: string };
type Draft = {
  evidence?: Record<string, Evidence[]>;
  equipment?: Record<string, string>;
  checklist?: Record<string, string>;
  measurements?: Record<string, string>;
  handover?: Record<string, boolean>;
  signatures?: Record<string, string>;
  [key: string]: unknown;
};
type Session = {
  status: "DRAFT" | "ISSUED";
  readOnly: boolean;
  expiresAt: string;
  lastAccessedAt: string | null;
  lastStep: string;
  progress: number;
  issuedAt: string | null;
  certificateNo: string | null;
  technicianName: string;
  project: { reference: string; customerName: string; location: string; system: string; expectedItems: string[] };
  data: Draft;
};

const checks = [
  "Inverter powers ON", "PV charging detected", "Battery charging", "Battery discharging",
  "Grid input detected", "Backup/changeover tested", "Protection devices installed", "Earthing connected",
  "Monitoring configured", "Customer training completed",
] as const;
const evidenceFields = [
  ["panelLabel", "Step 1 · Panel label", "Take a clear photo of one panel manufacturer's label."],
  ["panelArray", "Step 2 · Panel array", "Show the completed panel installation."],
  ["inverterLabel", "Step 3 · Inverter label", "Capture the inverter identity label."],
  ["inverterInstallation", "Step 3 · Inverter installation", "Show the inverter installed in position."],
  ["batteryLabel", "Step 4 · Battery label", "Capture the battery label and serial number."],
  ["batteryInstallation", "Step 4 · Battery installation", "Show the battery installed in position."],
  ["protection", "Step 5 · Protection / DB", "Show protection, DB or combiner equipment."],
  ["overall", "Step 5 · Completed setup", "Show the completed overall installation."],
] as const;

const initialDraft: Draft = { evidence: {}, equipment: {}, checklist: {}, measurements: {}, handover: {}, signatures: {} };
const inputClass = "mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-base text-white outline-none focus:border-cyan-400";

export default function CommissioningClient({ token }: { token: string }) {
  const [session, setSession] = useState<Session | null>(null);
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [lastStep, setLastStep] = useState("panel-identification");
  const [saveState, setSaveState] = useState<"loading" | "saved" | "saving" | "offline" | "error">("loading");
  const [error, setError] = useState("");
  const loaded = useRef(false);
  const cacheKey = `betech-commissioning-draft:${token}`;

  const progress = useMemo(() => {
    const evidence = draft.evidence || {};
    const evidenceDone = evidenceFields.filter(([key]) => Array.isArray(evidence[key]) && evidence[key].length > 0).length;
    const checklistDone = Object.keys(draft.checklist || {}).length;
    const signatureDone = Number(Boolean(draft.signatures?.customer)) + Number(Boolean(draft.signatures?.technician));
    return Math.min(99, Math.round(((evidenceDone / 8) * 45) + ((checklistDone / checks.length) * 35) + ((signatureDone / 2) * 20)));
  }, [draft]);

  useEffect(() => {
    let active = true;
    fetch(`/api/commissioning/${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || "Unable to open commissioning session.");
        return body.session as Session;
      })
      .then((next) => {
        if (!active) return;
        let cached: Draft = {};
        try { cached = JSON.parse(localStorage.getItem(cacheKey) || "{}"); } catch { /* ignore an invalid local fallback */ }
        setSession(next);
        setDraft({ ...initialDraft, ...next.data, ...cached, evidence: { ...(next.data?.evidence || {}), ...(cached.evidence || {}) } });
        setLastStep(next.lastStep);
        setSaveState(next.readOnly ? "saved" : "saved");
        loaded.current = true;
      })
      .catch((cause) => { if (active) { setError(cause instanceof Error ? cause.message : "Unable to open this link."); setSaveState("error"); } });
    return () => { active = false; };
  }, [cacheKey, token]);

  useEffect(() => {
    if (!loaded.current || session?.readOnly) return;
    localStorage.setItem(cacheKey, JSON.stringify(draft));
    if (!navigator.onLine) { setSaveState("offline"); return; }
    setSaveState("saving");
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/commissioning/${encodeURIComponent(token)}`, {
          method: "PATCH", headers: { "content-type": "application/json" },
          body: JSON.stringify({ data: draft, lastStep, progress }),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || "Draft could not be saved.");
        setSaveState("saved");
      } catch {
        setSaveState(navigator.onLine ? "error" : "offline");
      }
    }, 650);
    return () => window.clearTimeout(timer);
  }, [cacheKey, draft, lastStep, progress, session?.readOnly, token]);

  const patch = (section: string, key: string, value: unknown, step = section) => {
    setLastStep(step);
    setDraft((current) => ({ ...current, [section]: { ...((current[section] as Record<string, unknown>) || {}), [key]: value } }));
  };

  const addEvidence = (key: string, item: Evidence) => {
    setLastStep(key);
    setDraft((current) => ({ ...current, evidence: { ...(current.evidence || {}), [key]: [...(current.evidence?.[key] || []), item] } }));
  };

  const issue = async () => {
    if (!confirm("Issue the completion certificate? This locks the commissioning record.")) return;
    setError("");
    setSaveState("saving");
    try {
      await fetch(`/api/commissioning/${encodeURIComponent(token)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ data: draft, lastStep: "final-review", progress: 99 }) });
      const response = await fetch(`/api/commissioning/${encodeURIComponent(token)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "issue" }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Certificate could not be issued.");
      setSession((current) => current ? { ...current, status: "ISSUED", readOnly: true, progress: 100, certificateNo: body.certificateNo, issuedAt: body.issuedAt } : current);
      localStorage.removeItem(cacheKey);
      setSaveState("saved");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Certificate could not be issued."); setSaveState("error"); }
  };

  if (error && !session) return <main className="min-h-screen bg-slate-950 p-6 text-white"><div className="mx-auto max-w-lg rounded-3xl border border-rose-500/40 bg-rose-500/10 p-6">{error}</div></main>;
  if (!session) return <main className="min-h-screen bg-slate-950 p-6 text-white">Loading commissioning…</main>;
  if (session.readOnly) return <IssuedView session={session} draft={draft} />;

  return <main className="min-h-screen bg-slate-950 pb-28 text-slate-100">
    <header className="border-b border-cyan-400/20 bg-[#081522] px-4 py-5"><div className="mx-auto max-w-xl">
      <p className="text-xs font-black tracking-[.2em] text-cyan-300">BETECH SOLAR SOLUTIONS</p><h1 className="mt-2 text-2xl font-black">Commissioning</h1>
      <p className="mt-1 text-slate-300">{session.project.customerName} · {session.project.location}</p><p className="mt-1 text-sm text-slate-400">{session.project.system}</p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-cyan-400" style={{ width: `${progress}%` }} /></div>
      <div className="mt-2 flex justify-between text-xs text-slate-400"><span>{progress}% complete</span><span>{saveState === "saved" ? "✓ Saved just now" : saveState === "saving" ? "Saving…" : saveState === "offline" ? "Offline — saved on this phone" : "Save needs attention"}</span></div>
    </div></header>
    <div className="mx-auto max-w-xl space-y-5 p-4">
      <section className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4"><b>Continue where you stopped</b><p className="mt-1 text-sm text-slate-300">Everything is tied to this project and saves automatically. You can safely return with this same link on another phone.</p></section>
      {session.project.expectedItems.length ? <section className="rounded-2xl bg-slate-900 p-4"><b>Expected from project</b><ul className="mt-2 space-y-1 text-sm text-slate-300">{session.project.expectedItems.map((item) => <li key={item}>• {item}</li>)}</ul></section> : null}
      {evidenceFields.map(([key, title, note]) => <EvidenceCard key={key} title={title} note={note} items={draft.evidence?.[key] || []} token={token} onUploaded={(item) => addEvidence(key, item)} />)}
      <section className="rounded-2xl bg-slate-900 p-4"><h2 className="text-lg font-bold">Equipment confirmation</h2><p className="mt-1 text-sm text-slate-400">Confirm scanned label details or enter corrections only when needed.</p>
        <div className="mt-4 grid gap-3"><label>Panel brand / model<input className={inputClass} value={draft.equipment?.panel || ""} onChange={(e) => patch("equipment", "panel", e.target.value, "panel-confirmation")} /></label><label>Inverter model / serial<input className={inputClass} value={draft.equipment?.inverter || ""} onChange={(e) => patch("equipment", "inverter", e.target.value, "inverter-confirmation")} /></label><label>Battery model / serial<input className={inputClass} value={draft.equipment?.battery || ""} onChange={(e) => patch("equipment", "battery", e.target.value, "battery-confirmation")} /></label></div>
      </section>
      <section className="rounded-2xl bg-slate-900 p-4"><h2 className="text-lg font-bold">Commissioning checklist</h2><div className="mt-4 space-y-4">{checks.map((check) => <div key={check}><b className="text-sm">{check}</b><div className="mt-2 grid grid-cols-3 gap-2">{["PASS", "FAIL", "N/A"].map((value) => <button type="button" key={value} onClick={() => patch("checklist", check, value, "checklist")} className={`rounded-xl border px-3 py-3 text-sm font-bold ${draft.checklist?.[check] === value ? "border-cyan-300 bg-cyan-400 text-slate-950" : "border-slate-700 bg-slate-950"}`}>{value}</button>)}</div></div>)}</div></section>
      <section className="rounded-2xl bg-slate-900 p-4"><h2 className="text-lg font-bold">Measurements</h2><div className="mt-3 grid grid-cols-2 gap-3">{[["pvVoltage", "PV Voltage (V)"], ["batteryVoltage", "Battery Voltage (V)"], ["batterySoc", "Battery SOC (%)"], ["acInput", "AC Input (V)"], ["acOutput", "AC Output (V)"], ["load", "Current Load (W)"]].map(([key, label]) => <label key={key} className="text-sm">{label}<input type="number" inputMode="decimal" className={inputClass} value={draft.measurements?.[key] || ""} onChange={(e) => patch("measurements", key, e.target.value, "measurements")} /></label>)}</div></section>
      <section className="rounded-2xl bg-slate-900 p-4"><h2 className="text-lg font-bold">Customer handover & acceptance</h2><div className="mt-3 space-y-2">{["System operation explained", "Shutdown/startup explained", "Monitoring explained", "Warranty explained", "Load limitations explained", "Maintenance/panel cleaning explained", "Fault reporting procedure explained"].map((item) => <label key={item} className="flex gap-3 rounded-xl bg-slate-950 p-3 text-sm"><input type="checkbox" checked={Boolean(draft.handover?.[item])} onChange={(e) => patch("handover", item, e.target.checked, "handover")} />{item}</label>)}</div><label className="mt-4 block">Customer signature / name<input className={inputClass} placeholder="Customer signs or enters full name" value={draft.signatures?.customer || ""} onChange={(e) => patch("signatures", "customer", e.target.value, "signatures")} /></label><label className="mt-3 block">Technician signature / name<input className={inputClass} value={draft.signatures?.technician || session.technicianName} onChange={(e) => patch("signatures", "technician", e.target.value, "signatures")} /></label></section>
      {error ? <p className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p> : null}
    </div>
    <div className="fixed inset-x-0 bottom-0 border-t border-slate-700 bg-slate-950/95 p-3 backdrop-blur"><div className="mx-auto max-w-xl"><button type="button" onClick={() => void issue()} className="w-full rounded-2xl bg-cyan-400 px-5 py-4 text-base font-black text-slate-950">ISSUE COMPLETION CERTIFICATE</button></div></div>
  </main>;
}

function EvidenceCard({ title, note, items, token, onUploaded }: { title: string; note: string; items: Evidence[]; token: string; onUploaded: (item: Evidence) => void }) {
  const [uploading, setUploading] = useState(false); const [error, setError] = useState("");
  const upload = async (file: File) => { setUploading(true); setError(""); try { const form = new FormData(); form.set("file", file); const response = await fetch(`/api/commissioning/${encodeURIComponent(token)}/evidence`, { method: "POST", body: form }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || "Photo upload failed."); onUploaded({ url: body.url, fileName: body.fileName, capturedAt: new Date().toISOString() }); } catch (cause) { setError(cause instanceof Error ? cause.message : "Photo upload failed."); } finally { setUploading(false); } };
  return <section className="rounded-2xl bg-slate-900 p-4"><h2 className="text-lg font-bold">{title}</h2><p className="mt-1 text-sm text-slate-400">{note}</p>{items.length ? <div className="mt-3 space-y-1 text-sm text-emerald-300">✓ {items.length} photo{items.length === 1 ? "" : "s"} saved {items.map((item, index) => <a key={item.url} className="ml-2 underline" href={item.url} target="_blank" rel="noreferrer">View {index + 1}</a>)}</div> : null}<label className="mt-4 block cursor-pointer rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-4 py-4 text-center font-bold text-cyan-100"><input type="file" accept="image/*" capture="environment" className="hidden" disabled={uploading} onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(file); e.currentTarget.value = ""; }} />{uploading ? "Uploading photo…" : items.length ? "+ ADD ANOTHER PHOTO" : "TAKE / CHOOSE PHOTO"}</label>{error ? <p className="mt-2 text-sm text-rose-300">{error}</p> : null}</section>;
}

function IssuedView({ session, draft }: { session: Session; draft: Draft }) {
  const links = Object.values(draft.evidence || {}).flat().filter((item) => Boolean(item?.url));
  return <main className="min-h-screen bg-slate-950 p-4 text-slate-100"><article className="mx-auto max-w-xl space-y-5 rounded-3xl bg-slate-900 p-6"><p className="text-xs font-black tracking-[.2em] text-cyan-300">BETECH SOLAR SOLUTIONS</p><div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4"><h1 className="text-2xl font-black text-emerald-200">Certificate Issued — View Only</h1><p className="mt-2 text-sm text-slate-300">Certificate: {session.certificateNo}</p></div><section><h2 className="font-bold">Solar PV Completion & Commissioning Certificate</h2><dl className="mt-3 space-y-2 text-sm text-slate-300"><div>Project: {session.project.reference}</div><div>Customer: {session.project.customerName}</div><div>Location: {session.project.location}</div><div>Technician: {session.technicianName}</div><div>Issued: {session.issuedAt ? new Date(session.issuedAt).toLocaleString() : "—"}</div></dl></section><section><h2 className="font-bold">Evidence report</h2><p className="mt-2 text-sm text-slate-400">{links.length} evidence photo{links.length === 1 ? "" : "s"} retained with this certificate.</p><div className="mt-3 flex flex-wrap gap-2">{links.map((item, index) => <a key={item.url} href={item.url} target="_blank" rel="noreferrer" className="rounded-lg border border-cyan-400/30 px-3 py-2 text-sm text-cyan-200">Evidence {index + 1}</a>)}</div></section><button type="button" onClick={() => window.print()} className="w-full rounded-xl bg-cyan-400 px-4 py-3 font-black text-slate-950">PRINT / SAVE CERTIFICATE AS PDF</button></article></main>;
}
