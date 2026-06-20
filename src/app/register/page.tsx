import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isAgentsHost } from "@/lib/agents/host";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const host = (await headers()).get("host");
  if (isAgentsHost(host)) {
    redirect("/login/phone?callbackUrl=/account");
  }

  redirect("/");
}
