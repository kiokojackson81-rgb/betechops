import Link from "next/link";
import CatalogueSettingsClient from "./CatalogueSettingsClient";

export const dynamic = "force-dynamic";

export default function ProductCatalogueSettingsPage() {
  return <main className="space-y-6"><section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="text-xs uppercase tracking-[0.24em] text-slate-400">Product catalogue</div><h1 className="mt-2 text-3xl font-semibold text-white">Installation & delivery rules</h1><p className="mt-2 max-w-3xl text-sm text-slate-400">Central defaults used only by products explicitly configured for standard installation or zone delivery.</p></div><Link href="/admin/pos-management" className="rounded-2xl border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-200">Back to products</Link></div></section><CatalogueSettingsClient /></main>;
}
