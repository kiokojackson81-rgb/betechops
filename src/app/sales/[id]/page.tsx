import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AgentSaleDetailPage from "@/app/agents/AgentSaleDetailPage";
import { isAgentsHost } from "@/lib/agents/host";

export const dynamic = "force-dynamic";

export default async function SaleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const host = (await headers()).get("host");
  if (!isAgentsHost(host)) {
    redirect("/");
  }

  const { id } = await params;
  return <AgentSaleDetailPage id={id} useRootPaths />;
}
