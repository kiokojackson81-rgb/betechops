import { redirect } from "next/navigation";
import AgentRegisterForm from "@/app/agents/_components/AgentRegisterForm";
import { auth } from "@/lib/auth";
import { agentPath } from "@/lib/agents/host";

type AgentRegisterPageProps = {
  useRootPaths?: boolean;
};

export default async function AgentRegisterPage({ useRootPaths = false }: AgentRegisterPageProps) {
  const session = await auth();
  if ((session?.user as { isAgent?: boolean } | undefined)?.isAgent) {
    redirect(agentPath("/dashboard", useRootPaths));
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.16),transparent_25%),linear-gradient(180deg,#020617_0%,#0f172a_100%)] px-6 py-12 text-slate-100">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.96),rgba(2,6,23,.98))] p-8 shadow-[0_24px_80px_rgba(0,0,0,.35)]">
          <AgentRegisterForm useRootPaths={useRootPaths} />
        </div>
        <div className="space-y-4 rounded-[32px] border border-white/10 bg-white/[0.04] p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">Before approval</p>
          <h2 className="text-3xl font-semibold text-white">Create the account now, complete KYC as you grow.</h2>
          <p className="text-sm text-slate-400">
            Registration creates your agent profile, a unique BETECH referral code, and the account used for future
            commission, payout, and KYC flows. Admin can later approve, reject, or request more details.
          </p>
        </div>
      </div>
    </div>
  );
}
