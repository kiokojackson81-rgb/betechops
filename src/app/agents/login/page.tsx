import { redirect } from "next/navigation";
import AgentLoginForm from "@/app/agents/_components/AgentLoginForm";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AgentsLoginPage() {
  const session = await auth();
  if ((session?.user as { isAgent?: boolean } | undefined)?.isAgent) {
    redirect("/agents/dashboard");
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.18),transparent_25%),linear-gradient(180deg,#020617_0%,#0f172a_100%)] px-6 py-12 text-slate-100">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.96),rgba(2,6,23,.98))] p-8 shadow-[0_24px_80px_rgba(0,0,0,.35)]">
          <AgentLoginForm />
        </div>
        <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-8">
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300">What you get</p>
            <h2 className="text-3xl font-semibold text-white">A JForce-style performance board inside BETECHOPS.</h2>
            <p className="text-sm text-slate-400">
              Your dashboard shows referral volume, recorded sales, commission pipeline, payout requests, and profile approval
              status in a single dark workspace that matches the rest of the platform.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
