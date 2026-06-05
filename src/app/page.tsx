import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AgentsLandingPage from "@/app/agents/AgentsLandingPage";
import ShopHomePage from "@/app/shop/_components/ShopHomePage";
import { buildShopMetadata } from "@/app/shop/shopMetadata";
import { isAgentsHost } from "@/lib/agents/host";
import { isOpsHost } from "@/lib/runtimeUrls";

export const metadata = buildShopMetadata();

type RootPageProps = {
  searchParams?: Promise<{
    q?: string;
  }>;
};

export default async function Home({ searchParams }: RootPageProps) {
  const host = (await headers()).get("host");
  if (isAgentsHost(host)) {
    return <AgentsLandingPage useRootPaths />;
  }
  if (isOpsHost(host)) {
    redirect("/admin");
  }

  return <ShopHomePage searchParams={searchParams} analyticsPage="/" />;
}
