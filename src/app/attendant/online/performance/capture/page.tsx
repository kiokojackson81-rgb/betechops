import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import ProfitCaptureFormClient from "@/app/admin/online/performance/_components/ProfitCaptureForm.client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AttendantPerformanceCapturePage() {
  const session = await auth();
  const email = String((session?.user as any)?.email ?? "").toLowerCase();
  if (email !== "benjamin@betech.co.ke") {
    return redirect("/not-authorized");
  }

  const accounts = await prisma.marketplaceAccount.findMany({
    where: { isActive: true },
    select: { id: true, platform: true, displayName: true },
    orderBy: [{ platform: "asc" }, { displayName: "asc" }],
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto max-w-6xl space-y-6 p-6">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-slate-400">Online ops</p>
          <h1 className="text-3xl font-semibold text-white">Capture profit</h1>
          <p className="text-sm text-slate-300">
            Enter buying price and paste transaction details. Admin can review and analyze later.
          </p>
        </header>

        <ProfitCaptureFormClient accounts={accounts} limitedView backHref="/attendant/online/performance" />
      </main>
    </div>
  );
}
