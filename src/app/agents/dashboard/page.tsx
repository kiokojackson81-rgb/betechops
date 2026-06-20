export const dynamic = "force-dynamic";
import AgentDashboardPage from "@/app/agents/AgentDashboardPage";

export default async function AgentsDashboardRoute() {
  return <AgentDashboardPage useRootPaths />;
}
