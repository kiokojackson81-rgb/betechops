"use client";

import { useEffect, useState } from "react";
import type { SerializedSiteVisit } from "@/lib/siteVisitShared";

type UsageMode = "DAILY_HOURS" | "EVENTS_DAILY" | "EVENTS_WEEKLY" | "ALWAYS_ON";
type NumericField = number | "";
type LoadPreset = {
  key: string;
  name: string;
  watts: number;
  group: string;
  heavy?: boolean;
  alwaysOn?: boolean;
};
type Load = {
  id: number;
  kind: string;
  name: string;
  qty: NumericField;
  watts: NumericField | null;
  ratingKnown: boolean;
  usageMode: UsageMode;
  hours: NumericField;
  uses: NumericField;
  minutes: NumericField;
  period: string;
  simultaneous: NumericField;
  essential: boolean;
  design: string;
  photo: boolean;
  details: Record<string, string>;
};

const presets: LoadPreset[] = [
  { key: "lights", name: "Lights", watts: 10, group: "Lighting" },
  { key: "tv", name: "TV", watts: 90, group: "Living and office" },
  {
    key: "fridge",
    name: "Fridge",
    watts: 150,
    group: "Kitchen",
    alwaysOn: true,
  },
  {
    key: "freezer",
    name: "Freezer",
    watts: 180,
    group: "Kitchen",
    alwaysOn: true,
  },
  { key: "microwave", name: "Microwave", watts: 1000, group: "Kitchen" },
  { key: "kettle", name: "Kettle", watts: 2000, group: "Kitchen", heavy: true },
  {
    key: "cooker",
    name: "Cooker / oven",
    watts: 3500,
    group: "Kitchen",
    heavy: true,
  },
  {
    key: "washing",
    name: "Washing machine",
    watts: 700,
    group: "Water and laundry",
  },
  {
    key: "iron",
    name: "Iron",
    watts: 1200,
    group: "Water and laundry",
    heavy: true,
  },
  {
    key: "shower",
    name: "Instant shower",
    watts: 3500,
    group: "Water and laundry",
    heavy: true,
  },
  {
    key: "water-pump",
    name: "Water pump",
    watts: 750,
    group: "Water and laundry",
  },
  {
    key: "borehole-pump",
    name: "Borehole pump",
    watts: 1500,
    group: "Water and laundry",
  },
  {
    key: "cctv",
    name: "CCTV system",
    watts: 60,
    group: "Security and connectivity",
    alwaysOn: true,
  },
  {
    key: "electric-fence",
    name: "Electric fence",
    watts: 25,
    group: "Security and connectivity",
    alwaysOn: true,
  },
  {
    key: "electric-gate",
    name: "Electric gate",
    watts: 300,
    group: "Security and connectivity",
  },
  {
    key: "wifi",
    name: "Wi-Fi / fibre ONT",
    watts: 20,
    group: "Security and connectivity",
    alwaysOn: true,
  },
  { key: "laptop", name: "Laptop", watts: 65, group: "Living and office" },
  {
    key: "desktop",
    name: "Desktop computer",
    watts: 200,
    group: "Living and office",
  },
  { key: "printer", name: "Printer", watts: 100, group: "Living and office" },
  {
    key: "ac",
    name: "Air conditioner",
    watts: 1200,
    group: "Living and office",
    heavy: true,
  },
];
const input =
  "mt-1 w-full rounded-xl border border-white/10 bg-slate-950 p-3 text-white";
const readNumber = (value: NumericField | null) =>
  typeof value === "number" ? value : 0;
const numberOrBlank = (value: string): NumericField =>
  value === "" ? "" : Number(value);
const draftStorageKey = "betech-site-assessment-draft-v1";
const emptyHome = {
  bedrooms: "",
  type: "House",
  units: "1",
  notes: "",
};
const emptyElectrical = {
  billing: "Prepaid meter",
  grid: "Connected to grid",
  wiring: "Wiring complete",
  meterId: "",
  monthlyKwh: "",
  monthlyBill: "",
  tariff: "",
  systemGoal: "Backup during outages",
  backupHours: "8",
  budget: "",
};
const lightAreas = [
  "Living area",
  "Bedroom",
  "Kitchen",
  "Bathroom",
  "Balcony",
  "Outdoor",
  "Security",
  "Floodlight",
  "Other",
];
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="text-sm font-semibold text-slate-200">
      {label}
      {children}
    </label>
  );
}

export default function SiteAssessmentPublicClient({
  visit,
}: {
  visit: SerializedSiteVisit;
}) {
  const [loads, setLoads] = useState<Load[]>([]);
  const [home, setHome] = useState(emptyHome);
  const [electrical, setElectrical] = useState(emptyElectrical);
  const [draftLoaded, setDraftLoaded] = useState(false);
  useEffect(() => {
    try {
      const draft = localStorage.getItem(draftStorageKey);
      if (draft) {
        const parsed = JSON.parse(draft) as Partial<{
          loads: Load[];
          home: typeof emptyHome;
          electrical: typeof emptyElectrical;
        }>;
        if (parsed.loads) setLoads(parsed.loads);
        if (parsed.home) setHome({ ...emptyHome, ...parsed.home });
        if (parsed.electrical)
          setElectrical({ ...emptyElectrical, ...parsed.electrical });
      }
    } catch {
      localStorage.removeItem(draftStorageKey);
    } finally {
      setDraftLoaded(true);
    }
  }, []);
  useEffect(() => {
    if (draftLoaded)
      localStorage.setItem(
        draftStorageKey,
        JSON.stringify({ loads, home, electrical }),
      );
  }, [draftLoaded, electrical, home, loads]);
  const clearDraft = () => {
    setLoads([]);
    setHome(emptyHome);
    setElectrical(emptyElectrical);
    localStorage.removeItem(draftStorageKey);
  };
  const focusLoad = (id: number) => {
    window.setTimeout(() => {
      document.getElementById(`assessment-load-${id}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  };
  const add = (preset: LoadPreset) => {
    const id = Date.now();
    const usageDefaults = {
      lights: {
        usageMode: "DAILY_HOURS" as UsageMode,
        hours: 6,
        period: "Night",
      },
      tv: { usageMode: "DAILY_HOURS" as UsageMode, hours: 5, period: "Night" },
      washing: {
        usageMode: "EVENTS_WEEKLY" as UsageMode,
        uses: 2,
        minutes: 120,
        period: "Day",
      },
      microwave: {
        usageMode: "EVENTS_DAILY" as UsageMode,
        uses: 2,
        minutes: 5,
        period: "Both",
      },
    }[preset.key];
    setLoads((current) => [
      ...current,
      {
        id,
        kind: preset.key,
        name: preset.name,
        qty: 1,
        watts: preset.watts,
        ratingKnown: true,
        usageMode: preset.alwaysOn
          ? "ALWAYS_ON"
          : usageDefaults?.usageMode || "DAILY_HOURS",
        hours: usageDefaults?.hours || 4,
        uses: usageDefaults?.uses || 1,
        minutes: usageDefaults?.minutes || 15,
        period: preset.alwaysOn ? "Both" : usageDefaults?.period || "Day",
        simultaneous: 1,
        essential: !preset.heavy,
        design: preset.heavy ? "No - leave on grid" : "Yes",
        photo: false,
        details:
          preset.key === "lights"
            ? { area: "Living area", bulbType: "LED" }
            : {},
      },
    ]);
    focusLoad(id);
  };
  const addUnknown = () => {
    const id = Date.now();
    setLoads((current) => [
      ...current,
      {
        id,
        kind: "unknown",
        name: "Unknown equipment",
        qty: 1,
        watts: null,
        ratingKnown: false,
        usageMode: "DAILY_HOURS",
        hours: 1,
        uses: 1,
        minutes: 15,
        period: "Both",
        simultaneous: 1,
        essential: false,
        design: "Yes",
        photo: false,
        details: {},
      },
    ]);
    focusLoad(id);
  };
  const edit = (id: number, patch: Partial<Load>) =>
    setLoads((current) =>
      current.map((load) => (load.id === id ? { ...load, ...patch } : load)),
    );
  const detail = (load: Load, key: string, value: string) =>
    edit(load.id, { details: { ...load.details, [key]: value } });
  const loadWh = (load: Load) =>
    !readNumber(load.watts)
      ? 0
      : load.usageMode === "ALWAYS_ON"
        ? readNumber(load.qty) * readNumber(load.watts) * 24
        : load.usageMode === "DAILY_HOURS"
          ? readNumber(load.qty) *
            readNumber(load.watts) *
            readNumber(load.hours)
          : (readNumber(load.qty) *
              readNumber(load.watts) *
              readNumber(load.uses) *
              readNumber(load.minutes)) /
            60 /
            (load.usageMode === "EVENTS_WEEKLY" ? 7 : 1);
  const connected = loads.reduce(
    (total, load) => total + readNumber(load.watts) * readNumber(load.qty),
    0,
  );
  const daily = loads.reduce((total, load) => total + loadWh(load), 0);
  const unknown = loads.filter((load) => !load.ratingKnown).length;
  const groups = Array.from(new Set(presets.map((preset) => preset.group))).map(
    (group) => ({
      group,
      items: presets.filter((preset) => preset.group === group),
    }),
  );
  return (
    <main className="min-h-screen bg-slate-950 p-3 text-slate-100">
      <div className="mx-auto max-w-3xl space-y-5">
        <header className="rounded-3xl bg-cyan-400 p-6 text-slate-950">
          <b className="text-xs uppercase tracking-widest">
            Betech Solar Solutions
          </b>
          <h1 className="mt-2 text-3xl font-black">Field Site Assessment</h1>
          <p>
            {visit.visitRef} · {visit.customerName}
          </p>
        </header>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-3 text-sm text-cyan-100">
          <span>
            {draftLoaded
              ? "Assessment details save automatically on this device."
              : "Loading saved assessment..."}
          </span>
          <button
            type="button"
            onClick={clearDraft}
            className="rounded-lg border border-rose-300/50 px-3 py-2 font-bold text-rose-200"
          >
            Clear saved draft
          </button>
        </div>
        <section className="rounded-3xl bg-slate-900 p-5">
          <h2 className="text-xl font-bold">Home and project details</h2>
          <p className="mt-1 text-sm text-slate-400">
            Capture the household scale and customer requirements before
            inspecting loads.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Property type">
              <select
                className={input}
                value={home.type}
                onChange={(event) =>
                  setHome({ ...home, type: event.target.value })
                }
              >
                <option>House</option>
                <option>Apartment</option>
                <option>Maisonette</option>
                <option>Rental units</option>
                <option>Small business at home</option>
              </select>
            </Field>
            <Field label="Number of bedrooms">
              <input
                className={input}
                type="number"
                min="0"
                value={home.bedrooms}
                onChange={(event) =>
                  setHome({ ...home, bedrooms: event.target.value })
                }
              />
            </Field>
            <Field label="Consumer units / distribution boards">
              <input
                className={input}
                type="number"
                min="1"
                value={home.units}
                onChange={(event) =>
                  setHome({ ...home, units: event.target.value })
                }
              />
            </Field>
          </div>
        </section>
        <section className="rounded-3xl bg-slate-900 p-5">
          <h2 className="text-xl font-bold">Add customer loads</h2>
          <p className="mt-1 text-sm text-slate-400">
            Select each load type once. Use “Add another” on its card for
            another TV, room of lights, or machine.
          </p>
          {groups.map(({ group, items }) => (
            <div key={group} className="mt-5">
              <h3 className="text-sm font-black uppercase tracking-wider text-cyan-300">
                {group}
              </h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {items.map((preset) => {
                  const exists = loads.some((load) => load.kind === preset.key);
                  return (
                    <button
                      type="button"
                      key={preset.key}
                      disabled={exists}
                      onClick={() => add(preset)}
                      className="rounded-full border border-cyan-400/40 px-3 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:border-white/10 disabled:text-slate-500"
                    >
                      {exists ? `${preset.name} added` : `+ ${preset.name}`}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addUnknown}
            className="mt-5 rounded-full bg-white/10 px-4 py-3"
          >
            + Unknown equipment
          </button>
          {loads.map((load, index) => (
            <LoadCard
              key={load.id}
              load={load}
              index={index}
              addAnother={() => {
                const preset = presets.find((item) => item.key === load.kind);
                if (preset) add(preset);
                else addUnknown();
              }}
              edit={edit}
              detail={detail}
              remove={() =>
                setLoads((current) =>
                  current.filter((item) => item.id !== load.id),
                )
              }
            />
          ))}
        </section>
        <Section title="Electrical supply and safety">
          <Field label="Meter and billing">
            <select
              className={input}
              value={electrical.billing}
              onChange={(event) =>
                setElectrical({ ...electrical, billing: event.target.value })
              }
            >
              <option>Prepaid meter</option>
              <option>Postpaid meter</option>
              <option>Unknown</option>
            </select>
          </Field>
          <Field label="Grid connection status">
            <select
              className={input}
              value={electrical.grid}
              onChange={(event) =>
                setElectrical({ ...electrical, grid: event.target.value })
              }
            >
              <option>Connected to grid</option>
              <option>Grid nearby, not connected</option>
              <option>No grid connection</option>
              <option>Grid status unknown</option>
            </select>
          </Field>
          <Field label="Existing house wiring">
            <select
              className={input}
              value={electrical.wiring}
              onChange={(event) =>
                setElectrical({ ...electrical, wiring: event.target.value })
              }
            >
              <option>Wiring complete</option>
              <option>Partially wired</option>
              <option>Not wired yet</option>
              <option>Wiring needs inspection</option>
            </select>
          </Field>
          <Field label="Supply type">
            <select className={input}>
              <option>Single phase</option>
              <option>Three phase</option>
              <option>Unknown</option>
            </select>
          </Field>
          <Field label="Main breaker rating (A)">
            <input className={input} type="number" />
          </Field>
          <Field label="Available solar breaker slots">
            <input className={input} type="number" />
          </Field>
          <Field label="Earthing condition">
            <select className={input}>
              <option>Visually confirmed</option>
              <option>Needs verification</option>
              <option>Not visible</option>
            </select>
          </Field>
          <Field label="Earth wire gauge / notes">
            <input className={input} />
          </Field>
          {electrical.grid === "Connected to grid" && (
            <>
              <Field
                label={
                  electrical.billing === "Postpaid meter"
                    ? "KPLC account number or meter number"
                    : "KPLC meter number or account number"
                }
              >
                <input
                  className={input}
                  value={electrical.meterId}
                  onChange={(event) =>
                    setElectrical({
                      ...electrical,
                      meterId: event.target.value,
                    })
                  }
                  placeholder="Enter the identifier printed on the bill or meter"
                />
              </Field>
              <Field label="Tariff category (if shown on bill)">
                <input
                  className={input}
                  value={electrical.tariff}
                  onChange={(event) =>
                    setElectrical({ ...electrical, tariff: event.target.value })
                  }
                  placeholder="Example: Domestic Ordinary (DC3)"
                />
              </Field>
              <Field label="Latest bill / token statement photo">
                <input
                  className={input}
                  type="file"
                  accept="image/*,application/pdf"
                  capture="environment"
                />
              </Field>
              <Field label="Last bill consumption (kWh)">
                <input
                  className={input}
                  type="number"
                  min="0"
                  value={electrical.monthlyKwh}
                  onChange={(event) =>
                    setElectrical({
                      ...electrical,
                      monthlyKwh: event.target.value,
                    })
                  }
                  placeholder="Example: 111"
                />
              </Field>
              <Field label="Last bill or monthly token amount (KES)">
                <input
                  className={input}
                  type="number"
                  min="0"
                  value={electrical.monthlyBill}
                  onChange={(event) =>
                    setElectrical({
                      ...electrical,
                      monthlyBill: event.target.value,
                    })
                  }
                  placeholder="Example: 3141"
                />
              </Field>
            </>
          )}
        </Section>
        <Section title="Customer energy goal and budget">
          <Field label="What does the customer want the solar system to do?">
            <select
              className={input}
              value={electrical.systemGoal}
              onChange={(event) =>
                setElectrical({ ...electrical, systemGoal: event.target.value })
              }
            >
              <option>Backup during outages</option>
              <option>Reduce electricity bill</option>
              <option>Completely off-grid</option>
              <option>Solar daytime loads only</option>
              <option>Not decided yet</option>
            </select>
          </Field>
          <Field label="Required backup hours during outage">
            <input
              className={input}
              type="number"
              min="0"
              step="0.5"
              value={electrical.backupHours}
              onChange={(event) =>
                setElectrical({
                  ...electrical,
                  backupHours: event.target.value,
                })
              }
              placeholder="Example: 8"
            />
          </Field>
          <Field label="Customer budget (KES), if shared">
            <input
              className={input}
              type="number"
              min="0"
              value={electrical.budget}
              onChange={(event) =>
                setElectrical({ ...electrical, budget: event.target.value })
              }
              placeholder="Leave blank if not discussed"
            />
          </Field>
        </Section>
        <Section title="Roof, mounting and access">
          <Field label="Roof type">
            <select className={input}>
              <option>Corrugated iron</option>
              <option>Decra</option>
              <option>Tile</option>
              <option>Concrete flat</option>
              <option>Ground mount</option>
            </select>
          </Field>
          <Field label="Roof condition">
            <select className={input}>
              <option>Good</option>
              <option>Fair</option>
              <option>Rust, leaks or sagging</option>
            </select>
          </Field>
          <Field label="Usable width (m)">
            <input className={input} type="number" />
          </Field>
          <Field label="Usable length (m)">
            <input className={input} type="number" />
          </Field>
          <Field label="Roof pitch (degrees)">
            <input className={input} type="number" />
          </Field>
          <Field label="Shading">
            <select className={input}>
              <option>None</option>
              <option>Morning shade</option>
              <option>Afternoon shade</option>
              <option>Heavy shade</option>
            </select>
          </Field>
          <Field label="Access method">
            <select className={input}>
              <option>Standard ladder</option>
              <option>Scaffolding needed</option>
              <option>Harness / high-risk access</option>
            </select>
          </Field>
          <Field label="Obstructions">
            <input className={input} placeholder="Trees, vents, HVAC" />
          </Field>
        </Section>
        <Section title="Equipment room and cable route">
          <Field label="Inverter location">
            <select className={input}>
              <option>Indoor</option>
              <option>Utility room</option>
              <option>Garage</option>
              <option>Outdoor sheltered</option>
            </select>
          </Field>
          <Field label="Battery area">
            <select className={input}>
              <option>Dry and ventilated</option>
              <option>Ventilation needed</option>
              <option>Unsuitable location</option>
            </select>
          </Field>
          <Field label="Array to inverter (m)">
            <input className={input} type="number" />
          </Field>
          <Field label="Inverter to main DB (m)">
            <input className={input} type="number" />
          </Field>
          <Field label="Inverter to battery (m)">
            <input className={input} type="number" />
          </Field>
          <Field label="Cable route">
            <select className={input}>
              <option>Easy</option>
              <option>Conduit / trunking</option>
              <option>Underground / multi-storey</option>
            </select>
          </Field>
        </Section>
        <section className="rounded-3xl bg-slate-900 p-5">
          <h2 className="text-xl font-bold">Required evidence</h2>
          <p className="mt-1 text-sm text-slate-400">
            Capture objective evidence before analysis.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              "Meter box",
              "Open main DB",
              "Earthing point",
              "Roof wide",
              "Roof material",
              "Roof horizons",
              "Inverter/battery wall",
              "Cable route",
            ].map((label) => (
              <label
                key={label}
                className="rounded-xl border border-white/10 p-3 font-bold"
              >
                {label}
                <input
                  className="mt-2 block w-full text-xs"
                  type="file"
                  accept="image/*"
                  capture="environment"
                />
              </label>
            ))}
          </div>
        </section>
        <section className="rounded-3xl bg-slate-900 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold">
              Project comments and customer priorities
            </h2>
            <button
              type="button"
              onClick={() => setHome({ ...home, notes: "" })}
              disabled={!home.notes}
              className="rounded-lg border border-white/20 px-3 py-2 text-sm font-bold text-slate-300 disabled:opacity-40"
            >
              Clear comments
            </button>
          </div>
          <textarea
            className={`${input} min-h-28`}
            value={home.notes}
            onChange={(event) =>
              setHome({ ...home, notes: event.target.value })
            }
            placeholder="What must work during an outage? Budget, expansion, concerns, or special requests."
          />
        </section>
        <section className="rounded-3xl border border-cyan-400/30 bg-cyan-400/10 p-5">
          <h2 className="text-xl font-bold">Known-load summary</h2>
          <div className="mt-3 grid gap-3 text-lg font-bold sm:grid-cols-3">
            <span>{(connected / 1000).toFixed(2)} kW connected</span>
            <span>{(daily / 1000).toFixed(2)} kWh/day</span>
            <span>{unknown} unknown ratings</span>
          </div>
        </section>
        <section className="rounded-3xl bg-amber-400/10 p-5">
          <b>Analyse Assessment with AI</b>
          <p className="mt-2 text-sm">
            AI will analyse usage patterns, known values and photo evidence
            together. Unknown ratings are never treated as zero.
          </p>
          <button
            type="button"
            disabled={!loads.length}
            className="mt-4 w-full rounded-xl bg-cyan-400 py-4 font-black text-slate-950 disabled:opacity-50"
          >
            Save draft and analyse assessment
          </button>
        </section>
      </div>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl bg-slate-900 p-5">
      <h2 className="text-xl font-bold">{title}</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}
function LoadCard({
  load,
  index,
  addAnother,
  edit,
  detail,
  remove,
}: {
  load: Load;
  index: number;
  addAnother: () => void;
  edit: (id: number, patch: Partial<Load>) => void;
  detail: (load: Load, key: string, value: string) => void;
  remove: () => void;
}) {
  const special = (key: string, label: string, children: React.ReactNode) => (
    <Field label={label} key={key}>
      {children}
    </Field>
  );
  return (
    <article
      id={`assessment-load-${load.id}`}
      className="mt-5 scroll-mt-5 rounded-2xl bg-slate-950 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <b>
          {load.name} {index + 1}
        </b>
        <button type="button" onClick={remove} className="text-rose-300">
          Remove
        </button>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Load name / description">
          <input
            className={input}
            value={load.name}
            onChange={(event) => edit(load.id, { name: event.target.value })}
          />
        </Field>
        <Field label="Quantity">
          <input
            className={input}
            type="number"
            min="1"
            value={load.qty}
            onChange={(event) =>
              edit(load.id, { qty: numberOrBlank(event.target.value) })
            }
          />
        </Field>
        {load.kind === "lights" && (
          <>
            {special(
              "area",
              "Light area",
              <select
                className={input}
                value={load.details.area || "Living area"}
                onChange={(event) => detail(load, "area", event.target.value)}
              >
                {lightAreas.map((area) => (
                  <option key={area}>{area}</option>
                ))}
              </select>,
            )}
            {special(
              "bulbType",
              "Bulb / fitting type",
              <select
                className={input}
                value={load.details.bulbType || "LED"}
                onChange={(event) =>
                  detail(load, "bulbType", event.target.value)
                }
              >
                <option>LED</option>
                <option>Fluorescent</option>
                <option>Halogen</option>
                <option>Incandescent</option>
                <option>Unknown</option>
              </select>,
            )}
          </>
        )}
        {load.kind === "tv" && (
          <>
            {special(
              "size",
              "TV screen size",
              <select
                className={input}
                value={load.details.size || "Unknown"}
                onChange={(event) => detail(load, "size", event.target.value)}
              >
                <option>Unknown</option>
                <option>24 inch or less</option>
                <option>32 inch</option>
                <option>43 inch</option>
                <option>50 inch</option>
                <option>55 inch</option>
                <option>65 inch or larger</option>
              </select>,
            )}
            {special(
              "display",
              "TV type",
              <select
                className={input}
                value={load.details.display || "LED / Smart"}
                onChange={(event) =>
                  detail(load, "display", event.target.value)
                }
              >
                <option>LED / Smart</option>
                <option>OLED</option>
                <option>Older LCD / plasma</option>
                <option>Unknown</option>
              </select>,
            )}
          </>
        )}
        {load.kind === "cctv" && (
          <>
            {special(
              "cameras",
              "Number of cameras",
              <input
                className={input}
                type="number"
                min="0"
                value={load.details.cameras || ""}
                onChange={(event) =>
                  detail(load, "cameras", event.target.value)
                }
              />,
            )}
            {special(
              "channels",
              "DVR / NVR channel count",
              <input
                className={input}
                type="number"
                min="0"
                value={load.details.channels || ""}
                onChange={(event) =>
                  detail(load, "channels", event.target.value)
                }
              />,
            )}
          </>
        )}
        {load.kind === "washing" && (
          <>
            {special(
              "heated",
              "Uses heated water",
              <select
                className={input}
                value={load.details.heated || "Unknown"}
                onChange={(event) => detail(load, "heated", event.target.value)}
              >
                <option>Unknown</option>
                <option>Yes</option>
                <option>No</option>
              </select>,
            )}
            {special(
              "loading",
              "Machine type",
              <select
                className={input}
                value={load.details.loading || "Top load"}
                onChange={(event) =>
                  detail(load, "loading", event.target.value)
                }
              >
                <option>Top load</option>
                <option>Front load</option>
                <option>Unknown</option>
              </select>,
            )}
          </>
        )}
        {["water-pump", "borehole-pump"].includes(load.kind) && (
          <>
            {special(
              "phase",
              "Motor phase",
              <select
                className={input}
                value={load.details.phase || "Unknown"}
                onChange={(event) => detail(load, "phase", event.target.value)}
              >
                <option>Unknown</option>
                <option>Single phase</option>
                <option>Three phase</option>
              </select>,
            )}
            {special(
              "starts",
              "Starts / runs per day",
              <input
                className={input}
                type="number"
                min="0"
                value={load.details.starts || ""}
                onChange={(event) => detail(load, "starts", event.target.value)}
              />,
            )}
          </>
        )}
        {load.kind === "electric-gate" && (
          <>
            {special(
              "motors",
              "Number of gate motors",
              <input
                className={input}
                type="number"
                min="1"
                value={load.details.motors || "1"}
                onChange={(event) => detail(load, "motors", event.target.value)}
              />,
            )}
            {special(
              "battery",
              "Gate backup battery present",
              <select
                className={input}
                value={load.details.battery || "Unknown"}
                onChange={(event) =>
                  detail(load, "battery", event.target.value)
                }
              >
                <option>Unknown</option>
                <option>Yes</option>
                <option>No</option>
              </select>,
            )}
          </>
        )}
        <Field label="Rating evidence">
          <select
            className={input}
            value={load.ratingKnown ? "KNOWN" : "UNKNOWN"}
            onChange={(event) =>
              edit(load.id, {
                ratingKnown: event.target.value === "KNOWN",
                watts: event.target.value === "KNOWN" ? load.watts || 0 : null,
              })
            }
          >
            <option value="KNOWN">Rating known</option>
            <option value="UNKNOWN">Unknown - take nameplate photo</option>
          </select>
        </Field>
        {load.ratingKnown ? (
          <Field label="Nameplate rating (W)">
            <input
              className={input}
              type="number"
              min="0"
              value={load.watts ?? ""}
              onChange={(event) =>
                edit(load.id, { watts: numberOrBlank(event.target.value) })
              }
            />
          </Field>
        ) : (
          <label className="text-sm font-semibold text-amber-200">
            Equipment / nameplate photo
            <input
              className="mt-1 block w-full rounded-xl border border-amber-400/30 p-3"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={() => edit(load.id, { photo: true })}
            />
            {load.photo && (
              <span className="mt-1 block text-xs">
                Photo captured. Do not guess the rating.
              </span>
            )}
          </label>
        )}
        <Field label="How is it used?">
          <select
            className={input}
            value={load.usageMode}
            onChange={(event) =>
              edit(load.id, { usageMode: event.target.value as UsageMode })
            }
          >
            <option value="DAILY_HOURS">Hours per day</option>
            <option value="EVENTS_DAILY">Uses per day x minutes</option>
            <option value="EVENTS_WEEKLY">Uses per week x minutes</option>
            <option value="ALWAYS_ON">24 hours / always connected</option>
          </select>
        </Field>
        {load.usageMode === "DAILY_HOURS" ? (
          <Field label="Average hours per day">
            <input
              className={input}
              type="number"
              min="0"
              step="0.25"
              value={load.hours}
              onChange={(event) =>
                edit(load.id, { hours: numberOrBlank(event.target.value) })
              }
            />
          </Field>
        ) : load.usageMode !== "ALWAYS_ON" ? (
          <>
            <Field
              label={
                load.usageMode === "EVENTS_WEEKLY"
                  ? "Uses per week"
                  : "Uses per day"
              }
            >
              <input
                className={input}
                type="number"
                min="0"
                value={load.uses}
                onChange={(event) =>
                  edit(load.id, { uses: numberOrBlank(event.target.value) })
                }
              />
            </Field>
            <Field label="Average minutes per use">
              <input
                className={input}
                type="number"
                min="0"
                value={load.minutes}
                onChange={(event) =>
                  edit(load.id, { minutes: numberOrBlank(event.target.value) })
                }
              />
            </Field>
          </>
        ) : (
          <div className="rounded-xl border border-cyan-400/20 p-3 text-sm text-cyan-100">
            Counted as a continuous 24-hour load.
          </div>
        )}
        <Field label="When is it normally used?">
          <select
            className={input}
            value={load.period}
            onChange={(event) => edit(load.id, { period: event.target.value })}
          >
            <option>Day</option>
            <option>Night</option>
            <option>Both</option>
          </select>
        </Field>
        <Field label="How many run at the same time?">
          <input
            className={input}
            type="number"
            min="0"
            value={load.simultaneous}
            onChange={(event) =>
              edit(load.id, { simultaneous: numberOrBlank(event.target.value) })
            }
          />
        </Field>
        <Field label="Essential during an outage?">
          <select
            className={input}
            value={load.essential ? "Yes" : "No"}
            onChange={(event) =>
              edit(load.id, { essential: event.target.value === "Yes" })
            }
          >
            <option>Yes</option>
            <option>No</option>
          </select>
        </Field>
        <Field label="Include in solar design?">
          <select
            className={input}
            value={load.design}
            onChange={(event) => edit(load.id, { design: event.target.value })}
          >
            <option>Yes</option>
            <option>No - leave on grid</option>
            <option>Backup only</option>
            <option>Daytime only</option>
          </select>
        </Field>
      </div>
      <button
        type="button"
        onClick={addAnother}
        className="mt-5 w-full rounded-xl border border-cyan-400/40 px-4 py-3 font-bold text-cyan-300"
      >
        + Add another {load.name}
      </button>
    </article>
  );
}
