"use client";

import { useState } from "react";
import ToastContainer from "@/app/_components/ToastContainer";
import { QuickStatsCard } from "@/components/QuickStatsCard";
import { EarningsCard } from "@/components/EarningsCard";
import OnlineSalesForm from "./OnlineSalesForm";
import JumiaWeeksBlock from "./JumiaWeeksBlock";
import UnpricedOrdersCard from "./UnpricedOrdersCard";
import ReturnsCard from "./ReturnsCard";

type Tab = "pricing" | "returns";

export default function JumiaOpsPage() {
  const [tab, setTab] = useState<Tab>("pricing");

  return (
    <div className="min-h-screen bg-slate-950 px-4 pb-16 text-slate-50">
      <ToastContainer />
      <div className="mx-auto w-full max-w-6xl space-y-8 pt-8">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-400">Operations</p>
          <h1 className="text-2xl font-semibold">Jumia / Kilimall Ops</h1>
          <p className="text-sm text-slate-400">
            Log direct sales, monitor online weeks, and action pricing & returns for your assigned accounts.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)]">
          <OnlineSalesForm />
          <div className="space-y-4">
            <QuickStatsCard variant="onlineOps" />
            <EarningsCard variant="onlineOps" />
          </div>
        </div>

        <JumiaWeeksBlock />

        <section className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900/40 p-4 md:p-6">
          <div className="inline-flex rounded-full bg-slate-900 p-1">
            <button
              type="button"
              onClick={() => setTab("pricing")}
              className={`rounded-full px-4 py-1 text-sm font-medium transition ${tab === "pricing" ? "bg-emerald-500 text-black" : "text-slate-400"}`}
            >
              Pricing queue
            </button>
            <button
              type="button"
              onClick={() => setTab("returns")}
              className={`rounded-full px-4 py-1 text-sm font-medium transition ${tab === "returns" ? "bg-emerald-500 text-black" : "text-slate-400"}`}
            >
              Returns SLA
            </button>
          </div>

          {tab === "pricing" ? <UnpricedOrdersCard /> : <ReturnsCard />}
        </section>
      </div>
    </div>
  );
}
