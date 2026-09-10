"use client";

import { useEffect, useRef, useState } from "react";

type CompanyDocuments = {
  digitalStampUrl: string | null;
  digitalStampEnabled: boolean;
};

const emptyDocuments: CompanyDocuments = {
  digitalStampUrl: null,
  digitalStampEnabled: false,
};

export default function CompanyDocumentsClient() {
  const [documents, setDocuments] = useState<CompanyDocuments>(emptyDocuments);
  const [status, setStatus] = useState("Loading company documents…");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = async () => {
    const response = await fetch("/api/admin/branding", { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error || "Unable to load company documents.");
    setDocuments({
      digitalStampUrl: typeof payload?.companyDocuments?.digitalStampUrl === "string" ? payload.companyDocuments.digitalStampUrl : null,
      digitalStampEnabled: Boolean(payload?.companyDocuments?.digitalStampEnabled),
    });
  };

  useEffect(() => {
    void load().then(() => setStatus("")).catch((error) => setStatus(error instanceof Error ? error.message : "Unable to load company documents."));
  }, []);

  const submit = async (form: FormData, success: string) => {
    setSaving(true);
    setStatus("");
    try {
      const response = await fetch("/api/admin/branding", { method: "POST", body: form });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Unable to save the digital stamp.");
      await load();
      setStatus(success);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to save the digital stamp.");
    } finally {
      setSaving(false);
    }
  };

  const upload = async (file: File) => {
    if (file.type !== "image/png") {
      setStatus("Upload a PNG stamp template with a transparent background.");
      return;
    }
    const form = new FormData();
    form.set("digitalStamp", file);
    form.set("digitalStampEnabled", "true");
    await submit(form, "Digital stamp uploaded and enabled.");
  };

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6 text-slate-100">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">Settings · Company Documents</p>
        <h1 className="mt-2 text-3xl font-semibold">Digital Stamp</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Upload one reusable Betech PNG stamp template. Each completion certificate automatically overlays the customer signing date when the stamp is enabled.</p>
      </header>

      <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6">
        <input ref={fileRef} type="file" accept="image/png" className="hidden" onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
          event.currentTarget.value = "";
        }} />
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_260px] md:items-center">
          <div>
            <h2 className="text-lg font-semibold">Betech Solar Solutions rubber stamp</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">Use a high-resolution transparent PNG without a fixed date. The certificate prints it at approximately 35–45 mm beside the authorised technician signature.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" disabled={saving} onClick={() => fileRef.current?.click()} className="rounded-xl bg-cyan-400 px-4 py-3 text-sm font-bold text-slate-950 disabled:opacity-50">
                {documents.digitalStampUrl ? "Replace stamp image" : "Upload stamp image"}
              </button>
              {documents.digitalStampUrl ? <button type="button" disabled={saving} onClick={() => {
                if (window.confirm("Remove the digital stamp from future certificates?")) {
                  const form = new FormData();
                  form.set("removeDigitalStamp", "true");
                  form.set("digitalStampEnabled", "false");
                  void submit(form, "Digital stamp removed.");
                }
              }} className="rounded-xl border border-rose-400/40 px-4 py-3 text-sm font-bold text-rose-200 disabled:opacity-50">Remove stamp</button> : null}
            </div>
            <label className="mt-5 flex items-center gap-3 text-sm text-slate-200">
              <input type="checkbox" checked={documents.digitalStampEnabled} disabled={!documents.digitalStampUrl || saving} onChange={(event) => {
                const form = new FormData();
                form.set("digitalStampEnabled", String(event.target.checked));
                void submit(form, event.target.checked ? "Automatic certificate stamping enabled." : "Automatic certificate stamping disabled.");
              }} />
              Automatically stamp newly issued completion certificates
            </label>
          </div>
          <div className="flex min-h-56 items-center justify-center rounded-2xl border border-dashed border-white/15 bg-slate-950/70 p-4">
            {documents.digitalStampUrl ? <img src={documents.digitalStampUrl} alt="Configured Betech digital stamp" className="max-h-56 max-w-full object-contain" /> : <p className="text-center text-sm text-slate-500">No stamp template uploaded.</p>}
          </div>
        </div>
        {status ? <p className={`mt-5 text-sm ${/unable|upload a png/i.test(status) ? "text-rose-300" : "text-emerald-300"}`}>{status}</p> : null}
      </section>
    </main>
  );
}
