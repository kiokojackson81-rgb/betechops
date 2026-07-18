import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { buildPayrollRow } from "@/lib/adminPayroll";
import { computeAdminReceiptSummary } from "@/lib/adminReceiptsSummary";
import { getTechnicalProjectCommissionSummary, TECHNICAL_POS_PROFIT_COMMISSION_RATE } from "@/lib/technicalCompensation";
import getLandingPage from "@/lib/getLandingPage";
import { isTechnicalTeamCategory } from "@/lib/technicalTeam";
import { canonicalReceiptNumber } from "@/lib/receiptGuard";

export const dynamic = "force-dynamic";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function extractProfit(receipt: {
  totals?: unknown;
  data?: unknown;
}, supportProfit?: number | null) {
  if (Number(supportProfit ?? 0) > 0) return Number(supportProfit ?? 0);
  const totals =
    receipt.totals && typeof receipt.totals === "object" && !Array.isArray(receipt.totals)
      ? (receipt.totals as Record<string, unknown>)
      : {};
  const data =
    receipt.data && typeof receipt.data === "object" && !Array.isArray(receipt.data)
      ? (receipt.data as Record<string, unknown>)
      : {};
  const explicitProfit = Number(totals.profit ?? data.profit ?? 0);
  if (Number.isFinite(explicitProfit) && explicitProfit > 0) {
    return explicitProfit;
  }

  const totalsBuying = Number(totals.buyingTotal ?? 0);
  const totalsSelling = Number(totals.sellingTotal ?? 0);
  if (totalsBuying > 0 && Number.isFinite(totalsSelling)) {
    return totalsSelling - totalsBuying;
  }

  const dataBuying = Number(data.buyingTotal ?? 0);
  const dataSelling = Number(data.sellingTotal ?? 0);
  if (dataBuying > 0 && Number.isFinite(dataSelling)) {
    return dataSelling - dataBuying;
  }

  return 0;
}

async function resolveViewer() {
  const session = await auth().catch(() => null);
  const sessionUser = session?.user as
    | {
        id?: string | null;
        role?: string | null;
        attendantCategory?: string | null;
      }
    | undefined;

  if (!session || !sessionUser?.id) {
    redirect("/login");
  }

  const isAdmin = sessionUser.role === "ADMIN";
  const adminPreviewUser = isAdmin
    ? await prisma.user.findFirst({
        where: { attendantCategory: "TECHNICAL_TEAM", isActive: true },
        orderBy: [{ name: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          email: true,
          attendantCategory: true,
          isActive: true,
        },
      })
    : null;

  const targetId = adminPreviewUser?.id || sessionUser.id;
  const viewer = adminPreviewUser
    ? adminPreviewUser
    : await prisma.user.findUnique({
        where: { id: targetId },
        select: {
          id: true,
          name: true,
          email: true,
          attendantCategory: true,
          isActive: true,
        },
      });

  if (!viewer || !viewer.isActive) {
    redirect("/login");
  }

  if (sessionUser.role !== "ADMIN" && !isTechnicalTeamCategory(viewer.attendantCategory)) {
    redirect(getLandingPage(viewer.attendantCategory ?? null, sessionUser.role ?? undefined));
  }

  return viewer;
}

export default async function TechnicalSalesPage() {
  const viewer = await resolveViewer();
  const period = getTradingPeriodFor(new Date());

  const [payrollRow, summary, projectCommission, receipts] = await Promise.all([
    buildPayrollRow(
      {
        id: viewer.id,
        name: viewer.name,
        email: viewer.email,
        attendantCategory: viewer.attendantCategory,
        isActive: viewer.isActive,
      },
      period,
    ),
    computeAdminReceiptSummary({
      start: period.start,
      end: period.end,
      scope: "mine",
      currentUserId: viewer.id,
      attendantId: viewer.id,
      salesOnly: true,
      onlyPos: true,
    }),
    getTechnicalProjectCommissionSummary(viewer.id, period),
    prisma.receipt.findMany({
      where: {
        createdAt: { gte: period.start, lte: period.end },
        OR: [
          { issuedById: viewer.id },
          { order: { attendantId: viewer.id } },
          { data: { path: ["attendantId"], equals: viewer.id } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        receiptNumber: true,
        createdAt: true,
        totals: true,
        data: true,
        order: {
          select: {
            customerName: true,
            customerPhone: true,
            totalAmount: true,
            orderNumber: true,
            paymentStatus: true,
          },
        },
      },
    }),
  ]);

  const supportReceiptNumbers = Array.from(
    new Set(
      receipts.flatMap((receipt) => {
        const orderNumber = receipt.order?.orderNumber || null;
        const receiptNumber = receipt.receiptNumber || null;
        return [orderNumber, receiptNumber]
          .map((value) => canonicalReceiptNumber(value || undefined))
          .filter((value): value is string => Boolean(value));
      }),
    ),
  );

  const supportPricing = supportReceiptNumbers.length
    ? await prisma.supportReceipt.findMany({
        where: { receiptNumber: { in: supportReceiptNumbers } },
        select: {
          receiptNumber: true,
          sellingTotal: true,
          buyingTotal: true,
        },
      })
    : [];
  const supportProfitByReceipt = new Map(
    supportPricing
      .filter((row) => Number(row.buyingTotal ?? 0) > 0)
      .map((row) => [
        canonicalReceiptNumber(row.receiptNumber || undefined) || "",
        Number(row.sellingTotal ?? 0) - Number(row.buyingTotal ?? 0),
      ]),
  );

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-white/10 bg-gradient-to-br from-white/8 via-white/4 to-transparent p-6 shadow-2xl shadow-black/20">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.26em] text-emerald-300/80">Technical sales monitor</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">POS sales and commission tracking</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">
              Watch the receipts you created, the profit already recognized after pricing, and the commission that will flow into payroll. Technical POS commission defaults to 10% of priced profit only.
            </p>
          </div>
          <div className="grid gap-3 rounded-3xl border border-white/10 bg-[#091223] p-4 text-sm text-slate-300 sm:grid-cols-2">
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Period</div>
              <div className="mt-1 font-medium text-white">{period.label}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Staff</div>
              <div className="mt-1 font-medium text-white">{viewer.name || viewer.email || "Technical Team"}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
          <div className="text-sm text-slate-400">POS sales</div>
          <div className="mt-2 text-3xl font-semibold text-white">{formatCurrency(summary.totalSales)}</div>
          <div className="mt-1 text-sm text-slate-500">Your receipts in this trading period</div>
        </div>
        <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
          <div className="text-sm text-slate-400">POS receipts created</div>
          <div className="mt-2 text-3xl font-semibold text-white">{summary.receiptsCount}</div>
          <div className="mt-1 text-sm text-slate-500">Receipts you have created in this trading period</div>
        </div>
        <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
          <div className="text-sm text-slate-400">POS commission</div>
          <div className="mt-2 text-3xl font-semibold text-white">{formatCurrency(payrollRow.commissionDirect)}</div>
          <div className="mt-1 text-sm text-slate-500">10% profit share plus released POS product commission</div>
        </div>
        <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
          <div className="text-sm text-slate-400">Project commission</div>
          <div className="mt-2 text-3xl font-semibold text-white">{formatCurrency(projectCommission.completedAmount)}</div>
          <div className="mt-1 text-sm text-slate-500">
            Pending {formatCurrency(projectCommission.pendingAmount)} across {projectCommission.pendingCount} in-progress assigned project{projectCommission.pendingCount === 1 ? "" : "s"}
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-[#091223] p-5">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-lg font-semibold text-white">Receipt sales created by you</div>
            <div className="text-sm text-slate-400">
              Commission only starts after buying price has been entered. Until then, the receipt shows its selling price and stays at zero commission.
            </div>
          </div>
          <Link href="/receipts" target="_blank" rel="noreferrer" className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-100 hover:bg-white/5">
            Create another receipt
          </Link>
        </div>

        <div className="mt-5 space-y-3">
          {receipts.length ? (
            receipts.map((receipt) => {
              const supportProfit =
                supportProfitByReceipt.get(canonicalReceiptNumber(receipt.order?.orderNumber || receipt.receiptNumber || undefined) || "") ?? null;
              const profit = extractProfit(receipt, supportProfit);
              const commission = profit > 0 ? Math.round(profit * TECHNICAL_POS_PROFIT_COMMISSION_RATE) : 0;
              return (
                <div key={receipt.id} className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="text-base font-semibold text-white">
                        {receipt.order?.customerName || receipt.receiptNumber || receipt.order?.orderNumber || "Receipt"}
                      </div>
                      <div className="mt-1 text-sm text-slate-300">
                        {[receipt.receiptNumber || receipt.order?.orderNumber, receipt.order?.customerPhone, formatCurrency(Number(receipt.order?.totalAmount ?? 0))]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Created {new Date(receipt.createdAt).toLocaleString("en-KE")} · Payment {String(receipt.order?.paymentStatus || "PENDING").replace(/_/g, " ")}
                      </div>
                    </div>
                    <div className="grid min-w-[280px] gap-2 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-slate-200">
                      <div className="flex items-center justify-between">
                        <span>Selling price</span>
                        <span className="font-semibold text-white">{formatCurrency(Number(receipt.order?.totalAmount ?? 0))}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Commission on receipt</span>
                        <span className="font-semibold text-emerald-300">{formatCurrency(commission)}</span>
                      </div>
                      <div className="text-xs text-slate-500">
                        {profit > 0 ? "Pricing completed. This receipt already contributes to your POS commission." : "Awaiting pricing or buying-cost confirmation before commission can be recognized."}
                      </div>
                      <div className="pt-1">
                        <Link href={`/receipts/${encodeURIComponent(receipt.id)}`} target="_blank" rel="noreferrer" className="inline-flex rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/5">
                          Open receipt
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-400">
              No POS receipts have been created by this technical profile in the current trading period yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
