import { redirect } from "next/navigation";
import AgentSaleForm from "@/app/agents/_components/AgentSaleForm";
import { requireAgentSession } from "@/lib/agents/auth";
import { agentPath } from "@/lib/agents/host";

type AgentSaleNewPageProps = {
  useRootPaths?: boolean;
};

export default async function AgentSaleNewPage({ useRootPaths = false }: AgentSaleNewPageProps) {
  const agentSession = await requireAgentSession();
  if (!agentSession) {
    redirect(agentPath("/login", useRootPaths));
  }
  if (String(agentSession.agentStatus || "").toLowerCase() !== "approved") {
    redirect(agentPath("/dashboard", useRootPaths));
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.16),transparent_25%),linear-gradient(180deg,#020617_0%,#0f172a_60%,#020617_100%)] px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-5xl rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.96),rgba(2,6,23,.98))] p-8 shadow-[0_24px_80px_rgba(0,0,0,.35)]">
        <AgentSaleForm useRootPaths={useRootPaths} />
      </div>
    </div>
  );
}
