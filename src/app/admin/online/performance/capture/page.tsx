import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import ProfitCaptureFormClient from "@/app/admin/online/performance/_components/ProfitCaptureForm.client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function OnlinePerformanceCapturePage() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const email = String((session?.user as any)?.email ?? "").toLowerCase();
  const isBenjamin = email === "benjamin@betech.co.ke";
  const limitedView = isBenjamin && role !== "ADMIN";
  if (role !== "ADMIN" && role !== "SUPERVISOR" && !isBenjamin) {
    return redirect("/not-authorized");
  }

  const accounts = await prisma.marketplaceAccount.findMany({
    where: { isActive: true },
    select: { id: true, platform: true, displayName: true },
    orderBy: [{ platform: "asc" }, { displayName: "asc" }],
  });

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-slate-400">Online ops</p>
        <h1 className="text-2xl font-semibold text-white">Profit capture</h1>
        <p className="text-sm text-slate-400">
          Upload a marketplace statement CSV, then submit buying prices per order. The system stores the statement so you
          can continue pricing later and syncs the results into performance reports.
        </p>
      </header>

      {limitedView ? (
        <ProfitCaptureFormClient accounts={accounts} limitedView />
      ) : (
        <ProfitCaptureFormClient accounts={accounts} />
      )}
    </div>
  );
}
