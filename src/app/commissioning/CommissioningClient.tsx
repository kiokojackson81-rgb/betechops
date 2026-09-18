"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { commissioningEquipmentUnits, type EquipmentUnit } from "@/lib/commissioningEquipment";
import { isReadyToIssue } from "@/lib/commissioningValidation";
import { COMMISSIONING_PROFILES, commissioningProfile, type CommissioningSystemProfile } from "@/lib/commissioningProfiles";

type Evidence = { url: string; fileName?: string; capturedAt?: string };
type EquipmentKind = "panel" | "inverter" | "battery";
type Draft = {
  additionalEquipment?: EquipmentUnit[];
  systemEquipment?: EquipmentUnit[];
  systemProfile?: CommissioningSystemProfile;
  installerName?: string;
  installation?: Record<string, string>;
  site?: Record<string, string>;
  evidence?: Record<string, Evidence[]>;
  equipment?: Record<string, string>;
  checklist?: Record<string, string>;
  measurements?: Record<string, string>;
  handover?: Record<string, boolean>;
  termsAcceptance?: {
    accepted?: boolean;
    acceptedAt?: string | null;
    termsVersionUrl?: string;
    acceptedByCustomerName?: string;
  };
  signatures?: Record<string, string>;
  confirmations?: Record<string, boolean>;
  [key: string]: unknown;
};
type Session = {
  isCertifyingProfessional?: boolean;
  professionalReviewComment?: string | null;
  status: "DRAFT" | "TECHNICIAN_COMPLETED" | "AWAITING_PROFESSIONAL_REVIEW" | "RETURNED_FOR_CORRECTION" | "PROFESSIONALLY_APPROVED" | "ISSUED" | "REVOKED";
  readOnly: boolean;
  lastStep: string;
  progress: number;
  issuedAt: string | null;
  certificateNo: string | null;
  technicianName: string;
  technicianSignatureUrl?: string | null;
  project: {
    reference: string;
    customerName: string;
    location: string;
    system: string;
    expectedItems: string[];
  };
  data: Draft;
};
const handoverItems = [
  "System operation",
  "Shutdown/startup",
  "Monitoring",
  "Warranty",
  "Load limitations",
  "Maintenance",
  "Fault reporting",
] as const;
const requiredHandoverItems = [
  "System operation",
  "Shutdown/startup",
  "Warranty",
  "Maintenance",
  "Fault reporting",
] as const;
const steps = [
  { id: "panels", label: "Solar panels" },
  { id: "array", label: "Panel array" },
  { id: "inverter", label: "Inverter" },
  { id: "battery", label: "Battery" },
  { id: "final-photos", label: "Final installation photos" },
  { id: "commissioning", label: "Commissioning" },
  { id: "handover", label: "Customer handover" },
  { id: "review", label: "Final review" },
] as const;
const initialDraft: Draft = {
  systemProfile: "SOLAR_PV_STORAGE",
  installation: { type: "New Installation", systemConfiguration: "Hybrid" },
  site: { premises: "Residential" },
  evidence: {},
  equipment: {},
  checklist: {},
  measurements: {},
  handover: {},
  signatures: {},
  confirmations: {},
};
const inputClass =
  "mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-base text-white outline-none focus:border-cyan-400";

const MAX_EVIDENCE_UPLOAD_BYTES = 3 * 1024 * 1024;
const TARGET_EVIDENCE_UPLOAD_BYTES = Math.floor(2.5 * 1024 * 1024);

async function canvasPhoto(file: File) {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    return {
      source: bitmap as CanvasImageSource,
      width: bitmap.width,
      height: bitmap.height,
      dispose: () => bitmap.close(),
    };
  }
  const source = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("This photo could not be prepared."));
    };
    image.src = objectUrl;
  });
  return {
    source,
    width: source.naturalWidth,
    height: source.naturalHeight,
    dispose: () => undefined,
  };
}

async function prepareEvidencePhoto(file: File) {
  if (file.size <= MAX_EVIDENCE_UPLOAD_BYTES) return file;
  try {
    const image = await canvasPhoto(file);
    try {
      let longestSide = 1920;
      let quality = 0.84;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const scale = Math.min(1, longestSide / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) break;
        context.drawImage(image.source, 0, 0, width, height);
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/jpeg", quality),
        );
        if (blob && blob.size <= TARGET_EVIDENCE_UPLOAD_BYTES) {
          const baseName = file.name.replace(/\.[^.]+$/, "") || "commissioning-photo";
          return new File([blob], `${baseName}.jpg`, {
            type: "image/jpeg",
            lastModified: file.lastModified,
          });
        }
        longestSide = Math.round(longestSide * 0.72);
        quality -= 0.12;
      }
    } finally {
      image.dispose();
    }
  } catch {
    // Large HEIC or device-specific camera formats may not be decodable here.
  }
  throw new Error(
    "This photo is too large for a reliable mobile upload. Retake it as a JPG at a lower resolution, or choose a photo smaller than 3 MB.",
  );
}
const expectedPanel = (items: string[]) => {
  const text = items.find((item) => /panel/i.test(item)) || items[0] || "";
  return {
    text,
    qty: Number(text.match(/(\d+)\s*[×x]/i)?.[1] || 0),
    watts: Number(text.match(/(\d{3,4})\s*W/i)?.[1] || 0),
  };
};

export default function CommissioningClient({ token }: { token: string }) {
  const [session, setSession] = useState<Session | null>(null);
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [lastStep, setLastStep] = useState("panels");
  const [activeStep, setActiveStep] = useState(0);
  const [resumePrompt, setResumePrompt] = useState(false);
  const [manual, setManual] = useState<EquipmentKind | null>(null);
  const [differentQuantity, setDifferentQuantity] = useState(false);
  const [saveState, setSaveState] = useState<
    "loading" | "saved" | "saving" | "offline" | "error"
  >("loading");
  const [error, setError] = useState("");
  const [gpsMessage, setGpsMessage] = useState("");
  const loaded = useRef(false);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const saveGeneration = useRef(0);
  const cacheKey = `betech-commissioning-draft:${token}`;
  const evidence = draft.evidence || {};
  const confirmations = draft.confirmations || {};
  const profile = commissioningProfile(draft.systemProfile);
  const visibleSteps = useMemo(() => steps.filter((step) => {
    if (step.id === "array") return profile.panels;
    if (step.id === "inverter") return profile.inverter;
    if (step.id === "battery") return profile.battery;
    return true;
  }), [profile]);
  const expected = useMemo(
    () => expectedPanel(session?.project.expectedItems || []),
    [session?.project.expectedItems],
  );
  const complete = (id: string) =>
    id === "panels"
      ? Boolean(
          (!profile.panels || (evidence.panelLabel?.length && confirmations.panel && confirmations.panelQuantity)) &&
          draft.installation?.type && draft.installation?.systemConfiguration && draft.site?.premises && (draft.site.premises !== "Other" || draft.site.premisesOther?.trim()),
        )
      : id === "array"
        ? !profile.panels || Boolean(evidence.panelArray?.length)
        : id === "inverter"
          ? !profile.inverter || Boolean(
              evidence.inverterLabel?.length &&
              evidence.inverterInstallation?.length &&
              confirmations.inverter,
            )
          : id === "battery"
            ? !profile.battery || Boolean(
                evidence.batteryLabel?.length &&
                evidence.batteryInstallation?.length &&
                confirmations.battery && draft.equipment?.batterySerial?.trim(),
              )
            : id === "final-photos"
              ? Boolean(evidence.protection?.length && evidence.overall?.length)
              : id === "commissioning"
                ? profile.checklist.every((check) => ["PASS", "N/A"].includes(draft.checklist?.[check] || ""))
                : id === "handover"
                  ? Boolean(
                      draft.signatures?.customer &&
                      draft.signatures?.technician &&
                      draft.termsAcceptance?.accepted &&
                      requiredHandoverItems.every((item) => draft.handover?.[item]),
                    )
                  : false;
  const completedStages = visibleSteps
    .slice(0, -1)
    .filter((step) => complete(step.id)).length;
  const progress = Math.round((completedStages / Math.max(1, visibleSteps.length - 1)) * 100);
  const firstIncomplete = Math.max(
    0,
    visibleSteps.findIndex((step) => !complete(step.id)),
  );
  useEffect(() => {
    let alive = true;
    fetch(`/api/commissioning/${encodeURIComponent(token)}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(
            body.error || "Unable to open commissioning session.",
          );
        return body.session as Session;
      })
      .then((next) => {
        if (!alive) return;
        let cached: Draft = {};
        try {
          cached = JSON.parse(localStorage.getItem(cacheKey) || "{}");
        } catch {
          /* ignore bad local data */
        }
        const merged: Draft = {
          ...initialDraft,
          ...cached,
          ...next.data,
          evidence: {
            ...(cached.evidence || {}),
            ...(next.data?.evidence || {}),
          },
          equipment: {
            ...(cached.equipment || {}),
            ...(next.data?.equipment || {}),
          },
          checklist: {
            ...(cached.checklist || {}),
            ...(next.data?.checklist || {}),
          },
          measurements: {
            ...(cached.measurements || {}),
            ...(next.data?.measurements || {}),
          },
          handover: {
            ...(cached.handover || {}),
            ...(next.data?.handover || {}),
          },
          confirmations: {
            ...(cached.confirmations || {}),
            ...(next.data?.confirmations || {}),
          },
          signatures: {
            ...(cached.signatures || {}),
            ...(next.data?.signatures || {}),
          },
        };
        setSession(next);
        setDraft(merged);
        setLastStep(next.lastStep || "panels");
        // Resolve the saved step after the profile has been merged. Older solar
        // sessions can include steps that are hidden for a pump, heater or DC kit.
        const restoredProfile = commissioningProfile(merged.systemProfile);
        const restoredSteps = steps.filter((step) => {
          if (step.id === "array") return restoredProfile.panels;
          if (step.id === "inverter") return restoredProfile.inverter;
          if (step.id === "battery") return restoredProfile.battery;
          return true;
        });
        const index = restoredSteps.findIndex((step) => step.id === next.lastStep);
        setActiveStep(index >= 0 ? index : 0);
        setResumePrompt(next.progress > 0);
        setSaveState("saved");
        loaded.current = true;
      })
      .catch((cause) => {
        if (alive) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to open this link.",
          );
          setSaveState("error");
        }
      });
    return () => {
      alive = false;
    };
  }, [cacheKey, token]);
  useEffect(() => {
    const index = visibleSteps.findIndex((step) => step.id === lastStep);
    if (index >= 0) {
      setActiveStep(index);
      return;
    }
    setActiveStep(0);
    setLastStep(visibleSteps[0]?.id || "panels");
  }, [lastStep, visibleSteps]);
  useEffect(() => {
    if (!loaded.current || session?.readOnly) return;
    localStorage.setItem(cacheKey, JSON.stringify(draft));
    if (!navigator.onLine) {
      setSaveState("offline");
      return;
    }
    const generation = ++saveGeneration.current;
    const timer = window.setTimeout(async () => {
      const body = JSON.stringify({ data: draft, lastStep, progress });
      if (generation === saveGeneration.current) setSaveState("saving");
      saveQueue.current = saveQueue.current
        .catch(() => undefined)
        .then(async () => {
          const response = await fetch(
            `/api/commissioning/${encodeURIComponent(token)}`,
            {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body,
            },
          );
          if (!response.ok) throw new Error("Draft save failed.");
          if (generation === saveGeneration.current) setSaveState("saved");
        })
        .catch(() => {
          if (generation === saveGeneration.current)
            setSaveState(navigator.onLine ? "error" : "offline");
        });
    }, 900);
    return () => window.clearTimeout(timer);
  }, [cacheKey, draft, lastStep, progress, session?.readOnly, token]);
  const patch = (section: keyof Draft, key: string, value: unknown) =>
    setDraft((current) => ({
      ...current,
      [section]: {
        ...((current[section] as Record<string, unknown>) || {}),
        [key]: value,
      },
    }));
  const setEquipment = (kind: EquipmentKind, values: Record<string, string>) =>
    setDraft((current) => ({
      ...current,
      equipment: {
        ...(current.equipment || {}),
        ...Object.fromEntries(
          Object.entries(values).map(([key, value]) => [
            `${kind}${key[0].toUpperCase()}${key.slice(1)}`,
            value,
          ]),
        ),
      },
    }));
  const equipment = (kind: EquipmentKind) => ({
    brand: draft.equipment?.[`${kind}Brand`] || "",
    model: draft.equipment?.[`${kind}Model`] || "",
    serial: draft.equipment?.[`${kind}Serial`] || "",
    ratedPower: draft.equipment?.[`${kind}RatedPower`] || "",
    capacity: draft.equipment?.[`${kind}Capacity`] || "",
  });
  const addEvidence = (key: string, item: Evidence) =>
    setDraft((current) => ({
      ...current,
      evidence: {
        ...(current.evidence || {}),
        [key]: [...(current.evidence?.[key] || []), item],
      },
    }));
  const removeEvidence = (key: string, index: number) =>
    setDraft((current) => ({
      ...current,
      evidence: {
        ...(current.evidence || {}),
        [key]: (current.evidence?.[key] || []).filter(
          (_, itemIndex) => itemIndex !== index,
        ),
      },
    }));
  const clearEquipment = (kind: EquipmentKind) =>
    setDraft((current) => {
      const equipment = { ...(current.equipment || {}) };
      const confirmations = { ...(current.confirmations || {}) };
      for (const key of [
        "Brand",
        "Model",
        "Serial",
        "RatedPower",
        "Voltage",
        "Capacity",
      ]) {
        delete equipment[`${kind}${key}`];
      }
      delete confirmations[kind];
      if (kind === "panel") {
        delete equipment.panelQuantity;
        delete confirmations.panelQuantity;
      }
      return { ...current, equipment, confirmations };
    });
  const go = (index: number) => {
    setActiveStep(index);
    setLastStep(visibleSteps[index]?.id || visibleSteps[0]?.id || "panels");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const issue = async () => {
    setError("");
    setSaveState("saving");
    try {
      if (!session?.readOnly) {
      const save = await fetch(
        `/api/commissioning/${encodeURIComponent(token)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            data: draft,
            lastStep: "review",
            progress: 99,
          }),
        },
      );
      if (!save.ok) throw new Error("Final review could not be saved.");
      }
      const response = await fetch(
        `/api/commissioning/${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "issue" }),
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(body.error || "Certificate could not be issued.");
      setSession((current) =>
        current
          ? {
              ...current,
              status: body.status || "ISSUED",
              readOnly: true,
              certificateNo: body.certificateNo || null,
              issuedAt: body.issuedAt || null,
            }
          : current,
      );
      localStorage.removeItem(cacheKey);
      setSaveState("saved");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Certificate could not be issued.",
      );
      setSaveState("error");
    }
  };
  if (error && !session)
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-white">
        <div className="mx-auto max-w-lg rounded-3xl border border-rose-500/40 bg-rose-500/10 p-6">
          {error}
        </div>
      </main>
    );
  if (!session)
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-white">
        Loading commissioning…
      </main>
    );
  if (session.readOnly) return session.status === "ISSUED" ? <IssuedView session={session} token={token} /> : <ProfessionalReviewPendingView session={session} busy={saveState === "saving"} error={error} onIssue={() => void issue()} />;
  const current = visibleSteps[Math.min(activeStep, Math.max(0, visibleSteps.length - 1))] || visibleSteps[0];
  const canContinue = current.id === "review" || complete(current.id);
  return (
    <main className="min-h-screen bg-slate-950 pb-28 text-slate-100">
      <header className="border-b border-cyan-400/20 bg-[#081522] px-4 py-5">
        <div className="mx-auto max-w-xl">
          <p className="text-xs font-black tracking-[.2em] text-cyan-300">
            BETECH SOLAR SOLUTIONS
          </p>
          <h1 className="mt-2 text-2xl font-black">Commissioning</h1>
          <p className="mt-1 text-slate-300">
            {session.project.customerName} · {session.project.location}
          </p>
          <div className="mt-4 flex justify-between text-xs">
            <span className="font-bold text-cyan-200">
              {progress}% COMPLETE
            </span>
            <span className="text-slate-400">
              {saveState === "saved"
                ? "✓ Saved just now"
                : saveState === "saving"
                  ? "Saving…"
                  : saveState === "offline"
                    ? "Offline — saved on this phone"
                    : "Save needs attention"}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full bg-cyan-400"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </header>
      {resumePrompt ? (
        <div className="mx-auto max-w-xl p-4">
          <section className="rounded-3xl border border-cyan-400/25 bg-slate-900 p-6">
            <p className="text-sm font-bold text-cyan-200">
              Welcome back, {session.technicianName}
            </p>
            <h2 className="mt-2 text-2xl font-black">
              Continue where you stopped
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              {session.project.customerName} · {session.project.location}
              <br />
              {completedStages}/{Math.max(0, visibleSteps.length - 1)} stages complete
            </p>
            <button
              type="button"
              onClick={() => {
                setResumePrompt(false);
                go(firstIncomplete);
              }}
              className="mt-5 w-full rounded-2xl bg-cyan-400 px-4 py-4 font-black text-slate-950"
            >
              CONTINUE WHERE I STOPPED
            </button>
          </section>
        </div>
      ) : (
        <div className="mx-auto max-w-xl p-4">
          <p className="text-xs font-black tracking-[.2em] text-cyan-300">
            STEP {Math.min(activeStep + 1, visibleSteps.length)} OF {visibleSteps.length}
          </p>
          <h2 className="mt-2 text-2xl font-black">{current.id === "panels" && !profile.panels ? "System equipment" : current.label}</h2>
          {session.professionalReviewComment && session.status === "RETURNED_FOR_CORRECTION" ? <p role="alert" className="my-4 rounded-xl bg-amber-100 p-4 text-amber-950">Correction requested: {session.professionalReviewComment}</p> : null}
          {current.id === "panels" ? <section className="my-4 space-y-4 rounded-2xl border border-slate-700 p-4">
            <h3 className="font-bold">Customer &amp; site details</h3>
            <p>{session.project.customerName} · {session.project.location}</p>
            <label className="block">Installer / agent completing this form<input className={inputClass} value={draft.installerName || ""} placeholder={session.technicianName} onChange={event => setDraft(value => ({ ...value, installerName: event.target.value }))} /></label>
            <label className="block">System type<select className={inputClass} value={profile.id} onChange={event => { const nextProfile = commissioningProfile(event.target.value); const suggestedConfiguration = nextProfile.id === "SOLAR_WATER_HEATER" ? "Standalone / Solar Thermal" : ["DC_SOLAR_KIT", "SOLAR_WATER_PUMP"].includes(nextProfile.id) ? "Direct DC" : nextProfile.id === "SOLAR_PV_NO_STORAGE" ? "Grid-Tied" : nextProfile.id === "BATTERY_BACKUP" ? "Off-Grid" : "Hybrid"; setDraft(value => { const existing = value.systemEquipment || []; const required = nextProfile.extraEquipment.map((unit) => existing.find(item => item.kind === unit.kind) || { id: crypto.randomUUID(), kind: unit.kind, label: unit.label, brand: "", model: "", capacity: "", serial: "", warrantyYears: "5", labelPhotos: [] }); return { ...value, systemProfile: nextProfile.id, installation: { ...(value.installation || {}), systemConfiguration: suggestedConfiguration }, systemEquipment: nextProfile.id === "CUSTOM" ? existing : required }; }); setActiveStep(0); setLastStep("panels"); }}><option value="">Select system type</option>{COMMISSIONING_PROFILES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            <p className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-3 text-sm text-cyan-100">{profile.summary}. The form, required photos and warranty certificate will use this system type.</p>
            <label className="block">County<input className={inputClass} value={draft.site?.county || ""} onChange={event => patch("site", "county", event.target.value)} /></label>
            <label className="block">Nature of premises<select className={inputClass} value={draft.site?.premises || ""} onChange={event => patch("site", "premises", event.target.value)}><option value="">Select premises</option>{["Residential", "Commercial", "Institutional", "Industrial", "Agricultural", "Other"].map(value => <option key={value}>{value}</option>)}</select></label>
            {draft.site?.premises === "Other" ? <label className="block">Other premises<input maxLength={80} className={inputClass} value={draft.site?.premisesOther || ""} onChange={event => patch("site", "premisesOther", event.target.value)} /></label> : null}
            <label className="block">Site location / landmark <span className="text-slate-400">(optional)</span><input className={inputClass} value={draft.site?.manualLocation || ""} placeholder="Enter a landmark or address if GPS is unavailable" onChange={event => patch("site", "manualLocation", event.target.value)} /></label>
            <label className="block">GPS coordinates <span className="text-slate-400">(optional)</span><input className={inputClass} value={draft.site?.gps || ""} placeholder="e.g. -1.286389, 36.817223" onChange={event => { setGpsMessage(""); patch("site", "gps", event.target.value); }} /></label>
            <div className="flex flex-wrap gap-3"><button type="button" className="rounded-xl border border-cyan-400 px-4 py-2" onClick={() => { if (!navigator.geolocation) { setGpsMessage("GPS is unavailable on this device. Enter the location manually or continue without GPS."); return; } navigator.geolocation.getCurrentPosition(position => { setGpsMessage(""); patch("site", "gps", `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`); }, () => setGpsMessage("GPS was not shared. Enter the location manually or continue without GPS."), { enableHighAccuracy: true, timeout: 15000 }); }}>Capture GPS</button><button type="button" className="rounded-xl border border-slate-600 px-4 py-2 text-slate-200" onClick={() => { patch("site", "gps", ""); setGpsMessage("GPS skipped. You can continue without it."); }}>Skip GPS</button></div>
            <p className="text-sm text-slate-400">GPS: {draft.site?.gps || "Optional — not captured"}</p>
            {gpsMessage ? <p role="status" className="text-sm text-amber-200">{gpsMessage}</p> : null}
            <label className="block">Installation type<select className={inputClass} value={draft.installation?.type || ""} onChange={event => patch("installation", "type", event.target.value)}><option value="">Select type</option>{["New Installation", "Upgrade", "Modification"].map(value => <option key={value}>{value}</option>)}</select></label>
            <label className="block">System configuration<select className={inputClass} value={draft.installation?.systemConfiguration || ""} onChange={event => patch("installation", "systemConfiguration", event.target.value)}><option value="">Select configuration</option>{["Hybrid", "Off-Grid", "Grid-Tied", "Direct DC", "Standalone / Solar Thermal"].map(value => <option key={value}>{value}</option>)}</select></label>
          </section> : null}
          <div className="mt-4">
            {current.id === "panels" && profile.panels && (
              <Panels
                expected={expected}
                items={evidence.panelLabel || []}
                equipment={equipment("panel")}
                confirmed={Boolean(confirmations.panel)}
                quantityConfirmed={Boolean(confirmations.panelQuantity)}
                different={differentQuantity}
                setDifferent={setDifferentQuantity}
                token={token}
                onPhoto={(item) => addEvidence("panelLabel", item)}
                onRemovePhoto={(index) => removeEvidence("panelLabel", index)}
                onEquipment={(values) => setEquipment("panel", values)}
                onConfirm={() => patch("confirmations", "panel", true)}
                onClearEquipment={() => clearEquipment("panel")}
                onQuantity={(value) => {
                  patch("equipment", "panelQuantity", value);
                  patch("confirmations", "panelQuantity", Number(value) > 0);
                }}
                manual={manual === "panel"}
                onManual={() => setManual(manual === "panel" ? null : "panel")}
              />
            )}
            {current.id === "panels" && (profile.extraEquipment.length > 0 || profile.id === "CUSTOM") ? <SystemEquipmentEditor profile={profile} units={draft.systemEquipment || []} token={token} onChange={(units) => setDraft(value => ({ ...value, systemEquipment: units }))} /> : null}
            {current.id === "array" && (
              <PhotoStep
                title="Panel array"
                note="Take a photo showing the completed panel installation."
                items={evidence.panelArray || []}
                token={token}
                onUploaded={(item) => addEvidence("panelArray", item)}
                onRemove={(index) => removeEvidence("panelArray", index)}
              />
            )}
            {current.id === "inverter" && (
              <EquipmentStep
                kind="inverter"
                expected="Confirm the inverter supplied for this project."
                labelItems={evidence.inverterLabel || []}
                installationItems={evidence.inverterInstallation || []}
                equipment={equipment("inverter")}
                confirmed={Boolean(confirmations.inverter)}
                token={token}
                onLabel={(item) => addEvidence("inverterLabel", item)}
                onRemoveLabel={(index) =>
                  removeEvidence("inverterLabel", index)
                }
                onInstallation={(item) =>
                  addEvidence("inverterInstallation", item)
                }
                onRemoveInstallation={(index) =>
                  removeEvidence("inverterInstallation", index)
                }
                onEquipment={(values) => setEquipment("inverter", values)}
                onConfirm={() => patch("confirmations", "inverter", true)}
                onClearEquipment={() => clearEquipment("inverter")}
                manual={manual === "inverter"}
                onManual={() =>
                  setManual(manual === "inverter" ? null : "inverter")
                }
              />
            )}
            {current.id === "battery" && (
              <EquipmentStep
                kind="battery"
                expected={
                  session.project.expectedItems.find((item) =>
                    /battery/i.test(item),
                  ) || "Confirm the battery supplied for this project."
                }
                labelItems={evidence.batteryLabel || []}
                installationItems={evidence.batteryInstallation || []}
                equipment={equipment("battery")}
                confirmed={Boolean(confirmations.battery)}
                token={token}
                onLabel={(item) => addEvidence("batteryLabel", item)}
                onRemoveLabel={(index) => removeEvidence("batteryLabel", index)}
                onInstallation={(item) =>
                  addEvidence("batteryInstallation", item)
                }
                onRemoveInstallation={(index) =>
                  removeEvidence("batteryInstallation", index)
                }
                onEquipment={(values) => setEquipment("battery", values)}
                onConfirm={() => patch("confirmations", "battery", true)}
                onClearEquipment={() => clearEquipment("battery")}
                manual={manual === "battery"}
                onManual={() =>
                  setManual(manual === "battery" ? null : "battery")
                }
              />
            )}
            {["panels", "inverter", "battery"].includes(current.id) ? <section className="mt-4 rounded-3xl bg-slate-900 p-5"><label className="block font-bold">{current.id === "panels" ? "Solar panels" : current.id === "battery" ? "Battery 1" : "Inverter 1"} warranty (years)<input type="number" min="0.0833333333" max="50" step="any" className={inputClass} value={draft.equipment?.[`${current.id === "panels" ? "panel" : current.id}WarrantyYears`] ?? ""} onChange={event => patch("equipment", `${current.id === "panels" ? "panel" : current.id}WarrantyYears`, event.target.value)} /></label><p className="mt-2 text-sm text-slate-400">Pre-filled from project or quotation where available. Adjust to the agreed coverage, for example 2 or 5 years. The selected coverage will appear on the issued warranty.</p></section> : null}
            {current.id === "inverter" || current.id === "battery" ? <section className="mt-4 space-y-4">
              {(draft.additionalEquipment || []).filter(unit => unit.kind === current.id).map((unit, index) => <article key={unit.id} className="space-y-3 rounded-3xl border border-cyan-500/30 bg-slate-900 p-5"><div className="flex items-center justify-between"><h3 className="text-xl font-bold">{unit.kind === "battery" ? "Battery" : "Inverter"} {index + 2}</h3><button type="button" onClick={() => setDraft(value => ({ ...value, additionalEquipment: value.additionalEquipment?.filter(item => item.id !== unit.id) }))} className="text-rose-300">Remove</button></div>
                {([['brand', 'Brand'], ['model', 'Model'], ['capacity', 'Capacity'], ['serial', 'Serial number'], ['warrantyYears', 'Warranty (years)']] as const).map(([key, label]) => <label className="block" key={key}>{label}<input className={inputClass} type={key === "warrantyYears" ? "number" : "text"} min={key === "warrantyYears" ? "0.0833333333" : undefined} max={key === "warrantyYears" ? 50 : undefined} step="any" maxLength={180} value={unit[key]} onChange={event => setDraft(value => ({ ...value, additionalEquipment: value.additionalEquipment?.map(item => item.id === unit.id ? { ...item, [key]: event.target.value } : item) }))} /></label>)}
                <PhotoStep title="Equipment label and installation photos" note="Photograph this unit's serial label and installed position." items={unit.labelPhotos || []} token={token} onUploaded={photo => setDraft(value => ({ ...value, additionalEquipment: value.additionalEquipment?.map(item => item.id === unit.id ? { ...item, labelPhotos: [...(item.labelPhotos || []), photo] } : item) }))} onRemove={index => setDraft(value => ({ ...value, additionalEquipment: value.additionalEquipment?.map(item => item.id === unit.id ? { ...item, labelPhotos: item.labelPhotos?.filter((_, photoIndex) => index !== photoIndex) } : item) }))} />
              </article>)}
              <button type="button" disabled={(draft.additionalEquipment || []).length >= 48} className="rounded-xl bg-cyan-300 px-5 py-3 font-bold text-slate-950" onClick={() => { const kind = current.id as "battery" | "inverter"; setDraft(value => ({ ...value, additionalEquipment: [...(value.additionalEquipment || []), { id: crypto.randomUUID(), kind, brand: value.equipment?.[`${kind}Brand`] || "", model: value.equipment?.[`${kind}Model`] || "", capacity: value.equipment?.[`${kind}Capacity`] || "", serial: "", warrantyYears: value.equipment?.[`${kind}WarrantyYears`] || (kind === "battery" ? "10" : "5"), labelPhotos: [] }] })); }}>Add {current.id === "battery" ? "battery" : "inverter"}</button>
            </section> : null}
            {current.id === "review" ? <section className="my-4 rounded-3xl bg-slate-900 p-5"><h3 className="font-bold">Installed units and warranty</h3>{commissioningEquipmentUnits(draft).map(unit => <p className="mt-2 break-words" key={unit.id}>{unit.kind}: {unit.brand} {unit.model} · Serial: {unit.serial || "Missing"} · {unit.warrantyYears} years</p>)}</section> : null}
            {current.id === "final-photos" && (
              <>
                <PhotoStep
                  title="Protection / DB"
                  note="Show protection, DB or combiner equipment."
                  items={evidence.protection || []}
                  token={token}
                  onUploaded={(item) => addEvidence("protection", item)}
                  onRemove={(index) => removeEvidence("protection", index)}
                />
                <PhotoStep
                  title="Completed installation"
                  note="Show the completed overall setup."
                  items={evidence.overall || []}
                  token={token}
                  onUploaded={(item) => addEvidence("overall", item)}
                  onRemove={(index) => removeEvidence("overall", index)}
                />
              </>
            )}
            {current.id === "commissioning" && (
              <Commissioning
                checks={profile.checklist}
                checklist={draft.checklist || {}}
                measurements={draft.measurements || {}}
                onChecklist={(key, value) => patch("checklist", key, value)}
                onMeasurement={(key, value) =>
                  patch("measurements", key, value)
                }
                onClearChecklist={() =>
                  setDraft((current) => ({ ...current, checklist: {} }))
                }
                onClearMeasurements={() =>
                  setDraft((current) => ({ ...current, measurements: {} }))
                }
              />
            )}
            {current.id === "handover" && (
              <Handover
                customer={session.project.customerName}
                handover={draft.handover || {}}
                termsAccepted={Boolean(draft.termsAcceptance?.accepted)}
                customerSignature={draft.signatures?.customer || ""}
                technician={session.technicianName}
                savedTechnicianSignature={session.technicianSignatureUrl}
                technicianSignature={draft.signatures?.technician || ""}
                onAll={() =>
                  requiredHandoverItems.forEach((item) => patch("handover", item, true))
                }
                onToggle={(item, value) => patch("handover", item, value)}
                onTermsAccepted={(accepted) =>
                  setDraft((current) => ({
                    ...current,
                    termsAcceptance: {
                      accepted,
                      acceptedAt: accepted
                        ? current.termsAcceptance?.acceptedAt || new Date().toISOString()
                        : null,
                      termsVersionUrl: "https://www.betech.co.ke/p/terms",
                      acceptedByCustomerName: session.project.customerName,
                    },
                  }))
                }
                onCustomerSignature={(value) => patch("signatures", "customer", value)}
                onTechnicianSignature={(value) =>
                  setDraft((current) => ({
                    ...current,
                    signatures: {
                      ...current.signatures,
                      technician: value,
                      technicianSignedAt: value
                        ? current.signatures?.technicianSignedAt || new Date().toISOString()
                        : "",
                    },
                  }))
                }
              />
            )}
            {current.id === "review" && (
              <Review
                session={session}
                draft={draft}
                completed={completedStages}
                total={visibleSteps.length - 1}
                profile={profile}
              />
            )}
          </div>
          {error ? (
            <p className="mt-4 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-200">
              {error}
            </p>
          ) : null}
        </div>
      )}
      {!resumePrompt && (
        <div className="fixed inset-x-0 bottom-0 border-t border-slate-700 bg-slate-950/95 p-3 backdrop-blur">
          <div className="mx-auto max-w-xl">
            {current.id === "review" ? (
              <button
                type="button"
                disabled={saveState === "saving" || !isReadyToIssue(draft).ready}
                onClick={() => void issue()}
                className="w-full rounded-2xl bg-cyan-400 px-5 py-4 text-base font-black text-slate-950 disabled:opacity-40"
              >
                {saveState === "saving" ? "GENERATING CERTIFICATES..." : "SUBMIT & GENERATE CERTIFICATES"}
              </button>
            ) : (
              <button
                type="button"
                disabled={!canContinue}
                onClick={() => go(Math.min(visibleSteps.length - 1, activeStep + 1))}
                className="w-full rounded-2xl bg-cyan-400 px-5 py-4 text-base font-black text-slate-950 disabled:opacity-40"
              >
                {canContinue ? "CONTINUE" : "COMPLETE THIS STEP TO CONTINUE"}
              </button>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

function PhotoStep({
  title,
  note,
  items,
  token,
  onUploaded,
  onRemove,
}: {
  title: string;
  note: string;
  items: Evidence[];
  token: string;
  onUploaded: (item: Evidence) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <section className="mt-4 rounded-3xl bg-slate-900 p-5">
      <h3 className="text-xl font-black">{title}</h3>
      <p className="mt-2 text-slate-400">{note}</p>
      <PhotoCapture
        items={items}
        token={token}
        onUploaded={onUploaded}
        onRemove={onRemove}
      />
    </section>
  );
}

function SystemEquipmentEditor({
  profile,
  units,
  token,
  onChange,
}: {
  profile: ReturnType<typeof commissioningProfile>;
  units: EquipmentUnit[];
  token: string;
  onChange: (units: EquipmentUnit[]) => void;
}) {
  const update = (id: string, values: Partial<EquipmentUnit>) =>
    onChange(units.map((unit) => unit.id === id ? { ...unit, ...values } : unit));
  const add = () => onChange([
    ...units,
    { id: crypto.randomUUID(), kind: "custom", label: "Other equipment", brand: "", model: "", capacity: "", serial: "", warrantyYears: "5", labelPhotos: [] },
  ]);
  return (
    <section className="mt-4 space-y-4 rounded-3xl border border-cyan-400/20 bg-slate-900 p-5">
      <h3 className="text-xl font-black">Installed equipment</h3>
      <p className="text-sm text-slate-400">Record each installed unit. Brand, model, serial number, warranty and a clear manufacturer-label photo are required for the certificate and warranty.</p>
      {units.map((unit) => (
        <article key={unit.id} className="space-y-3 rounded-2xl border border-slate-700 bg-slate-950 p-4">
          <div className="flex items-center justify-between gap-3">
            <h4 className="font-bold">{unit.label || unit.kind || "Equipment"}</h4>
            {(profile.id === "CUSTOM" || !profile.extraEquipment.some((item) => item.kind === unit.kind)) ? <button type="button" onClick={() => onChange(units.filter((item) => item.id !== unit.id))} className="text-sm font-bold text-rose-300">Remove</button> : null}
          </div>
          {profile.id === "CUSTOM" ? <label className="block text-sm">Equipment name<input className={inputClass} value={unit.label || ""} placeholder="Example: Solar controller" onChange={(event) => update(unit.id, { label: event.target.value, kind: event.target.value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") || "custom" })} /></label> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            {([['brand', 'Brand'], ['model', 'Model'], ['capacity', 'Capacity / rating'], ['serial', 'Serial number'], ['warrantyYears', 'Warranty (years)']] as const).map(([key, label]) => <label className="block text-sm" key={key}>{label}<input className={inputClass} type={key === "warrantyYears" ? "number" : "text"} min={key === "warrantyYears" ? "0.0833333333" : undefined} max={key === "warrantyYears" ? 50 : undefined} step="any" maxLength={180} value={unit[key] || ""} onChange={(event) => update(unit.id, { [key]: event.target.value })} /></label>)}
          </div>
          <PhotoStep title="Manufacturer label photo" note="Take a clear photo showing the model and serial number." items={unit.labelPhotos || []} token={token} onUploaded={(photo) => update(unit.id, { labelPhotos: [...(unit.labelPhotos || []), photo] })} onRemove={(index) => update(unit.id, { labelPhotos: (unit.labelPhotos || []).filter((_, photoIndex) => photoIndex !== index) })} />
        </article>
      ))}
      {profile.id === "CUSTOM" ? <button type="button" onClick={add} className="w-full rounded-xl border border-cyan-400/50 px-4 py-3 font-bold text-cyan-100">+ Add installed equipment</button> : null}
    </section>
  );
}
function Panels({
  expected,
  items,
  equipment,
  confirmed,
  quantityConfirmed,
  different,
  setDifferent,
  token,
  onPhoto,
  onRemovePhoto,
  onEquipment,
  onConfirm,
  onClearEquipment,
  onQuantity,
  manual,
  onManual,
}: {
  expected: ReturnType<typeof expectedPanel>;
  items: Evidence[];
  equipment: Record<string, string>;
  confirmed: boolean;
  quantityConfirmed: boolean;
  different: boolean;
  setDifferent: (value: boolean) => void;
  token: string;
  onPhoto: (item: Evidence) => void;
  onRemovePhoto: (index: number) => void;
  onEquipment: (values: Record<string, string>) => void;
  onConfirm: () => void;
  onClearEquipment: () => void;
  onQuantity: (value: string) => void;
  manual: boolean;
  onManual: () => void;
}) {
  return (
    <section className="rounded-3xl bg-slate-900 p-5">
      <p className="text-slate-300">
        Take a clear photo of <b>one</b> manufacturer’s panel label.
      </p>
      <LabelCapture
        kind="panel"
        items={items}
        token={token}
        onUploaded={onPhoto}
        onRemove={onRemovePhoto}
        onEquipment={onEquipment}
      />
      <EquipmentConfirm
        kind="panel"
        expected={expected.text || "Project equipment"}
        equipment={equipment}
        confirmed={confirmed}
        labelPhotoAttached={items.length > 0}
        onConfirm={onConfirm}
        onClear={onClearEquipment}
        manual={manual}
        onManual={onManual}
        onEquipment={onEquipment}
      />
      {confirmed ? (
        <div className="mt-5 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4">
          <p className="text-xs font-black tracking-wider text-cyan-200">
            PROJECT EXPECTED
          </p>
          <p className="mt-2 font-bold">
            {expected.text || "Panel quantity recorded in project"}
          </p>
          {expected.qty > 0 && !different ? (
            <>
              <p className="mt-4">Were {expected.qty} panels installed?</p>
              <button
                type="button"
                onClick={() => onQuantity(String(expected.qty))}
                className={`mt-3 w-full rounded-xl px-4 py-3 font-black ${quantityConfirmed ? "bg-emerald-400 text-slate-950" : "bg-cyan-400 text-slate-950"}`}
              >
                ✓ YES — {expected.qty} PANELS
              </button>
              <button
                type="button"
                onClick={() => setDifferent(true)}
                className="mt-3 w-full text-sm font-bold text-cyan-200"
              >
                NO, QUANTITY DIFFERENT
              </button>
            </>
          ) : (
            <label className="mt-4 block text-sm">
              Installed panels
              <input
                className={inputClass}
                type="number"
                inputMode="numeric"
                defaultValue={expected.qty || ""}
                onChange={(event) => onQuantity(event.target.value)}
              />
            </label>
          )}
          {quantityConfirmed && expected.watts ? (
            <p className="mt-4 font-black text-emerald-300">
              Total PV Capacity ·{" "}
              {(
                (Number(equipment.panelQuantity || expected.qty) *
                  expected.watts) /
                1000
              ).toFixed(2)}{" "}
              kWp
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
function EquipmentStep({
  kind,
  expected,
  labelItems,
  installationItems,
  equipment,
  confirmed,
  token,
  onLabel,
  onRemoveLabel,
  onInstallation,
  onRemoveInstallation,
  onEquipment,
  onConfirm,
  onClearEquipment,
  manual,
  onManual,
}: {
  kind: EquipmentKind;
  expected: string;
  labelItems: Evidence[];
  installationItems: Evidence[];
  equipment: Record<string, string>;
  confirmed: boolean;
  token: string;
  onLabel: (item: Evidence) => void;
  onRemoveLabel: (index: number) => void;
  onInstallation: (item: Evidence) => void;
  onRemoveInstallation: (index: number) => void;
  onEquipment: (values: Record<string, string>) => void;
  onConfirm: () => void;
  onClearEquipment: () => void;
  manual: boolean;
  onManual: () => void;
}) {
  const title = kind === "inverter" ? "Inverter" : "Battery";
  return (
    <>
      <section className="rounded-3xl bg-slate-900 p-5">
        <h3 className="text-xl font-black">{title} label</h3>
        <p className="mt-2 text-slate-400">
          Take a clear photo of the {title.toLowerCase()} label.
        </p>
        <LabelCapture
          kind={kind}
          items={labelItems}
          token={token}
          onUploaded={onLabel}
          onRemove={onRemoveLabel}
          onEquipment={onEquipment}
        />
      </section>
      <EquipmentConfirm
        kind={kind}
        expected={expected}
        equipment={equipment}
        confirmed={confirmed}
        labelPhotoAttached={labelItems.length > 0}
        onConfirm={onConfirm}
        onClear={onClearEquipment}
        manual={manual}
        onManual={onManual}
        onEquipment={onEquipment}
      />
      {labelItems.length ? (
        <PhotoStep
          title={`Installed ${title.toLowerCase()}`}
          note={`Now show the installed ${title.toLowerCase()} in position.`}
          items={installationItems}
          token={token}
          onUploaded={onInstallation}
          onRemove={onRemoveInstallation}
        />
      ) : null}
    </>
  );
}
function LabelCapture({
  kind,
  items,
  token,
  onUploaded,
  onRemove,
  onEquipment,
}: {
  kind: EquipmentKind;
  items: Evidence[];
  token: string;
  onUploaded: (item: Evidence) => void;
  onRemove: (index: number) => void;
  onEquipment: (values: Record<string, string>) => void;
}) {
  const [reading, setReading] = useState(false);
  const [message, setMessage] = useState("");
  const uploaded = async (item: Evidence) => {
    onUploaded(item);
    setReading(true);
    setMessage("Reading equipment label…");
    try {
      const response = await fetch(
        `/api/commissioning/${encodeURIComponent(token)}/extract`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ kind, imageUrl: item.url }),
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.identified)
        throw new Error(body.error || "We couldn't clearly read this label.");
      onEquipment(body.equipment as Record<string, string>);
      setMessage("✓ Equipment identified");
    } catch (cause) {
      setMessage(
        cause instanceof Error
          ? cause.message
          : "We couldn't clearly read this label.",
      );
    } finally {
      setReading(false);
    }
  };
  return (
    <>
      <PhotoCapture
        items={items}
        token={token}
        onUploaded={uploaded}
        onRemove={onRemove}
      />
      {items.length ? (
        <p
          className={`mt-3 text-sm ${reading ? "text-cyan-200" : message.startsWith("✓") ? "text-emerald-300" : "text-amber-200"}`}
        >
          {reading ? "Reading equipment label…" : message || "✓ Photo saved"}
        </p>
      ) : null}
    </>
  );
}
function EquipmentConfirm({
  kind,
  expected,
  equipment,
  confirmed,
  labelPhotoAttached,
  onConfirm,
  onClear,
  manual,
  onManual,
  onEquipment,
}: {
  kind: EquipmentKind;
  expected: string;
  equipment: Record<string, string>;
  confirmed: boolean;
  labelPhotoAttached: boolean;
  onConfirm: () => void;
  onClear: () => void;
  manual: boolean;
  onManual: () => void;
  onEquipment: (values: Record<string, string>) => void;
}) {
  const identified = equipment.brand || equipment.model || equipment.serial;
  return (
    <section className="mt-4 rounded-3xl border border-cyan-400/20 bg-slate-900 p-5">
      {identified ? (
        <>
          <p className="text-xs font-black tracking-[.18em] text-emerald-300">
            ✓ {kind.toUpperCase()} IDENTIFIED
          </p>
          <h3 className="mt-3 text-xl font-black">
            {equipment.brand || "Equipment"}
          </h3>
          <p className="mt-1 text-slate-300">
            {equipment.model && `Model: ${equipment.model}`}
            {equipment.serial && ` · S/N: ${equipment.serial}`}
            {equipment.ratedPower && ` · ${equipment.ratedPower}`}
            {equipment.capacity && ` · ${equipment.capacity}`}
          </p>
        </>
      ) : (
        <p className="font-bold text-amber-200">
          We couldn’t clearly read this label.
        </p>
      )}
      <p className="mt-4 text-sm text-slate-400">
        Expected from project: {expected}
      </p>
      {!labelPhotoAttached ? (
        <p className="mt-3 rounded-xl border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100">
          Enter the label details now if they cannot be read automatically. A clear manufacturer-label photo is still required before this step can be completed.
        </p>
      ) : null}
      {!confirmed ? (
        <button
          type="button"
          onClick={onConfirm}
          disabled={!labelPhotoAttached}
          className="mt-4 w-full rounded-xl bg-cyan-400 px-4 py-3 font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {labelPhotoAttached ? "✓ YES, CONTINUE" : "ADD LABEL PHOTO TO CONTINUE"}
        </button>
      ) : (
        <p className="mt-4 font-bold text-emerald-300">✓ Confirmed</p>
      )}
      <button
        type="button"
        onClick={onManual}
        className="mt-3 text-sm font-bold text-cyan-200"
      >
        {manual ? "HIDE MANUAL DETAILS" : "ENTER BRAND / MODEL DETAILS MANUALLY"}
      </button>
      {(identified || confirmed) && (
        <button
          type="button"
          onClick={onClear}
          className="ml-4 mt-3 text-sm font-bold text-rose-300"
        >
          CLEAR ENTERED DETAILS
        </button>
      )}
      {manual ? (
        <div className="mt-3 grid gap-3">
          <label className="text-sm">
            Brand
            <input
              className={inputClass}
              value={equipment.brand}
              onChange={(event) => onEquipment({ brand: event.target.value })}
            />
          </label>
          <label className="text-sm">
            Model
            <input
              className={inputClass}
              value={equipment.model}
              onChange={(event) => onEquipment({ model: event.target.value })}
            />
          </label>
          <label className="text-sm">
            {kind === "panel" ? "Panel rating" : "Capacity / rating"}
            <input
              className={inputClass}
              value={kind === "panel" ? equipment.ratedPower : equipment.capacity}
              onChange={(event) => onEquipment(kind === "panel" ? { ratedPower: event.target.value } : { capacity: event.target.value })}
            />
          </label>
          <label className="text-sm">
            Serial number
            <input
              className={inputClass}
              value={equipment.serial}
              onChange={(event) => onEquipment({ serial: event.target.value })}
            />
          </label>
        </div>
      ) : null}
    </section>
  );
}
function PhotoCapture({
  items,
  token,
  onUploaded,
  onRemove,
}: {
  items: Evidence[];
  token: string;
  onUploaded: (item: Evidence) => void;
  onRemove: (index: number) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const upload = async (file: File) => {
    setUploading(true);
    setError("");
    try {
      const uploadFile = await prepareEvidencePhoto(file);
      const form = new FormData();
      form.set("file", uploadFile);
      let response: Response | null = null;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          response = await fetch(
            `/api/commissioning/${encodeURIComponent(token)}/evidence`,
            { method: "POST", body: form },
          );
          break;
        } catch {
          if (attempt === 0)
            await new Promise((resolve) => window.setTimeout(resolve, 750));
        }
      }
      if (!response) {
        throw new Error(
          navigator.onLine
            ? "The photo could not reach the server. Check your connection and retry once the signal is stable."
            : "You are offline. Reconnect to upload this photo.",
        );
      }
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Photo upload failed.");
      if (typeof body.url !== "string" || !body.url) throw new Error("Photo storage did not return a usable image link. Please retry.");
      onUploaded({
        url: body.url,
        fileName: body.fileName,
        capturedAt: new Date().toISOString(),
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Photo upload failed.");
    } finally {
      setUploading(false);
    }
  };
  return (
    <div className="mt-4">
      {items.length ? (
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-200">
          <p>
            ✓ {items.length} photo{items.length === 1 ? "" : "s"} saved
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            {items.map((item, index) => (
              <div
                key={item.url}
                className="overflow-hidden rounded-lg border border-emerald-300/30"
              >
                <a href={item.url} target="_blank" rel="noreferrer">
                  <Image
                    src={item.url}
                    alt={`Evidence photo ${index + 1}`}
                    width={112}
                    height={84}
                    className="h-20 w-28 object-cover"
                  />
                  <span className="block px-2 py-1 text-center text-[11px] font-black">
                    VIEW PHOTO
                  </span>
                </a>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("Remove this photo from the draft?"))
                      onRemove(index);
                  }}
                  className="w-full border-t border-emerald-300/20 px-2 py-1.5 text-[11px] font-black text-rose-200 hover:bg-rose-500/10"
                >
                  REMOVE
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block cursor-pointer rounded-2xl border border-cyan-400/40 bg-cyan-400/10 px-4 py-5 text-center font-black text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
              event.currentTarget.value = "";
            }}
          />
          {uploading ? "UPLOADING PHOTO…" : "📷 TAKE PHOTO"}
        </label>
        <label className="block cursor-pointer rounded-2xl border border-cyan-400/40 bg-cyan-400/10 px-4 py-5 text-center font-black text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
              event.currentTarget.value = "";
            }}
          />
          {uploading ? "UPLOADING PHOTO…" : "🖼 CHOOSE FROM GALLERY"}
        </label>
      </div>
      {error ? <p className="mt-2 text-sm text-rose-300">{error}</p> : null}
    </div>
  );
}
function Commissioning({
  checks,
  checklist,
  measurements,
  onChecklist,
  onMeasurement,
  onClearChecklist,
  onClearMeasurements,
}: {
  checks: readonly string[];
  checklist: Record<string, string>;
  measurements: Record<string, string>;
  onChecklist: (key: string, value: string) => void;
  onMeasurement: (key: string, value: string) => void;
  onClearChecklist: () => void;
  onClearMeasurements: () => void;
}) {
  return (
    <section className="rounded-3xl bg-slate-900 p-5">
      <button
        type="button"
        onClick={() => checks.forEach((check) => onChecklist(check, "PASS"))}
        className="w-full rounded-2xl bg-emerald-400 px-4 py-4 font-black text-slate-950"
      >
        ✓ PASS ALL STANDARD TESTS
      </button>
      <button
        type="button"
        onClick={() => {
          if (window.confirm("Clear all commissioning test results?"))
            onClearChecklist();
        }}
        className="mt-3 w-full rounded-xl border border-rose-400/30 px-4 py-3 text-sm font-black text-rose-200"
      >
        CLEAR TEST RESULTS
      </button>
      <div className="mt-5 space-y-3">
        {checks.map((check) => (
          <div key={check} className="rounded-xl bg-slate-950 p-3">
            <div className="flex items-center justify-between gap-2">
              <b className="text-sm">{check}</b>
              <span className="text-xs font-black text-cyan-200">
                {checklist[check] || "PENDING"}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {["PASS", "FAIL", "N/A"].map((value) => (
                <button
                  type="button"
                  key={value}
                  onClick={() => onChecklist(check, value)}
                  className={`rounded-lg border py-2 text-xs font-bold ${checklist[check] === value ? "border-cyan-300 bg-cyan-400 text-slate-950" : "border-slate-700"}`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <h3 className="mt-6 text-lg font-black">Relevant measurements</h3>
      <p className="mt-1 text-sm text-slate-400">
        Confirm available readings. Mark a reading N/A when it does not apply.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {[
          ["pvVoltage", "PV Voltage (V)"],
          ["batteryVoltage", "Battery (V)"],
          ["batterySoc", "Battery SOC (%)"],
          ["acOutput", "AC Output (V)"],
        ].map(([key, label]) => (
          <label key={key} className="rounded-xl bg-slate-950 p-3 text-sm">
            {label}
            <div className="mt-2 flex gap-2">
              <input
                className="min-w-0 flex-1 rounded-lg bg-slate-900 px-3 py-2"
                type="number"
                inputMode="decimal"
                value={measurements[key] || ""}
                onChange={(event) => onMeasurement(key, event.target.value)}
              />
              <button
                type="button"
                onClick={() => onMeasurement(key, "N/A")}
                className="rounded-lg border border-slate-700 px-3 text-xs font-bold"
              >
                N/A
              </button>
            </div>
          </label>
        ))}
      </div>
      <button
        type="button"
        onClick={() => {
          if (window.confirm("Clear all recorded measurements?"))
            onClearMeasurements();
        }}
        className="mt-4 text-sm font-bold text-rose-300"
      >
        CLEAR MEASUREMENTS
      </button>
    </section>
  );
}
function Handover({
  customer,
  technician,
  handover,
  termsAccepted,
  customerSignature,
  technicianSignature,
  savedTechnicianSignature,
  onAll,
  onToggle,
  onTermsAccepted,
  onCustomerSignature,
  onTechnicianSignature,
}: {
  customer: string;
  technician: string;
  handover: Record<string, boolean>;
  termsAccepted: boolean;
  customerSignature: string;
  technicianSignature: string;
  savedTechnicianSignature?: string | null;
  onAll: () => void;
  onToggle: (item: string, value: boolean) => void;
  onTermsAccepted: (value: boolean) => void;
  onCustomerSignature: (value: string) => void;
  onTechnicianSignature: (value: string) => void;
}) {
  return (
    <section className="rounded-3xl bg-slate-900 p-5">
      <button
        type="button"
        onClick={onAll}
        className="w-full rounded-2xl bg-cyan-400 px-4 py-4 font-black text-slate-950"
      >
        CONFIRM ALL EXPLAINED
      </button>
      <div className="mt-4 space-y-2">
        {handoverItems.map((item) => (
          <label
            key={item}
            className="flex items-center gap-3 rounded-xl bg-slate-950 p-3 text-sm"
          >
            <input
              type="checkbox"
              checked={Boolean(handover[item])}
              onChange={(event) => onToggle(item, event.target.checked)}
            />
            {item === "Monitoring" ? "Monitoring explained / N/A" : `${item} explained`}
          </label>
        ))}
      </div>
      <div className="mt-6">
        <p className="text-xs font-black tracking-[.18em] text-cyan-300">
          TERMS &amp; CONDITIONS
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-300">Please allow the customer to review Betech Solar Installation Terms &amp; Conditions before signing.</p>
        <a href="https://www.betech.co.ke/p/terms" target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-xl border border-cyan-400/40 px-4 py-3 text-sm font-black text-cyan-200">OPEN TERMS &amp; CONDITIONS</a>
        <label className="mt-4 flex items-start gap-3 rounded-xl border border-cyan-400/20 bg-slate-950 p-3 text-sm leading-6 text-slate-100">
          <input type="checkbox" checked={termsAccepted} onChange={(event) => onTermsAccepted(event.target.checked)} className="mt-1" />
          <span>I have read, understood and agree to the Betech Solar Installation, Performance, Warranty &amp; After-Sales Terms &amp; Conditions.</span>
        </label>
        {termsAccepted ? <p className="mt-3 flex items-center gap-2 text-sm font-bold text-emerald-300"><span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400 text-xs text-slate-950">✓</span>Terms &amp; Conditions accepted</p> : <p className="mt-3 text-sm text-amber-200">Terms acceptance is required before the customer can sign.</p>}
      </div>
      <div className="mt-6">
        <p className="text-xs font-black tracking-[.18em] text-cyan-300">CUSTOMER SIGNATURE</p>
        <p className="mt-2 font-bold">{customer}</p>
        {termsAccepted ? <SignaturePad value={customerSignature} onChange={onCustomerSignature} label="Customer finger signature" /> : <div className="mt-3 rounded-2xl border-2 border-dashed border-slate-700 bg-slate-950 p-5 text-sm text-slate-400">Accept the Terms &amp; Conditions above to enable customer signature.</div>}
      </div>
      <div className="mt-6">
        <p className="text-xs font-black tracking-[.18em] text-cyan-300">TECHNICIAN SIGNATURE</p>
        <p className="mt-2 font-bold">{technician}</p>
        {savedTechnicianSignature ? <button type="button" onClick={() => onTechnicianSignature(savedTechnicianSignature)} className="my-3 rounded-lg border border-cyan-400 px-3 py-2">Use my saved signature</button> : null}
        <SignaturePad value={technicianSignature} onChange={onTechnicianSignature} label="Technician finger signature" />
      </div>
    </section>
  );
}
function SignaturePad({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  };
  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawing.current = true;
    canvas.setPointerCapture(event.pointerId);
    const ctx = canvas.getContext("2d");
    const p = point(event);
    ctx?.beginPath();
    ctx?.moveTo(p.x, p.y);
  };
  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    const p = point(event);
    ctx?.lineTo(p.x, p.y);
    if (ctx) {
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.stroke();
    }
  };
  const finish = () => {
    if (!drawing.current) return;
    drawing.current = false;
    const canvas = canvasRef.current;
    if (canvas) onChange(canvas.toDataURL("image/png"));
  };
  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    onChange("");
  };
  return (
    <div className="mt-3">
      <canvas
        ref={canvasRef}
        width={700}
        height={260}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerCancel={finish}
        className="h-40 w-full touch-none rounded-2xl border-2 border-dashed border-cyan-400/50 bg-white"
        aria-label={label}
      />
      {value ? (
        <p className="mt-2 text-sm font-bold text-emerald-300">
          ✓ Signature captured
        </p>
      ) : (
        <p className="mt-2 text-sm text-slate-400">
          Use your finger to sign here.
        </p>
      )}
      <button
        type="button"
        onClick={clear}
        className="mt-2 text-sm font-bold text-cyan-200"
      >
        CLEAR
      </button>
    </div>
  );
}
function Review({
  session,
  draft,
  completed,
  total,
  profile,
}: {
  session: Session;
  draft: Draft;
  completed: number;
  total: number;
  profile: ReturnType<typeof commissioningProfile>;
}) {
  const e = draft.equipment || {};
  const q = e.panelQuantity || "Project quantity";
  return (
    <section className="rounded-3xl bg-slate-900 p-5">
      <p className="text-xs font-black tracking-[.18em] text-emerald-300">
        {isReadyToIssue(draft).ready ? "READY FOR SIGN-OFF" : "COMPLETION REQUIRED"}
      </p>
      <h3 className="mt-2 text-2xl font-black">Final review</h3>
      <div className="mt-5 space-y-3 text-sm">
        {[
          ["Customer", session.project.customerName],
          ["Location", session.project.location],
          ...(profile.panels ? [["Panels", `${q} · ${e.panelBrand || "Confirmed"} ${e.panelModel || ""}`]] : []),
          ...(profile.inverter ? [["Inverter", `${e.inverterBrand || "Confirmed"} ${e.inverterModel || ""}`]] : []),
          ...(profile.battery ? [["Battery", `${e.batteryBrand || "Confirmed"} ${e.batteryModel || ""}`]] : []),
          ...commissioningEquipmentUnits(draft).filter((unit) => !["inverter", "battery"].includes(unit.kind)).map((unit) => [unit.label || unit.kind, `${unit.brand || "Confirmed"} ${unit.model || ""}`]),
          ["Protection evidence", "Complete"],
          ["Commissioning tests", "Complete"],
          ["Customer handover", "Complete"],
        ].map(([label, value]) => (
          <div
            key={label}
            className="flex items-center justify-between rounded-xl bg-slate-950 p-3"
          >
            <span className="text-slate-400">{label}</span>
            <span className="font-bold text-emerald-300">{value} ✓</span>
          </div>
        ))}
      </div>
      <p className="mt-5 text-sm text-slate-400">
        {completed}/{total} stages completed. Submitting issues the certificates using the configured supervisor signature and stamp once all required checks are complete.
      </p>
    </section>
  );
}
function IssuedView({ session, token }: { session: Session; token: string }) {
  const certificateHref = `/api/commissioning/${encodeURIComponent(token)}/certificate`;
  return (
    <main className="min-h-screen bg-[#f5f2ee] p-4 text-slate-900">
      <article className="mx-auto max-w-xl space-y-5 rounded-3xl border border-[#7a0000]/15 bg-white p-6 shadow-sm">
        <p className="text-xs font-black tracking-[.2em] text-[#7a0000]">
          BETECH SOLAR SOLUTIONS
        </p>
        <div className="rounded-2xl border border-emerald-700/20 bg-emerald-50 p-4">
          <p className="text-xs font-black tracking-[.16em] text-emerald-800">COMMISSIONED ✓</p>
          <h1 className="mt-2 text-2xl font-black">Completion & commissioning certificate</h1>
          <p className="mt-2 text-sm text-slate-600">Certificate No: {session.certificateNo}</p>
        </div>
        <p className="text-sm text-slate-700">
          Project: {session.project.reference}
          <br />
          Customer: {session.project.customerName}
          <br />
          Issued:{" "}
          {session.issuedAt ? new Date(session.issuedAt).toLocaleString() : "—"}
        </p>
        <a href={certificateHref} className="block w-full rounded-xl bg-[#7a0000] px-4 py-3 text-center font-black text-white">
          DOWNLOAD FORMAL CERTIFICATE & EVIDENCE REPORT (PDF)
        </a>
        <p className="text-xs leading-5 text-slate-500">The issued record is view-only. The downloadable PDF contains the professional certificate and installation evidence report only.</p>
      </article>
    </main>
  );
}
function ProfessionalReviewPendingView({ session, busy, error, onIssue }: { session: Session; busy: boolean; error: string; onIssue: () => void }) {
  return <main className="min-h-screen bg-[#f5f2ee] p-4 text-slate-900"><article className="mx-auto max-w-xl space-y-5 rounded-3xl border border-[#7a0000]/15 bg-white p-6 shadow-sm"><p className="text-xs font-black tracking-[.2em] text-[#7a0000]">BETECH SOLAR SOLUTIONS</p><h1 className="text-2xl font-black">Installation details submitted</h1><p>Generate your certificates using the configured supervisor signature and company stamp. No separate approval or supervisor sign-off is required.</p><p>Project: {session.project.reference}<br />Customer: {session.project.customerName}</p>{error ? <p role="alert">{error}</p> : null}<button disabled={busy} onClick={onIssue} className="w-full rounded-xl bg-[#7a0000] px-4 py-3 font-bold text-white disabled:opacity-50">{busy ? "Generating certificates..." : "Generate certificates"}</button></article></main>;
}
