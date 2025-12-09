"use client";

import { useState } from "react";
import ReceiptFormClient from "@/app/receipts/ReceiptFormClient";
import ReceiptsPageClient from "@/app/receipts/ReceiptsPageClient";

export default function AttendantOnlineClient({ initial = [] as any[] }) {
  const [view, setView] = useState<"create" | "list">("create");

  return (
    <div className="min-h-screen bg-slate-950 px-4 pb-16 text-slate-50">
      <div className="mx-auto w-full max-w-6xl space-y-8 pt-8">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-400">Receipts desk</p>
            <h1 className="text-2xl font-semibold sm:text-3xl">Betech Customers Operations</h1>
            <p className="text-sm text-slate-300">Track every printable document, search by customer, and open the PDF drawer without leaving this page.</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10 ${view === "create" ? "bg-white/5" : ""}`}
              onClick={() => setView("create")}
            >
              Create
            </button>
            <button
              type="button"
              className={`rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:brightness-95 ${view === "list" ? "ring-2 ring-emerald-300" : ""}`}
              onClick={() => setView((v) => (v === "list" ? "create" : "list"))}
            >
              View receipts
            </button>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)]">
          <div>
            <section id="receipt-create" className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl shadow-black/40">
              <ReceiptFormClient />
            </section>

            {view === "list" && (
              <section className="mt-6 rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                <ReceiptsPageClient initial={initial} />
              </section>
            )}
          </div>

          <div>
            <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-400">Preview</p>
              <h3 className="mt-2 text-xl font-semibold text-white">Receipt preview</h3>
              <div className="mt-4">
                <p className="text-sm text-slate-400">Select a receipt from search results to preview it here.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
