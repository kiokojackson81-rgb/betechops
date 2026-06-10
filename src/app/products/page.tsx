import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AgentProductsPage from "@/app/agents/AgentProductsPage";
import { isAgentsHost } from "@/lib/agents/host";

export const dynamic = "force-dynamic";

export default async function ProductsPage({
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
  const host = (await headers()).get("host");
  if (isAgentsHost(host)) {
    return <AgentProductsPage searchParams={searchParams} useRootPaths />;
  }

  redirect("/");
}
