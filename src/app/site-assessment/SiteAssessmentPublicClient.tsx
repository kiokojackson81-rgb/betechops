"use client";
import { useState } from "react";
import type { SerializedSiteVisit } from "@/lib/siteVisitShared";

const presets = [
  { name: "Lights", watts: 10 },
  { name: "TV", watts: 90 },
  { name: "Fridge", watts: 150 },
  { name: "Freezer", watts: 180 },
  { name: "Kettle", watts: 2000 },
  { name: "Iron", watts: 1200 },
  { name: "Water Pump", watts: 750 },
  { name: "Borehole Pump", watts: 1500 },
  { name: "Shower", watts: 3500 },
  { name: "AC", watts: 1200 },
];
type UsageMode = "DAILY_HOURS" | "EVENTS_DAILY" | "EVENTS_WEEKLY" | "ALWAYS_ON";
type Load = {
  id: number;
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
};
const input =
  "w-full rounded-xl border border-white/10 bg-slate-950 p-3 text-white";
export default function SiteAssessmentPublicClient({
  visit,
}: {
  visit: SerializedSiteVisit;
}) {
  const [loads, setLoads] = useState<Load[]>([]);
  const add = (name: string, watts: number) =>
    setLoads((x) => [
      ...x,
      {
        id: Date.now(),
        name,
        qty: 1,
        watts,
        ratingKnown: true,
        usageMode:
          name.includes("Fridge") || name.includes("Freezer")
            ? "ALWAYS_ON"
            : "DAILY_HOURS",
        hours: 4,
        uses: 1,
        minutes: 15,
        period: "Both",
        simultaneous: 1,
        essential: true,
        design: "Yes",
        photo: false,
      },
    ]);
  const edit = (id: number, p: Partial<Load>) =>
    setLoads((x) => x.map((a) => (a.id === id ? { ...a, ...p } : a)));
  const wh = (a: Load) =>
    !a.watts
      ? 0
      : a.usageMode === "ALWAYS_ON"
        ? a.qty * a.watts * 24
        : a.usageMode === "DAILY_HOURS"
          ? a.qty * a.watts * a.hours
          : (a.qty * a.watts * a.uses * a.minutes) /
            60 /
            (a.usageMode === "EVENTS_WEEKLY" ? 7 : 1);
  const connected = loads.reduce((s, a) => s + (a.watts || 0) * a.qty, 0);
  const daily = loads.reduce((s, a) => s + wh(a), 0);
  const unknown = loads.filter((a) => !a.ratingKnown).length;
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
          <h2 className="text-xl font-bold">Tap customer loads</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {presets.map((p) => (
              <button
                type="button"
                key={p.name}
                onClick={() => add(p.name, p.watts)}
                className="rounded-full border border-cyan-400/40 px-4 py-3 font-bold"
              >
                + {p.name}
              </button>
            ))}
            <button
              type="button"
              onClick={() => add("Unknown equipment", 0)}
              className="rounded-full bg-white/10 px-4 py-3"
            >
              + Unknown equipment
            </button>
          </div>
          {loads.map((a, i) => (
            <article key={a.id} className="mt-4 rounded-2xl bg-slate-950 p-4">
              <div className="flex justify-between">
                <b>
                  {a.name} {i + 1}
                </b>
                <button
                  type="button"
                  onClick={() =>
                    setLoads((x) => x.filter((v) => v.id !== a.id))
                  }
                  className="text-rose-300"
                >
                  Remove
                </button>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <input
                  className={input}
                  value={a.name}
                  onChange={(e) => edit(a.id, { name: e.target.value })}
                />
                <input
                  className={input}
                  type="number"
                  value={a.qty}
                  onChange={(e) => edit(a.id, { qty: +e.target.value })}
                  placeholder="Quantity"
                />
                <select
                  className={input}
                  value={a.ratingKnown ? "KNOWN" : "UNKNOWN"}
                  onChange={(e) =>
                    edit(a.id, {
                      ratingKnown: e.target.value === "KNOWN",
                      watts: e.target.value === "KNOWN" ? a.watts || 0 : null,
                    })
                  }
                >
                  <option value="KNOWN">Rating known</option>
                  <option value="UNKNOWN">Unknown - take photo</option>
                </select>
                {a.ratingKnown ? (
                  <input
                    className={input}
                    type="number"
                    value={a.watts || ""}
                    onChange={(e) => edit(a.id, { watts: +e.target.value })}
                    placeholder="Watts / nameplate rating"
                  />
                ) : (
                  <label className="rounded-xl border border-amber-400/30 p-3 text-amber-200">
                    Take equipment/nameplate photo
                    <input
                      className="mt-2 block w-full"
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={() => edit(a.id, { photo: true })}
                    />
                    {a.photo
                      ? "Photo captured - specification pending AI analysis"
                      : ""}
                  </label>
                )}
                <select
                  className={input}
                  value={a.usageMode}
                  onChange={(e) =>
                    edit(a.id, { usageMode: e.target.value as UsageMode })
                  }
                >
                  <option value="DAILY_HOURS">Hours per day</option>
                  <option value="EVENTS_DAILY">Uses/day x minutes</option>
                  <option value="EVENTS_WEEKLY">Uses/week x minutes</option>
                  <option value="ALWAYS_ON">24 hours / always connected</option>
                </select>
                {a.usageMode === "DAILY_HOURS" ? (
                  <input
                    className={input}
                    type="number"
                    value={a.hours}
                    onChange={(e) => edit(a.id, { hours: +e.target.value })}
                    placeholder="Hours/day"
                  />
                ) : a.usageMode !== "ALWAYS_ON" ? (
                  <>
                    <input
                      className={input}
                      type="number"
                      value={a.uses}
                      onChange={(e) => edit(a.id, { uses: +e.target.value })}
                      placeholder="Uses"
                    />
                    <input
                      className={input}
                      type="number"
                      value={a.minutes}
                      onChange={(e) => edit(a.id, { minutes: +e.target.value })}
                      placeholder="Minutes/use"
                    />
                  </>
                ) : null}
                <select
                  className={input}
                  value={a.period}
                  onChange={(e) => edit(a.id, { period: e.target.value })}
                >
                  <option>Day</option>
                  <option>Night</option>
                  <option>Both</option>
                </select>
                <input
                  className={input}
                  type="number"
                  value={a.simultaneous}
                  onChange={(e) =>
                    edit(a.id, { simultaneous: +e.target.value })
                  }
                  placeholder="Normally on together"
                />
                <select
                  className={input}
                  value={a.essential ? "Yes" : "No"}
                  onChange={(e) =>
                    edit(a.id, { essential: e.target.value === "Yes" })
                  }
                >
                  <option>Yes</option>
                  <option>No</option>
                </select>
                <select
                  className={input}
                  value={a.design}
                  onChange={(e) => edit(a.id, { design: e.target.value })}
                >
                  <option>Yes</option>
                  <option>No</option>
                  <option>Backup only</option>
                  <option>Daytime only</option>
                </select>
              </div>
            </article>
          ))}
        </section>
        <section className="rounded-3xl bg-slate-900 p-5">
          <h2 className="text-xl font-bold">Electrical supply and safety</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <select className={input}><option>Meter: Prepaid</option><option>Meter: Postpaid</option></select>
            <select className={input}><option>Supply: Single phase</option><option>Supply: Three phase</option><option>Supply: Unknown</option></select>
            <input className={input} type="number" placeholder="Main breaker rating (A)" />
            <input className={input} type="number" placeholder="Available solar breaker slots" />
            <select className={input}><option>Earthing: visually confirmed</option><option>Earthing: needs verification</option><option>Earthing: not visible</option></select>
            <input className={input} placeholder="Earth wire gauge / notes" />
          </div>
        </section>
        <section className="rounded-3xl bg-slate-900 p-5">
          <h2 className="text-xl font-bold">Roof, mounting and access</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <select className={input}><option>Roof: Corrugated iron</option><option>Roof: Decra</option><option>Roof: Tile</option><option>Roof: Concrete flat</option><option>Ground mount</option></select>
            <select className={input}><option>Condition: Good</option><option>Condition: Fair</option><option>Condition: Rust, leaks or sagging</option></select>
            <input className={input} type="number" placeholder="Usable width (m)" />
            <input className={input} type="number" placeholder="Usable length (m)" />
            <input className={input} type="number" placeholder="Roof pitch (degrees)" />
            <select className={input}><option>Shading: None</option><option>Morning shade</option><option>Afternoon shade</option><option>Heavy shade</option></select>
            <select className={input}><option>Access: Standard ladder</option><option>Scaffolding needed</option><option>Harness / high-risk access</option></select>
            <input className={input} placeholder="Obstructions: trees, vents, HVAC" />
          </div>
        </section>
        <section className="rounded-3xl bg-slate-900 p-5">
          <h2 className="text-xl font-bold">Equipment room and cable route</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <select className={input}><option>Inverter: Indoor</option><option>Utility room</option><option>Garage</option><option>Outdoor sheltered</option></select>
            <select className={input}><option>Battery: Dry and ventilated</option><option>Battery: ventilation needed</option><option>Battery: unsuitable location</option></select>
            <input className={input} type="number" placeholder="Array to inverter (m)" />
            <input className={input} type="number" placeholder="Inverter to main DB (m)" />
            <input className={input} type="number" placeholder="Inverter to battery (m)" />
            <select className={input}><option>Cable route: Easy</option><option>Conduit / trunking</option><option>Underground / multi-storey</option></select>
          </div>
        </section>
        <section className="rounded-3xl bg-slate-900 p-5">
          <h2 className="text-xl font-bold">Required evidence</h2>
          <p className="mt-1 text-sm text-slate-400">Capture objective evidence before analysis.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">{["Meter box", "Open main DB", "Earthing point", "Roof wide", "Roof material", "Roof horizons", "Inverter/battery wall", "Cable route"].map((label) => <label key={label} className="rounded-xl border border-white/10 p-3 font-bold">{label}<input className="mt-2 block w-full text-xs" type="file" accept="image/*" capture="environment" /></label>)}</div>
        </section>
        <section className="rounded-3xl bg-amber-400/10 p-5">
          <b>Analyse Assessment with AI</b>
          <p className="mt-2 text-sm">
            AI will analyse all usage patterns, known values and photo evidence
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
