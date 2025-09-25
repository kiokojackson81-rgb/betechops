"use client";
import { useEffect, useState } from "react";

type JumiaForm = {
  apiBase: string;
  issuer: string;
  clientId: string;
  refreshToken: string;
};

type WindowForm = {
  fromDay: number;
  toDay: number;
  adminEmails: string;
};

export default function AdminSettings() {
  const [j, setJ] = useState<JumiaForm>({ apiBase: "", issuer: "", clientId: "", refreshToken: "" });
  const [w, setW] = useState<WindowForm>({ fromDay: 24, toDay: 24, adminEmails: "" });
  const [okJ, setOkJ] = useState(""); const [okW, setOkW] = useState("");

  useEffect(() => {
    (async () => {
      const a = await fetch("/api/settings/jumia"); if (a.ok) setJ(await a.json());
      const b = await fetch("/api/settings/config"); if (b.ok) setW(await b.json());
    })();
  }, []);

  async function saveJ(e: React.FormEvent) {
    e.preventDefault(); setOkJ("");
    const r = await fetch("/api/settings/jumia", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(j) });
    setOkJ(r.ok ? "Saved" : "Failed");
  }
  async function saveW(e: React.FormEvent) {
    e.preventDefault(); setOkW("");
    const r = await fetch("/api/settings/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(w) });
    setOkW(r.ok ? "Saved" : "Failed");
  }

  const Input = (p: React.InputHTMLAttributes<HTMLInputElement>) =>
    <input {...p} className="w-full rounded-md bg-[#0b0e13] p-2 border border-white/10" />;

  return (
    <main className="mx-auto max-w-3xl p-6 text-slate-100">
      <h1 className="mb-6 text-2xl font-semibold">Settings</h1>

      <section className="mb-10 rounded-xl border border-white/10 bg-[#0b0e13] p-4">
        <h2 className="mb-3 text-lg font-medium">Jumia API (Global)</h2>
        <form onSubmit={saveJ} className="space-y-3">
          <label className="block">
            <div className="text-sm text-slate-400">API Base URL</div>
            <Input value={j.apiBase} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setJ(v=>({...v, apiBase:e.target.value}))}/>
          </label>
          <label className="block">
            <div className="text-sm text-slate-400">OIDC Issuer</div>
            <Input value={j.issuer} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setJ(v=>({...v, issuer:e.target.value}))}/>
          </label>
          <label className="block">
            <div className="text-sm text-slate-400">Client ID</div>
            <Input value={j.clientId} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setJ(v=>({...v, clientId:e.target.value}))}/>
          </label>
          <label className="block">
            <div className="text-sm text-slate-400">Refresh Token</div>
            <Input value={j.refreshToken} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setJ(v=>({...v, refreshToken:e.target.value}))}/>
          </label>
          <button className="rounded-md bg-yellow-400 text-black px-4 py-2 font-medium">Save</button>
          {okJ && <span className="ml-3 text-sm text-slate-300">{okJ}</span>}
        </form>
      </section>

      <section className="rounded-xl border border-white/10 bg-[#0b0e13] p-4">
        <h2 className="mb-3 text-lg font-medium">Commission Window</h2>
        <form onSubmit={saveW} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <div className="text-sm text-slate-400">From Day (1–28)</div>
              <Input type="number" min={1} max={28} value={w.fromDay} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setW(v=>({...v, fromDay:Number(e.target.value)}))}/>
            </label>
            <label className="block">
              <div className="text-sm text-slate-400">To Day (1–28)</div>
              <Input type="number" min={1} max={28} value={w.toDay} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setW(v=>({...v, toDay:Number(e.target.value)}))}/>
            </label>
          </div>
          <label className="block">
            <div className="text-sm text-slate-400">Admin Emails (comma separated)</div>
            <Input value={w.adminEmails} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setW(v=>({...v, adminEmails:e.target.value}))}/>
          </label>
          <button className="rounded-md bg-yellow-400 text-black px-4 py-2 font-medium">Save</button>
          {okW && <span className="ml-3 text-sm text-slate-300">{okW}</span>}
        </form>
      </section>
    </main>
  );
}
