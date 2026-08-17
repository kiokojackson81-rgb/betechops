import { redirect } from "next/navigation";
import PosPricingWorkspaceClient from "./PosPricingWorkspaceClient";
import { canAccessOnlineSupervisorWorkspace } from "@/lib/onlineSupervisorAccess";

export const dynamic = "force-dynamic";

export default async function PosPricingWorkspacePage({
  searchParams,
}: {
  searchParams?: Promise<{ impersonateId?: string }> | { impersonateId?: string };
}) {
  const resolved = await Promise.resolve(searchParams ?? {});
  if (!(await canAccessOnlineSupervisorWorkspace(resolved.impersonateId))) {
    redirect("/not-authorized");
  }
  return <PosPricingWorkspaceClient />;
}
