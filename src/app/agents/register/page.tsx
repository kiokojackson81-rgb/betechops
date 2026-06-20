export const dynamic = "force-dynamic";
import AgentRegisterPage from "@/app/agents/AgentRegisterPage";

export default async function AgentsRegisterRoute() {
  return <AgentRegisterPage useRootPaths />;
}
