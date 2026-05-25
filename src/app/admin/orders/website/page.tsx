import Link from "next/link";
import { prisma } from "@/lib/prisma";
import WebsiteOrdersAdminClient from "@/app/admin/orders/website/WebsiteOrdersAdminClient";
import { serializeWebsiteOrder, websiteOrderAdminInclude } from "@/lib/websiteOrders";

export const dynamic = "force-dynamic";

export default async function WebsiteOrdersPage() {
  const orders = await prisma.websiteOrder.findMany({
    include: websiteOrderAdminInclude,
    orderBy: [{ createdAt: "desc" }],
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Pending Website Orders</h1>
          <p className="mt-1 text-slate-300">
            Review customer website orders, confirm them safely, and continue into the correct receipt flow only after admin approval.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/orders"
            className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-100 transition hover:bg-white/10"
          >
            Back to Orders
          </Link>
          <Link
            href="/receipts"
            className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/18"
          >
            Receipts Desk
          </Link>
        </div>
      </div>

      <WebsiteOrdersAdminClient initialOrders={orders.map(serializeWebsiteOrder)} />
    </div>
  );
}
