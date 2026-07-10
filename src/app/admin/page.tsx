import Link from "next/link";
import { endOfDay, format, startOfDay, subDays } from "date-fns";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Prisma } from "@prisma/client";
import {
  Activity,
  ArrowRight,
  BadgeDollarSign,
  Boxes,
  Briefcase,
  Building2,
  ChartColumnBig,
  ChevronDown,
  CircleAlert,
  ClipboardCheck,
  HeartHandshake,
  Package,
  Receipt,
  RefreshCcw,
  ShieldCheck,
  ShoppingBag,
  Store,
  PhoneCall,
  UserRound,
  TrendingUp,
  TriangleAlert,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import AutoRefresh from "@/app/_components/AutoRefresh";
import AdminPrivacyToggle from "@/app/admin/_components/AdminPrivacyToggle";
import { getAdminAgentSales } from "@/lib/agents/sales";
import {
  ensureQuoteRequestsSchema,
} from "@/lib/quoteRequests";
import {
  isCarriedForwardPendingItem,
  isOpenQuotationStatus,
  isOpenWorkItemStatus,
  isPendingPodStatus,
  isPendingWebOrderStatus,
  shouldShowPendingWorkItem,
  wasCreatedOrUpdatedInPeriod,
} from "@/lib/operationsWorkQueue";
import { prisma } from "@/lib/prisma";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { buildPayrollRow } from "@/lib/adminPayroll";
import { applyCanonicalPayrollOverrides } from "@/lib/payrollCanonical";
import { payrollEligibleUserWhere } from "@/lib/payrollEligibility";
import { getUnpricedDailySalesForRange } from "@/lib/marketingUnpricedSales";
import { groupMarketingUnpricedSales } from "@/lib/unpricedReceiptGrouping";
import { buildStaffAttendantWhere } from "@/lib/staffUsers";
import { computeEffectiveCashAdvanceRemainingBalance } from "@/lib/wellness";
import { buildAdminCustomerProfileHref } from "@/lib/adminCustomerProfileLinks";
import { resolveVoiceProviderOutcome } from "@/lib/voiceOperations";
import { normalizePhone } from "@/lib/phone";

export const dynamic = "force-dynamic";

const AGENT_OPEN_STATUSES = [
  "pending_review",
  "awaiting_payment",
  "payment_confirmed",
  "processing",
  "dispatched",
  "delivered_pending_balance",
] as const;

type ReceiptSnapshot = {
  generatedAt: Date;
  order: { totalAmount: number | null } | null;
  totals: unknown;
  data: unknown;
};

type DeskReceiptSnapshot = {
  createdAt: Date;
  sellingTotal: number;
  buyingTotal: number;
  paymentMethod?: string | null;
};

type TrendPoint = {
  key: string;
  label: string;
  total: number;
  pos: number;
  desk: number;
  online: number;
  webOrders: number;
  agentOrders: number;
  quotations: number;
  marketplaceOrders: number;
};

type LinkItem = {
  href: string;
  label: string;
  meta: string;
};

type LinkGroup = {
  title: string;
  tone: string;
  items: LinkItem[];
};

type DashboardRangePreset = "today" | "yesterday" | "trading_period" | "custom";

type DashboardRange = {
  preset: DashboardRangePreset;
  start: Date;
  end: Date;
  label: string;
  shortLabel: string;
  description: string;
  fromValue: string;
  toValue: string;
};

const shellCard =
  "rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(19,27,43,0.95),rgba(9,13,26,0.98))] shadow-[0_30px_80px_rgba(0,0,0,0.35)]";

const subtleCard =
  "rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(15,22,37,0.94),rgba(7,10,20,0.98))]";

const sectionPill =
  "rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-300 transition hover:border-emerald-400/40 hover:text-emerald-200";

const sensitiveClass = "admin-sensitive-value";

const formatKES = (value: number) =>
  `KES ${Math.round(value || 0).toLocaleString("en-KE")}`;

const formatCompactKES = (value: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value || 0);

const toNumber = (value: unknown) => {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
};

const getReceiptTotals = (receipt: ReceiptSnapshot) => {
  const totals = (receipt.totals ?? {}) as Record<string, unknown>;
  const data = (receipt.data ?? {}) as Record<string, unknown>;
  const dataTotals = ((data.totals ?? {}) as Record<string, unknown>) || {};
  const selling =
    toNumber(receipt.order?.totalAmount) ||
    toNumber(totals.total) ||
    toNumber(totals.totalAmount) ||
    toNumber(dataTotals.total) ||
    toNumber(dataTotals.totalAmount);
  const buying =
    toNumber(totals.buyingTotal) ||
    toNumber(dataTotals.buyingTotal);
  const storedProfit = toNumber(totals.profit) || toNumber(dataTotals.profit);
  const profit = storedProfit || (selling > 0 && buying > 0 ? selling - buying : 0);
  return { selling, buying, profit };
};

const getDeskReceiptTotals = (receipt: DeskReceiptSnapshot) => {
  const selling = toNumber(receipt.sellingTotal);
  const buying = toNumber(receipt.buyingTotal);
  const profit = selling > 0 && buying > 0 ? selling - buying : 0;
  return { selling, buying, profit };
};

function dayKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function toInputDate(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function buildTrendSeed(anchorDate: Date) {
  const today = anchorDate;
  return Array.from({ length: 7 }, (_, index) => {
    const date = subDays(today, 6 - index);
    return {
      key: dayKey(date),
      label: format(date, "EEE"),
      total: 0,
      pos: 0,
      desk: 0,
      online: 0,
      webOrders: 0,
      agentOrders: 0,
      quotations: 0,
      marketplaceOrders: 0,
    } satisfies TrendPoint;
  });
}

function resolveDashboardRange(params?: {
  range?: string;
  from?: string;
  to?: string;
}): DashboardRange {
  const now = new Date();
  const tradingPeriod = getTradingPeriodFor(now);
  const normalizedPreset = String(params?.range || "trading_period").trim().toLowerCase();

  const parseDate = (value?: string, fallback?: Date, boundary: "start" | "end" = "start") => {
    if (!value) return fallback ?? now;
    const parsed = new Date(`${value}T00:00:00.000`);
    if (Number.isNaN(parsed.getTime())) return fallback ?? now;
    if (boundary === "end") {
      return endOfDay(parsed);
    }
    return startOfDay(parsed);
  };

  if (normalizedPreset === "today") {
    return {
      preset: "today",
      start: startOfDay(now),
      end: endOfDay(now),
      label: `Today · ${format(now, "dd MMM yyyy")}`,
      shortLabel: "Today",
      description: "Same-day operations only.",
      fromValue: toInputDate(now),
      toValue: toInputDate(now),
    };
  }

  if (normalizedPreset === "yesterday") {
    const date = subDays(now, 1);
    return {
      preset: "yesterday",
      start: startOfDay(date),
      end: endOfDay(date),
      label: `Yesterday · ${format(date, "dd MMM yyyy")}`,
      shortLabel: "Yesterday",
      description: "Previous day performance and pending carry-forward.",
      fromValue: toInputDate(date),
      toValue: toInputDate(date),
    };
  }

  if (normalizedPreset === "custom") {
    const start = parseDate(params?.from, tradingPeriod.start, "start");
    const end = parseDate(params?.to, tradingPeriod.end, "end");
    const safeStart = start.getTime() <= end.getTime() ? start : startOfDay(end);
    const safeEnd = end.getTime() >= start.getTime() ? end : endOfDay(start);
    return {
      preset: "custom",
      start: safeStart,
      end: safeEnd,
      label: `${format(safeStart, "dd MMM yyyy")} – ${format(safeEnd, "dd MMM yyyy")}`,
      shortLabel: "Custom range",
      description: "Manual window for audits and management review.",
      fromValue: toInputDate(safeStart),
      toValue: toInputDate(safeEnd),
    };
  }

  return {
    preset: "trading_period",
    start: tradingPeriod.start,
    end: tradingPeriod.end,
    label: tradingPeriod.label,
    shortLabel: "Trading period",
    description: "Current 25th-to-24th trading period.",
    fromValue: toInputDate(tradingPeriod.start),
    toValue: toInputDate(tradingPeriod.end),
  };
}

function scoreTone(value: number) {
  if (value > 0) return "text-emerald-300";
  if (value < 0) return "text-rose-300";
  return "text-slate-200";
}

function SectionHeader({
  id,
  eyebrow,
  title,
  description,
  action,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div id={id} className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.34em] text-emerald-300/90">{eyebrow}</div>
        <h2 className="text-2xl font-semibold tracking-tight text-white">{title}</h2>
        <p className="max-w-3xl text-sm text-slate-400">{description}</p>
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  accent = "from-emerald-500/20 via-cyan-500/10 to-transparent",
  href,
}: {
  title: string;
  value: string;
  sub: string;
  icon: LucideIcon;
  accent?: string;
  href?: string;
}) {
  const content = (
    <>
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accent}`} />
      <div className="relative flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">{title}</div>
          <div className={`text-2xl font-semibold text-white ${sensitiveClass}`}>{value}</div>
          <div className="text-sm text-slate-400">{sub}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-emerald-200 transition group-hover:border-emerald-400/30 group-hover:text-emerald-100">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="group relative overflow-hidden rounded-[26px] border border-white/10 bg-slate-950/80 p-5 transition hover:border-emerald-400/30 hover:bg-slate-950"
      >
        {content}
      </Link>
    );
  }

  return <div className="relative overflow-hidden rounded-[26px] border border-white/10 bg-slate-950/80 p-5">{content}</div>;
}

function ChannelCard({
  title,
  sales,
  profit,
  volume,
  note,
  href,
}: {
  title: string;
  sales: number;
  profit: number;
  volume: string;
  note: string;
  href: string;
}) {
  return (
    <Link href={href} className={`${subtleCard} group block p-5 transition hover:border-emerald-400/40`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-white">{title}</div>
          <div className="mt-1 text-sm text-slate-400">{note}</div>
        </div>
        <ArrowRight className="mt-1 h-4 w-4 text-slate-500 transition group-hover:text-emerald-300" />
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Sales</div>
          <div className={`mt-1 text-xl font-semibold text-white ${sensitiveClass}`}>{formatCompactKES(sales)}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Profit</div>
          <div className={`mt-1 text-xl font-semibold ${scoreTone(profit)} ${sensitiveClass}`}>{formatCompactKES(profit)}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Volume</div>
          <div className={`mt-1 text-xl font-semibold text-white ${sensitiveClass}`}>{volume}</div>
        </div>
      </div>
    </Link>
  );
}

function ActionItem({
  title,
  value,
  note,
  href,
  icon: Icon,
  danger = false,
}: {
  title: string;
  value: string;
  note: string;
  href: string;
  icon: LucideIcon;
  danger?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group flex items-start gap-4 rounded-2xl border px-4 py-4 transition ${
        danger
          ? "border-amber-500/25 bg-amber-500/10 hover:border-amber-400/50"
          : "border-white/10 bg-white/[0.03] hover:border-emerald-400/40"
      }`}
    >
      <div className={`rounded-2xl p-3 ${danger ? "bg-amber-500/15 text-amber-200" : "bg-emerald-500/10 text-emerald-200"}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-white">{title}</div>
          <div className={`text-lg font-semibold text-white ${sensitiveClass}`}>{value}</div>
        </div>
        <div className="mt-1 text-sm text-slate-400">{note}</div>
      </div>
    </Link>
  );
}

function TrendCard({ points }: { points: TrendPoint[] }) {
  const maxValue = Math.max(...points.map((point) => point.total), 1);
  const summary = points.reduce(
    (acc, point) => {
      acc.pos += point.pos;
      acc.webOrders += point.webOrders;
      acc.agentOrders += point.agentOrders;
      acc.quotations += point.quotations;
      acc.marketplaceOrders += point.marketplaceOrders;
      return acc;
    },
    { pos: 0, webOrders: 0, agentOrders: 0, quotations: 0, marketplaceOrders: 0 },
  );

  return (
    <div className={`${subtleCard} p-5`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-lg font-semibold text-white">7-day sales movement</div>
          <div className="mt-1 text-sm text-slate-400">Combined recorded sales from POS, desk receipts, and marketplace channels.</div>
        </div>
        <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs uppercase tracking-[0.22em] text-slate-400">
          Last 7 days
        </div>
      </div>

      <div className="mt-6 grid grid-cols-7 gap-3">
        {points.map((point) => {
          const height = Math.max(14, Math.round((point.total / maxValue) * 180));
          return (
            <div key={point.key} className="flex flex-col items-center gap-3">
              <div className="flex h-52 w-full items-end justify-center rounded-3xl border border-white/10 bg-slate-950/70 px-2 py-3">
                <div className="w-full max-w-[52px] rounded-2xl bg-gradient-to-t from-emerald-500 via-cyan-400 to-sky-300" style={{ height }} />
              </div>
              <div className="text-center">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-500">{point.label}</div>
                <div className={`mt-1 text-sm font-semibold text-white ${sensitiveClass}`}>{formatCompactKES(point.total)}</div>
                <div className={`mt-1 text-[11px] text-slate-500 ${sensitiveClass}`}>
                  POS {formatCompactKES(point.pos)} · Desk {formatCompactKES(point.desk)} · Online {formatCompactKES(point.online)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">POS sales</div>
          <div className={`mt-1 text-lg font-semibold text-white ${sensitiveClass}`}>{formatCompactKES(summary.pos)}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Web orders</div>
          <div className="mt-1 text-lg font-semibold text-white">{summary.webOrders}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Agent orders</div>
          <div className="mt-1 text-lg font-semibold text-white">{summary.agentOrders}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Quotations</div>
          <div className="mt-1 text-lg font-semibold text-white">{summary.quotations}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Marketplace orders</div>
          <div className="mt-1 text-lg font-semibold text-white">{summary.marketplaceOrders}</div>
        </div>
      </div>
    </div>
  );
}

function CollapsibleSection({
  id,
  eyebrow,
  title,
  description,
  action,
  defaultOpen = false,
  children,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details id={id} open={defaultOpen} className={`${subtleCard} group p-4 md:p-5`}>
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 [&::-webkit-details-marker]:hidden">
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.34em] text-emerald-300/90">{eyebrow}</div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-semibold tracking-tight text-white">{title}</h2>
            <ChevronDown className="h-5 w-5 text-slate-500 transition group-open:rotate-180" />
          </div>
          <p className="max-w-3xl text-sm text-slate-400">{description}</p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </summary>
      <div className="mt-5 space-y-4">{children}</div>
    </details>
  );
}

function ControlCenterCard({
  title,
  count,
  amount,
  pending,
  href,
  note,
}: {
  title: string;
  count: number;
  amount?: number | null;
  pending?: number | null;
  href: string;
  note: string;
}) {
  return (
    <Link href={href} className={`${subtleCard} group block p-5 transition hover:border-emerald-400/40`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">{title}</div>
          <div className="mt-3 text-3xl font-semibold text-white">{count}</div>
          <div className="mt-2 text-sm text-slate-400">{note}</div>
        </div>
        <ArrowRight className="mt-1 h-4 w-4 text-slate-500 transition group-hover:text-emerald-300" />
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Sales amount</div>
          <div className={`mt-1 text-lg font-semibold text-white ${sensitiveClass}`}>{formatCompactKES(amount ?? 0)}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Pending</div>
          <div className="mt-1 text-lg font-semibold text-white">{pending ?? count}</div>
        </div>
      </div>
    </Link>
  );
}

function QueueRow({
  badge,
  title,
  note,
  amount,
  status,
  age,
  href,
  carriedForward = false,
}: {
  badge: string;
  title: string;
  note: string;
  amount?: number | null;
  status: string;
  age: string;
  href: string;
  carriedForward?: boolean;
}) {
  return (
    <Link
      href={href}
      className="grid gap-3 rounded-[22px] border border-white/10 bg-white/[0.03] p-4 transition hover:border-emerald-400/30 lg:grid-cols-[120px_minmax(0,1.4fr)_180px_140px_120px]"
    >
      <div className="flex items-center">
        <span className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100">
          {badge}
        </span>
      </div>
      <div>
        <div className="font-semibold text-white">{title}</div>
        <div className="mt-1 text-sm text-slate-400">{note}</div>
        {carriedForward ? (
          <div className="mt-2">
            <span className="inline-flex rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-100">
              Carried forward
            </span>
          </div>
        ) : null}
      </div>
      <div>
        <div className={`text-sm font-semibold text-white ${sensitiveClass}`}>{amount != null ? formatKES(amount) : "Action needed"}</div>
      </div>
      <div className="text-sm capitalize text-slate-300">{status}</div>
      <div className="text-sm text-slate-400">{age}</div>
    </Link>
  );
}

function safeDate(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function ageLabel(value: string | Date | null | undefined) {
  const date = safeDate(value);
  if (!date) return "-";
  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
  if (diffHours < 1) {
    return `${Math.max(0, Math.floor(diffMs / (1000 * 60)))} min ago`;
  }
  if (diffHours < 24) return `${diffHours} hr ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

function queueSort<T extends { createdAt?: string | Date | null; updatedAt?: string | Date | null; amount?: number | null }>(rows: T[]) {
  return rows.sort((left, right) => {
    const leftCreatedAt = safeDate(left.createdAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const rightCreatedAt = safeDate(right.createdAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    if (leftCreatedAt !== rightCreatedAt) return leftCreatedAt - rightCreatedAt;

    const amountDelta = Number(right.amount ?? 0) - Number(left.amount ?? 0);
    if (amountDelta !== 0) return amountDelta;

    const leftUpdatedAt = safeDate(left.updatedAt)?.getTime() ?? 0;
    const rightUpdatedAt = safeDate(right.updatedAt)?.getTime() ?? 0;
    return rightUpdatedAt - leftUpdatedAt;
  });
}

function isOpenVoiceFollowUpStatus(status: string | null | undefined) {
  const normalized = String(status || "").trim().toLowerCase();
  return !["resolved", "closed"].includes(normalized);
}

function ageToneClass(value: string | Date | null | undefined) {
  const date = safeDate(value);
  if (!date) return "border-white/10 bg-white/[0.03]";
  const diffHours = Math.max(0, Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60)));
  if (diffHours >= 72) return "border-rose-500/30 bg-rose-500/10";
  if (diffHours >= 24) return "border-amber-500/30 bg-amber-500/10";
  return "border-emerald-500/20 bg-emerald-500/5";
}

function ageToneLabel(value: string | Date | null | undefined) {
  const date = safeDate(value);
  if (!date) return "No timestamp";
  const diffHours = Math.max(0, Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60)));
  if (diffHours >= 72) return "Overdue";
  if (diffHours >= 24) return "Aging";
  return "Fresh";
}

type AdminQuoteRow = {
  id: string;
  quoteRef: string;
  customerName: string;
  customerPhone: string;
  customerLocation: string | null;
  status: string;
  quoteTitle: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type AdminPodItem = {
  id: string;
  customerName: string;
  customerPhone: string | null;
  total: number;
  status: string;
  createdAt: Date | null;
  updatedAt: Date | null;
};

async function safeLoad<T>(loader: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await loader();
  } catch (error) {
    console.warn("[admin.dashboard] optional block unavailable", error);
    return fallback;
  }
}

async function listAdminQuoteRequests() {
  await ensureQuoteRequestsSchema();
  return prisma.$queryRaw<AdminQuoteRow[]>(Prisma.sql`
    SELECT "id", "quoteRef", "customerName", "customerPhone", "customerLocation", "status", "quoteTitle", "createdAt", "updatedAt"
    FROM "QuoteRequest"
    WHERE COALESCE("source", 'WEBSITE_REQUEST') = 'WEBSITE_REQUEST'
    ORDER BY "updatedAt" DESC
    LIMIT 120
  `);
}

async function listAdminPodFollowUp() {
  const receipts = await prisma.receipt.findMany({
    where: { data: { path: ["podDelivery"], not: Prisma.JsonNull } },
    orderBy: { generatedAt: "desc" },
    take: 80,
    select: {
      id: true,
      generatedAt: true,
      createdAt: true,
      totals: true,
      data: true,
      order: {
        select: {
          customerName: true,
          customerPhone: true,
          totalAmount: true,
        },
      },
    },
  });

  const items: AdminPodItem[] = [];
  for (const receipt of receipts) {
    const data =
      receipt.data && typeof receipt.data === "object" && !Array.isArray(receipt.data)
        ? (receipt.data as Record<string, unknown>)
        : null;
    const podDelivery =
      data?.podDelivery && typeof data.podDelivery === "object" && !Array.isArray(data.podDelivery)
        ? (data.podDelivery as Record<string, unknown>)
        : null;
    const status = String(podDelivery?.status ?? "pending");
    if (!isPendingPodStatus(status)) continue;
    items.push({
      id: receipt.id,
      customerName: String(receipt.order?.customerName ?? data?.customerName ?? "POD customer"),
      customerPhone: receipt.order?.customerPhone ?? (typeof data?.customerPhone === "string" ? data.customerPhone : null),
      total:
        Number(
          ((receipt.totals as Record<string, unknown> | null)?.total ??
            receipt.order?.totalAmount ??
            (typeof data?.amount === "number" ? data.amount : 0)) as number,
        ) || 0,
      status,
      createdAt: receipt.generatedAt ?? receipt.createdAt,
      updatedAt:
        typeof podDelivery?.updatedAt === "string"
          ? new Date(podDelivery.updatedAt)
          : typeof podDelivery?.createdAt === "string"
            ? new Date(podDelivery.createdAt)
            : receipt.generatedAt ?? receipt.createdAt,
    });
  }

  return items;
}

function LinkGroupCard({ title, tone, items }: LinkGroup) {
  return (
    <div className={`${subtleCard} p-5`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">{tone}</div>
      <div className="mt-2 text-xl font-semibold text-white">{title}</div>
      <div className="mt-4 space-y-2">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 transition hover:border-emerald-400/40"
          >
            <div>
              <div className="font-medium text-white">{item.label}</div>
              <div className="text-sm text-slate-400">{item.meta}</div>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-500 transition group-hover:text-emerald-300" />
          </Link>
        ))}
      </div>
    </div>
  );
}

async function getDashboardData(range: DashboardRange) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const trendStart = startOfDay(subDays(range.end, 6));
  const periodBounds = { start: range.start, end: range.end };
  const payrollPeriod = {
    ...getTradingPeriodFor(range.end),
    start: range.start,
    end: range.end,
    label: range.label,
  };

  const [
    productsCount,
    shopsCount,
    activeStaffCount,
    returnsCount,
    lowStockCount,
    pendingJumiaOrders,
    pendingLeaveCount,
    pendingCashAdvanceCount,
    pendingAdjustmentRequestCount,
    pendingPosCommissionCandidates,
    posReceiptsPeriod,
    posReceiptsToday,
    posTrendReceipts,
    marketingReceiptsPeriod,
    marketingReceiptsToday,
    marketingTrendReceipts,
    supportReceiptsPeriod,
    supportReceiptsToday,
    supportTrendReceipts,
    marketplaceOrdersPeriod,
    marketplaceOrdersToday,
    marketplaceTrendOrders,
    payrollUsers,
    dailyReportsToday,
    websiteOrdersRecent,
    websiteOrdersToday,
    websiteOrdersPendingCount,
    websiteOrdersCompletedCount,
    quoteRows,
    podFollowUpRows,
    openAgentOrders,
    periodAgentOrders,
    lowStockItems,
    pendingPosOrdersRecent,
    recentPendingJumiaOrders,
    approvedAdvances,
    voiceCallsPeriod,
    voiceFollowUpsOpen,
    voiceCallbackRequestsPeriod,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.shop.count(),
    prisma.user.count({
      where: {
        AND: [buildStaffAttendantWhere(), { isActive: true }],
      },
    }),
    prisma.returnCase.count(),
    prisma.product
      .findMany({
        where: { isActive: true },
        select: { stockQuantity: true, minStockLevel: true },
      })
      .then((rows) => rows.filter((row) => Number(row.stockQuantity ?? 0) <= Number(row.minStockLevel ?? 0)).length),
    prisma.jumiaOrder.count({ where: { status: "PENDING" } }).catch(() => 0),
    prisma.leaveRequest.count({ where: { status: "PENDING" } }),
    prisma.cashAdvance.count({ where: { status: "PENDING" } }),
    (prisma as any).payrollAdjustmentRequest.count({ where: { status: "PENDING" } }),
    prisma.commissionEarning.findMany({
      where: { status: { in: ["PENDING", "PENDING_APPROVAL"] } },
      select: { id: true, basis: true, calcDetail: true },
    }),
    prisma.receipt.findMany({
      where: { generatedAt: { gte: range.start, lte: range.end } },
      select: {
        generatedAt: true,
        totals: true,
        data: true,
        order: { select: { totalAmount: true } },
      },
    }),
    prisma.receipt.findMany({
      where: { generatedAt: { gte: todayStart, lte: todayEnd } },
      select: {
        generatedAt: true,
        totals: true,
        data: true,
        order: { select: { totalAmount: true } },
      },
    }),
    prisma.receipt.findMany({
      where: { generatedAt: { gte: trendStart, lte: todayEnd } },
      select: {
        generatedAt: true,
        totals: true,
        data: true,
        order: { select: { totalAmount: true } },
      },
    }),
    prisma.marketingReceipt.findMany({
      where: { createdAt: { gte: range.start, lte: range.end } },
      select: { createdAt: true, sellingTotal: true, buyingTotal: true, paymentMethod: true },
    }),
    prisma.marketingReceipt.findMany({
      where: { createdAt: { gte: todayStart, lte: todayEnd } },
      select: { createdAt: true, sellingTotal: true, buyingTotal: true, paymentMethod: true },
    }),
    prisma.marketingReceipt.findMany({
      where: { createdAt: { gte: trendStart, lte: todayEnd } },
      select: { createdAt: true, sellingTotal: true, buyingTotal: true, paymentMethod: true },
    }),
    prisma.supportReceipt.findMany({
      where: { createdAt: { gte: range.start, lte: range.end } },
      select: { createdAt: true, sellingTotal: true, buyingTotal: true, paymentMethod: true },
    }),
    prisma.supportReceipt.findMany({
      where: { createdAt: { gte: todayStart, lte: todayEnd } },
      select: { createdAt: true, sellingTotal: true, buyingTotal: true, paymentMethod: true },
    }),
    prisma.supportReceipt.findMany({
      where: { createdAt: { gte: trendStart, lte: todayEnd } },
      select: { createdAt: true, sellingTotal: true, buyingTotal: true, paymentMethod: true },
    }),
    prisma.marketplaceOrder.findMany({
      where: { orderedAt: { gte: range.start, lte: range.end } },
      select: { orderedAt: true, platform: true, sellingPrice: true, profit: true, status: true },
    }),
    prisma.marketplaceOrder.findMany({
      where: { orderedAt: { gte: todayStart, lte: todayEnd } },
      select: { orderedAt: true, platform: true, sellingPrice: true, profit: true, status: true },
    }),
    prisma.marketplaceOrder.findMany({
      where: { orderedAt: { gte: trendStart, lte: todayEnd } },
      select: { orderedAt: true, platform: true, sellingPrice: true, profit: true, status: true },
    }),
    prisma.user.findMany({
      where: payrollEligibleUserWhere({ isActive: true }),
      orderBy: [{ attendantCategory: "asc" }, { name: "asc" }],
      select: { id: true, name: true, email: true, attendantCategory: true, isActive: true },
    }),
    prisma.dailyReport.count({
      where: {
        date: { gte: range.start, lte: range.end },
        user: { is: { AND: [buildStaffAttendantWhere(), { isActive: true }] } },
      },
    }),
    prisma.websiteOrder.findMany({
      orderBy: [{ updatedAt: "desc" }],
      take: 120,
      select: {
        id: true,
        orderRef: true,
        customerName: true,
        customerPhone: true,
        total: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.websiteOrder.count({
      where: { createdAt: { gte: todayStart, lte: todayEnd } },
    }),
    prisma.websiteOrder.count({
      where: { status: { in: ["PENDING", "CONFIRMED", "PROCESSING", "RECEIPT_ISSUED", "DISPATCHED", "PAYMENT_CONFIRMED"] } },
    }),
    prisma.websiteOrder.count({
      where: { status: "DELIVERED" },
    }),
    safeLoad(() => listAdminQuoteRequests(), [] as AdminQuoteRow[]),
    safeLoad(() => listAdminPodFollowUp(), [] as AdminPodItem[]),
    safeLoad(() => getAdminAgentSales({ statuses: [...AGENT_OPEN_STATUSES] }), [] as Awaited<ReturnType<typeof getAdminAgentSales>>),
    safeLoad(
      () =>
        getAdminAgentSales({
          start: format(range.start, "yyyy-MM-dd"),
          end: format(range.end, "yyyy-MM-dd"),
        }),
      [] as Awaited<ReturnType<typeof getAdminAgentSales>>,
    ),
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: [{ stockQuantity: "asc" }],
      take: 8,
      select: { id: true, name: true, stockQuantity: true, minStockLevel: true },
    }),
    prisma.order.findMany({
      where: { status: { in: ["PENDING", "PROCESSING"] } },
      orderBy: [{ updatedAt: "desc" }],
      take: 80,
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        customerPhone: true,
        totalAmount: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.jumiaOrder.findMany({
      where: { status: "PENDING" },
      orderBy: [{ updatedAtJumia: "desc" }, { updatedAt: "desc" }],
      take: 8,
      select: {
        id: true,
        number: true,
        status: true,
        pendingSince: true,
        totalAmountLocalCurrency: true,
        totalAmountLocalValue: true,
        updatedAtJumia: true,
        createdAtJumia: true,
        shopName: true,
      },
    }).catch(() => []),
    prisma.cashAdvance.findMany({
      where: { status: "APPROVED" },
      orderBy: [{ approvedAt: "desc" }],
      take: 12,
      include: {
        user: { select: { id: true, name: true, email: true } },
        installments: {
          orderBy: [{ dueDate: "asc" }],
          take: 6,
        },
      },
    }),
    prisma.voiceCall.findMany({
      where: { createdAt: { gte: range.start, lte: range.end } },
      orderBy: [{ createdAt: "desc" }],
      take: 160,
      select: {
        id: true,
        callerNumber: true,
        destinationNumber: true,
        createdAt: true,
        startedAt: true,
        durationInSeconds: true,
        status: true,
        routeType: true,
        routedTo: true,
        rawPayloadJson: true,
        assignedToId: true,
        customerId: true,
        assignedTo: {
          select: {
            name: true,
            email: true,
          },
        },
        customer: {
          select: {
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    }),
    prisma.voiceFollowUp.findMany({
      where: {
        status: { notIn: ["resolved", "closed"] },
        OR: [
          { createdAt: { gte: range.start, lte: range.end } },
          { updatedAt: { gte: range.start, lte: range.end } },
        ],
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 80,
      select: {
        id: true,
        voiceCallId: true,
        voiceLeadId: true,
        customerId: true,
        assignedToId: true,
        phone: true,
        title: true,
        status: true,
        dueAt: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        assignedTo: {
          select: {
            name: true,
            email: true,
          },
        },
        customer: {
          select: {
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    }),
    prisma.voiceCallbackRequest.findMany({
      where: {
        OR: [
          { createdAt: { gte: range.start, lte: range.end } },
          { requestedAt: { gte: range.start, lte: range.end } },
        ],
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 80,
      select: {
        id: true,
        voiceCallId: true,
        normalizedPhone: true,
        requestedAt: true,
        openedAt: true,
        openedCount: true,
        createdAt: true,
        updatedAt: true,
        agentId: true,
        agent: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    }),
  ]);

  const payrollRows = await Promise.all(
    payrollUsers.map(async (user) =>
      applyCanonicalPayrollOverrides(await buildPayrollRow(user, payrollPeriod), payrollPeriod),
    ),
  );
  const payrollTotals = payrollRows.reduce(
    (acc, row) => {
      acc.base += Number(row.baseSalary ?? 0) + Number(row.transportAllowance ?? 0);
      acc.commission += Number(row.commissionTotal ?? 0);
      acc.net += Number(row.netPay ?? 0);
      acc.deductions += Number(row.totalDeductions ?? 0);
      acc.sales += Number(row.totalSales ?? 0);
      return acc;
    },
    { base: 0, commission: 0, net: 0, deductions: 0, sales: 0 },
  );

  const topSalesRow = [...payrollRows].sort((left, right) => Number(right.totalSales ?? 0) - Number(left.totalSales ?? 0))[0] ?? null;
  const topCommissionRow = [...payrollRows].sort((left, right) => Number(right.commissionTotal ?? 0) - Number(left.commissionTotal ?? 0))[0] ?? null;
  const topNetRow = [...payrollRows].sort((left, right) => Number(right.netPay ?? 0) - Number(left.netPay ?? 0))[0] ?? null;

  const posPeriod = posReceiptsPeriod.reduce(
    (acc, receipt) => {
      const totals = getReceiptTotals(receipt);
      acc.sales += totals.selling;
      acc.buying += totals.buying;
      acc.profit += totals.profit;
      return acc;
    },
    { sales: 0, buying: 0, profit: 0 },
  );
  const posToday = posReceiptsToday.reduce((acc, receipt) => acc + getReceiptTotals(receipt).selling, 0);

  const marketingPeriod = marketingReceiptsPeriod.reduce(
    (acc, receipt) => {
      const totals = getDeskReceiptTotals(receipt);
      acc.sales += totals.selling;
      acc.profit += totals.profit;
      return acc;
    },
    { sales: 0, profit: 0 },
  );
  const marketingToday = marketingReceiptsToday.reduce((acc, receipt) => acc + getDeskReceiptTotals(receipt).selling, 0);

  const supportPeriod = supportReceiptsPeriod.reduce(
    (acc, receipt) => {
      const totals = getDeskReceiptTotals(receipt);
      acc.sales += totals.selling;
      acc.profit += totals.profit;
      return acc;
    },
    { sales: 0, profit: 0 },
  );
  const supportToday = supportReceiptsToday.reduce((acc, receipt) => acc + getDeskReceiptTotals(receipt).selling, 0);

  const marketplacePeriod = marketplaceOrdersPeriod.reduce(
    (acc, row) => {
      const sales = toNumber(row.sellingPrice);
      const profit = toNumber(row.profit);
      acc.totalSales += sales;
      acc.totalProfit += profit;
      if (String(row.platform).toUpperCase() === "JUMIA") {
        acc.jumiaSales += sales;
        acc.jumiaProfit += profit;
      }
      if (String(row.platform).toUpperCase() === "KILIMALL") {
        acc.kilimallSales += sales;
        acc.kilimallProfit += profit;
      }
      return acc;
    },
    { totalSales: 0, totalProfit: 0, jumiaSales: 0, jumiaProfit: 0, kilimallSales: 0, kilimallProfit: 0 },
  );
  const marketplaceToday = marketplaceOrdersToday.reduce((acc, row) => acc + toNumber(row.sellingPrice), 0);

  const combinedPeriodSales =
    posPeriod.sales +
    marketingPeriod.sales +
    supportPeriod.sales +
    marketplacePeriod.totalSales;
  const combinedPeriodProfit =
    posPeriod.profit +
    marketingPeriod.profit +
    supportPeriod.profit +
    marketplacePeriod.totalProfit;
  const todaySales =
    posToday +
    marketingToday +
    supportToday +
    marketplaceToday;

  const trendMap = new Map(buildTrendSeed(range.end).map((point) => [point.key, point]));
  for (const receipt of posTrendReceipts) {
    const key = dayKey(receipt.generatedAt);
    const point = trendMap.get(key);
    if (!point) continue;
    const totals = getReceiptTotals(receipt);
    point.pos += totals.selling;
    point.total += totals.selling;
  }
  for (const receipt of marketingTrendReceipts) {
    const key = dayKey(receipt.createdAt);
    const point = trendMap.get(key);
    if (!point) continue;
    const totals = getDeskReceiptTotals(receipt);
    point.desk += totals.selling;
    point.total += totals.selling;
  }
  for (const receipt of supportTrendReceipts) {
    const key = dayKey(receipt.createdAt);
    const point = trendMap.get(key);
    if (!point) continue;
    const totals = getDeskReceiptTotals(receipt);
    point.desk += totals.selling;
    point.total += totals.selling;
  }
  for (const row of marketplaceTrendOrders) {
    const key = dayKey(row.orderedAt);
    const point = trendMap.get(key);
    if (!point) continue;
    const sales = toNumber(row.sellingPrice);
    point.online += sales;
    point.total += sales;
    point.marketplaceOrders += 1;
  }

  const pendingWebsiteOrders = websiteOrdersRecent.filter((order) =>
    isPendingWebOrderStatus(order.status) &&
    shouldShowPendingWorkItem({
      status: order.status,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      periodStart: periodBounds.start,
      periodEnd: periodBounds.end,
    }),
  );
  const periodWebsiteOrders = pendingWebsiteOrders.filter((order) =>
    wasCreatedOrUpdatedInPeriod(order.createdAt, order.updatedAt, periodBounds),
  );
  const carriedWebsiteOrders = pendingWebsiteOrders.filter((order) =>
    isCarriedForwardPendingItem({
      status: order.status,
      createdAt: order.createdAt,
      periodStart: periodBounds.start,
    }) && !wasCreatedOrUpdatedInPeriod(order.createdAt, order.updatedAt, periodBounds),
  );
  const webOrderValue = periodWebsiteOrders.reduce((sum, order) => sum + toNumber(order.total), 0);
  const pendingWebOrderValue = pendingWebsiteOrders.reduce((sum, order) => sum + toNumber(order.total), 0);

  const pendingPosOrders = pendingPosOrdersRecent.filter((order) =>
    shouldShowPendingWorkItem({
      status: order.status,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      periodStart: periodBounds.start,
      periodEnd: periodBounds.end,
    }),
  );
  const periodPendingPosOrders = pendingPosOrders.filter((order) =>
    wasCreatedOrUpdatedInPeriod(order.createdAt, order.updatedAt, periodBounds),
  );
  const carriedPendingPosOrders = pendingPosOrders.filter((order) =>
    isCarriedForwardPendingItem({
      status: order.status,
      createdAt: order.createdAt,
      periodStart: periodBounds.start,
    }) && !wasCreatedOrUpdatedInPeriod(order.createdAt, order.updatedAt, periodBounds),
  );
  const pendingPosOrderValue = pendingPosOrders.reduce((sum, order) => sum + toNumber(order.totalAmount), 0);

  const openQuoteRows = quoteRows.filter((row) =>
    isOpenQuotationStatus(row.status) &&
    shouldShowPendingWorkItem({
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      periodStart: periodBounds.start,
      periodEnd: periodBounds.end,
    }),
  );
  const periodQuoteRows = openQuoteRows.filter((row) => wasCreatedOrUpdatedInPeriod(row.createdAt, row.updatedAt, periodBounds));
  const carriedQuoteRows = openQuoteRows.filter((row) =>
    isCarriedForwardPendingItem({
      status: row.status,
      createdAt: row.createdAt,
      periodStart: periodBounds.start,
    }) && !wasCreatedOrUpdatedInPeriod(row.createdAt, row.updatedAt, periodBounds),
  );
  const newQuoteRows = periodQuoteRows.filter((row) => String(row.status).toLowerCase() === "new");

  const pendingPodRows = podFollowUpRows.filter((row) =>
    isPendingPodStatus(row.status) &&
    shouldShowPendingWorkItem({
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      periodStart: periodBounds.start,
      periodEnd: periodBounds.end,
    }),
  );
  const periodPendingPodRows = pendingPodRows.filter((row) => wasCreatedOrUpdatedInPeriod(row.createdAt, row.updatedAt, periodBounds));
  const carriedPendingPodRows = pendingPodRows.filter((row) =>
    isCarriedForwardPendingItem({
      status: row.status,
      createdAt: row.createdAt,
      periodStart: periodBounds.start,
    }) && !wasCreatedOrUpdatedInPeriod(row.createdAt, row.updatedAt, periodBounds),
  );
  const pendingPodValue = pendingPodRows.reduce((sum, row) => sum + row.total, 0);

  const visibleOpenAgentOrders = openAgentOrders.filter((sale) =>
    isOpenWorkItemStatus(sale.status) &&
    shouldShowPendingWorkItem({
      status: sale.status,
      createdAt: sale.createdAt,
      updatedAt: sale.updatedAt,
      periodStart: periodBounds.start,
      periodEnd: periodBounds.end,
    }),
  );
  const periodOpenAgentOrders = visibleOpenAgentOrders.filter((sale) =>
    wasCreatedOrUpdatedInPeriod(sale.createdAt, sale.updatedAt, periodBounds),
  );
  const carriedOpenAgentOrders = visibleOpenAgentOrders.filter((sale) =>
    isCarriedForwardPendingItem({
      status: sale.status,
      createdAt: sale.createdAt,
      periodStart: periodBounds.start,
    }) && !wasCreatedOrUpdatedInPeriod(sale.createdAt, sale.updatedAt, periodBounds),
  );
  const periodAgentOrderValue = periodOpenAgentOrders.reduce((sum, sale) => sum + Number(sale.totalAmount ?? 0), 0);

  const agentPerformance = periodAgentOrders.reduce<
    Map<string, { agentName: string; orders: number; sales: number }>
  >((acc, sale) => {
    const key = sale.agentId;
    const current = acc.get(key) ?? { agentName: sale.agentName, orders: 0, sales: 0 };
    current.orders += 1;
    current.sales += Number(sale.totalAmount ?? 0);
    acc.set(key, current);
    return acc;
  }, new Map());
  const rankedAgents = Array.from(agentPerformance.values());
  const topAgentByOrders = rankedAgents.slice().sort((a, b) => b.orders - a.orders)[0] ?? null;
  const topAgentBySales = rankedAgents.slice().sort((a, b) => b.sales - a.sales)[0] ?? null;

  const recentAgentActivity = queueSort(
    visibleOpenAgentOrders.slice(0, 12).map((sale) => ({
      id: sale.id,
      agentName: sale.agentName,
      customerName: sale.customerName,
      amount: Number(sale.totalAmount ?? 0),
      status: sale.statusMeta.label,
      createdAt: sale.createdAt,
      updatedAt: sale.updatedAt,
      href: `/marketing/agent-orders?saleId=${encodeURIComponent(sale.id)}`,
      carriedForward: isCarriedForwardPendingItem({
        status: sale.status,
        createdAt: sale.createdAt,
        periodStart: periodBounds.start,
      }),
    })),
  ).slice(0, 6);

  const webRecentRows = queueSort(
    pendingWebsiteOrders.map((order) => ({
      id: order.id,
      customerName: order.customerName,
      phone: order.customerPhone,
      amount: toNumber(order.total),
      status: String(order.status).replace(/_/g, " ").toLowerCase(),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      href: `/marketing/receipts?tab=web-orders&orderId=${encodeURIComponent(order.id)}`,
      ref: order.orderRef,
      carriedForward: isCarriedForwardPendingItem({
        status: order.status,
        createdAt: order.createdAt,
        periodStart: periodBounds.start,
      }),
    })),
  ).slice(0, 6);

  for (const order of websiteOrdersRecent) {
    const key = dayKey(order.updatedAt);
    const point = trendMap.get(key);
    if (point && isPendingWebOrderStatus(order.status)) point.webOrders += 1;
  }
  for (const sale of periodAgentOrders) {
    const key = dayKey(sale.updatedAt);
    const point = trendMap.get(key);
    if (point) point.agentOrders += 1;
  }
  for (const quote of quoteRows) {
    const updatedAt = safeDate(quote.updatedAt);
    if (!updatedAt) continue;
    const key = dayKey(updatedAt);
    const point = trendMap.get(key);
    if (point && isOpenQuotationStatus(quote.status)) point.quotations += 1;
  }

  const unpricedSales = await getUnpricedDailySalesForRange({
    startDate: range.start,
    endDate: range.end,
  });
  const groupedUnpriced = groupMarketingUnpricedSales(unpricedSales);
  const pricingQueue = groupedUnpriced.reduce(
    (acc, sale) => {
      acc.receipts += 1;
      if (sale.source === "support") {
        acc.support += 1;
        acc.items += Number(sale.receiptItems?.length ?? sale.itemsPending ?? 0) || 1;
      } else {
        acc.items += Number(sale.receiptItems?.length ?? sale.groupedSaleIds?.length ?? sale.itemsPending ?? 0) || 1;
      }
      return acc;
    },
    { receipts: 0, items: 0, support: 0 },
  );

  const pendingPosCommissionCount = pendingPosCommissionCandidates.filter((item) => {
    const detail = item.calcDetail as Record<string, unknown> | null;
    return item.basis === "product_flat" || detail?.reason === "pos_product_commission";
  }).length;

  const recentPendingPosRows = queueSort(
    pendingPosOrders.map((order) => ({
      id: order.id,
      orderRef: order.orderNumber,
      customerName: order.customerName,
      phone: order.customerPhone,
      amount: toNumber(order.totalAmount),
      status: String(order.status).replace(/_/g, " ").toLowerCase(),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      href: `/admin/customers?q=${encodeURIComponent(order.orderNumber || order.customerName)}`,
      carriedForward: isCarriedForwardPendingItem({
        status: order.status,
        createdAt: order.createdAt,
        periodStart: periodBounds.start,
      }),
    })),
  ).slice(0, 6);

  const jumiaPendingRows = recentPendingJumiaOrders.map((order) => ({
    id: order.id,
    orderRef: order.number ? `Jumia #${order.number}` : order.id,
    shopName: order.shopName || "Jumia shop",
    amount: toNumber(order.totalAmountLocalValue),
    status: String(order.status || "PENDING").toLowerCase(),
    createdAt: order.createdAtJumia ?? null,
    updatedAt: order.updatedAtJumia ?? null,
    pendingSince: order.pendingSince,
  }));

  const outstandingAdvances = approvedAdvances
    .map((advance) => ({
      ...advance,
      remainingBalance: computeEffectiveCashAdvanceRemainingBalance(advance),
    }))
    .filter((advance) => Number(advance.remainingBalance ?? 0) > 0)
    .sort((left, right) => Number(right.remainingBalance ?? 0) - Number(left.remainingBalance ?? 0))
    .slice(0, 6);

  const voiceStatuses = voiceCallsPeriod.map((call) => {
    const outcome = resolveVoiceProviderOutcome(call);
    return {
      ...call,
      displayStatus: String(outcome.displayStatus || "").trim().toLowerCase(),
      providerStatus: String(outcome.providerStatus || "").trim().toLowerCase(),
    };
  });
  const answeredVoiceCalls = voiceStatuses.filter((call) =>
    ["answered", "connected", "transferred"].includes(call.displayStatus),
  );
  const missedVoiceCalls = voiceStatuses.filter((call) =>
    ["missed", "no_answer", "busy", "failed", "aborted", "cancelled", "disconnected"].includes(call.displayStatus),
  );
  const attemptedVoiceCalls = voiceStatuses.filter((call) => call.displayStatus === "attempted_call");
  const requestedCallbackCount = voiceCallbackRequestsPeriod.filter((request) => Boolean(request.requestedAt)).length;
  const recentlyOpenedCallbackCount = voiceCallbackRequestsPeriod.filter((request) => Boolean(request.openedAt)).length;
  const recentVoiceCalls = voiceStatuses.slice(0, 4).map((call) => {
    const normalizedPhone =
      normalizePhone(call.callerNumber || "") ||
      normalizePhone(call.customer?.phone || "") ||
      normalizePhone(call.destinationNumber || "");
    const customerName =
      String(call.customer?.name || "").trim() ||
      normalizedPhone ||
      "Voice caller";
    return {
      id: call.id,
      customerName,
      phone: normalizedPhone || call.callerNumber || "",
      status: call.displayStatus,
      agent:
        call.assignedTo?.name ||
        call.assignedTo?.email ||
        "Routing queue",
      at: call.startedAt ?? call.createdAt,
      href: `/admin/communications/voice?tab=recent&selectedCallId=${encodeURIComponent(call.id)}${normalizedPhone ? `&selectedPhone=${encodeURIComponent(normalizedPhone)}` : ""}`,
      customerHref: buildAdminCustomerProfileHref({
        customerUserId: call.customerId,
        phone: normalizedPhone,
        phones: [normalizedPhone, call.callerNumber, call.destinationNumber, call.customer?.phone],
        email: call.customer?.email,
        displayName: customerName,
      }),
    };
  });
  const recentVoiceFollowUps = voiceFollowUpsOpen.slice(0, 4).map((item) => {
    const normalizedPhone =
      normalizePhone(item.phone || "") ||
      normalizePhone(item.customer?.phone || "");
    const customerName =
      String(item.customer?.name || "").trim() ||
      normalizedPhone ||
      "Voice follow-up";
    return {
      id: item.id,
      customerName,
      phone: normalizedPhone || item.phone,
      title: item.title,
      status: String(item.status || "").replace(/_/g, " ").toLowerCase(),
      assignedTo: item.assignedTo?.name || item.assignedTo?.email || "Unassigned",
      at: item.updatedAt ?? item.createdAt,
      href: `/admin/communications/voice?tab=followups&selectedPhone=${encodeURIComponent(normalizedPhone || item.phone)}`,
      customerHref: buildAdminCustomerProfileHref({
        customerUserId: item.customerId,
        phone: normalizedPhone,
        phones: [normalizedPhone, item.phone, item.customer?.phone],
        email: item.customer?.email,
        displayName: customerName,
      }),
      overdueTone: ageToneClass(item.dueAt ?? item.updatedAt ?? item.createdAt),
      overdueLabel: ageToneLabel(item.dueAt ?? item.updatedAt ?? item.createdAt),
    };
  });

  const voiceWorkloadByAgent = new Map<
    string,
    {
      agentKey: string;
      agentName: string;
      answered: number;
      missed: number;
      attempted: number;
      openFollowUps: number;
      callbackRequests: number;
      lastAt: Date | null;
    }
  >();
  const ensureVoiceAgent = (agentKey: string, agentName: string) => {
    const existing = voiceWorkloadByAgent.get(agentKey);
    if (existing) return existing;
    const created = {
      agentKey,
      agentName,
      answered: 0,
      missed: 0,
      attempted: 0,
      openFollowUps: 0,
      callbackRequests: 0,
      lastAt: null as Date | null,
    };
    voiceWorkloadByAgent.set(agentKey, created);
    return created;
  };
  for (const call of voiceStatuses) {
    const agentName = call.assignedTo?.name || call.assignedTo?.email || "Routing queue";
    const agentKey = String(call.assignedToId || agentName);
    const bucket = ensureVoiceAgent(agentKey, agentName);
    if (["answered", "connected", "transferred"].includes(call.displayStatus)) bucket.answered += 1;
    if (["missed", "no_answer", "busy", "failed", "aborted", "cancelled", "disconnected"].includes(call.displayStatus)) bucket.missed += 1;
    if (call.displayStatus === "attempted_call") bucket.attempted += 1;
    const at = safeDate(call.startedAt ?? call.createdAt);
    if (at && (!bucket.lastAt || at.getTime() > bucket.lastAt.getTime())) bucket.lastAt = at;
  }
  for (const item of voiceFollowUpsOpen) {
    const agentName = item.assignedTo?.name || item.assignedTo?.email || "Unassigned";
    const agentKey = String(item.assignedToId || agentName);
    const bucket = ensureVoiceAgent(agentKey, agentName);
    bucket.openFollowUps += 1;
    const at = safeDate(item.updatedAt ?? item.createdAt);
    if (at && (!bucket.lastAt || at.getTime() > bucket.lastAt.getTime())) bucket.lastAt = at;
  }
  for (const request of voiceCallbackRequestsPeriod) {
    const agentName = request.agent?.name || request.agent?.email || "Unassigned";
    const agentKey = String(request.agentId || agentName);
    const bucket = ensureVoiceAgent(agentKey, agentName);
    if (request.requestedAt) bucket.callbackRequests += 1;
    const at = safeDate(request.requestedAt ?? request.updatedAt ?? request.createdAt);
    if (at && (!bucket.lastAt || at.getTime() > bucket.lastAt.getTime())) bucket.lastAt = at;
  }
  const voiceAgentWorkload = Array.from(voiceWorkloadByAgent.values())
    .sort((left, right) => {
      const rightWeight = right.openFollowUps * 5 + right.missed * 3 + right.callbackRequests * 2 + right.attempted;
      const leftWeight = left.openFollowUps * 5 + left.missed * 3 + left.callbackRequests * 2 + left.attempted;
      if (rightWeight !== leftWeight) return rightWeight - leftWeight;
      return (right.lastAt?.getTime() || 0) - (left.lastAt?.getTime() || 0);
    })
    .slice(0, 4);

  const customerHotspotMap = new Map<
    string,
    {
      key: string;
      displayName: string;
      phone: string;
      customerUserId: string | null;
      email: string | null;
      sources: Set<string>;
      openItems: number;
      lastAt: Date | null;
      lastVoiceStatus: string | null;
      sourceLinks: {
        voice: boolean;
        web: boolean;
        quote: boolean;
        pos: boolean;
        pod: boolean;
      };
    }
  >();
  const upsertCustomerHotspot = (input: {
    phone?: string | null;
    displayName?: string | null;
    customerUserId?: string | null;
    email?: string | null;
    source: string;
    at?: string | Date | null;
    lastVoiceStatus?: string | null;
  }) => {
    const normalizedPhone = normalizePhone(input.phone || "");
    if (!normalizedPhone) return;
    const key = String(input.customerUserId || "").trim() || normalizedPhone;
    const current = customerHotspotMap.get(key) ?? {
      key,
      displayName: String(input.displayName || "").trim() || normalizedPhone,
      phone: normalizedPhone,
      customerUserId: input.customerUserId ?? null,
      email: input.email ?? null,
      sources: new Set<string>(),
      openItems: 0,
      lastAt: null as Date | null,
      lastVoiceStatus: null as string | null,
      sourceLinks: {
        voice: false,
        web: false,
        quote: false,
        pos: false,
        pod: false,
      },
    };
    current.sources.add(input.source);
    current.openItems += 1;
    const nextAt = safeDate(input.at);
    if (nextAt && (!current.lastAt || nextAt.getTime() > current.lastAt.getTime())) {
      current.lastAt = nextAt;
    }
    if (input.lastVoiceStatus) current.lastVoiceStatus = input.lastVoiceStatus;
    if (!current.displayName || current.displayName === current.phone) {
      current.displayName = String(input.displayName || "").trim() || current.displayName;
    }
    if (!current.email && input.email) current.email = input.email;
    if (!current.customerUserId && input.customerUserId) current.customerUserId = input.customerUserId;
    if (input.source === "Voice") current.sourceLinks.voice = true;
    if (input.source === "Web order") current.sourceLinks.web = true;
    if (input.source === "Quotation") current.sourceLinks.quote = true;
    if (input.source === "POS order") current.sourceLinks.pos = true;
    if (input.source === "POD follow-up") current.sourceLinks.pod = true;
    customerHotspotMap.set(key, current);
  };

  for (const order of pendingWebsiteOrders) {
    upsertCustomerHotspot({
      phone: order.customerPhone,
      displayName: order.customerName,
      source: "Web order",
      at: order.updatedAt,
    });
  }
  for (const order of pendingPosOrders) {
    upsertCustomerHotspot({
      phone: order.customerPhone,
      displayName: order.customerName,
      source: "POS order",
      at: order.updatedAt,
    });
  }
  for (const quote of openQuoteRows) {
    upsertCustomerHotspot({
      phone: quote.customerPhone,
      displayName: quote.customerName,
      source: "Quotation",
      at: quote.updatedAt,
    });
  }
  for (const row of pendingPodRows) {
    upsertCustomerHotspot({
      phone: row.customerPhone,
      displayName: row.customerName,
      source: "POD follow-up",
      at: row.updatedAt ?? row.createdAt,
    });
  }
  for (const call of voiceStatuses) {
    upsertCustomerHotspot({
      phone: call.callerNumber,
      displayName: call.customer?.name || call.callerNumber,
      customerUserId: call.customerId,
      email: call.customer?.email,
      source: "Voice",
      at: call.startedAt ?? call.createdAt,
      lastVoiceStatus: call.displayStatus,
    });
  }
  const customerHotspots = Array.from(customerHotspotMap.values())
    .sort((left, right) => {
      if ((right.openItems || 0) !== (left.openItems || 0)) return right.openItems - left.openItems;
      return (right.lastAt?.getTime() || 0) - (left.lastAt?.getTime() || 0);
    })
    .slice(0, 4)
    .map((item) => ({
      ...item,
      href: buildAdminCustomerProfileHref({
        customerUserId: item.customerUserId,
        phone: item.phone,
        phones: [item.phone],
        email: item.email,
        displayName: item.displayName,
      }),
      sourceSummary: Array.from(item.sources).join(" · "),
      urgencyTone: ageToneClass(item.lastAt),
      urgencyLabel: ageToneLabel(item.lastAt),
      voiceHref: `/admin/communications/voice?tab=recent&selectedPhone=${encodeURIComponent(item.phone)}`,
      webHref: `/marketing/receipts?tab=web-orders&q=${encodeURIComponent(item.phone)}`,
      quoteHref: `/marketing/receipts?tab=quotations&q=${encodeURIComponent(item.phone)}`,
      posHref: `/admin/customers?q=${encodeURIComponent(item.phone)}`,
    }));

  return {
    range,
    periodLabel: range.label,
    periodStart: range.start,
    todaySales,
    combinedPeriodSales,
    combinedPeriodProfit,
    counts: {
      products: productsCount,
      shops: shopsCount,
      activeStaff: activeStaffCount,
      returns: returnsCount,
      lowStock: lowStockCount,
      pendingJumiaOrders,
      pendingLeave: pendingLeaveCount,
      pendingCashAdvance: pendingCashAdvanceCount,
      pendingAdjustments: pendingAdjustmentRequestCount,
      pendingPosCommission: pendingPosCommissionCount,
    },
    livePulse: {
      todaySales,
      currentPeriodSales: combinedPeriodSales,
      currentPeriodProfit: combinedPeriodProfit,
      posReceipts: posReceiptsPeriod.length + marketingReceiptsPeriod.length + supportReceiptsPeriod.length,
      posOrders: pendingPosOrders.length,
      webOrders: pendingWebsiteOrders.length,
      agentOrders: visibleOpenAgentOrders.length,
      quotations: openQuoteRows.length,
      podPending: pendingPodRows.length,
      jumiaPending: pendingJumiaOrders,
      lowStockItems: lowStockCount,
    },
    pos: {
      sales: posPeriod.sales,
      profit: posPeriod.profit,
      receipts: posReceiptsPeriod.length,
    },
    marketing: {
      sales: marketingPeriod.sales,
      profit: marketingPeriod.profit,
      receipts: marketingReceiptsPeriod.length,
    },
    support: {
      sales: supportPeriod.sales,
      profit: supportPeriod.profit,
      receipts: supportReceiptsPeriod.length,
    },
    marketplace: {
      sales: marketplacePeriod.totalSales,
      profit: marketplacePeriod.totalProfit,
      orders: marketplaceOrdersPeriod.length,
      jumiaSales: marketplacePeriod.jumiaSales,
      kilimallSales: marketplacePeriod.kilimallSales,
    },
    payroll: {
      base: payrollTotals.base,
      commission: payrollTotals.commission,
      net: payrollTotals.net,
      deductions: payrollTotals.deductions,
      staff: payrollRows.length,
      topSalesRow,
      topCommissionRow,
      topNetRow,
    },
    salesActivity: {
      pos: {
        count: posReceiptsPeriod.length,
        sales: posPeriod.sales,
        pending: pendingPosOrders.length + pendingPodRows.length,
      },
      web: {
        count: pendingWebsiteOrders.length,
        sales: webOrderValue,
        pending: pendingWebsiteOrders.length,
      },
      agent: {
        count: visibleOpenAgentOrders.length,
        sales: periodAgentOrderValue,
        pending: visibleOpenAgentOrders.length,
      },
      quotations: {
        count: openQuoteRows.length,
        sales: 0,
        pending: newQuoteRows.length,
      },
      pod: {
        count: pendingPodRows.length,
        sales: pendingPodValue,
        pending: pendingPodRows.length,
      },
      marketplace: {
        count: marketplaceOrdersPeriod.length,
        sales: marketplacePeriod.totalSales,
        pending: pendingJumiaOrders,
      },
    },
    agents: {
      activeAgents: rankedAgents.length,
      pendingOrders: visibleOpenAgentOrders.length,
      orderValue: periodAgentOrderValue,
      topByOrders: topAgentByOrders,
      topBySales: topAgentBySales,
      recentActivity: recentAgentActivity,
    },
    web: {
      newOrders: websiteOrdersToday,
      pendingOrders: pendingWebsiteOrders.length,
      completedOrders: websiteOrdersCompletedCount,
      orderValue: webOrderValue,
      pendingOrderValue: pendingWebOrderValue,
      recentOrders: webRecentRows,
      quoteRequests: openQuoteRows.slice(0, 4).map((quote) => ({
        ...quote,
        carriedForward: isCarriedForwardPendingItem({
          status: quote.status,
          createdAt: quote.createdAt,
          periodStart: periodBounds.start,
        }),
      })),
      posOrders: recentPendingPosRows,
    },
    staffSnapshot: {
      topSalesPerformer: topSalesRow,
      topCommissionPerformer: topCommissionRow,
      activeStaffToday: activeStaffCount,
      submittedDailyReports: dailyReportsToday,
      missingDailyReports: Math.max(0, activeStaffCount - dailyReportsToday),
      payrollDue: payrollTotals.net,
      staffRows: payrollRows
        .slice()
        .sort((left, right) => Number(right.totalSales ?? 0) - Number(left.totalSales ?? 0))
        .slice(0, 4),
    },
    lowStockItems,
    queues: {
      websiteOrders: pendingWebsiteOrders,
      quotations: openQuoteRows.map((quote) => ({
        ...quote,
        carriedForward: isCarriedForwardPendingItem({
          status: quote.status,
          createdAt: quote.createdAt,
          periodStart: periodBounds.start,
        }),
      })),
      pod: pendingPodRows,
    },
    pendingBreakdown: {
      pos: { current: periodPendingPosOrders.length, carried: carriedPendingPosOrders.length },
      web: { current: periodWebsiteOrders.length, carried: carriedWebsiteOrders.length },
      agent: { current: periodOpenAgentOrders.length, carried: carriedOpenAgentOrders.length },
      quotations: { current: periodQuoteRows.length, carried: carriedQuoteRows.length },
      pod: { current: periodPendingPodRows.length, carried: carriedPendingPodRows.length },
    },
    pricingQueue,
    pricingRows: groupedUnpriced.slice(0, 4),
    jumia: {
      pendingRows: jumiaPendingRows,
    },
    wellness: {
      pendingLeaveCount,
      pendingCashAdvanceCount,
      pendingAdjustmentRequestCount,
      outstandingAdvanceBalance: outstandingAdvances.reduce(
        (sum, advance) => sum + Number(advance.remainingBalance ?? 0),
        0,
      ),
      outstandingAdvances,
    },
    voice: {
      totalCalls: voiceStatuses.length,
      answeredCalls: answeredVoiceCalls.length,
      missedCalls: missedVoiceCalls.length,
      attemptedCalls: attemptedVoiceCalls.length,
      openFollowUps: voiceFollowUpsOpen.length,
      callbackRequests: voiceCallbackRequestsPeriod.length,
      requestedCallbacks: requestedCallbackCount,
      openedCallbackLinks: recentlyOpenedCallbackCount,
      recentCalls: recentVoiceCalls,
      recentFollowUps: recentVoiceFollowUps,
      agentWorkload: voiceAgentWorkload,
    },
    customers: {
      hotspots: customerHotspots,
    },
    trends: Array.from(trendMap.values()),
  };
}

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams?: Promise<{ range?: string; from?: string; to?: string; customerSource?: string }>;
}) {
  const params = (await searchParams) || {};
  const range = resolveDashboardRange(params);
  const dashboard = await getDashboardData(range);
  const customerSourceFilter = String(params.customerSource || "all").trim().toLowerCase();

  const buildRangeHref = (preset: DashboardRangePreset) => {
    const next = new URLSearchParams();
    next.set("range", preset);
    if (customerSourceFilter !== "all") next.set("customerSource", customerSourceFilter);
    if (preset === "custom") {
      next.set("from", range.fromValue);
      next.set("to", range.toValue);
    }
    return `/admin${next.toString() ? `?${next.toString()}` : ""}`;
  };

  const buildDashboardHref = (overrides: Partial<{ customerSource: string; range: string; from: string; to: string }>) => {
    const next = new URLSearchParams();
    next.set("range", overrides.range ?? range.preset);
    if ((overrides.customerSource ?? customerSourceFilter) !== "all") {
      next.set("customerSource", overrides.customerSource ?? customerSourceFilter);
    }
    const effectiveRange = overrides.range ?? range.preset;
    if (effectiveRange === "custom") {
      next.set("from", overrides.from ?? range.fromValue);
      next.set("to", overrides.to ?? range.toValue);
    }
    return `/admin${next.toString() ? `?${next.toString()}` : ""}`;
  };

  const withDashboardRange = (href: string, options?: { includeCustomerSource?: boolean }) => {
    if (!href.startsWith("/")) return href;
    const [hrefWithoutHash, hash = ""] = href.split("#");
    const [pathname, rawQuery = ""] = hrefWithoutHash.split("?");
    const next = new URLSearchParams(rawQuery);
    if (!next.has("range")) next.set("range", range.preset);
    if (!next.has("from")) next.set("from", range.fromValue);
    if (!next.has("to")) next.set("to", range.toValue);
    if (options?.includeCustomerSource && customerSourceFilter !== "all" && !next.has("customerSource")) {
      next.set("customerSource", customerSourceFilter);
    }
    return `${pathname}${next.toString() ? `?${next.toString()}` : ""}${hash ? `#${hash}` : ""}`;
  };

  const filteredCustomerHotspots = dashboard.customers.hotspots.filter((item) => {
    if (customerSourceFilter === "all") return true;
    if (customerSourceFilter === "voice") return item.sources.has("Voice");
    if (customerSourceFilter === "web") return item.sources.has("Web order");
    if (customerSourceFilter === "quotation") return item.sources.has("Quotation");
    if (customerSourceFilter === "pos") return item.sources.has("POS order");
    if (customerSourceFilter === "pod") return item.sources.has("POD follow-up");
    return true;
  });

  const quickLinks: LinkGroup[] = [
    {
      title: "Core operations",
      tone: "Run the floor",
      items: [
        { href: withDashboardRange("/admin/orders"), label: "Orders", meta: "Dispatch, pack, payment, and order status flow" },
        { href: withDashboardRange("/admin/receipts"), label: "Receipts", meta: "POS receipts, PDFs, downloads, and direct-sale history" },
        { href: withDashboardRange("/admin/communications/voice"), label: "Voice calls", meta: "Live incoming calls, agent availability, and missed-call follow-up" },
        { href: withDashboardRange("/admin/pending-pricing"), label: "Pending pricing", meta: "Clear missing buying prices and unblock profits" },
        { href: withDashboardRange("/admin/returns"), label: "Returns", meta: "Pickup, receive, approve, and resolve return cases" },
      ],
    },
    {
      title: "Sales and growth",
      tone: "Grow revenue",
      items: [
        { href: withDashboardRange("/admin/marketing-report"), label: "Marketing report", meta: "Daily desk sales, profitability, and manual pricing queue" },
        { href: withDashboardRange("/admin/online/summary"), label: "Online summary", meta: "Marketplace performance, accounts, and divided views" },
        { href: withDashboardRange("/admin/online/performance"), label: "Online performance", meta: "Capture week profit and monitor channel outcomes" },
        { href: withDashboardRange("/admin/support-report"), label: "Support report", meta: "Support desk sales, receipts, and battery work" },
      ],
    },
    {
      title: "People and payroll",
      tone: "Run the team",
      items: [
        { href: withDashboardRange("/admin/attendants"), label: "Attendants", meta: "Edit staff, comp plans, payroll pages, and profiles" },
        { href: withDashboardRange("/admin/payroll"), label: "Payroll", meta: "Current trading-period pay, deductions, and payouts" },
        { href: withDashboardRange("/admin/wellness"), label: "Wellness", meta: "Leave, cash advances, and deduction follow-up" },
        { href: withDashboardRange("/admin/users"), label: "Users", meta: "User accounts, roles, passwords, and access control" },
      ],
    },
    {
      title: "Inventory and control",
      tone: "Keep systems clean",
      items: [
        { href: withDashboardRange("/admin/pos-management"), label: "POS management", meta: "Catalogue, commissions, warranties, and product cleanup" },
        { href: withDashboardRange("/admin/shops"), label: "Shops", meta: "Branches, assignments, credentials, and ownership" },
        { href: withDashboardRange("/admin/settings"), label: "Settings", meta: "System controls, API credentials, and config" },
        { href: withDashboardRange("/admin/health-checks"), label: "Health checks", meta: "Service health, database readiness, and diagnostics" },
      ],
    },
  ];

  return (
    <div className="space-y-8">
      <AutoRefresh intervalMs={60_000} />

      <section className={`${shellCard} overflow-hidden p-6 md:p-8`}>
        <div className="absolute" />
        <div className="grid gap-8 xl:grid-cols-[1.4fr_0.9fr]">
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              <a href="#overview" className={sectionPill}>Overview</a>
              <a href="#action-queue" className={sectionPill}>Action Queue</a>
              <a href="#voice" className={sectionPill}>Voice</a>
              <a href="#orders" className={sectionPill}>Orders</a>
              <a href="#customers" className={sectionPill}>Customers</a>
              <a href="#marketplace" className={sectionPill}>Jumia</a>
              <a href="#wellness" className={sectionPill}>Wellness</a>
              <a href="#people" className={sectionPill}>People</a>
              <a href="#resources" className={sectionPill}>Resources</a>
            </div>

            <div className="space-y-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.34em] text-emerald-300">Business Control Center</div>
              <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-white md:text-5xl">
                One control center for live business activity, staff performance, money flow, and urgent work.
              </h1>
              <p className="max-w-3xl text-base text-slate-400">
                Watch POS, web orders, agent activity, quotations, POD follow-up, marketplace movement, and payroll from one screen. The layout is grouped so management can scan live work and jump into the right operating page quickly.
              </p>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
              <div className="flex flex-wrap items-center gap-2">
                {([
                  ["today", "Today"],
                  ["yesterday", "Yesterday"],
                  ["trading_period", "Trading period"],
                ] as const).map(([preset, label]) => (
                  <Link
                    key={preset}
                    href={buildRangeHref(preset)}
                    className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition ${
                      range.preset === preset
                        ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-100"
                        : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20"
                    }`}
                  >
                    {label}
                  </Link>
                ))}
                <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100">
                  {dashboard.range.shortLabel}
                </span>
              </div>
              <form className="mt-3 flex flex-wrap items-end gap-3" action="/admin" method="get">
                <input type="hidden" name="range" value="custom" />
                {customerSourceFilter !== "all" ? <input type="hidden" name="customerSource" value={customerSourceFilter} /> : null}
                <label className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  From
                  <input
                    type="date"
                    name="from"
                    defaultValue={dashboard.range.fromValue}
                    className="mt-2 block rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none"
                  />
                </label>
                <label className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  To
                  <input
                    type="date"
                    name="to"
                    defaultValue={dashboard.range.toValue}
                    className="mt-2 block rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none"
                  />
                </label>
                <button
                  type="submit"
                  className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-emerald-400/40 hover:text-emerald-100"
                >
                  Apply range
                </button>
              </form>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-[24px] border border-emerald-500/20 bg-emerald-500/10 p-5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-200">Active range</div>
                <div className="mt-2 text-2xl font-semibold text-white">{dashboard.periodLabel}</div>
                <div className="mt-2 text-sm text-emerald-100/80">{dashboard.range.description}</div>
              </div>
              <div className="rounded-[24px] border border-cyan-500/20 bg-cyan-500/10 p-5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200">Selected-range sales</div>
                <div className={`mt-2 text-2xl font-semibold text-white ${sensitiveClass}`}>{formatKES(dashboard.combinedPeriodSales)}</div>
                <div className="mt-2 text-sm text-cyan-100/80">Across POS, support, marketing desk, website, and marketplace channels.</div>
              </div>
              <div className="rounded-[24px] border border-fuchsia-500/20 bg-fuchsia-500/10 p-5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-fuchsia-200">Net payroll due</div>
                <div className={`mt-2 text-2xl font-semibold text-white ${sensitiveClass}`}>{formatKES(dashboard.payroll.net)}</div>
                <div className="mt-2 text-sm text-fuchsia-100/80">Current period pay after deductions, commission, and top-ups.</div>
              </div>
            </div>
          </div>

          <div className={`${subtleCard} p-6`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Control pulse</div>
                <div className="mt-2 text-2xl font-semibold text-white">What needs action now</div>
              </div>
              <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs uppercase tracking-[0.22em] text-slate-400">
                live
              </div>
            </div>
            <div className="mt-5 space-y-3">
              <ActionItem
                title="Manual pricing queue"
                value={`${dashboard.pricingQueue.receipts}`}
                note={`${dashboard.pricingQueue.items} items still need buying price attention.`}
                href={withDashboardRange("/admin/marketing-report")}
                icon={CircleAlert}
                danger={dashboard.pricingQueue.receipts > 0}
              />
              <ActionItem
                title="POS commission approvals"
                value={`${dashboard.counts.pendingPosCommission}`}
                note="Release or reject staff commission requests from POS catalogue sales."
                href={withDashboardRange("/admin/pos-management")}
                icon={BadgeDollarSign}
                danger={dashboard.counts.pendingPosCommission > 0}
              />
              <ActionItem
                title="Wellness approvals"
                value={`${dashboard.counts.pendingLeave + dashboard.counts.pendingCashAdvance}`}
                note={`${dashboard.counts.pendingLeave} leave requests and ${dashboard.counts.pendingCashAdvance} cash advances pending.`}
                href={withDashboardRange("/admin/wellness")}
                icon={HeartHandshake}
                danger={dashboard.counts.pendingLeave + dashboard.counts.pendingCashAdvance > 0}
              />
              <ActionItem
                title="Low stock risk"
                value={`${dashboard.counts.lowStock}`}
                note="Products at or below minimum stock level need attention."
                href={withDashboardRange("/admin/pos-management")}
                icon={Package}
                danger={dashboard.counts.lowStock > 0}
              />
            </div>
          </div>
        </div>
      </section>

      <section id="overview" className="space-y-4">
        <SectionHeader
          eyebrow="Live business pulse"
          title="Selected range, live queues, and pending workload"
          description="This strip is the first management scan for the chosen range: what sold, what is still pending, and where operations pressure is building."
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5 2xl:grid-cols-10">
          <StatCard title="Today sales" value={formatKES(dashboard.livePulse.todaySales)} sub="Separate same-day pulse for quick comparison" icon={Wallet} href={withDashboardRange("/admin/receipts")} />
          <StatCard title="Selected range sales" value={formatKES(dashboard.livePulse.currentPeriodSales)} sub={dashboard.periodLabel} icon={TrendingUp} accent="from-cyan-500/20 via-emerald-500/10 to-transparent" href={withDashboardRange("/admin/receipts")} />
          <StatCard title="Selected range profit" value={formatKES(dashboard.livePulse.currentPeriodProfit)} sub="Recorded margin across major channels" icon={ChartColumnBig} accent="from-sky-500/20 via-cyan-500/10 to-transparent" href={withDashboardRange("/admin/marketing-report")} />
          <StatCard title="POS receipts" value={`${dashboard.livePulse.posReceipts}`} sub="POS, marketing, and support receipts" icon={Receipt} accent="from-indigo-500/20 via-cyan-500/10 to-transparent" href={withDashboardRange("/admin/receipts")} />
          <StatCard title="POS orders" value={`${dashboard.livePulse.posOrders}`} sub={`Current ${dashboard.pendingBreakdown.pos.current} · Carried ${dashboard.pendingBreakdown.pos.carried}`} icon={Package} accent="from-violet-500/20 via-slate-500/10 to-transparent" href={withDashboardRange("/marketing/receipts?tab=pos")} />
          <StatCard title="Web orders" value={`${dashboard.livePulse.webOrders}`} sub={`Current period ${dashboard.pendingBreakdown.web.current} · Carried forward ${dashboard.pendingBreakdown.web.carried}`} icon={ShoppingBag} accent="from-emerald-500/20 via-teal-500/10 to-transparent" href={withDashboardRange("/marketing/receipts?tab=web-orders")} />
          <StatCard title="Agent orders" value={`${dashboard.livePulse.agentOrders}`} sub={`Current period ${dashboard.pendingBreakdown.agent.current} · Carried forward ${dashboard.pendingBreakdown.agent.carried}`} icon={Users} accent="from-violet-500/20 via-fuchsia-500/10 to-transparent" href={withDashboardRange("/marketing/agent-orders")} />
          <StatCard title="Quotations" value={`${dashboard.livePulse.quotations}`} sub={`Current period ${dashboard.pendingBreakdown.quotations.current} · Carried forward ${dashboard.pendingBreakdown.quotations.carried}`} icon={ClipboardCheck} accent="from-cyan-500/20 via-sky-500/10 to-transparent" href={withDashboardRange("/marketing/receipts?tab=quotations")} />
          <StatCard title="POD pending" value={`${dashboard.livePulse.podPending}`} sub={`Current period ${dashboard.pendingBreakdown.pod.current} · Carried forward ${dashboard.pendingBreakdown.pod.carried}`} icon={Truck} accent="from-amber-500/20 via-orange-500/10 to-transparent" href={withDashboardRange("/marketing/receipts?tab=pos&podStatus=pending")} />
          <StatCard title="Jumia pending" value={`${dashboard.livePulse.jumiaPending}`} sub="Marketplace pending order backlog" icon={Store} accent="from-amber-500/20 via-yellow-500/10 to-transparent" href={withDashboardRange("/admin/orders")} />
          <StatCard title="Low stock items" value={`${dashboard.livePulse.lowStockItems}`} sub="Items at or below minimum stock" icon={Boxes} accent="from-rose-500/20 via-orange-500/10 to-transparent" href={withDashboardRange("/admin/pos-management")} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={withDashboardRange("/admin/receipts")} className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 transition hover:border-emerald-400/30 hover:text-emerald-200">POS receipts</Link>
          <Link href={withDashboardRange("/marketing/receipts?tab=pos")} className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 transition hover:border-emerald-400/30 hover:text-emerald-200">POS orders</Link>
          <Link href={withDashboardRange("/admin/communications/voice?tab=recent")} className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 transition hover:border-emerald-400/30 hover:text-emerald-200">Voice history</Link>
          <Link href={withDashboardRange("/admin/communications/voice?tab=followups")} className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 transition hover:border-emerald-400/30 hover:text-emerald-200">Voice follow-ups</Link>
        </div>
      </section>

      <section id="voice" className="space-y-4">
        <SectionHeader
          eyebrow="Voice command"
          title="Calls, callback demand, and follow-up pressure"
          description="This lane keeps call-center pressure visible from the admin homepage: answered, missed, attempted, callback link requests, and live follow-up ownership."
          action={
            <Link
              href={withDashboardRange("/admin/communications/voice")}
              className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 transition hover:border-emerald-400/30 hover:text-emerald-200"
            >
              Open voice desk
            </Link>
          }
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-7">
          <StatCard title="Voice calls" value={`${dashboard.voice.totalCalls}`} sub={`In ${dashboard.range.shortLabel.toLowerCase()}`} icon={PhoneCall} accent="from-cyan-500/20 via-sky-500/10 to-transparent" href={withDashboardRange("/admin/communications/voice?tab=recent")} />
          <StatCard title="Answered" value={`${dashboard.voice.answeredCalls}`} sub="Bridged or completed answered calls" icon={ClipboardCheck} accent="from-emerald-500/20 via-teal-500/10 to-transparent" href={withDashboardRange("/admin/communications/voice?tab=recent")} />
          <StatCard title="Missed" value={`${dashboard.voice.missedCalls}`} sub="Missed or no-answer sessions" icon={TriangleAlert} accent="from-rose-500/20 via-orange-500/10 to-transparent" href={withDashboardRange("/admin/communications/voice?tab=followups&queue=missed")} />
          <StatCard title="Attempted" value={`${dashboard.voice.attemptedCalls}`} sub="Calls that did not reach bridged talk stage" icon={RefreshCcw} accent="from-amber-500/20 via-yellow-500/10 to-transparent" href={withDashboardRange("/admin/communications/voice?tab=recent")} />
          <StatCard title="Open follow-ups" value={`${dashboard.voice.openFollowUps}`} sub="Voice tasks still unresolved" icon={CircleAlert} accent="from-violet-500/20 via-fuchsia-500/10 to-transparent" href={withDashboardRange("/admin/communications/voice?tab=followups")} />
          <StatCard title="Callback requests" value={`${dashboard.voice.requestedCallbacks}`} sub={`${dashboard.voice.openedCallbackLinks} customers opened the callback link`} icon={HeartHandshake} accent="from-emerald-500/20 via-lime-500/10 to-transparent" href={withDashboardRange("/admin/communications/voice?tab=followups")} />
          <StatCard title="Voice leads" value={`${dashboard.voice.callbackRequests}`} sub="Attempted-call sessions and callback records" icon={Users} accent="from-indigo-500/20 via-cyan-500/10 to-transparent" href={withDashboardRange("/admin/communications/voice?tab=followups")} />
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <div className={`${subtleCard} p-5`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-white">Recent call outcomes</div>
                <div className="mt-1 text-sm text-slate-400">Fast jump into the exact call review or customer profile.</div>
              </div>
              <Link href={withDashboardRange("/admin/communications/voice?tab=recent")} className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 transition hover:border-emerald-400/30 hover:text-emerald-200">Open history</Link>
            </div>
            <div className="mt-4 grid gap-3">
              {dashboard.voice.recentCalls.length ? dashboard.voice.recentCalls.map((call) => (
                <div key={call.id} className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Link href={call.customerHref} className="font-semibold text-white transition hover:text-emerald-200">{call.customerName}</Link>
                      <div className="mt-1 text-sm text-slate-400">{call.phone || "No phone captured"} · {call.agent}</div>
                    </div>
                    <span className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100">
                      {call.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span>{format(call.at, "dd MMM, HH:mm")}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link href={call.href} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-100 transition hover:border-white/20">Open call</Link>
                    <Link href={call.customerHref} className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100 transition hover:border-emerald-400">Open customer</Link>
                  </div>
                </div>
              )) : (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">No voice calls recorded for this range.</div>
              )}
            </div>
          </div>
          <div className={`${subtleCard} p-5`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-white">Open voice follow-ups</div>
                <div className="mt-1 text-sm text-slate-400">Shows the ownership trail for callbacks and unresolved voice work.</div>
              </div>
              <Link href={withDashboardRange("/admin/communications/voice?tab=followups")} className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 transition hover:border-emerald-400/30 hover:text-emerald-200">Open follow-ups</Link>
            </div>
            <div className="mt-4 grid gap-3">
              {dashboard.voice.recentFollowUps.length ? dashboard.voice.recentFollowUps.map((item) => (
                <div key={item.id} className={`rounded-[22px] border p-4 ${item.overdueTone}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Link href={item.customerHref} className="font-semibold text-white transition hover:text-emerald-200">{item.customerName}</Link>
                      <div className="mt-1 text-sm text-slate-400">{item.phone || "No phone captured"} · {item.assignedTo}</div>
                    </div>
                    <span className="inline-flex rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-100">
                      {item.status}
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-slate-300">{item.title}</div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span>{format(item.at, "dd MMM, HH:mm")}</span>
                    <span>{item.overdueLabel}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link href={item.href} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-100 transition hover:border-white/20">Open queue</Link>
                    <Link href={item.customerHref} className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100 transition hover:border-emerald-400">Open customer</Link>
                  </div>
                </div>
              )) : (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">No open voice follow-ups in this range.</div>
              )}
            </div>
          </div>
        </div>
        <div className={`${subtleCard} p-5`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-white">Per-agent voice workload</div>
              <div className="mt-1 text-sm text-slate-400">Shows who is carrying missed calls, attempted-call callbacks, and unresolved voice follow-up pressure.</div>
            </div>
            <Link href={withDashboardRange("/admin/communications/voice?tab=agents")} className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 transition hover:border-emerald-400/30 hover:text-emerald-200">Open agents</Link>
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-4">
            {dashboard.voice.agentWorkload.length ? dashboard.voice.agentWorkload.map((agent) => (
              <div key={agent.agentKey} className={`rounded-[22px] border p-4 ${ageToneClass(agent.lastAt)}`}>
                <div className="text-lg font-semibold text-white">{agent.agentName}</div>
                <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">{agent.lastAt ? `${ageToneLabel(agent.lastAt)} · ${format(agent.lastAt, "dd MMM, HH:mm")}` : "No recent activity"}</div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Answered</div>
                    <div className="mt-1 text-lg font-semibold text-white">{agent.answered}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Missed</div>
                    <div className="mt-1 text-lg font-semibold text-white">{agent.missed}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Attempted</div>
                    <div className="mt-1 text-lg font-semibold text-white">{agent.attempted}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Open follow-ups</div>
                    <div className="mt-1 text-lg font-semibold text-white">{agent.openFollowUps}</div>
                  </div>
                </div>
                <div className="mt-3 text-sm text-slate-400">{agent.callbackRequests} customer callback requests currently tied to this owner.</div>
              </div>
            )) : (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400 xl:col-span-4">No voice agent workload recorded for this range.</div>
            )}
          </div>
        </div>
      </section>

      <section id="action-queue" className="space-y-4">
        <SectionHeader
          eyebrow="Unified queue"
          title="Urgent action queue"
          description="Closed, delivered, cancelled, settled, and completed work is excluded. This is the live queue that still needs attention."
        />
        <div className="grid gap-3">
          {queueSort([
            ...dashboard.web.posOrders.map((order) => ({
              id: `pos-${order.id}`,
              badge: "POS ORDER",
              title: `${order.customerName} · ${order.orderRef}`,
              note: order.phone || "No phone captured",
              amount: order.amount,
              status: order.status,
              createdAt: order.createdAt,
              updatedAt: order.updatedAt,
              href: order.href,
              carriedForward: Boolean((order as { carriedForward?: boolean }).carriedForward),
            })),
            ...dashboard.queues.websiteOrders.map((order) => ({
              id: `web-${order.id}`,
              badge: "WEB ORDER",
              title: `${order.customerName} · ${order.orderRef}`,
              note: order.customerPhone || "No phone captured",
              amount: toNumber(order.total),
              status: String(order.status).replace(/_/g, " ").toLowerCase(),
              createdAt: order.createdAt,
              updatedAt: order.updatedAt,
              href: `/marketing/receipts?tab=web-orders&orderId=${encodeURIComponent(order.id)}`,
              carriedForward: isCarriedForwardPendingItem({
                status: order.status,
                createdAt: order.createdAt,
                periodStart: dashboard.periodStart,
              }),
            })),
            ...dashboard.agents.recentActivity.map((row) => ({
              id: `agent-${row.id}`,
              badge: "AGENT ORDER",
              title: `${row.agentName} · ${row.customerName}`,
              note: "Pending customer order",
              amount: row.amount,
              status: row.status,
              createdAt: row.createdAt,
              updatedAt: row.updatedAt,
              href: row.href,
            })),
            ...dashboard.queues.quotations.map((quote) => ({
              id: `quote-${quote.id}`,
              badge: "QUOTATION",
              title: `${quote.customerName} · ${quote.quoteRef}`,
              note: quote.customerPhone || "No phone captured",
              amount: null,
              status: String(quote.status).replace(/_/g, " ").toLowerCase(),
              createdAt: quote.createdAt,
              updatedAt: quote.updatedAt,
              href: `/marketing/receipts?tab=quotations&quoteId=${encodeURIComponent(quote.id)}`,
              carriedForward: Boolean((quote as { carriedForward?: boolean }).carriedForward),
            })),
            ...dashboard.queues.pod.map((row) => ({
              id: `pod-${row.id}`,
              badge: "POD",
              title: row.customerName,
              note: row.customerPhone || "No phone captured",
              amount: row.total,
              status: row.status.replace(/_/g, " ").toLowerCase(),
              createdAt: row.createdAt,
              updatedAt: row.updatedAt,
              href: `/marketing/receipts?tab=pos&podStatus=pending&receiptId=${encodeURIComponent(row.id)}`,
              carriedForward: isCarriedForwardPendingItem({
                status: row.status,
                createdAt: row.createdAt,
                periodStart: dashboard.periodStart,
              }),
            })),
            {
              id: "pricing-queue",
              badge: "PRICING",
              title: "Missing pricing queue",
              note: `${dashboard.pricingQueue.items} items still need buying prices`,
              amount: null,
              status: `${dashboard.pricingQueue.receipts} receipts`,
              createdAt: null,
              updatedAt: null,
              href: "/admin/pending-pricing",
            },
            {
              id: "low-stock",
              badge: "STOCK",
              title: "Low stock risk",
              note: dashboard.lowStockItems.slice(0, 3).map((item) => item.name).join(" · ") || "Inventory threshold alert",
              amount: null,
              status: `${dashboard.counts.lowStock} items`,
              createdAt: null,
              updatedAt: null,
              href: "/admin/pos-management",
            },
            {
              id: "returns",
              badge: "RETURNS",
              title: "Returns waiting resolution",
              note: "Open return cases that still need handling",
              amount: null,
              status: `${dashboard.counts.returns} open`,
              createdAt: null,
              updatedAt: null,
              href: "/admin/returns",
            },
            {
              id: "jumia-pending",
              badge: "JUMIA",
              title: "Jumia pending orders",
              note: "Marketplace queue still pending in vendor sync tables",
              amount: null,
              status: `${dashboard.counts.pendingJumiaOrders} pending`,
              createdAt: null,
              updatedAt: null,
              href: "/admin/online/summary",
            },
          ]).slice(0, 10).map((item) => (
            <QueueRow
              key={item.id}
              badge={item.badge}
              title={item.title}
              note={item.note}
              amount={item.amount}
              status={item.status}
              age={ageLabel(item.createdAt)}
              href={item.href}
              carriedForward={Boolean((item as { carriedForward?: boolean }).carriedForward)}
            />
          ))}
        </div>
      </section>

      <section id="orders" className="space-y-4">
        <SectionHeader
          eyebrow="Sales activity center"
          title="Channel control boards"
          description="Each revenue lane shows its live volume, value, pending pressure, and direct entry point into the operating page."
        />
        <div className="grid gap-4 xl:grid-cols-3">
          <ControlCenterCard title="POS / Direct Sales" count={dashboard.salesActivity.pos.count} amount={dashboard.salesActivity.pos.sales} pending={dashboard.salesActivity.pos.pending} href={withDashboardRange("/admin/receipts")} note={`Receipts plus ${dashboard.livePulse.posOrders} open POS orders / POD actions.`} />
          <ControlCenterCard title="Web Orders" count={dashboard.salesActivity.web.count} amount={dashboard.salesActivity.web.sales} pending={dashboard.salesActivity.web.pending} href={withDashboardRange("/marketing/receipts?tab=web-orders")} note={`Current period ${dashboard.pendingBreakdown.web.current} · Carried forward ${dashboard.pendingBreakdown.web.carried}`} />
          <ControlCenterCard title="Agent Orders" count={dashboard.salesActivity.agent.count} amount={dashboard.salesActivity.agent.sales} pending={dashboard.salesActivity.agent.pending} href={withDashboardRange("/marketing/agent-orders")} note={`Current period ${dashboard.pendingBreakdown.agent.current} · Carried forward ${dashboard.pendingBreakdown.agent.carried}`} />
          <ControlCenterCard title="Quotations" count={dashboard.salesActivity.quotations.count} amount={dashboard.salesActivity.quotations.sales} pending={dashboard.salesActivity.quotations.pending} href={withDashboardRange("/marketing/receipts?tab=quotations")} note={`Current period ${dashboard.pendingBreakdown.quotations.current} · Carried forward ${dashboard.pendingBreakdown.quotations.carried}`} />
          <ControlCenterCard title="POD Follow-up" count={dashboard.salesActivity.pod.count} amount={dashboard.salesActivity.pod.sales} pending={dashboard.salesActivity.pod.pending} href={withDashboardRange("/marketing/receipts?tab=pos&podStatus=pending")} note={`Current period ${dashboard.pendingBreakdown.pod.current} · Carried forward ${dashboard.pendingBreakdown.pod.carried}`} />
          <ControlCenterCard title="Marketplace Orders" count={dashboard.salesActivity.marketplace.count} amount={dashboard.salesActivity.marketplace.sales} pending={dashboard.salesActivity.marketplace.pending} href={withDashboardRange("/admin/online/summary")} note="Jumia and Kilimall order movement." />
        </div>
      </section>

      <CollapsibleSection
        id="customers"
        defaultOpen={false}
        eyebrow="Customer hotspots"
        title="Customers currently driving work across the company"
        description="This block ties voice, web, POS, quotes, and POD follow-up back to the same canonical customer profile so admin can understand the customer before taking action."
        action={
          <Link
            href="/admin/customers"
            className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 transition hover:border-emerald-400/30 hover:text-emerald-200"
          >
            Open customer desk
          </Link>
        }
      >
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="xl:col-span-2 flex flex-wrap gap-2">
            {([
              ["all", "All hotspots"],
              ["voice", "Voice"],
              ["web", "Web orders"],
              ["quotation", "Quotations"],
              ["pos", "POS"],
              ["pod", "POD"],
            ] as const).map(([key, label]) => (
              <Link
                key={key}
                href={buildDashboardHref({ customerSource: key })}
                className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${
                  customerSourceFilter === key
                    ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-100"
                    : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20"
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
          {filteredCustomerHotspots.length ? filteredCustomerHotspots.map((customer) => (
            <div
              key={customer.key}
              className={`${subtleCard} p-5`}
            >
              <div className={`rounded-[22px] border p-4 ${customer.urgencyTone}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xl font-semibold text-white">{customer.displayName}</div>
                  <div className="mt-1 text-sm text-slate-400">{customer.phone}</div>
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                  {customer.openItems} open
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Active sources</div>
                  <div className="mt-1 text-sm font-semibold text-white">{customer.sourceSummary}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Last seen</div>
                  <div className="mt-1 text-sm font-semibold text-white">{customer.lastAt ? format(customer.lastAt, "dd MMM, HH:mm") : "—"}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Last voice outcome</div>
                  <div className="mt-1 text-sm font-semibold text-white">{customer.lastVoiceStatus ? customer.lastVoiceStatus.replace(/_/g, " ") : "No voice log"}</div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>{customer.urgencyLabel}</span>
                <span>{customer.lastAt ? ageLabel(customer.lastAt) : "No activity age"}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={customer.href} className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100 transition hover:border-emerald-400">Customer</Link>
                {customer.sourceLinks.voice ? <Link href={customer.voiceHref} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-100 transition hover:border-white/20">Voice</Link> : null}
                {customer.sourceLinks.web ? <Link href={customer.webHref} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-100 transition hover:border-white/20">Web</Link> : null}
                {customer.sourceLinks.quote ? <Link href={customer.quoteHref} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-100 transition hover:border-white/20">Quotes</Link> : null}
                {(customer.sourceLinks.pos || customer.sourceLinks.pod) ? <Link href={customer.posHref} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-100 transition hover:border-white/20">POS</Link> : null}
              </div>
              </div>
            </div>
          )) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400 xl:col-span-2">No customer hotspots detected for this filter and range.</div>
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        defaultOpen={false}
        eyebrow="Agent and web activity"
        title="Affiliate, agent, and website movement"
        description="These support lanes stay available on the homepage, but they stay collapsed until admin needs to inspect agent order pressure or live website flow."
      >
      <section className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-4">
          <SectionHeader
            eyebrow="Agent activity"
            title="Affiliate and agent movement"
            description="Track active agents, pending order value, top performers, and the most recent agent activity without leaving the home page."
          />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Active agents" value={`${dashboard.agents.activeAgents}`} sub="Agents with period activity" icon={Users} accent="from-cyan-500/20 via-slate-500/10 to-transparent" />
            <StatCard title="Pending agent orders" value={`${dashboard.agents.pendingOrders}`} sub="Open agent order workload" icon={ShoppingBag} accent="from-violet-500/20 via-fuchsia-500/10 to-transparent" />
            <StatCard title="Agent order value" value={formatKES(dashboard.agents.orderValue)} sub="Current open order amount" icon={BadgeDollarSign} accent="from-emerald-500/20 via-lime-500/10 to-transparent" />
            <StatCard title="Top agent by sales" value={dashboard.agents.topBySales?.agentName || "No data"} sub={dashboard.agents.topBySales ? formatKES(dashboard.agents.topBySales.sales) : "Waiting for period activity"} icon={UserRound} accent="from-amber-500/20 via-orange-500/10 to-transparent" />
          </div>
          <div className={`${subtleCard} p-5`}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Top agent by orders</div>
                <div className="mt-2 text-xl font-semibold text-white">{dashboard.agents.topByOrders?.agentName || "No data"}</div>
                <div className="mt-1 text-sm text-slate-400">{dashboard.agents.topByOrders ? `${dashboard.agents.topByOrders.orders} orders this period` : "Waiting for period activity."}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Recent agent activity</div>
                <div className="mt-2 text-xl font-semibold text-white">{dashboard.agents.recentActivity.length}</div>
                <div className="mt-1 text-sm text-slate-400">Latest open agent-order movements in the current period.</div>
              </div>
            </div>
            <div className="mt-4 grid gap-3">
              {dashboard.agents.recentActivity.length ? dashboard.agents.recentActivity.map((row) => (
                <QueueRow
                  key={row.id}
                  badge="AGENT"
                  title={`${row.agentName} · ${row.customerName}`}
                  note="Customer / order activity"
                  amount={row.amount}
                  status={row.status}
                  age={ageLabel(row.updatedAt)}
                  href={row.href}
                  carriedForward={Boolean((row as { carriedForward?: boolean }).carriedForward)}
                />
              )) : (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">No recent open agent activity right now.</div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <SectionHeader
            eyebrow="Web activity"
            title="Website orders and quote requests"
            description="Monitor website order flow, pending order value, and website-origin quotations from one panel."
          />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="New web orders" value={`${dashboard.web.newOrders}`} sub="Created today" icon={ShoppingBag} accent="from-cyan-500/20 via-sky-500/10 to-transparent" />
            <StatCard title="Pending web orders" value={`${dashboard.web.pendingOrders}`} sub={`Current period ${dashboard.pendingBreakdown.web.current} · Carried forward ${dashboard.pendingBreakdown.web.carried}`} icon={CircleAlert} accent="from-emerald-500/20 via-teal-500/10 to-transparent" />
            <StatCard title="Completed web orders" value={`${dashboard.web.completedOrders}`} sub="Delivered web orders in view" icon={ClipboardCheck} accent="from-indigo-500/20 via-cyan-500/10 to-transparent" />
            <StatCard title="Web order value" value={formatKES(dashboard.web.orderValue)} sub={`Pending value ${formatCompactKES(dashboard.web.pendingOrderValue)}`} icon={Wallet} accent="from-amber-500/20 via-orange-500/10 to-transparent" />
          </div>
          <div className={`${subtleCard} p-5`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-white">Recent web customers and orders</div>
                <div className="mt-1 text-sm text-slate-400">Most recent website orders plus website quote activity for the active statistics period.</div>
              </div>
              <Link href="/marketing/receipts?tab=web-orders" className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 transition hover:border-emerald-400/30 hover:text-emerald-200">Open web orders</Link>
            </div>
            <div className="mt-4 grid gap-3">
              {dashboard.web.recentOrders.map((row) => (
                <QueueRow
                  key={row.id}
                  badge="WEB"
                  title={`${row.customerName} · ${row.ref}`}
                  note={row.phone || "No phone captured"}
                  amount={row.amount}
                  status={row.status}
                  age={ageLabel(row.updatedAt)}
                  href={row.href}
                  carriedForward={Boolean((row as { carriedForward?: boolean }).carriedForward)}
                />
              ))}
              {dashboard.web.quoteRequests.map((quote) => (
                <QueueRow
                  key={quote.id}
                  badge="QUOTE"
                  title={`${quote.customerName} · ${quote.quoteRef}`}
                  note={quote.customerLocation || quote.customerPhone}
                  amount={null}
                  status={String(quote.status).replace(/_/g, " ").toLowerCase()}
                  age={ageLabel(quote.updatedAt)}
                  href={`/marketing/receipts?tab=quotations&quoteId=${encodeURIComponent(quote.id)}`}
                  carriedForward={Boolean((quote as { carriedForward?: boolean }).carriedForward)}
                />
              ))}
              {!dashboard.web.recentOrders.length && !dashboard.web.quoteRequests.length ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">No open website order or quotation activity right now.</div>
              ) : null}
            </div>
          </div>
        </div>
      </section>
      </CollapsibleSection>

      <CollapsibleSection
        id="marketplace"
        defaultOpen={false}
        eyebrow="Marketplace and wellness"
        title="Marketplace pressure, Jumia backlog, and staff welfare risk"
        description="Marketplace work and wellness risk are still on the dashboard, but they stay folded until admin needs to inspect vendor backlog or people-side approvals."
      >
      <section className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-4">
          <SectionHeader
            eyebrow="Marketplace watch"
            title="Jumia and marketplace pressure"
            description="Keep Jumia visible as its own operating lane so pending vendor work, account backlog, and current-period revenue are never buried under other sales channels."
          />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Jumia sales" value={formatKES(dashboard.marketplace.jumiaSales)} sub="Selected range Jumia revenue" icon={Store} accent="from-amber-500/20 via-orange-500/10 to-transparent" />
            <StatCard title="Kilimall sales" value={formatKES(dashboard.marketplace.kilimallSales)} sub="Selected range Kilimall revenue" icon={Store} accent="from-yellow-500/20 via-amber-500/10 to-transparent" />
            <StatCard title="Marketplace orders" value={`${dashboard.salesActivity.marketplace.count}`} sub="Selected range synced marketplace orders" icon={ShoppingBag} accent="from-cyan-500/20 via-sky-500/10 to-transparent" />
            <StatCard title="Jumia pending" value={`${dashboard.counts.pendingJumiaOrders}`} sub="Live vendor queue still unresolved" icon={CircleAlert} accent="from-rose-500/20 via-orange-500/10 to-transparent" />
          </div>
          <div className={`${subtleCard} p-5`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-white">Recent Jumia pending orders</div>
                <div className="mt-1 text-sm text-slate-400">Most recent vendor-side pending orders so admin can see where marketplace activity is stalling.</div>
              </div>
              <Link href="/admin/orders" className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 transition hover:border-emerald-400/30 hover:text-emerald-200">Open orders</Link>
            </div>
            <div className="mt-4 grid gap-3">
              {dashboard.jumia.pendingRows.length ? dashboard.jumia.pendingRows.map((row) => (
                <QueueRow
                  key={row.id}
                  badge="JUMIA"
                  title={`${row.orderRef} · ${row.shopName}`}
                  note={row.pendingSince ? `Pending since ${row.pendingSince}` : "Awaiting vendor progression"}
                  amount={row.amount}
                  status={row.status}
                  age={ageLabel(row.updatedAt || row.createdAt)}
                  href={`/admin/orders?q=${encodeURIComponent(row.orderRef)}`}
                />
              )) : (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">No recent Jumia pending orders were returned from the local sync tables.</div>
              )}
            </div>
          </div>
        </div>

        <div id="wellness" className="space-y-4">
          <SectionHeader
            eyebrow="Wellness and payroll risk"
            title="Leave, cash advance, and HR action board"
            description="Operational health is part of the company view. These cards keep pending people actions, outstanding advances, and payroll-side requests visible to admin."
          />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Leave approvals" value={`${dashboard.wellness.pendingLeaveCount}`} sub="Pending leave requests" icon={HeartHandshake} accent="from-emerald-500/20 via-teal-500/10 to-transparent" />
            <StatCard title="Cash advances" value={`${dashboard.wellness.pendingCashAdvanceCount}`} sub="New cash advance approvals pending" icon={Wallet} accent="from-fuchsia-500/20 via-violet-500/10 to-transparent" />
            <StatCard title="Payroll adjustments" value={`${dashboard.wellness.pendingAdjustmentRequestCount}`} sub="Pending deduction / adjustment reviews" icon={TriangleAlert} accent="from-amber-500/20 via-orange-500/10 to-transparent" />
            <StatCard title="Outstanding advances" value={formatKES(dashboard.wellness.outstandingAdvanceBalance)} sub="Approved balances still unrecovered" icon={Briefcase} accent="from-rose-500/20 via-orange-500/10 to-transparent" />
          </div>
          <div className={`${subtleCard} p-5`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-white">Outstanding cash advances</div>
                <div className="mt-1 text-sm text-slate-400">Largest approved balances still sitting on the books.</div>
              </div>
              <Link href="/admin/wellness" className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 transition hover:border-emerald-400/30 hover:text-emerald-200">Open wellness</Link>
            </div>
            <div className="mt-4 grid gap-3">
              {dashboard.wellness.outstandingAdvances.length ? dashboard.wellness.outstandingAdvances.map((advance) => (
                <QueueRow
                  key={advance.id}
                  badge="ADVANCE"
                  title={advance.user?.name || advance.user?.email || "Staff member"}
                  note={advance.reason || "Cash advance still outstanding"}
                  amount={advance.remainingBalance}
                  status="outstanding"
                  age={ageLabel(advance.approvedAt || advance.createdAt)}
                  href="/admin/wellness"
                />
              )) : (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">No outstanding approved cash advances right now.</div>
              )}
            </div>
          </div>
        </div>
      </section>
      </CollapsibleSection>

      <CollapsibleSection
        id="pricing"
        defaultOpen={false}
        eyebrow="Pricing and staff output"
        title="Unpriced receipts, POS risk, and staff scoreboard"
        description="Pricing backlog and staff output stay one click away without stretching the homepage vertically by default."
      >
      <section className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-4">
          <SectionHeader
            eyebrow="Pricing control"
            title="Unpriced receipts and POS risk"
            description="This block is for receipts that still lack buying prices or cost completion. It protects margin, staff commissions, and reporting accuracy."
          />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Unpriced receipts" value={`${dashboard.pricingQueue.receipts}`} sub="Grouped receipts still blocked by missing cost" icon={RefreshCcw} accent="from-amber-500/20 via-orange-500/10 to-transparent" />
            <StatCard title="Items pending cost" value={`${dashboard.pricingQueue.items}`} sub="Individual line items still not costed" icon={Boxes} accent="from-rose-500/20 via-orange-500/10 to-transparent" />
            <StatCard title="Support queue" value={`${dashboard.pricingQueue.support}`} sub="Support receipts waiting for buying price" icon={ShieldCheck} accent="from-cyan-500/20 via-sky-500/10 to-transparent" />
            <StatCard title="Low stock items" value={`${dashboard.counts.lowStock}`} sub="Products at or below the minimum level" icon={Package} accent="from-violet-500/20 via-fuchsia-500/10 to-transparent" />
          </div>
          <div className={`${subtleCard} p-5`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-white">Unpriced receipt queue</div>
                <div className="mt-1 text-sm text-slate-400">Selected-range pricing backlog grouped by receipt so admin can clear the queue faster.</div>
              </div>
              <Link href="/admin/marketing-report" className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 transition hover:border-emerald-400/30 hover:text-emerald-200">Open pricing desk</Link>
            </div>
            <div className="mt-4 grid gap-3">
              {dashboard.pricingRows.length ? dashboard.pricingRows.map((row) => (
                <QueueRow
                  key={row.id}
                  badge={row.source === "support" ? "SUPPORT" : "POS"}
                  title={row.productName}
                  note={`${row.attendantName} · ${row.receiptNumber || "No receipt number"}`}
                  amount={row.sellingPrice}
                  status={`${row.itemsPending || 1} item${Number(row.itemsPending || 1) === 1 ? "" : "s"} pending`}
                  age={ageLabel(row.saleDate)}
                  href="/admin/marketing-report"
                />
              )) : (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">No unpriced receipts found for the selected range.</div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <SectionHeader
            eyebrow="Staff scoreboard"
            title="Sales, commission, and salary leaders"
            description="A compact people table so admin can compare staff output, commission exposure, and projected net pay without opening payroll first."
          />
          <div className={`${subtleCard} overflow-hidden`}>
            <div className="grid grid-cols-[minmax(0,1.2fr)_120px_140px_140px] gap-3 border-b border-white/10 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              <div>Staff</div>
              <div>Sales</div>
              <div>Commission</div>
              <div>Net Pay</div>
            </div>
            {dashboard.staffSnapshot.staffRows.length ? dashboard.staffSnapshot.staffRows.map((row) => (
              <Link
                key={row.attendantId}
                href={`/admin/attendants/${encodeURIComponent(row.attendantId)}/payroll`}
                className="grid grid-cols-[minmax(0,1.2fr)_120px_140px_140px] gap-3 border-b border-white/10 px-5 py-4 text-sm transition hover:bg-white/[0.03] last:border-b-0"
              >
                <div className="min-w-0">
                  <div className="truncate font-semibold text-white">{row.name || row.email || "Staff member"}</div>
                  <div className="truncate text-xs text-slate-500">{row.attendantCategory || "Staff"}</div>
                </div>
                <div className={`text-slate-200 ${sensitiveClass}`}>{formatCompactKES(Number(row.totalSales ?? 0))}</div>
                <div className={`text-slate-200 ${sensitiveClass}`}>{formatCompactKES(Number(row.commissionTotal ?? 0))}</div>
                <div className={`text-slate-200 ${sensitiveClass}`}>{formatCompactKES(Number(row.netPay ?? 0))}</div>
              </Link>
            )) : (
              <div className="px-5 py-6 text-sm text-slate-400">No payroll-linked staff data found for the selected range.</div>
            )}
          </div>

          <div className={`${subtleCard} p-5`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-white">Open POS orders</div>
                <div className="mt-1 text-sm text-slate-400">Pending and processing local POS orders that still need action or conversion into completed receipts.</div>
              </div>
              <Link href="/admin/customers" className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 transition hover:border-emerald-400/30 hover:text-emerald-200">Open customer desk</Link>
            </div>
            <div className="mt-4 grid gap-3">
              {dashboard.web.posOrders.length ? dashboard.web.posOrders.map((row) => (
                <QueueRow
                  key={row.id}
                  badge="POS ORDER"
                  title={`${row.customerName} · ${row.orderRef}`}
                  note={row.phone || "No phone captured"}
                  amount={row.amount}
                  status={row.status}
                  age={ageLabel(row.updatedAt)}
                  href={row.href}
                  carriedForward={Boolean((row as { carriedForward?: boolean }).carriedForward)}
                />
              )) : (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">No open POS orders match the selected range.</div>
              )}
            </div>
          </div>
        </div>
      </section>
      </CollapsibleSection>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <SectionHeader
            eyebrow="Trend watch"
            title="Sales movement and operating pressure"
            description="A compact view of the last 7 days plus the highest-risk operational items that still need action."
          />
          <div className={`${subtleCard} grid gap-4 p-5 sm:grid-cols-2`}>
            <ActionItem
              title="Pending pricing"
              value={`${dashboard.pricingQueue.receipts}`}
              note={`${dashboard.pricingQueue.items} items still need buying prices before the books are clean.`}
              href="/admin/marketing-report"
              icon={RefreshCcw}
              danger={dashboard.pricingQueue.receipts > 0}
            />
            <ActionItem
              title="Returns queue"
              value={`${dashboard.counts.returns}`}
              note="Open return cases still visible in the returns workspace."
              href="/admin/returns"
              icon={Truck}
              danger={dashboard.counts.returns > 0}
            />
            <ActionItem
              title="Jumia pending orders"
              value={`${dashboard.counts.pendingJumiaOrders}`}
              note="Live pending order backlog from the Jumia sync tables."
              href="/admin/orders"
              icon={ShoppingBag}
              danger={dashboard.counts.pendingJumiaOrders > 0}
            />
            <ActionItem
              title="Low stock products"
              value={`${dashboard.counts.lowStock}`}
              note="Items already at or below the minimum stock threshold."
              href="/admin/pos-management"
              icon={Boxes}
              danger={dashboard.counts.lowStock > 0}
            />
          </div>
        </div>

        <TrendCard points={dashboard.trends} />
      </section>

      <CollapsibleSection
        id="people"
        defaultOpen={false}
        eyebrow="People and payroll"
        title="Staff cost, payouts, and performance"
        description="Put salaries, commissions, deductions, and staff leaders in one lane so admin can connect sales movement to real payroll impact."
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <StatCard title="Top sales performer" value={dashboard.staffSnapshot.topSalesPerformer?.name || "No data"} sub={dashboard.staffSnapshot.topSalesPerformer ? formatKES(Number(dashboard.staffSnapshot.topSalesPerformer.totalSales ?? 0)) : "Waiting for linked sales"} icon={TrendingUp} accent="from-cyan-500/20 via-sky-500/10 to-transparent" />
          <StatCard title="Top commission" value={dashboard.staffSnapshot.topCommissionPerformer?.name || "No data"} sub={dashboard.staffSnapshot.topCommissionPerformer ? formatKES(Number(dashboard.staffSnapshot.topCommissionPerformer.commissionTotal ?? 0)) : "Waiting for commission summary"} icon={BadgeDollarSign} accent="from-emerald-500/20 via-lime-500/10 to-transparent" />
          <StatCard title="Active staff" value={`${dashboard.staffSnapshot.activeStaffToday}`} sub="Filtered to real attendants/staff only" icon={Users} accent="from-fuchsia-500/20 via-violet-500/10 to-transparent" />
          <StatCard title="Submitted daily reports" value={`${dashboard.staffSnapshot.submittedDailyReports}`} sub={`Reports received in ${dashboard.range.shortLabel.toLowerCase()}`} icon={ClipboardCheck} accent="from-emerald-500/20 via-teal-500/10 to-transparent" />
          <StatCard title="Missing daily reports" value={`${dashboard.staffSnapshot.missingDailyReports}`} sub="Expected active staff still missing a report" icon={TriangleAlert} accent="from-amber-500/20 via-orange-500/10 to-transparent" />
          <StatCard title="Payroll due" value={formatKES(dashboard.staffSnapshot.payrollDue)} sub="Current net payroll exposure" icon={Briefcase} accent="from-indigo-500/20 via-sky-500/10 to-transparent" />
        </div>

        <div className="grid gap-4 lg:grid-cols-4">
          <StatCard title="Base salary + transport" value={formatKES(dashboard.payroll.base)} sub="Fixed cost for the active payroll sheet" icon={Briefcase} accent="from-indigo-500/20 via-sky-500/10 to-transparent" />
          <StatCard title="Commissions" value={formatKES(dashboard.payroll.commission)} sub="Direct, marketplace, and POS product commission totals" icon={BadgeDollarSign} accent="from-emerald-500/20 via-teal-500/10 to-transparent" />
          <StatCard title="Deductions" value={formatKES(dashboard.payroll.deductions)} sub="Chama, lateness, discipline, cash advance, and other deductions" icon={TriangleAlert} accent="from-amber-500/20 via-orange-500/10 to-transparent" />
          <StatCard title="Active company staff" value={`${dashboard.counts.activeStaff}`} sub={`${dashboard.counts.shops} shops and ${dashboard.counts.products} catalogued products in system`} icon={Building2} accent="from-cyan-500/20 via-slate-500/10 to-transparent" />
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <div className={`${subtleCard} p-5`}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-400">Top sales performer</div>
            <div className="mt-3 text-2xl font-semibold text-white">{dashboard.payroll.topSalesRow?.name || "No data"}</div>
            <div className="mt-2 text-sm text-slate-400">
              {dashboard.payroll.topSalesRow ? (
                <span className={sensitiveClass}>{`${formatKES(Number(dashboard.payroll.topSalesRow.totalSales ?? 0))} sales this period`}</span>
              ) : (
                "Waiting for payroll-linked sales data."
              )}
            </div>
          </div>
          <div className={`${subtleCard} p-5`}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-400">Top commission</div>
            <div className="mt-3 text-2xl font-semibold text-white">{dashboard.payroll.topCommissionRow?.name || "No data"}</div>
            <div className="mt-2 text-sm text-slate-400">
              {dashboard.payroll.topCommissionRow ? (
                <span className={sensitiveClass}>{`${formatKES(Number(dashboard.payroll.topCommissionRow.commissionTotal ?? 0))} commission due`}</span>
              ) : (
                "Waiting for commission summary."
              )}
            </div>
          </div>
          <div className={`${subtleCard} p-5`}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-400">Best net pay</div>
            <div className="mt-3 text-2xl font-semibold text-white">{dashboard.payroll.topNetRow?.name || "No data"}</div>
            <div className="mt-2 text-sm text-slate-400">
              {dashboard.payroll.topNetRow ? (
                <span className={sensitiveClass}>{`${formatKES(Number(dashboard.payroll.topNetRow.netPay ?? 0))} projected net pay`}</span>
              ) : (
                "Waiting for payroll projection."
              )}
            </div>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        id="resources"
        defaultOpen={false}
        eyebrow="Company links"
        title="Quick access boards for the whole company"
        description="These grouped links make the homepage a real control room. Money, people, operations, and system controls each get their own board."
        action={<AdminPrivacyToggle />}
      >
        <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-4">
          {quickLinks.map((group) => (
            <LinkGroupCard key={group.title} {...group} />
          ))}
        </div>
      </CollapsibleSection>

    </div>
  );
}
