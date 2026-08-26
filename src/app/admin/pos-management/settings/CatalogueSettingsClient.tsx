"use client";

import { useEffect, useState } from "react";
import { showToast } from "@/lib/ui/toast";

type Settings = {
  installationBand1Max: number; installationBand1Fee: number;
  installationBand2Max: number; installationBand2Fee: number;
  installationBand3Max: number; installationBand3Fee: number;
  installationBand4Max: number; installationBand4Fee: number;
  zone1TransportFee: number; zone2TransportFee: number; zone3TransportFee: number;
};

const defaults: Settings = { installationBand1Max: 50000, installationBand1Fee: 8000, installationBand2Max: 100000, installationBand2Fee: 15000, installationBand3Max: 350000, installationBand3Fee: 25000, installationBand4Max: 800000, installationBand4Fee: 35000, zone1TransportFee: 3000, zone2TransportFee: 7500, zone3TransportFee: 15000 };

export default function CatalogueSettingsClient() {
  const [settings, setSettings] = useState(defaults);
  const [saving, setSaving] = useState(false);
  useEffect(() => { void fetch("/api/admin/pos-products/settings", { cache: "no-store" }).then((response) => response.json()).then((json) => json.settings && setSettings(json.settings)); }, []);
  const setValue = (key: keyof Settings, value: string) => setSettings((current) => ({ ...current, [key]: Number(value || 0) }));
  const save = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/pos-products/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof json.error === "string" ? json.error : "Could not save settings");
      setSettings(json.settings);
      showToast("Installation and delivery rules saved", "success");
    } catch (error) { showToast(error instanceof Error ? error.message : "Could not save settings", "error"); }
    finally { setSaving(false); }
  };
  const field = "mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-white outline-none focus:border-cyan-400";
  return <div className="grid gap-6 xl:grid-cols-2">
    <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6"><div className="text-xs uppercase tracking-[0.22em] text-cyan-300">Installation rules</div><h2 className="mt-2 text-2xl font-semibold text-white">Standard price bands</h2><p className="mt-2 text-sm text-slate-400">Product overrides take priority. Prices above the final band require a site assessment.</p><div className="mt-5 space-y-4">{([1,2,3,4] as const).map((band) => <div key={band} className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-950/50 p-4 sm:grid-cols-2"><label className="text-sm text-slate-300">Band {band} maximum<input type="number" min="0" className={field} value={settings[`installationBand${band}Max`]} onChange={(event) => setValue(`installationBand${band}Max`, event.target.value)} /></label><label className="text-sm text-slate-300">Installation fee<input type="number" min="0" className={field} value={settings[`installationBand${band}Fee`]} onChange={(event) => setValue(`installationBand${band}Fee`, event.target.value)} /></label></div>)}</div></section>
    <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6"><div className="text-xs uppercase tracking-[0.22em] text-emerald-300">Delivery rules</div><h2 className="mt-2 text-2xl font-semibold text-white">Default zone transport</h2><p className="mt-2 text-sm text-slate-400">County and town determine the zone. Products can override these amounts.</p><div className="mt-5 space-y-4">{([1,2,3] as const).map((zone) => <label key={zone} className="block rounded-2xl border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-300">Zone {zone} default fee<input type="number" min="0" className={field} value={settings[`zone${zone}TransportFee`]} onChange={(event) => setValue(`zone${zone}TransportFee`, event.target.value)} /></label>)}</div><button type="button" onClick={() => void save()} disabled={saving} className="mt-6 w-full rounded-2xl bg-emerald-500 px-5 py-4 font-semibold text-slate-950 disabled:opacity-60">{saving ? "Saving..." : "Save installation & delivery rules"}</button></section>
  </div>;
}
