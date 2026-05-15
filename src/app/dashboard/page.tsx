import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AgentDashboardPage from "@/app/agents/AgentDashboardPage";
import { isAgentsHost } from "@/lib/agents/host";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const host = (await headers()).get("host");
  if (isAgentsHost(host)) {
    return <AgentDashboardPage useRootPaths />;
  }

  redirect("/");
}
