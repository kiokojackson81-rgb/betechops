import Link from "next/link";
import { redirect } from "next/navigation";
import MarketingAgentOrdersClient from "@/app/marketing/agent-orders/MarketingAgentOrdersClient";
import { auth } from "@/lib/auth";
import { getAdminAgentSales } from "@/lib/agents/sales";

export const dynamic = "force-dynamic";

const OPEN_AGENT_ORDER_STATUSES = [
  "pending_review",
  "awaiting_payment",
  "payment_confirmed",
  "processing",
  "dispatched",
  "delivered_pending_balance",
  "completed",
  "cancelled",
  "rejected",
] as const;

function canAccessAgentOrdersDesk(role: string | null | undefined, attendantCategory: string | null | undefined) {
  return (
    role === "ADMIN" ||
    attendantCategory === "DIRECT_SALES_OPS" ||
    attendantCategory === "MARKETING_OPS"
  );
}

export default async function MarketingAgentOrdersPage() {
  const session = await auth();
  const user = session?.user as { role?: string | null; attendantCategory?: string | null } | undefined;

  if (!session) redirect("/admin/login");
  if (!canAccessAgentOrdersDesk(user?.role, user?.attendantCategory)) {
    redirect("/not-authorized");
  }

  const sales = await getAdminAgentSales({ statuses: [...OPEN_AGENT_ORDER_STATUSES] });
  const preparedSales = sales.map((sale) => ({
    ...sale,
    createdAt: sale.createdAt.toISOString(),
    updatedAt: sale.updatedAt.toISOString(),
    completedAt: sale.completedAt ? sale.completedAt.toISOString() : null,
    ownershipWindowEndsAt: sale.ownershipWindowEndsAt ? sale.ownershipWindowEndsAt.toISOString() : null,
  }));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto max-w-6xl space-y-6 p-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300">Agent orders</div>
            <h1 className="mt-2 text-3xl font-semibold">Customer service processing desk</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">
              Review agent-submitted customer orders, call customers, confirm processing, record delivery, and reject invalid orders.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/marketing/receipts"
              className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:border-white/40 hover:bg-white/10"
            >
              Back to receipts
            </Link>
            <Link
              href="/marketing/tracker"
              className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-200 transition hover:border-emerald-400 hover:bg-emerald-500/15"
            >
              Dashboard
            </Link>
          </div>
        </header>

        <MarketingAgentOrdersClient sales={preparedSales} />
      </main>
    </div>
  );
}
