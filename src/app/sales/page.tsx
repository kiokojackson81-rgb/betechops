import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AgentSalesPage from "@/app/agents/AgentSalesPage";
import { isAgentsHost } from "@/lib/agents/host";

export const dynamic = "force-dynamic";

export default async function SalesPage() {
  const host = (await headers()).get("host");
  if (isAgentsHost(host)) {
    return <AgentSalesPage useRootPaths />;
  }

  redirect("/");
}
