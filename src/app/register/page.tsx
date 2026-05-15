import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AgentRegisterPage from "@/app/agents/AgentRegisterPage";
import { isAgentsHost } from "@/lib/agents/host";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const host = (await headers()).get("host");
  if (isAgentsHost(host)) {
    return <AgentRegisterPage useRootPaths />;
  }

  redirect("/");
}
