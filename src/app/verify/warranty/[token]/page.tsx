import { notFound } from "next/navigation";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { liveWarrantyStatus } from "@/lib/warrantyRules";
import { currentWarrantyEquipment, findWarrantyByVerificationToken } from "@/lib/warrantyCertificates";

function asSnapshot(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function date(value: unknown) {
  const raw = typeof value === "string" ? value : "";
  const parsed = new Date(raw);
  return raw && !Number.isNaN(parsed.getTime()) ? parsed.toLocaleDateString("en-KE", { day: "2-digit", month: "long", year: "numeric" }) : "Not recorded";
}

export const dynamic = "force-dynamic";

export default async function WarrantyVerificationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const certificate = await findWarrantyByVerificationToken(token);
  if (!certificate) notFound();
  const data = asSnapshot(certificate.data);
  const equipment = currentWarrantyEquipment(certificate);
  const status = liveWarrantyStatus(certificate, equipment);
  const valid = status === "ACTIVE";
  return <main className="min-h-screen bg-[#f7f4ef] p-4 text-slate-900 sm:p-8"><article className="mx-auto max-w-3xl overflow-hidden rounded-3xl border border-[#7a0000]/15 bg-white shadow-sm"><header className="border-b-4 border-[#8f0000] p-6 sm:p-8"><div className="flex items-start gap-4"><ShieldCheck className={`h-10 w-10 shrink-0 ${valid ? "text-[#0f9d58]" : "text-amber-600"}`} /><div><p className="text-xs font-black tracking-[.18em] text-[#7a0000]">BETECH SOLAR SOLUTIONS</p><h1 className="mt-2 text-2xl font-black sm:text-3xl">{`WARRANTY STATUS: ${status.replaceAll("_", " ")}`}</h1><p className="mt-2 text-sm text-slate-600">{certificate.status === "SUPERSEDED" ? "A newer certificate has replaced this document." : "Current warranty registration status, verified by Betech Solar Solutions."}</p></div></div></header><section className="grid gap-4 p-6 text-sm sm:grid-cols-2 sm:p-8"><Info label="Certificate No." value={certificate.certificateNo} /><Info label="Project reference" value={String(data.projectReference || "Not recorded")} /><Info label="Customer" value={String(data.customerName || "Not recorded")} /><Info label="Installation location" value={String(data.installationLocation || "Not recorded")} /><Info label="Completion certificate" value={certificate.sourceCertificateNo} /><Info label="Commissioning date" value={date(data.commissioningDate)} /></section><section className="border-t border-slate-200 bg-[#fcfaf7] p-6 sm:p-8"><h2 className="flex items-center gap-2 font-black text-[#7a0000]"><CheckCircle2 className="h-5 w-5" /> Warranty coverage</h2><div className="mt-4 grid gap-3">{equipment.map((item, index) => <div key={`${String(item.equipment)}-${index}`} className="grid gap-2 rounded-2xl border border-[#7a0000]/10 bg-white p-4 text-sm sm:grid-cols-[1fr_auto]"><div><div className="font-black">{String(item.equipment || "Equipment")}</div><p className="mt-1 text-slate-600">{String(item.brand || "Not recorded")} · {String(item.modelCapacity || "Not recorded")}</p>{String(item.serialNumbers || "") !== "Not recorded" ? <p className="mt-1 text-xs text-slate-500">Serial: {String(item.serialNumbers)}</p> : null}</div><div className="text-left sm:text-right"><div className="font-black text-[#0f7a43]">{String(item.warrantyYears || "")} Years</div><p className="mt-1 text-xs text-slate-500">Starts {date(item.warrantyStartDate)}<br />Expires {date(item.warrantyExpiryDate)}</p></div></div>)}</div><p className="mt-5 text-xs leading-5 text-slate-500">Warranty coverage remains subject to Betech Solar&apos;s Terms &amp; Conditions. This verification page intentionally excludes contact, payment and internal project information.</p></section></article></main>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 font-bold">{value}</dd></div>;
}
