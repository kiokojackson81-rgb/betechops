import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma, WebsiteOrderStatus } from "@prisma/client";
import MarketingTrackerLegacySections, {
  MarketingTrackerTopActions,
} from "@/app/marketing/tracker/MarketingTrackerLegacySections";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTradingPeriodFor, parseTradingPeriodKey } from "@/lib/tradingPeriod";
import { WEBSITE_ORDER_ACTIVE_STATUSES } from "@/lib/websiteOrders";
import { getAdminAgentSales } from "@/lib/agents/sales";
import {
  isOpenQuotationStatus,
  isOpenWorkItemStatus,
  isPendingPodStatus,
  wasCreatedOrUpdatedInPeriod,
} from "@/lib/operationsWorkQueue";
import {
  ensureQuoteRequestAssignments,
  ensureQuoteRequestsSchema,
  listAssignedQuoteRequests,
  type SerializedQuoteRequest,
} from "@/lib/quoteRequests";

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

function explainTrackerError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return `${error.code}: ${error.message}`;
  }
  if (error instanceof Error) return error.message;
  return String(error);
}

async function safeLoad<T>(label: string, loader: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await loader();
  } catch (error) {
    console.warn(`[marketing.tracker] ${label} unavailable: ${explainTrackerError(error)}`);
    return fallback;
  }
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
  status: string;
  createdAt: Date | null;
  updatedAt: Date | null;
};

type TrackerWebsiteOrder = {
  id: string;
  customerName: string;
  customerPhone: string | null;
  total: number;
  status: WebsiteOrderStatus;
  createdAt: Date;
  updatedAt: Date;
  assignedAttendant: {
    id: string | null;
    email: string | null;
    name: string | null;
  } | null;
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

type TrackerAgentOrder = Awaited<ReturnType<typeof getAdminAgentSales>>[number];
function readWebsiteOrderAssignment(
  metadata: Prisma.JsonValue | null | undefined,
): TrackerWebsiteOrder["assignedAttendant"] {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const source = metadata as Record<string, unknown>;
  const id = typeof source.assignedAttendantId === "string" ? source.assignedAttendantId : null;
  const email = typeof source.assignedAttendantEmail === "string" ? source.assignedAttendantEmail : null;
  const name = typeof source.assignedAttendantName === "string" ? source.assignedAttendantName : null;
  if (!id && !email && !name) return null;
  return { id, email, name };
}

async function listTrackerWebsiteOrders(): Promise<TrackerWebsiteOrder[]> {
  const rows = await prisma.websiteOrder.findMany({
    where: { status: { in: WEBSITE_ORDER_ACTIVE_STATUSES } },
    orderBy: { createdAt: "desc" },
    take: 60,
    select: {
      id: true,
      customerName: true,
      customerPhone: true,
      total: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      metadata: true,
    },
  });

  return rows.map((row) => ({
    id: row.id,
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    total: Number(row.total ?? 0),
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    assignedAttendant: readWebsiteOrderAssignment(row.metadata),
  }));
}

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
      WHERE LOWER(COALESCE("status", '')) IN ('new', 'contacted', 'pending', 'follow_up', 'quoted', 'amount_pending')
      ORDER BY
        CASE
          WHEN "status" = 'NEW' THEN 1
          WHEN "status" = 'CONTACTED' THEN 2
          WHEN "status" = 'PENDING' THEN 3
          WHEN "status" = 'FOLLOW_UP' THEN 4
          WHEN "status" = 'QUOTED' THEN 5
          WHEN "status" = 'AMOUNT_PENDING' THEN 6
          ELSE 7
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
    where: { data: { path: ["podDelivery"], not: Prisma.JsonNull } },
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
    const podDelivery =
      receiptData.podDelivery && typeof receiptData.podDelivery === "object" && !Array.isArray(receiptData.podDelivery)
        ? (receiptData.podDelivery as Record<string, unknown>)
        : null;
    const receiptTotals = receipt.totals ?? {};
    const receiptNumber = String(receipt.order?.orderNumber ?? receiptData.receiptNumber ?? receipt.id);
    if (seen.has(receiptNumber)) continue;
    seen.add(receiptNumber);

    const total =
      Number(receiptTotals.total ?? receiptTotals.grandTotal ?? receipt.order?.totalAmount ?? receiptData.amount ?? 0) || 0;
    const status = String(podDelivery?.status ?? "pending");
    items.push({
      id: String(receipt.id),
      receiptNumber,
      customerName: String(receipt.order?.customerName ?? receiptData.customerName ?? "POD customer"),
      customerPhone: String(receipt.order?.customerPhone ?? receiptData.customerPhone ?? "").trim() || null,
      total,
      status,
      createdAt: receipt.generatedAt instanceof Date ? receipt.generatedAt : receipt.createdAt instanceof Date ? receipt.createdAt : null,
      updatedAt:
        typeof podDelivery?.updatedAt === "string"
          ? new Date(String(podDelivery.updatedAt))
          : typeof podDelivery?.createdAt === "string"
            ? new Date(String(podDelivery.createdAt))
            : receipt.generatedAt instanceof Date
              ? receipt.generatedAt
              : receipt.createdAt instanceof Date
                ? receipt.createdAt
                : null,
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
  const userId = user.id;

  const resolvedSearchParams = (await searchParams) ?? {};
  const periodKeyParam = Array.isArray(resolvedSearchParams.periodKey)
    ? resolvedSearchParams.periodKey[0]
    : resolvedSearchParams.periodKey;
  const period = parseTradingPeriodKey(periodKeyParam) ?? getTradingPeriodFor(new Date());
  const [
    rawWebsiteOrders,
    rawQuoteRequests,
    allAgentOrders,
    podFollowUp,
  ] = await Promise.all([
    safeLoad("website orders", () => listTrackerWebsiteOrders(), [] as TrackerWebsiteOrder[]),
    safeLoad("quote requests", () => listVisibleQuoteRequests({ userId, role: user.role }), [] as SerializedQuoteRequest[]),
    safeLoad("agent orders", () => getAdminAgentSales({ statuses: [...AGENT_OPEN_STATUSES] }), [] as TrackerAgentOrder[]),
    safeLoad("pod follow-up", () => listPodFollowUp(5), [] as PodFollowUpItem[]),
  ]);

  const websiteOrders =
    user.role === "ADMIN"
      ? rawWebsiteOrders
      : rawWebsiteOrders.filter(
          (order) =>
            order.assignedAttendant?.id === user.id ||
            (order.assignedAttendant?.email &&
              user.email &&
              order.assignedAttendant.email.toLowerCase() === user.email.toLowerCase()),
        );
  const websiteOrdersPending = websiteOrders.filter((order) => WEBSITE_PENDING_STATUSES.has(order.status));
  const websiteOrdersInPeriod = websiteOrdersPending.filter((order) =>
    isOpenWorkItemStatus(order.status) &&
    wasCreatedOrUpdatedInPeriod(order.createdAt, order.updatedAt, period),
  );

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
  const openAgentOrders = agentOrders.filter((sale) =>
    isOpenWorkItemStatus(sale.status) &&
    wasCreatedOrUpdatedInPeriod(sale.createdAt, sale.updatedAt, period),
  );

  const quoteRequests = rawQuoteRequests.filter((request) =>
    isOpenQuotationStatus(request.status) &&
    wasCreatedOrUpdatedInPeriod(request.createdAt, request.updatedAt, period),
  );
  const pendingPodFollowUp = podFollowUp.filter((item) =>
    isPendingPodStatus(item.status) &&
    wasCreatedOrUpdatedInPeriod(item.createdAt, item.updatedAt, period),
  );
  const needsAttentionQueue: QueueItem[] = [
    ...websiteOrdersInPeriod.slice(0, 6).map((order) => ({
      id: `website:${order.id}`,
      type: "Website Order" as const,
      customerName: order.customerName,
      phone: order.customerPhone,
      amount: order.total,
      status: websiteStatusLabel(order.status),
      createdAt: order.createdAt,
      assignedTo: order.assignedAttendant?.name || order.assignedAttendant?.email || null,
      href: `/marketing/receipts?tab=web-orders&orderId=${encodeURIComponent(order.id)}`,
    })),
    ...openAgentOrders.slice(0, 6).map((sale) => ({
      id: `agent:${sale.id}`,
      type: "Agent Order" as const,
      customerName: sale.customerName,
      phone: sale.customerPhone,
      amount: sale.totalAmount,
      status: sale.statusMeta.label,
      createdAt: sale.createdAt,
      assignedTo: sale.assignedProcessorName || sale.assignedProcessorEmail || null,
      href: `/marketing/agent-orders?saleId=${encodeURIComponent(sale.id)}`,
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
      href: `/marketing/receipts?tab=quotations&quoteId=${encodeURIComponent(request.id)}`,
    })),
    ...pendingPodFollowUp.map((item) => ({
      id: `pod:${item.id}`,
      type: "POD" as const,
      customerName: item.customerName,
      phone: item.customerPhone,
      amount: item.total,
      status: item.status.replace(/_/g, " ").toLowerCase(),
      createdAt: item.createdAt,
      assignedTo: null,
      href: `/marketing/receipts?tab=pos&pod=pending&receiptId=${encodeURIComponent(item.id)}`,
    })),
  ]
    .sort((left, right) => {
      const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
      const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
      return rightTime - leftTime;
    })
    .slice(0, 14);

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

            <MarketingTrackerTopActions />
          </div>
        </header>

        <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.96),rgba(2,6,23,.98))] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Needs Attention</div>
              <h2 className="mt-2 text-2xl font-semibold text-white">Unified work queue</h2>
              <p className="mt-1 text-sm text-slate-400">
                Open work in the active statistics period only. Closed, delivered, cancelled, and settled items are hidden automatically.
              </p>
            </div>
            <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-slate-300">
              {needsAttentionQueue.length} pending item{needsAttentionQueue.length === 1 ? "" : "s"}
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
                      {item.type === "Agent Order"
                        ? "Process order"
                        : item.type === "Website Order"
                          ? "Open order"
                          : item.type === "Quotation"
                            ? "View quotation"
                            : "Open POD"}
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-5 text-sm text-slate-400">
                No pending work right now.
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
              {openAgentOrders.slice(0, 5).map((sale) => (
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
              {!openAgentOrders.length ? <div className="text-sm text-slate-400">No assigned agent orders right now.</div> : null}
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
              {!quoteRequests.length ? <div className="text-sm text-slate-400">No pending quotations.</div> : null}
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
              {pendingPodFollowUp.map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-white">{item.customerName}</div>
                      <div className="mt-1 text-sm text-slate-400">{item.receiptNumber}</div>
                    </div>
                    <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-100">
                      {item.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 text-sm text-slate-400">
                    <span>{item.customerPhone || "-"}</span>
                    <span className="font-medium text-white">{formatKes(item.total)}</span>
                  </div>
                </div>
              ))}
              {!pendingPodFollowUp.length ? <div className="text-sm text-slate-400">No pending POD follow-up.</div> : null}
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.96),rgba(2,6,23,.98))] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Staff Report & Payroll</div>
              <h2 className="mt-2 text-2xl font-semibold text-white">Daily reporting, quick stats, and payslip tools</h2>
              <p className="mt-1 text-sm text-slate-400">
                Complete the daily checklist, review your period stats, and download payroll documents from one integrated section.
              </p>
            </div>
          </div>
          <MarketingTrackerLegacySections />
        </section>

      </main>
    </div>
  );
}
