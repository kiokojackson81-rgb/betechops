"use client";

import { useState } from "react";
import type { SerializedSiteVisit } from "@/lib/siteVisitShared";

type UsageMode = "DAILY_HOURS" | "EVENTS_DAILY" | "EVENTS_WEEKLY" | "ALWAYS_ON";
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
  qty: number;
  watts: number | null;
  ratingKnown: boolean;
  usageMode: UsageMode;
  hours: number;
  uses: number;
  minutes: number;
  period: string;
  simultaneous: number;
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
  const [home, setHome] = useState({
    bedrooms: "",
    occupants: "",
    type: "House",
    units: "1",
    notes: "",
  });
  const add = (preset: LoadPreset) =>
    setLoads((current) => [
      ...current,
      {
        id: Date.now() + current.length,
        kind: preset.key,
        name: preset.name,
        qty: 1,
        watts: preset.watts,
        ratingKnown: true,
        usageMode: preset.alwaysOn ? "ALWAYS_ON" : "DAILY_HOURS",
        hours: 4,
        uses: 1,
        minutes: 15,
        period: preset.alwaysOn ? "Both" : "Day",
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
  const addUnknown = () =>
    setLoads((current) => [
      ...current,
      {
        id: Date.now() + current.length,
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
  const edit = (id: number, patch: Partial<Load>) =>
    setLoads((current) =>
      current.map((load) => (load.id === id ? { ...load, ...patch } : load)),
    );
  const detail = (load: Load, key: string, value: string) =>
    edit(load.id, { details: { ...load.details, [key]: value } });
  const loadWh = (load: Load) =>
    !load.watts
      ? 0
      : load.usageMode === "ALWAYS_ON"
        ? load.qty * load.watts * 24
        : load.usageMode === "DAILY_HOURS"
          ? load.qty * load.watts * load.hours
          : (load.qty * load.watts * load.uses * load.minutes) /
            60 /
            (load.usageMode === "EVENTS_WEEKLY" ? 7 : 1);
  const connected = loads.reduce(
    (total, load) => total + (load.watts || 0) * load.qty,
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
        <section className="sticky top-2 z-10 rounded-2xl bg-slate-900 p-4">
          <b>Known-load summary</b>
          <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
            <span>{(connected / 1000).toFixed(2)} kW connected</span>
            <span>{(daily / 1000).toFixed(2)} kWh/day</span>
            <span>{unknown} unknown ratings</span>
          </div>
        </section>
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
            <Field label="People normally in the home">
              <input
                className={input}
                type="number"
                min="0"
                value={home.occupants}
                onChange={(event) =>
                  setHome({ ...home, occupants: event.target.value })
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
            <label className="sm:col-span-2 text-sm font-semibold text-slate-200">
              Project comments and customer priorities
              <textarea
                className={`${input} min-h-28`}
                value={home.notes}
                onChange={(event) =>
                  setHome({ ...home, notes: event.target.value })
                }
                placeholder="What must work during an outage? Budget, expansion, concerns, or special requests."
              />
            </label>
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
            <select className={input}>
              <option>Prepaid meter</option>
              <option>Postpaid meter</option>
              <option>Unknown</option>
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
    <article className="mt-5 rounded-2xl bg-slate-950 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <b>
          {load.name} {index + 1}
        </b>
        <div className="flex gap-4">
          <button type="button" onClick={addAnother} className="text-cyan-300">
            Add another
          </button>
          <button type="button" onClick={remove} className="text-rose-300">
            Remove
          </button>
        </div>
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
              edit(load.id, { qty: Number(event.target.value) })
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
              value={load.watts || ""}
              onChange={(event) =>
                edit(load.id, { watts: Number(event.target.value) })
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
                edit(load.id, { hours: Number(event.target.value) })
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
                  edit(load.id, { uses: Number(event.target.value) })
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
                  edit(load.id, { minutes: Number(event.target.value) })
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
              edit(load.id, { simultaneous: Number(event.target.value) })
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
    </article>
  );
}
