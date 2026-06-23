import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma, WebsiteOrderStatus } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTradingPeriodFor, parseTradingPeriodKey } from "@/lib/tradingPeriod";
import { summarizePosReceiptsForPeriod } from "@/lib/posReceiptSummary";
import {
  WEBSITE_ORDER_ACTIVE_STATUSES,
  serializeWebsiteOrders,
  websiteOrderAdminInclude,
} from "@/lib/websiteOrders";
import { getAdminAgentSales } from "@/lib/agents/sales";
import {
  ensureQuoteRequestAssignments,
  ensureQuoteRequestsSchema,
  listAssignedQuoteRequests,
  type SerializedQuoteRequest,
} from "@/lib/quoteRequests";
import { getPodPendingStats } from "@/lib/podPendingStats";
import { getEarningsSummaryForUser } from "@/lib/earningsSummary";
import { summarizeMarketingReportsForPeriod } from "@/lib/marketingPeriodTotals";
import { getSupportPeriodAggregates } from "@/lib/supportEntries";

export const dynamic = "force-dynamic";

const AGENT_OPEN_STATUSES = [
  "pending_review",
  "awaiting_payment",
  "payment_confirmed",
  "processing",
  "dispatched",
  "delivered_pending_balance",
] as const;

const WEBSITE_PENDING_STATUSES = new Set<WebsiteOrderStatus>([
  WebsiteOrderStatus.PENDING,
  WebsiteOrderStatus.CONFIRMED,
  WebsiteOrderStatus.PROCESSING,
  WebsiteOrderStatus.RECEIPT_ISSUED,
  WebsiteOrderStatus.DISPATCHED,
  WebsiteOrderStatus.PAYMENT_CONFIRMED,
]);

const QUOTE_PENDING_STATUSES = new Set(["NEW", "CONTACTED", "FOLLOW_UP", "QUOTED"]);

function canAccessOperationsHub(role: string | null | undefined, attendantCategory: string | null | undefined) {
  return (
    role === "ADMIN" ||
    attendantCategory === "DIRECT_SALES_OPS" ||
    attendantCategory === "MARKETING_OPS"
  );
}

function formatKes(value: number | null | undefined) {
  return `KES ${Math.round(Number(value ?? 0)).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
}

function formatDateOnly(value: string | Date | null | undefined) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function startOfToday() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

function endOfToday() {
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  return now;
}

function ageLabel(value: string | Date | null | undefined) {
  if (!value) return "-";
  const createdAt = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(createdAt.getTime())) return "-";
  const diffMs = Date.now() - createdAt.getTime();
  const diffHours = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
  if (diffHours < 1) {
    const diffMinutes = Math.max(0, Math.floor(diffMs / (1000 * 60)));
    return `${diffMinutes} min ago`;
  }
  if (diffHours < 24) return `${diffHours} hr ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

function staffRoleLabel(role: string | null | undefined, attendantCategory: string | null | undefined) {
  if (role === "ADMIN") return "Admin";
  if (attendantCategory === "DIRECT_SALES_OPS") return "Direct Sales Ops";
  if (attendantCategory === "MARKETING_OPS") return "Marketing Ops";
  return "Operations";
}

function quoteStatusLabel(status: string) {
  return status.replace(/_/g, " ").toLowerCase();
}

function websiteStatusLabel(status: string) {
  return status.replace(/_/g, " ").toLowerCase();
}

type QueueItem = {
  id: string;
  type: "Website Order" | "Agent Order" | "Quotation" | "POD";
  customerName: string;
  phone: string | null;
  amount: number | null;
  status: string;
  createdAt: string | Date | null;
  assignedTo?: string | null;
  href: string;
};

type PodFollowUpItem = {
  id: string;
  receiptNumber: string;
  customerName: string;
  customerPhone: string | null;
  total: number;
  createdAt: Date | null;
};

type PodReceiptFollowUpRow = {
  id: string;
  generatedAt: Date | null;
  createdAt: Date;
  totals: Record<string, unknown> | null;
  data: Record<string, unknown> | null;
  order: {
    orderNumber: string | null;
    customerName: string | null;
    customerPhone: string | null;
    totalAmount: number | null;
  } | null;
};

async function listVisibleQuoteRequests(input: {
  userId: string;
  role: string | null | undefined;
}) {
  await ensureQuoteRequestsSchema();
  await ensureQuoteRequestAssignments();

  if (input.role === "ADMIN") {
    const rows = await prisma.$queryRaw<Array<{
      id: string;
      customerName: string;
      customerPhone: string;
      customerEmail: string | null;
      customerLocation: string | null;
      county: string | null;
      town: string | null;
      status: string;
      assignedAttendantId: string | null;
      assignedAttendantEmail: string | null;
      assignedAttendantName: string | null;
      quoteTitle: string | null;
      quoteMessage: string | null;
      quotationData: Prisma.JsonValue | null;
      responseMetadata: Prisma.JsonValue | null;
      respondedAt: Date | string | null;
      respondedById: string | null;
      metadata: Prisma.JsonValue | null;
      createdAt: Date | string;
      updatedAt: Date | string;
      quoteRef: string;
      customerUserId: string | null;
      specificLocation: string | null;
      projectType: string | null;
      propertyType: string | null;
      preferredContactMethod: string | null;
      bestTimeToContact: string | null;
      urgency: string | null;
      installationStatus: string | null;
      loadDescription: string | null;
      budgetRange: string | null;
      preferredProducts: string | null;
      notes: string | null;
      answersJson: Prisma.JsonValue | null;
    }>>(Prisma.sql`
      SELECT *
      FROM "QuoteRequest"
      WHERE "status" IN ('NEW', 'CONTACTED', 'FOLLOW_UP', 'QUOTED')
      ORDER BY
        CASE
          WHEN "status" = 'NEW' THEN 1
          WHEN "status" = 'CONTACTED' THEN 2
          WHEN "status" = 'FOLLOW_UP' THEN 3
          WHEN "status" = 'QUOTED' THEN 4
          ELSE 5
        END ASC,
        "createdAt" DESC
    `);
    return rows.map((row) => ({
      id: row.id,
      customerName: row.customerName,
      customerPhone: row.customerPhone,
      customerEmail: row.customerEmail,
      customerLocation: row.customerLocation,
      county: row.county,
      town: row.town,
      projectType: row.projectType as SerializedQuoteRequest["projectType"],
      status: row.status,
      assignedAttendant: row.assignedAttendantId
        ? {
            id: row.assignedAttendantId,
            email: row.assignedAttendantEmail,
            name: row.assignedAttendantName,
          }
        : null,
      quoteTitle: row.quoteTitle,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : new Date(row.createdAt).toISOString(),
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : new Date(row.updatedAt).toISOString(),
    })) as Array<
      Pick<
        SerializedQuoteRequest,
        "id" | "customerName" | "customerPhone" | "customerEmail" | "customerLocation" | "county" | "town" | "projectType" | "status" | "assignedAttendant" | "quoteTitle" | "createdAt" | "updatedAt"
      >
    >;
  }

  return listAssignedQuoteRequests({
    userId: input.userId,
    status: "ALL",
  });
}

async function listPodFollowUp(limit = 5): Promise<PodFollowUpItem[]> {
  const receipts = await prisma.receipt.findMany({
    where: { data: { path: ["podDelivery", "status"], equals: "pending" } },
    orderBy: { generatedAt: "desc" },
    take: 50,
    select: {
      id: true,
      generatedAt: true,
      createdAt: true,
      totals: true,
      data: true,
      order: {
        select: {
          orderNumber: true,
          customerName: true,
          customerPhone: true,
          totalAmount: true,
        },
      },
    },
  });

  const seen = new Set<string>();
  const items: PodFollowUpItem[] = [];

  for (const receipt of receipts as PodReceiptFollowUpRow[]) {
    const receiptData = receipt.data ?? {};
    const receiptTotals = receipt.totals ?? {};
    const receiptNumber = String(receipt.order?.orderNumber ?? receiptData.receiptNumber ?? receipt.id);
    if (seen.has(receiptNumber)) continue;
    seen.add(receiptNumber);

    const total =
      Number(receiptTotals.total ?? receiptTotals.grandTotal ?? receipt.order?.totalAmount ?? receiptData.amount ?? 0) || 0;
    items.push({
      id: String(receipt.id),
      receiptNumber,
      customerName: String(receipt.order?.customerName ?? receiptData.customerName ?? "POD customer"),
      customerPhone: String(receipt.order?.customerPhone ?? receiptData.customerPhone ?? "").trim() || null,
      total,
      createdAt: receipt.generatedAt instanceof Date ? receipt.generatedAt : receipt.createdAt instanceof Date ? receipt.createdAt : null,
    });
    if (items.length >= limit) break;
  }

  return items;
}

type TrackerPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function MarketingTrackerPage({ searchParams }: TrackerPageProps) {
  const session = await auth();
  const user = session?.user as {
    id?: string | null;
    email?: string | null;
    name?: string | null;
    role?: string | null;
    attendantCategory?: string | null;
  } | undefined;

  if (!session || !user?.id) redirect("/admin/login");
  if (!canAccessOperationsHub(user.role, user.attendantCategory)) redirect("/not-authorized");

  const resolvedSearchParams = (await searchParams) ?? {};
  const periodKeyParam = Array.isArray(resolvedSearchParams.periodKey)
    ? resolvedSearchParams.periodKey[0]
    : resolvedSearchParams.periodKey;
  const period = parseTradingPeriodKey(periodKeyParam) ?? getTradingPeriodFor(new Date());
  const todayStart = startOfToday();
  const todayEnd = endOfToday();

  const [
    todayPosSummary,
    podPendingStats,
    earningsSummary,
    marketingSummary,
    supportSummary,
    rawWebsiteOrders,
    rawQuoteRequests,
    allAgentOrders,
    podFollowUp,
    completedWebsiteOrdersToday,
    completedAgentOrdersToday,
  ] = await Promise.all([
    summarizePosReceiptsForPeriod({
      start: todayStart,
      end: todayEnd,
      userId: user.id,
      ownershipMode: "staffDisplay",
      paymentScope: "paidOnly",
    }),
    getPodPendingStats(5),
    getEarningsSummaryForUser({ userId: user.id, asOf: period.start }),
    summarizeMarketingReportsForPeriod({
      userId: user.id,
      userEmail: user.email ?? null,
      period,
    }),
    getSupportPeriodAggregates({ userId: user.id, period }),
    prisma.websiteOrder.findMany({
      where: { status: { in: WEBSITE_ORDER_ACTIVE_STATUSES } },
      include: websiteOrderAdminInclude,
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
    listVisibleQuoteRequests({ userId: user.id, role: user.role }),
    getAdminAgentSales({ statuses: [...AGENT_OPEN_STATUSES] }),
    listPodFollowUp(5),
    prisma.websiteOrder.count({
      where: {
        status: WebsiteOrderStatus.DELIVERED,
        updatedAt: { gte: todayStart, lte: todayEnd },
      },
    }),
    prisma.agentSale.count({
      where: {
        status: "completed",
        OR: [
          { completedAt: { gte: todayStart, lte: todayEnd } },
          { updatedAt: { gte: todayStart, lte: todayEnd } },
        ],
      },
    }),
  ]);

  const serializedWebsiteOrders = await serializeWebsiteOrders(rawWebsiteOrders);
  const websiteOrders =
    user.role === "ADMIN"
      ? serializedWebsiteOrders
      : serializedWebsiteOrders.filter((order) => order.assignedAttendant?.id === user.id);
  const websiteOrdersPending = websiteOrders.filter((order) => WEBSITE_PENDING_STATUSES.has(order.status));

  const agentOrders =
    user.role === "ADMIN"
      ? allAgentOrders
      : allAgentOrders.filter(
          (sale) =>
            sale.assignedProcessorId === user.id ||
            (sale.assignedProcessorEmail &&
              user.email &&
              sale.assignedProcessorEmail.toLowerCase() === user.email.toLowerCase()),
        );

  const quoteRequests = rawQuoteRequests.filter((request) => QUOTE_PENDING_STATUSES.has(request.status));

  const completedToday = completedWebsiteOrdersToday + completedAgentOrdersToday;
  const chatLeadsPending = 0; // TODO: wire stable chat/lead source when the queue is finalized.

  const needsAttentionQueue: QueueItem[] = [
    ...websiteOrdersPending.slice(0, 6).map((order) => ({
      id: `website:${order.id}`,
      type: "Website Order" as const,
      customerName: order.customerName,
      phone: order.customerPhone,
      amount: order.total,
      status: websiteStatusLabel(order.status),
      createdAt: order.createdAt,
      assignedTo: order.assignedAttendant?.name || order.assignedAttendant?.email || null,
      href: "/marketing/receipts",
    })),
    ...agentOrders.slice(0, 6).map((sale) => ({
      id: `agent:${sale.id}`,
      type: "Agent Order" as const,
      customerName: sale.customerName,
      phone: sale.customerPhone,
      amount: sale.totalAmount,
      status: sale.statusMeta.label,
      createdAt: sale.createdAt,
      assignedTo: sale.assignedProcessorName || sale.assignedProcessorEmail || null,
      href: "/marketing/agent-orders",
    })),
    ...quoteRequests.slice(0, 6).map((request) => ({
      id: `quote:${request.id}`,
      type: "Quotation" as const,
      customerName: request.customerName,
      phone: request.customerPhone,
      amount: null,
      status: quoteStatusLabel(request.status),
      createdAt: request.createdAt,
      assignedTo: request.assignedAttendant?.name || request.assignedAttendant?.email || null,
      href: "/marketing/receipts",
    })),
    ...podFollowUp.map((item) => ({
      id: `pod:${item.id}`,
      type: "POD" as const,
      customerName: item.customerName,
      phone: item.customerPhone,
      amount: item.total,
      status: "pending follow-up",
      createdAt: item.createdAt,
      assignedTo: null,
      href: "/marketing/receipts",
    })),
  ]
    .sort((left, right) => {
      const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
      const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
      return rightTime - leftTime;
    })
    .slice(0, 14);

  const performancePdfHref = `/api/attendant/daily-report/performance-receipt/pdf?periodKey=${encodeURIComponent(period.key)}`;
  const periodSales = Number(earningsSummary.totalSales ?? 0);
  const periodReceipts = Number(earningsSummary.totalReceipts ?? 0);
  const periodItems = Number(earningsSummary.totalItems ?? 0);
  const periodCommission = Number(earningsSummary.commission ?? earningsSummary.grossCommission ?? 0);
  const periodSupportSales = Number(supportSummary.aggregates.totalSales ?? 0);
  const periodMarketingSales = Number(marketingSummary.totals.totalSales ?? 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto max-w-7xl space-y-6 p-6">
        <header className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.96),rgba(2,6,23,.98))] px-6 py-6 shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
                {staffRoleLabel(user.role, user.attendantCategory)}
              </div>
              <div>
                <h1 className="text-3xl font-semibold text-white">Operations Command Center</h1>
                <p className="mt-2 max-w-3xl text-sm text-slate-300">
                  Overview of POS sales, web orders, agent orders, quotations, chats, and delivery follow-up.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                  {user.name || user.email || "Operations staff"}
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                  {period.label}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/marketing/receipts"
                className="rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:border-white/30 hover:bg-white/[0.08]"
              >
                POS Receipts
              </Link>
              <Link
                href="/marketing/receipts"
                className="rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:border-white/30 hover:bg-white/[0.08]"
              >
                Web Orders
              </Link>
              <Link
                href="/marketing/agent-orders"
                className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-100 transition hover:border-emerald-300/30 hover:bg-emerald-400/15"
              >
                Agent Orders
              </Link>
              <Link
                href="/marketing/receipts"
                className="rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:border-white/30 hover:bg-white/[0.08]"
              >
                Quotations
              </Link>
              <a
                href={performancePdfHref}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-amber-400/20 bg-amber-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-amber-100 transition hover:border-amber-300/30 hover:bg-amber-400/15"
              >
                Performance PDF
              </a>
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "POS Receipts Today", value: todayPosSummary.totalReceipts, note: "Paid receipts captured today" },
            { label: "POS Sales Today", value: formatKes(todayPosSummary.totalSales), note: "From POS receipt totals" },
            { label: "Web Orders Pending", value: websiteOrdersPending.length, note: "Assigned website queue" },
            { label: "Agent Orders Assigned", value: agentOrders.length, note: "Open agent-submitted orders" },
            { label: "Quotation Requests Pending", value: quoteRequests.length, note: "Assigned quotation follow-up" },
            { label: "POD Pending", value: podPendingStats.pendingCount, note: formatKes(podPendingStats.pendingTotal) },
            { label: "Chats / Leads Pending", value: chatLeadsPending, note: "TODO: connect stable lead source" },
            { label: "Completed Today", value: completedToday, note: "Website + agent orders finalized today" },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.96),rgba(2,6,23,.98))] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.28)]"
            >
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{card.label}</div>
              <div className="mt-3 text-3xl font-semibold text-white">{card.value}</div>
              <div className="mt-2 text-sm text-slate-400">{card.note}</div>
            </div>
          ))}
        </section>

        <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.96),rgba(2,6,23,.98))] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Needs Attention</div>
              <h2 className="mt-2 text-2xl font-semibold text-white">Unified work queue</h2>
              <p className="mt-1 text-sm text-slate-400">
                Pending website orders, assigned agent orders, quotation follow-up, and POD work in one place.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            {needsAttentionQueue.length ? (
              needsAttentionQueue.map((item) => (
                <div
                  key={item.id}
                  className="grid gap-3 rounded-[22px] border border-white/10 bg-white/[0.03] p-4 lg:grid-cols-[140px_1.3fr_1fr_160px_140px_150px]"
                >
                  <div className="flex items-center">
                    <span className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100">
                      {item.type}
                    </span>
                  </div>
                  <div>
                    <div className="font-semibold text-white">{item.customerName}</div>
                    <div className="mt-1 text-sm text-slate-400">{item.phone || "No phone captured"}</div>
                  </div>
                  <div className="text-sm text-slate-300">
                    <div className="font-medium text-white">{item.amount != null ? formatKes(item.amount) : "Amount pending"}</div>
                    <div className="mt-1 capitalize text-slate-400">{item.status}</div>
                  </div>
                  <div className="text-sm text-slate-400">
                    <div>{formatDateOnly(item.createdAt)}</div>
                    <div className="mt-1">{ageLabel(item.createdAt)}</div>
                  </div>
                  <div className="text-sm text-slate-400">
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Assigned</div>
                    <div className="mt-1 text-slate-200">{item.assignedTo || "Shared queue"}</div>
                  </div>
                  <div className="flex items-center justify-start lg:justify-end">
                    <Link
                      href={item.href}
                      className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-100 transition hover:border-emerald-300/30 hover:bg-emerald-400/15"
                    >
                      Open queue
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-5 text-sm text-slate-400">
                No active work queue items found right now.
              </div>
            )}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.96),rgba(2,6,23,.98))] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Agent Orders</div>
                <h3 className="mt-2 text-xl font-semibold text-white">Assigned top 5</h3>
              </div>
              <Link href="/marketing/agent-orders" className="text-sm font-medium text-emerald-300 hover:text-emerald-200">
                Open all
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              {agentOrders.slice(0, 5).map((sale) => (
                <div key={sale.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-white">{sale.customerName}</div>
                      <div className="mt-1 text-sm text-slate-400">{sale.productName}</div>
                    </div>
                    <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                      {sale.statusMeta.label}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 text-sm text-slate-400">
                    <span>{sale.customerPhone}</span>
                    <span className="font-medium text-white">{formatKes(sale.totalAmount)}</span>
                  </div>
                </div>
              ))}
              {!agentOrders.length ? <div className="text-sm text-slate-400">No assigned agent orders right now.</div> : null}
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.96),rgba(2,6,23,.98))] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Quotations</div>
                <h3 className="mt-2 text-xl font-semibold text-white">Pending top 5</h3>
              </div>
              <Link href="/marketing/receipts" className="text-sm font-medium text-emerald-300 hover:text-emerald-200">
                Open desk
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              {quoteRequests.slice(0, 5).map((request) => (
                <div key={request.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-white">{request.customerName}</div>
                      <div className="mt-1 text-sm text-slate-400">
                        {request.projectType ? request.projectType.replace(/_/g, " ").toLowerCase() : "Quotation request"}
                      </div>
                    </div>
                    <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                      {quoteStatusLabel(request.status)}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 text-sm text-slate-400">
                    <span>{request.customerPhone}</span>
                    <span>{formatDateOnly(request.createdAt)}</span>
                  </div>
                </div>
              ))}
              {!quoteRequests.length ? <div className="text-sm text-slate-400">No quotation follow-up items right now.</div> : null}
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.96),rgba(2,6,23,.98))] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">POD Follow-up</div>
                <h3 className="mt-2 text-xl font-semibold text-white">Pending top 5</h3>
              </div>
              <Link href="/marketing/receipts" className="text-sm font-medium text-emerald-300 hover:text-emerald-200">
                Open receipts
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              {podFollowUp.map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-white">{item.customerName}</div>
                      <div className="mt-1 text-sm text-slate-400">{item.receiptNumber}</div>
                    </div>
                    <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-100">
                      Pending
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 text-sm text-slate-400">
                    <span>{item.customerPhone || "-"}</span>
                    <span className="font-medium text-white">{formatKes(item.total)}</span>
                  </div>
                </div>
              ))}
              {!podFollowUp.length ? <div className="text-sm text-slate-400">No pending POD follow-up right now.</div> : null}
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.96),rgba(2,6,23,.98))] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Performance Snapshot</div>
              <h2 className="mt-2 text-2xl font-semibold text-white">Current trading period</h2>
              <p className="mt-1 text-sm text-slate-400">
                Uses the same trading-period and performance-report logic already powering Jeniffer&apos;s PDF.
              </p>
            </div>
            <a
              href={performancePdfHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-full border border-amber-400/20 bg-amber-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-amber-100 transition hover:border-amber-300/30 hover:bg-amber-400/15"
            >
              Download performance PDF
            </a>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Sales</div>
              <div className="mt-2 text-2xl font-semibold text-white">{formatKes(periodSales)}</div>
              <div className="mt-1 text-sm text-slate-400">Marketing: {formatKes(periodMarketingSales)} · Support: {formatKes(periodSupportSales)}</div>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Receipts count</div>
              <div className="mt-2 text-2xl font-semibold text-white">{periodReceipts}</div>
              <div className="mt-1 text-sm text-slate-400">Trading-period receipt volume</div>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Items sold</div>
              <div className="mt-2 text-2xl font-semibold text-white">{periodItems}</div>
              <div className="mt-1 text-sm text-slate-400">Combined from the earnings summary</div>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Estimated commission</div>
              <div className="mt-2 text-2xl font-semibold text-amber-200">{formatKes(periodCommission)}</div>
              <div className="mt-1 text-sm text-slate-400">Authoritative earnings summary output</div>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">POD pending</div>
              <div className="mt-2 text-2xl font-semibold text-white">{podPendingStats.pendingCount}</div>
              <div className="mt-1 text-sm text-slate-400">{formatKes(podPendingStats.pendingTotal)} awaiting closure</div>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Completed deliveries</div>
              <div className="mt-2 text-2xl font-semibold text-white">{completedToday}</div>
              <div className="mt-1 text-sm text-slate-400">Orders finalized today across active queues</div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
