"use client";

import { useState } from "react";
import { commissioningEquipmentUnits } from "@/lib/commissioningEquipment";
import ProjectSmsPanel from "./ProjectSmsPanel";

type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue => value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {};
const fieldClass = "w-full rounded-lg border border-white/20 bg-slate-950 p-2 text-sm text-white";

export default function CertificateReviewPanel({ receiptId, showSms = true, onCertified }: { receiptId: string; showSms?: boolean; onCertified?: () => void }) {
  const [review, setReview] = useState<RecordValue | null>(null);
  const [warranty, setWarranty] = useState<RecordValue | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [correctionStep, setCorrectionStep] = useState("review");
  const [warrantyEdits, setWarrantyEdits] = useState<Record<number, string>>({});
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [replacement, setReplacement] = useState({ index: 0, brand: "", modelCapacity: "", serialNumbers: "", replacementDate: "", claimReference: "" });
  const base = `/api/receipts/${encodeURIComponent(receiptId)}`;
  async function load() {
    setBusy(true);
    setMessage("");
    try {
      const responses = await Promise.all([fetch(`${base}/commissioning/review`), fetch(`${base}/warranty`)]);
      const payloads = await Promise.all(responses.map(response => response.json()));
      responses.forEach((response, index) => { if (!response.ok) throw new Error(payloads[index].error || "Unable to load certificate details."); });
      setReview(payloads[0]); setWarranty(payloads[1]);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to load review."); }
    finally { setBusy(false); }
  }
  async function act(path: string, body: RecordValue) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`${base}/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "The action could not be completed.");
      setWarrantyEdits({});
      await load();
      if (payload.status === "ISSUED") onCertified?.();
      setMessage(record(payload.delivery).error ? String(record(payload.delivery).error) : record(payload.warranty).error ? String(record(payload.warranty).error) : "Saved successfully.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save."); }
    finally { setBusy(false); }
  }
  const session = record(review?.session);
  const data = record(session.data);
  const certificates = Array.isArray(warranty?.certificates) ? warranty.certificates.map(record) : [];
  const issued = certificates.find(certificate => certificate.status === "ISSUED");
  const readiness = record(warranty?.readiness);
  const snapshot = record(issued?.data || readiness.snapshot);
  const warrantyEquipment = Array.isArray(snapshot.equipment) ? snapshot.equipment.map(record) : [];
  const warnings = Array.isArray(readiness.warnings) ? readiness.warnings.map(String) : [];
  return <section className="mt-4 space-y-4 rounded-xl border border-cyan-400/20 p-4 text-sm text-slate-200">
    <button type="button" disabled={busy} onClick={() => void load()} className="rounded-lg bg-cyan-300 px-4 py-2 font-bold text-slate-950 disabled:opacity-50">{busy ? "Loading…" : "Professional review & warranty documents"}</button>
    {message ? <p role="status" className="rounded-lg bg-slate-950 p-3">{message}</p> : null}
    {review ? <>
      <h3 className="font-bold">Professional review — {String(session.status || "") .replaceAll("_", " ")}</h3>
      <p>Installed by: {String(data.installerName || record(session.technician).name || "Installer / agent")}<br />Customer: {String(record(session.project).customerName || "")}<br />Location: {String(record(session.project).location || "")}</p>
      <p>{["PASS", "N/A", "FAIL"].map(status => `${Object.values(record(data.checklist)).filter(value => value === status).length} ${status}`).join(" · ")}</p>
      <div className="grid gap-3 sm:grid-cols-2">{["equipment", "checklist", "measurements", "handover", "confirmations"].map(section => <details key={section} className="rounded-lg bg-slate-950 p-3" open={section === "checklist"}><summary className="cursor-pointer font-bold capitalize">{section}</summary><dl className="mt-2 space-y-1">{Object.entries(record(data[section])).map(([key, value]) => <div key={key} className="flex flex-wrap justify-between gap-2"><dt>{key}</dt><dd className="break-all font-semibold">{String(value)}</dd></div>)}</dl></details>)}</div>
      <details className="rounded-lg bg-slate-950 p-3"><summary className="cursor-pointer font-bold">View all installation evidence</summary><div className="mt-3 grid gap-3 sm:grid-cols-2">{Object.entries(record(data.evidence)).flatMap(([key, items]) => Array.isArray(items) ? items.map((item, index) => { const evidence = record(item); const url = String(evidence.url || ""); return /^https:\/\//.test(url) ? <a key={`${key}-${index}`} href={url} target="_blank" rel="noreferrer" className="rounded-lg border border-white/15 p-3 text-cyan-200 underline">{key} — {String(evidence.fileName || `Photo ${index + 1}`)}</a> : null; }) : [])}</div></details>
      <p>Customer terms: {record(data.termsAcceptance).accepted === true ? "Accepted" : "Incomplete"} · Customer signature: {record(data.signatures).customer ? "Captured" : "Missing"} · Technician signature: {record(data.signatures).technician ? "Captured" : "Missing"}</p>
      <label className="block">Review / correction / warranty change reason<textarea className={`${fieldClass} mt-2`} maxLength={1200} value={reason} onChange={event => setReason(event.target.value)} /></label>
      {session.status === "AWAITING_PROFESSIONAL_REVIEW" ? <label className="block">Correction step<select className={`${fieldClass} mt-2`} value={correctionStep} onChange={event => setCorrectionStep(event.target.value)}>{["panels", "array", "inverter", "battery", "final-photos", "commissioning", "handover", "review"].map(step => <option key={step} value={step}>{step.replaceAll("-", " ")}</option>)}</select></label> : null}
      {session.status === "AWAITING_PROFESSIONAL_REVIEW" ? <div className="flex flex-wrap gap-2"><button disabled={busy} onClick={() => void act("commissioning/review", { action: "approve" })} className="rounded-lg bg-emerald-300 px-3 py-2 font-bold text-slate-950">Approve &amp; Certify</button><button disabled={busy || !reason.trim()} onClick={() => void act("commissioning/review", { action: "return", reason, step: correctionStep })} className="rounded-lg border border-amber-300 px-3 py-2">Return to Technician</button></div> : null}
      {showSms ? <ProjectSmsPanel receiptId={receiptId} /> : null}
      {commissioningEquipmentUnits(data).map(unit => <div key={unit.id} className="rounded-lg bg-slate-950 p-3"><p>{unit.kind}: {unit.brand} {unit.model} · Serial: {unit.serial || "Missing"} · Warranty: {unit.warrantyYears} years</p>{unit.labelPhotos?.map(photo => <a key={photo.url} href={photo.url} target="_blank" rel="noreferrer" className="mr-3 text-cyan-200 underline">Equipment photo</a>)}</div>)}
      <h3 className="border-t border-white/10 pt-4 font-bold">Warranty certificate</h3>
      {warnings.length ? <ul className="list-disc space-y-1 pl-5 text-amber-200">{warnings.map(warning => <li key={warning}>{warning}</li>)}</ul> : null}
      {warrantyEquipment.length ? <div className="space-y-3"><p>Adjust warranty periods before generating or reissuing. Reissue preserves the original PDF and requires a reason.</p>{warrantyEquipment.map((unit, index) => <label key={index} className="block">{String(unit.equipment)} · {String(unit.serialNumbers)} — Warranty (years)<input className={fieldClass} type="number" min="0.0833333333" max="50" step="any" value={warrantyEdits[index] ?? String(unit.warrantyYears)} onChange={event => setWarrantyEdits(current => ({ ...current, [index]: event.target.value }))} /></label>)}</div> : null}
      {readiness.ready === true ? <div className="flex flex-wrap gap-2"><a href={`${base}/warranty?preview=1`} target="_blank" rel="noreferrer" className="rounded-lg border border-white/20 px-3 py-2">Preview current warranty (before edits)</a><button disabled={busy || Boolean(issued && !reason.trim())} onClick={() => void act("warranty", { action: issued ? "reissue" : "generate", warrantyYears: warrantyEquipment.map((unit, index) => Number(warrantyEdits[index] ?? unit.warrantyYears)), ...(issued ? { reason } : {}) })} className="rounded-lg bg-emerald-300 px-3 py-2 font-bold text-slate-950">{issued ? "Reissue Warranty Certificate" : "Generate Warranty Certificate"}</button></div> : null}
      {issued ? <>
        <p>{String(issued.certificateNo)} · {String(issued.coverageStatus || "ACTIVE").replaceAll("_", " ")}</p>
        <div className="flex flex-wrap gap-3"><a className="text-cyan-200 underline" href={`${base}/warranty/download`}>Download Warranty Certificate</a></div>
        <label className="block">Warranty status<select className={`${fieldClass} mt-2`} value={status} onChange={event => setStatus(event.target.value)}>{["ACTIVE", "EXPIRED", "VOID", "REPLACED", "UNDER_CLAIM"].map(value => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label>
        <button disabled={busy || !reason.trim()} onClick={() => void act("warranty", { action: "status", status, reason })} className="rounded-lg border border-white/20 px-3 py-2 disabled:opacity-40">Update live status</button>
        <details className="rounded-lg bg-slate-950 p-3"><summary className="cursor-pointer font-bold">Record equipment replacement</summary><div className="mt-3 grid gap-3 sm:grid-cols-2"><label>Equipment<select className={fieldClass} value={replacement.index} onChange={event => setReplacement(current => ({ ...current, index: Number(event.target.value) }))}>{warrantyEquipment.map((unit, index) => <option key={index} value={index}>{String(unit.equipment)} - {String(unit.serialNumbers)}</option>)}</select></label>{([['Brand', 'brand'], ['Model / Capacity', 'modelCapacity'], ['Replacement serial number(s)', 'serialNumbers'], ['Replacement date', 'replacementDate'], ['Warranty claim reference', 'claimReference']] as const).map(([label, key]) => <label key={key}>{label}<input type={key === "replacementDate" ? "date" : "text"} className={fieldClass} value={replacement[key]} onChange={event => setReplacement(current => ({ ...current, [key]: event.target.value }))} /></label>)}</div><button disabled={busy || !reason.trim()} onClick={() => void act("warranty", { action: "replace", replacement, reason })} className="mt-3 rounded-lg border border-white/20 px-3 py-2 disabled:opacity-40">Save replacement history</button></details>
      </> : null}
      <details><summary className="cursor-pointer font-bold">View Warranty History ({certificates.length} versions)</summary><div className="mt-3 space-y-3">{certificates.map(certificate => <article key={String(certificate.id)} className="rounded-lg bg-slate-950 p-3"><p>{String(certificate.certificateNo)} · {String(certificate.status)}</p><a href={String(certificate.pdfUrl)} target="_blank" rel="noreferrer" className="text-cyan-200 underline">Stored issued PDF</a>{Array.isArray(certificate.history) ? certificate.history.map(entry => { const event = record(entry); return <p key={String(event.id)} className="mt-2 text-xs">{String(event.createdAt)} · {String(event.action)} · {String(event.reason)}</p>; }) : null}</article>)}</div></details>
    </> : null}
  </section>;
}
