import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AgentWithdrawalsPage from "@/app/agents/AgentWithdrawalsPage";
import { isAgentsHost } from "@/lib/agents/host";

export const dynamic = "force-dynamic";

export default async function WithdrawalsPage() {
  const host = (await headers()).get("host");
  if (isAgentsHost(host)) {
    return <AgentWithdrawalsPage useRootPaths />;
  }

  redirect("/");
}
