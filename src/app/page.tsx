import { headers } from "next/headers";
import { redirect } from "next/navigation";
import HomePageClient from "@/app/HomePageClient";
import { isAgentsHost } from "@/lib/runtimeUrls";

export default async function Home() {
  const host = (await headers()).get("host");
  if (isAgentsHost(host)) {
    redirect("/agents");
  }

  return <HomePageClient />;
}
