import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { agentPath } from "@/lib/agents/host";

type AgentRegisterPageProps = {
  useRootPaths?: boolean;
};

export default async function AgentRegisterPage({ useRootPaths = false }: AgentRegisterPageProps) {
  const session = await auth();
  if ((session?.user as { isAgent?: boolean } | undefined)?.isAgent) {
    redirect(agentPath("/dashboard", useRootPaths));
  }

  redirect(`/login/phone?callbackUrl=${encodeURIComponent(agentPath("/dashboard", useRootPaths))}`);
  return null;
}
