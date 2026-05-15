import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AgentProfilePage from "@/app/agents/AgentProfilePage";
import { isAgentsHost } from "@/lib/agents/host";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const host = (await headers()).get("host");
  if (isAgentsHost(host)) {
    return <AgentProfilePage useRootPaths />;
  }

  redirect("/");
}
