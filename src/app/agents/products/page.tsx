import AgentProductsPage from "@/app/agents/AgentProductsPage";

export const dynamic = "force-dynamic";

export default async function AgentsProductsRoute({
  searchParams,
}: {
  searchParams?: Promise<{
    category?: string;
    sub?: string;
    brand?: string;
    price?: string;
    stock?: string;
    warranty?: string;
    sort?: string;
  }>;
}) {
  return <AgentProductsPage searchParams={searchParams} />;
}
