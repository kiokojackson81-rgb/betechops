"use client";

import BenjaminPosPricingPanel from "../BenjaminPosPricingPanel";

export default function PosPricingWorkspaceClient() {
  return (
    <section className="rounded-[28px] border border-cyan-400/20 bg-cyan-400/5 p-3 sm:p-5">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-[0.22em] text-cyan-200">Supervisor workspace</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">POS pricing queue</h1>
        <p className="mt-1 text-sm text-slate-400">Complete pricing requests while keeping the operations navigation available.</p>
      </div>
      <BenjaminPosPricingPanel onQueueEmpty={() => undefined} />
    </section>
  );
}
