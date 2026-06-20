export const dynamic = "force-dynamic";
import AgentLoginPage from "@/app/agents/AgentLoginPage";

export default async function AgentsLoginRoute() {
  return <AgentLoginPage useRootPaths />;
}
