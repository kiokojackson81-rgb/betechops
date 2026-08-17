import { redirect } from "next/navigation";
import LipaPolePoleAdminClient from "@/app/admin/lipa-pole-pole/LipaPolePoleAdminClient";
import {
  loadLipaPolePoleAdminWorkspace,
  type LipaPolePoleSearchParams,
} from "@/app/admin/lipa-pole-pole/loadLipaPolePoleAdminWorkspace";
import { canAccessOnlineSupervisorWorkspace } from "@/lib/onlineSupervisorAccess";

export const dynamic = "force-dynamic";

type SearchParams = LipaPolePoleSearchParams & { impersonateId?: string };

export default async function AttendantLipaPolePolePage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const resolved = await Promise.resolve(searchParams ?? {});
  if (!(await canAccessOnlineSupervisorWorkspace(resolved.impersonateId))) {
    redirect("/not-authorized");
  }

  const workspace = await loadLipaPolePoleAdminWorkspace(resolved);
  return <LipaPolePoleAdminClient {...workspace} workspaceEmbedded />;
}
