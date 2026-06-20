export const dynamic = "force-dynamic";
import AgentPaymentMethodPage from "@/app/agents/AgentPaymentMethodPage";

export default async function AgentsPaymentMethodRoute() {
  return <AgentPaymentMethodPage useRootPaths />;
}
