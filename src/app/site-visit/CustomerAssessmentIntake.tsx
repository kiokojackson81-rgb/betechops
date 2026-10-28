"use client";

import { useEffect, useRef, useState } from "react";

type Field = { key: string; label: string; type?: "text" | "number" | "textarea" };
type Props = { token: string; projectFields: readonly Field[]; customerName: string };

const fieldClass = "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-[#7a0000]";

export default function CustomerAssessmentIntake({ token, projectFields, customerName }: Props) {
  const [projectDetails, setProjectDetails] = useState<Record<string, string>>({});
  const [home, setHome] = useState<Record<string, string>>({});
  const [electrical, setElectrical] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("Loading your saved answers…");
  const loaded = useRef(false);

  useEffect(() => {
    void fetch("/api/site-assessment/draft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, action: "load" }) })
      .then(async (response) => ({ response, data: await response.json().catch(() => null) }))
      .then(({ response, data }) => {
        const intake = data?.draft?.customerIntake || data?.draft;
        if (response.ok && intake) {
          setProjectDetails(intake.projectDetails || data?.draft?.projectDetails || {});
          setHome(intake.home || data?.draft?.home || {});
          setElectrical(intake.electrical || data?.draft?.electrical || {});
          setNotes(intake.notes || "");
        }
        loaded.current = true;
        setStatus("Your answers save automatically.");
      }).catch(() => { loaded.current = true; setStatus("We will save when your connection returns."); });
  }, [token]);

  useEffect(() => {
    if (!loaded.current) return;
    setStatus("Saving…");
    const timer = window.setTimeout(() => {
      void fetch("/api/site-assessment/draft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, action: "save-customer", draft: { projectDetails, home, electrical, notes } }) })
        .then((response) => setStatus(response.ok ? "Saved — your technician can now see these answers." : "Could not save yet; please keep this page open."))
        .catch(() => setStatus("Could not save yet; please keep this page open."));
    }, 800);
    return () => window.clearTimeout(timer);
  }, [token, projectDetails, home, electrical, notes]);

  const input = (label: string, value: string, set: (value: string) => void, type = "text") => <label className="block text-sm font-bold text-slate-700">{label}{type === "textarea" ? <textarea rows={3} className={fieldClass} value={value} onChange={(e) => set(e.target.value)} /> : <input type={type} className={fieldClass} value={value} onChange={(e) => set(e.target.value)} />}</label>;
  return <section className="mt-8 border-t border-slate-200 pt-8"><h2 className="text-xl font-black">Help your technician prepare</h2><p className="mt-2 leading-7 text-slate-600">Hi {customerName}. Share anything you know below. Technical measurements, photos and safety checks will be completed by the technician on site.</p><p className="mt-3 text-sm font-semibold text-[#7a0000]" aria-live="polite">{status}</p>
    <div className="mt-6 grid gap-5 sm:grid-cols-2">
      {projectFields.map((field) => <div key={field.key} className={field.type === "textarea" ? "sm:col-span-2" : ""}>{input(field.label, projectDetails[field.key] || "", (value) => setProjectDetails((current) => ({ ...current, [field.key]: value })), field.type || "text")}</div>)}
      {input("Appliances or equipment to assess", projectDetails.customerEquipment || "", (value) => setProjectDetails((current) => ({ ...current, customerEquipment: value })), "textarea")}
      {input("What must continue during a power outage?", projectDetails.priorityAppliances || "", (value) => setProjectDetails((current) => ({ ...current, priorityAppliances: value })), "textarea")}
      {input("People in the home / premises", home.occupants || "", (value) => setHome((current) => ({ ...current, occupants: value })), "number")}
      {input("Typical monthly electricity spend (KES), if known", electrical.monthlyBill || "", (value) => setElectrical((current) => ({ ...current, monthlyBill: value })), "number")}
      {input("Meter or account number, if known", electrical.meterId || "", (value) => setElectrical((current) => ({ ...current, meterId: value })))}
      {input("Anything else the technician should know", notes, setNotes, "textarea")}
    </div>
  </section>;
}
