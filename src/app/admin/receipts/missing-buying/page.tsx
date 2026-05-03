import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { requireRole } from "@/lib/api";
import MissingBuyingTableClient from "./MissingBuyingTableClient";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams?: Record<string, string> }) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) {
    // Server-side redirect for unauthorized users to match other admin pages
    redirect("/admin/login");
  }

  const attendantId = searchParams?.attendantId ?? null;

  const period = getTradingPeriodFor(new Date());
  const start = period.start;
  const end = period.end;

  if (!attendantId) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">Missing buying prices</h1>
        <p className="text-sm text-slate-500">Please provide an `attendantId` query param to filter results.</p>
      </div>
    );
  }

  const receipts = await prisma.order.findMany({
    where: { attendantId, createdAt: { gte: start, lte: end } },
    select: {
      id: true,
      orderNumber: true,
      createdAt: true,
      totalAmount: true,
      items: {
        select: {
          id: true,
          productId: true,
          quantity: true,
          sellingPrice: true,
          orderCosts: { select: { unitCost: true } },
          profitSnapshots: { select: { unitCost: true } },
        },
      },
      
    },
    orderBy: { createdAt: "desc" },
  });

  const missing = receipts
    .map((r) => ({
      id: r.id,
      orderNumber: r.orderNumber,
      createdAt: r.createdAt,
      sellingTotal: r.totalAmount,
      items: r.items.filter((it) => {
        const hasCost = (it.orderCosts && it.orderCosts.length > 0) || (it.profitSnapshots && it.profitSnapshots.length > 0);
        return !hasCost;
      }),
    }))
    .filter((r) => (r.items?.length ?? 0) > 0);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Receipts missing buying prices</h1>
      <p className="text-sm text-slate-500 mb-4">Period: {period.label}. Attendant: {attendantId}</p>

      {missing.length === 0 ? (
        <div className="text-slate-400">No receipts with missing buying prices for this attendant/period.</div>
      ) : (
        // Render client-side table for interactive batch pricing
        <MissingBuyingTableClient missing={missing.map((r) => ({ id: r.id, orderNumber: r.orderNumber, createdAt: r.createdAt?.toISOString?.() ?? String(r.createdAt), sellingTotal: r.sellingTotal, items: r.items.map((it) => ({ receiptId: r.id, id: it.id, productId: it.productId, quantity: it.quantity, sellingPrice: it.sellingPrice })) }))} />
      )}
    </div>
  );
}
