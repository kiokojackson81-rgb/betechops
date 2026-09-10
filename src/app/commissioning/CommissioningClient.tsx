"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

type Evidence = { url: string; fileName?: string; capturedAt?: string };
type EquipmentKind = "panel" | "inverter" | "battery";
type Draft = {
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
  status: "DRAFT" | "ISSUED";
  readOnly: boolean;
  lastStep: string;
  progress: number;
  issuedAt: string | null;
  certificateNo: string | null;
  technicianName: string;
  project: {
    reference: string;
    customerName: string;
    location: string;
    system: string;
    expectedItems: string[];
  };
  data: Draft;
};
const checks = [
  "Inverter powers ON",
  "PV charging detected",
  "Battery charging",
  "Battery discharging",
  "Grid input detected",
  "Backup/changeover tested",
  "Protection devices installed",
  "Earthing connected",
  "Monitoring configured",
  "Customer training completed",
] as const;
const handoverItems = [
  "System operation",
  "Shutdown/startup",
  "Monitoring",
  "Warranty",
  "Load limitations",
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
  const loaded = useRef(false);
  const cacheKey = `betech-commissioning-draft:${token}`;
  const evidence = draft.evidence || {};
  const confirmations = draft.confirmations || {};
  const expected = useMemo(
    () => expectedPanel(session?.project.expectedItems || []),
    [session?.project.expectedItems],
  );
  const complete = (id: string) =>
    id === "panels"
      ? Boolean(
          evidence.panelLabel?.length &&
          confirmations.panel &&
          confirmations.panelQuantity,
        )
      : id === "array"
        ? Boolean(evidence.panelArray?.length)
        : id === "inverter"
          ? Boolean(
              evidence.inverterLabel?.length &&
              evidence.inverterInstallation?.length &&
              confirmations.inverter,
            )
          : id === "battery"
            ? Boolean(
                evidence.batteryLabel?.length &&
                evidence.batteryInstallation?.length &&
                confirmations.battery,
              )
            : id === "final-photos"
              ? Boolean(evidence.protection?.length && evidence.overall?.length)
              : id === "commissioning"
                ? checks.every((check) => Boolean(draft.checklist?.[check]))
                : id === "handover"
                  ? Boolean(
                      draft.signatures?.customer &&
                      draft.termsAcceptance?.accepted &&
                      handoverItems.every((item) => draft.handover?.[item]),
                    )
                  : false;
  const completedStages = steps
    .slice(0, -1)
    .filter((step) => complete(step.id)).length;
  const progress = Math.round((completedStages / 8) * 100);
  const firstIncomplete = Math.max(
    0,
    steps.findIndex((step) => !complete(step.id)),
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
        if (!merged.signatures?.technician)
          merged.signatures = {
            ...merged.signatures,
            technician: next.technicianName,
          };
        setSession(next);
        setDraft(merged);
        setLastStep(next.lastStep || "panels");
        const index = steps.findIndex((step) => step.id === next.lastStep);
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
    if (!loaded.current || session?.readOnly) return;
    localStorage.setItem(cacheKey, JSON.stringify(draft));
    if (!navigator.onLine) {
      setSaveState("offline");
      return;
    }
    setSaveState("saving");
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/commissioning/${encodeURIComponent(token)}`,
          {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ data: draft, lastStep, progress }),
          },
        );
        if (!response.ok) throw new Error();
        setSaveState("saved");
      } catch {
        setSaveState(navigator.onLine ? "error" : "offline");
      }
    }, 500);
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
    setLastStep(steps[index].id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const issue = async () => {
    if (
      !confirm(
        "Issue the completion certificate? This locks the commissioning record.",
      )
    )
      return;
    setError("");
    setSaveState("saving");
    try {
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
              status: "ISSUED",
              readOnly: true,
              certificateNo: body.certificateNo,
              issuedAt: body.issuedAt,
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
  if (session.readOnly) return <IssuedView session={session} token={token} />;
  const current = steps[activeStep];
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
              {completedStages}/8 stages complete
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
            STEP {activeStep + 1} OF 8
          </p>
          <h2 className="mt-2 text-2xl font-black">{current.label}</h2>
          <div className="mt-4">
            {current.id === "panels" && (
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
                signature={draft.signatures?.customer || ""}
                onAll={() =>
                  handoverItems.forEach((item) => patch("handover", item, true))
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
                onSignature={(value) => patch("signatures", "customer", value)}
              />
            )}
            {current.id === "review" && (
              <Review
                session={session}
                draft={draft}
                completed={completedStages}
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
                disabled={completedStages < 7}
                onClick={() => void issue()}
                className="w-full rounded-2xl bg-cyan-400 px-5 py-4 text-base font-black text-slate-950 disabled:opacity-40"
              >
                ISSUE COMPLETION CERTIFICATE
              </button>
            ) : (
              <button
                type="button"
                disabled={!canContinue}
                onClick={() => go(Math.min(7, activeStep + 1))}
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
      {items.length ? (
        <EquipmentConfirm
          kind="panel"
          expected={expected.text || "Project equipment"}
          equipment={equipment}
          confirmed={confirmed}
          onConfirm={onConfirm}
          onClear={onClearEquipment}
          manual={manual}
          onManual={onManual}
          onEquipment={onEquipment}
        />
      ) : null}
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
      {labelItems.length ? (
        <EquipmentConfirm
          kind={kind}
          expected={expected}
          equipment={equipment}
          confirmed={confirmed}
          onConfirm={onConfirm}
          onClear={onClearEquipment}
          manual={manual}
          onManual={onManual}
          onEquipment={onEquipment}
        />
      ) : null}
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
        label="TAKE LABEL PHOTO"
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
      {!confirmed ? (
        <button
          type="button"
          onClick={onConfirm}
          className="mt-4 w-full rounded-xl bg-cyan-400 px-4 py-3 font-black text-slate-950"
        >
          ✓ YES, CONTINUE
        </button>
      ) : (
        <p className="mt-4 font-bold text-emerald-300">✓ Confirmed</p>
      )}
      <button
        type="button"
        onClick={onManual}
        className="mt-3 text-sm font-bold text-cyan-200"
      >
        {manual ? "HIDE MANUAL DETAILS" : "ENTER DETAILS MANUALLY"}
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
  label = "TAKE / CHOOSE PHOTO",
}: {
  items: Evidence[];
  token: string;
  onUploaded: (item: Evidence) => void;
  onRemove: (index: number) => void;
  label?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const upload = async (file: File) => {
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch(
        `/api/commissioning/${encodeURIComponent(token)}/evidence`,
        { method: "POST", body: form },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Photo upload failed.");
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
      <label className="mt-3 block cursor-pointer rounded-2xl border border-cyan-400/40 bg-cyan-400/10 px-4 py-5 text-center font-black text-cyan-100">
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
        {uploading
          ? "UPLOADING PHOTO…"
          : items.length
            ? "RETAKE / ADD PHOTO"
            : label}
      </label>
      {error ? <p className="mt-2 text-sm text-rose-300">{error}</p> : null}
    </div>
  );
}
function Commissioning({
  checklist,
  measurements,
  onChecklist,
  onMeasurement,
  onClearChecklist,
  onClearMeasurements,
}: {
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
  handover,
  termsAccepted,
  signature,
  onAll,
  onToggle,
  onTermsAccepted,
  onSignature,
}: {
  customer: string;
  handover: Record<string, boolean>;
  termsAccepted: boolean;
  signature: string;
  onAll: () => void;
  onToggle: (item: string, value: boolean) => void;
  onTermsAccepted: (value: boolean) => void;
  onSignature: (value: string) => void;
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
        {termsAccepted ? <SignaturePad value={signature} onChange={onSignature} /> : <div className="mt-3 rounded-2xl border-2 border-dashed border-slate-700 bg-slate-950 p-5 text-sm text-slate-400">Accept the Terms &amp; Conditions above to enable customer signature.</div>}
      </div>
    </section>
  );
}
function SignaturePad({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
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
        aria-label="Customer finger signature"
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
}: {
  session: Session;
  draft: Draft;
  completed: number;
}) {
  const e = draft.equipment || {};
  const q = e.panelQuantity || "Project quantity";
  return (
    <section className="rounded-3xl bg-slate-900 p-5">
      <p className="text-xs font-black tracking-[.18em] text-emerald-300">
        READY TO ISSUE
      </p>
      <h3 className="mt-2 text-2xl font-black">Final review</h3>
      <div className="mt-5 space-y-3 text-sm">
        {[
          ["Customer", session.project.customerName],
          ["Location", session.project.location],
          [
            "Panels",
            `${q} · ${e.panelBrand || "Confirmed"} ${e.panelModel || ""}`,
          ],
          [
            "Inverter",
            `${e.inverterBrand || "Confirmed"} ${e.inverterModel || ""}`,
          ],
          [
            "Battery",
            `${e.batteryBrand || "Confirmed"} ${e.batteryModel || ""}`,
          ],
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
        {completed}/8 stages completed. Issuing locks the commissioning record.
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
