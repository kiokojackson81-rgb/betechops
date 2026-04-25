import { redirect } from "next/navigation";
import { requireRole } from "@/lib/api";
import CashAdvanceClient from "./CashAdvanceClient";

export const dynamic = "force-dynamic";

export default async function CashAdvancePage() {
  const auth = await requireRole(["ATTENDANT", "SUPERVISOR"]);
  if (!auth.ok) {
    redirect("/attendant/login");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="mx-auto max-w-5xl">
        <CashAdvanceClient />
      </div>
    </div>
  );
}
