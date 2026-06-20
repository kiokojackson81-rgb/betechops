import AgentSaleDetailPage from "@/app/agents/AgentSaleDetailPage";

export const dynamic = "force-dynamic";

export default async function AgentSalesDetailCompatibilityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AgentSaleDetailPage id={id} useRootPaths />;
}
