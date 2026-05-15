import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AgentSaleNewPage from "@/app/agents/AgentSaleNewPage";
import { isAgentsHost } from "@/lib/agents/host";

export const dynamic = "force-dynamic";

export default async function NewSalePage() {
  const host = (await headers()).get("host");
  if (isAgentsHost(host)) {
    return <AgentSaleNewPage useRootPaths />;
  }

  redirect("/");
}
