import { redirect } from "next/navigation";
import AgentSaleForm from "@/app/agents/_components/AgentSaleForm";
import AgentPortalShell from "@/app/agents/_components/AgentPortalShell";
import { requireAgentSession } from "@/lib/agents/auth";
import { agentPath } from "@/lib/agents/host";
import { getAgentDashboardData } from "@/lib/agents/service";

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

  const dashboard = await getAgentDashboardData(agentSession.userId);
  if (!dashboard) redirect(agentPath("/register", useRootPaths));

  return (
    <AgentPortalShell
      useRootPaths={useRootPaths}
      title="Submit Sale"
      description="Capture a customer opportunity with the right payment and delivery details so admin can process it through the normal BETECH order flow."
      agent={{
        displayName: dashboard.displayName,
        email: dashboard.profile.email || dashboard.profile.user.email,
        status: String(dashboard.profile.status || ""),
        referralCode: dashboard.profile.referralCode,
        payoutPhone: dashboard.profile.phone,
      }}
      stats={{
        potentialCommission: dashboard.salesSummary.potentialCommission,
        earnedCommission: dashboard.salesSummary.earnedCommission,
        paidCommission: dashboard.salesSummary.paidCommission,
      }}
    >
      <div className="rounded-[28px] border border-[#e4d4cb] bg-white p-6 shadow-[0_12px_40px_rgba(64,32,18,0.08)] md:p-8">
        <AgentSaleForm useRootPaths={useRootPaths} />
      </div>
    </AgentPortalShell>
  );
}
