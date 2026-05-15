import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AgentPaymentMethodPage from "@/app/agents/AgentPaymentMethodPage";
import { isAgentsHost } from "@/lib/agents/host";

export const dynamic = "force-dynamic";

export default async function PaymentMethodPage() {
  const host = (await headers()).get("host");
  if (isAgentsHost(host)) {
    return <AgentPaymentMethodPage useRootPaths />;
  }

  redirect("/");
}
