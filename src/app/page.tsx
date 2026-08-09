import type { Metadata } from "next";
import { headers } from "next/headers";
import AgentsLandingPage from "@/app/agents/AgentsLandingPage";
import HomePageClient from "@/app/HomePageClient";
import ShopHomePage from "@/app/shop/_components/ShopHomePage";
import { buildShopMetadata } from "@/app/shop/shopMetadata";
import { isAgentsHost } from "@/lib/agents/host";
import { isOpsHost } from "@/lib/runtimeUrls";

export async function generateMetadata(): Promise<Metadata> {
  const host = (await headers()).get("host");

  if (isOpsHost(host)) {
    return {
      title: "BetechOps Digital Access Portal",
      description: "Access Betech Solar customer, agent, and staff services from one secure portal.",
    };
  }

  return buildShopMetadata();
}

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
    return <HomePageClient />;
  }

  return <ShopHomePage searchParams={searchParams} analyticsPage="/" />;
}
