import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import ProfitCaptureFormClient from "@/app/admin/online/performance/_components/ProfitCaptureForm.client";

export const dynamic = "force-dynamic";

export default async function OnlinePerformanceCapturePage() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== "ADMIN" && role !== "SUPERVISOR") {
    return redirect("/not-authorized");
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-slate-400">Online ops</p>
        <h1 className="text-2xl font-semibold text-white">Profit capture</h1>
        <p className="text-sm text-slate-400">
          Paste the marketplace transaction block and enter buying price. The system extracts credit/fees, computes net
          payout, profit and margin, and stores the raw text for audit.
        </p>
      </header>

      <ProfitCaptureFormClient />
    </div>
  );
}

