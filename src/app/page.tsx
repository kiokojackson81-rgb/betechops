import { headers } from "next/headers";
import AgentsLandingPage from "@/app/agents/AgentsLandingPage";
import HomePageClient from "@/app/HomePageClient";
import { isAgentsHost } from "@/lib/runtimeUrls";

export default async function Home() {
  const host = (await headers()).get("host");
  if (isAgentsHost(host)) {
    return <AgentsLandingPage />;
  }

  return <HomePageClient />;
}
