"use client";

import { useEffect, useRef, useState } from "react";

type CompanyDocuments = {
  licensedProfessionalUserId: string | null;
  digitalStampUrl: string | null;
  digitalStampEnabled: boolean;
  licensedProfessionalName: string;
  licensedProfessionalTitle: string;
  licensedProfessionalQualification: string;
  licensedProfessionalLicenceNumber: string;
  licensedProfessionalSignatureUrl: string | null;
  licensedProfessionalActive: boolean;
};

const emptyDocuments: CompanyDocuments = {
  licensedProfessionalUserId: null,
  digitalStampUrl: null,
  digitalStampEnabled: false,
  licensedProfessionalName: "Jonathan Mugiira",
  licensedProfessionalTitle: "Senior Solar PV & Electrical Engineer",
  licensedProfessionalQualification: "EPRA T3 Solar Photovoltaic Technician",
  licensedProfessionalLicenceNumber: "EPRA/SPVT/001782",
  licensedProfessionalSignatureUrl: null,
  licensedProfessionalActive: true,
};

export default function CompanyDocumentsClient() {
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string | null; email: string }>>([]);
  const [documents, setDocuments] = useState<CompanyDocuments>(emptyDocuments);
  const [status, setStatus] = useState("Loading company documents…");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const professionalSignatureRef = useRef<HTMLInputElement | null>(null);

  const load = async () => {
    const response = await fetch("/api/admin/branding", { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error || "Unable to load company documents.");
    setAccounts(payload.professionalAccounts || []);
    setDocuments({
      licensedProfessionalUserId: payload.companyDocuments?.licensedProfessionalUserId || null,
      digitalStampUrl: typeof payload?.companyDocuments?.digitalStampUrl === "string" ? payload.companyDocuments.digitalStampUrl : null,
      digitalStampEnabled: Boolean(payload?.companyDocuments?.digitalStampEnabled),
      licensedProfessionalName: typeof payload?.companyDocuments?.licensedProfessionalName === "string" ? payload.companyDocuments.licensedProfessionalName : emptyDocuments.licensedProfessionalName,
      licensedProfessionalTitle: typeof payload?.companyDocuments?.licensedProfessionalTitle === "string" ? payload.companyDocuments.licensedProfessionalTitle : emptyDocuments.licensedProfessionalTitle,
      licensedProfessionalQualification: typeof payload?.companyDocuments?.licensedProfessionalQualification === "string" ? payload.companyDocuments.licensedProfessionalQualification : emptyDocuments.licensedProfessionalQualification,
      licensedProfessionalLicenceNumber: typeof payload?.companyDocuments?.licensedProfessionalLicenceNumber === "string" ? payload.companyDocuments.licensedProfessionalLicenceNumber : emptyDocuments.licensedProfessionalLicenceNumber,
      licensedProfessionalSignatureUrl: typeof payload?.companyDocuments?.licensedProfessionalSignatureUrl === "string" ? payload.companyDocuments.licensedProfessionalSignatureUrl : null,
      licensedProfessionalActive: payload?.companyDocuments?.licensedProfessionalActive !== false,
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

  const saveProfessionalProfile = async () => {
    const form = new FormData();
    form.set("licensedProfessionalUserId", documents.licensedProfessionalUserId || "");
    form.set("licensedProfessionalName", documents.licensedProfessionalName);
    form.set("licensedProfessionalTitle", documents.licensedProfessionalTitle);
    form.set("licensedProfessionalQualification", documents.licensedProfessionalQualification);
    form.set("licensedProfessionalLicenceNumber", documents.licensedProfessionalLicenceNumber);
    form.set("licensedProfessionalActive", String(documents.licensedProfessionalActive));
    await submit(form, "Licensed solar professional profile saved.");
  };

  const uploadProfessionalSignature = async (file: File) => {
    if (!/^image\/(png|jpeg|jpg)$/i.test(file.type)) {
      setStatus("Upload Jonathan's signature as a PNG or JPG image.");
      return;
    }
    const form = new FormData();
    form.set("licensedProfessionalSignature", file);
    await submit(form, "Licensed professional signature saved.");
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

      <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">Professional certification</p><h2 className="mt-2 text-lg font-semibold">Licensed Solar Professional</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">This approved profile is automatically placed on completion certificates after professional review. Technicians never type these licence details per project.</p></div>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-200"><input type="checkbox" checked={documents.licensedProfessionalActive} onChange={(event) => setDocuments((current) => ({ ...current, licensedProfessionalActive: event.target.checked }))} /> Active</label>
        </div>
        <input ref={professionalSignatureRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadProfessionalSignature(file); event.currentTarget.value = ""; }} />
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-slate-200">Professional staff account<select value={documents.licensedProfessionalUserId || ""} onChange={event => setDocuments(current => ({ ...current, licensedProfessionalUserId: event.target.value || null }))} className="rounded-xl border border-white/15 bg-slate-950 px-3 py-3 text-white"><option value="">Select the certifying professional</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.name || account.email} ({account.email})</option>)}</select></label>
          {([['Full name', 'licensedProfessionalName'], ['Professional title', 'licensedProfessionalTitle'], ['EPRA qualification', 'licensedProfessionalQualification'], ['EPRA licence number', 'licensedProfessionalLicenceNumber']] as const).map(([label, field]) => <label key={field} className="grid gap-2 text-sm font-semibold text-slate-200">{label}<input value={documents[field]} onChange={(event) => setDocuments((current) => ({ ...current, [field]: event.target.value }))} className="rounded-xl border border-white/15 bg-slate-950 px-3 py-3 text-white" /></label>)}
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_220px] md:items-center"><div className="flex flex-wrap gap-3"><button type="button" disabled={saving} onClick={() => void saveProfessionalProfile()} className="rounded-xl bg-emerald-400 px-4 py-3 text-sm font-bold text-slate-950 disabled:opacity-50">Save professional profile</button><button type="button" disabled={saving} onClick={() => professionalSignatureRef.current?.click()} className="rounded-xl border border-cyan-400/40 px-4 py-3 text-sm font-bold text-cyan-100 disabled:opacity-50">{documents.licensedProfessionalSignatureUrl ? 'Replace signature image' : 'Upload signature image'}</button></div><div className="flex min-h-20 items-center justify-center rounded-xl border border-dashed border-white/15 bg-slate-950/70 p-3">{documents.licensedProfessionalSignatureUrl ? <img src={documents.licensedProfessionalSignatureUrl} alt="Licensed professional signature" className="max-h-16 max-w-full object-contain" /> : <span className="text-center text-xs text-slate-500">Upload a signature image before certifying installations.</span>}</div></div>
      </section>
    </main>
  );
}
