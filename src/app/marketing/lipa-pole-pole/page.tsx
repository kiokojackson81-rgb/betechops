import { redirect } from "next/navigation";
import LipaPolePoleAdminClient from "@/app/admin/lipa-pole-pole/LipaPolePoleAdminClient";
import { loadLipaPolePoleAdminWorkspace, type LipaPolePoleSearchParams } from "@/app/admin/lipa-pole-pole/loadLipaPolePoleAdminWorkspace";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function MarketingLipaPolePolePage({
  searchParams,
}: {
  searchParams?: Promise<LipaPolePoleSearchParams> | LipaPolePoleSearchParams;
}) {
  const resolved = await Promise.resolve(searchParams ?? {});
  const session = await auth();
  const role = String((session?.user as { role?: string } | undefined)?.role ?? "").toUpperCase();
  if (!["ADMIN", "SUPERVISOR", "ATTENDANT"].includes(role)) {
    redirect("/not-authorized");
  }

  const workspace = await loadLipaPolePoleAdminWorkspace(
    resolved,
  );
  return (
    <LipaPolePoleAdminClient
      {...workspace}
      workspaceEmbedded
      scopeCreatedById={String(resolved.impersonateId || "").trim() || null}
      bookingReceiptBasePath="/lipa-pole-pole/print"
    />
  );
}
