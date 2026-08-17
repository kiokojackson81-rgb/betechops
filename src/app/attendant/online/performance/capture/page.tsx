import { redirect } from "next/navigation";
import ProfitCaptureFormClient from "@/app/admin/online/performance/_components/ProfitCaptureForm.client";
import { prisma } from "@/lib/prisma";
import { canAccessOnlineSupervisorWorkspace } from "@/lib/onlineSupervisorAccess";

export const dynamic = "force-dynamic";

export default async function AttendantPerformanceCapturePage({
  searchParams,
}: {
  searchParams?: Promise<{ impersonateId?: string }> | { impersonateId?: string };
}) {
  const resolved = await Promise.resolve(searchParams ?? {});
  if (!(await canAccessOnlineSupervisorWorkspace(resolved.impersonateId))) {
    return redirect("/not-authorized");
  }

  const accounts = await prisma.marketplaceAccount.findMany({
    where: { isActive: true },
    select: { id: true, platform: true, displayName: true },
    orderBy: [{ platform: "asc" }, { displayName: "asc" }],
  });

  return (
    <div className="space-y-6">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-slate-400">Online ops</p>
          <h1 className="text-3xl font-semibold text-white">Capture Buying price</h1>
          <p className="text-sm text-slate-300">
            Enter buying price and paste transaction details. Admin can review and analyze later.
          </p>
        </header>

        <ProfitCaptureFormClient
          accounts={accounts}
          limitedView
          backHref={
            resolved.impersonateId
              ? `/attendant/online/performance?impersonateId=${encodeURIComponent(resolved.impersonateId)}`
              : "/attendant/online/performance"
          }
        />
    </div>
  );
}
