import { prisma } from "@/lib/prisma";
import { getJumiaWeeklyPeriodFor } from "@/lib/tradingPeriod";

function fmt(n: number) {
  return `KES ${n.toLocaleString()}`;
}

export default async function WeeklySummary() {
  const period = getJumiaWeeklyPeriodFor(new Date());
  const start = period.start;
  const end = period.end;

  const agg = await prisma.marketplaceOrder.aggregate({
    where: { orderedAt: { gte: start, lte: end } },
    _count: true,
    _sum: {
      sellingPrice: true,
      sellerFee: true,
      shippingFee: true,
      profit: true,
    },
  });

  const count = agg._count ?? 0;
  const totalSales = Number(agg._sum.sellingPrice ?? 0);
  const totalFees = Number(agg._sum.sellerFee ?? 0);
  const totalShipping = Number(agg._sum.shippingFee ?? 0);
  const totalProfit = Number(agg._sum.profit ?? 0);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Marketplace (Jumia) — Weekly summary</h3>
          <p className="text-sm text-slate-400">{period.label}</p>
        </div>
        <div className="text-right text-sm text-slate-300">
          <div>Orders: <span className="font-semibold">{count}</span></div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg bg-white/5 p-3">
          <div className="text-xs text-slate-400">Total sales</div>
          <div className="mt-1 font-medium text-slate-100">{fmt(totalSales)}</div>
        </div>
        <div className="rounded-lg bg-white/5 p-3">
          <div className="text-xs text-slate-400">Seller fees</div>
          <div className="mt-1 font-medium text-slate-100">{fmt(totalFees)}</div>
        </div>
        <div className="rounded-lg bg-white/5 p-3">
          <div className="text-xs text-slate-400">Shipping</div>
          <div className="mt-1 font-medium text-slate-100">{fmt(totalShipping)}</div>
        </div>
        <div className="rounded-lg bg-white/5 p-3">
          <div className="text-xs text-slate-400">Profit</div>
          <div className="mt-1 font-medium text-emerald-400">{fmt(totalProfit)}</div>
        </div>
      </div>
    </div>
  );
}
