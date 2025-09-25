"use client";
import { useEffect, useState } from "react";

export default function AdminSettings() {
  const [form, setForm] = useState({
    apiBase: "",
    apiKey: "",
    apiSecret: "",
  });
  const [ok, setOk] = useState<string>("");

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/settings/jumia");
      if (r.ok) setForm(await r.json());
    })();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setOk("");
    const r = await fetch("/api/settings/jumia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setOk(r.ok ? "Saved" : "Failed");
  }

  return (
    <main className="mx-auto max-w-2xl p-6 text-slate-100">
      <h1 className="mb-4 text-2xl font-semibold">Jumia API Settings</h1>
      <form onSubmit={save} className="space-y-4">
        <label className="block">
          <div className="text-sm text-slate-400">API Base URL</div>
          <input className="w-full rounded-md bg-[#0b0e13] p-2 border border-white/10"
                 value={form.apiBase}
                 onChange={e=>setForm(v=>({...v, apiBase: e.target.value}))}/>
        </label>
        <label className="block">
          <div className="text-sm text-slate-400">API Key</div>
          <input className="w-full rounded-md bg-[#0b0e13] p-2 border border-white/10"
                 value={form.apiKey}
                 onChange={e=>setForm(v=>({...v, apiKey: e.target.value}))}/>
        </label>
        <label className="block">
          <div className="text-sm text-slate-400">API Secret</div>
          <input className="w-full rounded-md bg-[#0b0e13] p-2 border border-white/10"
                 value={form.apiSecret}
                 onChange={e=>setForm(v=>({...v, apiSecret: e.target.value}))}/>
        </label>
        <button className="rounded-md bg-yellow-400 text-black px-4 py-2 font-medium">
          Save
        </button>
        {ok && <span className="ml-3 text-sm text-slate-300">{ok}</span>}
      </form>
    </main>
  );
}
