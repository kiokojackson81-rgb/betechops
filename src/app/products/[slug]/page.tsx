import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AgentProductDetailPage, { generateMetadata } from "@/app/agents/products/[slug]/page";
import { isAgentsHost } from "@/lib/agents/host";

export { generateMetadata };

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ opsProductId?: string }>;
}) {
  const host = (await headers()).get("host");
  if (!isAgentsHost(host)) {
    redirect("/");
  }

  return <AgentProductDetailPage params={params} searchParams={searchParams} />;
}
