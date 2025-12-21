"use client";

export default function SupportDashboardPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto max-w-5xl p-6 space-y-6">
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 shadow-xl shadow-black/30">
          <h1 className="text-3xl font-semibold">Support Dashboard</h1>
          <p className="text-sm text-slate-400">
            This area will host core support workflows for the SUPPORT_OPS team. Build the tooling you need
            to monitor escalations, reconciliations and customer follow-ups.
          </p>
        </div>
      </main>
    </div>
  );
}
