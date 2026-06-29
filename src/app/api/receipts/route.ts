import { NextRequest, NextResponse } from "next/server";
import { PaymentMethod, Prisma, type SupportReceipt } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseNumber, parseIntLike } from "@/lib/parseNumber";
import { publishSummaryUpdate } from "@/lib/receiptSseBroker";
import { requireAttendant, auth } from "@/lib/auth";
import { canonicalReceiptNumber, parsePaymentMethod, buildReceiptKey } from "@/lib/receipts/utils";
import { findReceiptOwner, buildDuplicateMessage } from "@/lib/receiptGuard";
import { getOrCreateCommissionPeriod, computeSalesCommissionFromTiers } from "@/lib/commission";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { recomputeSupportCommissionLedger } from "@/lib/supportCommission";
import { generateRandomId } from "@/lib/id";
import { normalizeReceiptSerial } from "@/lib/receipts/serial";
import { sendReceiptChannels } from "@/workers/receiptSender";
import { getSiteUrl, notifyInternalPodAlerts, notifyInternalReceipt } from "@/lib/receiptInternalNotifications";
import { randomUUID } from "crypto";
import { composeIdentityResponse, resolveTargetUserId } from "@/lib/resolveTargetUser";
import { isDeliveryFeePayloadItem } from "@/lib/supportPricing";
import {
  getProfitReceiptContributorsForAdminFilters,
  type ProfitReceiptContributor,
} from "@/lib/adminReceiptsSummary";
import { adjustProfitForPodDeliveryFee, getPodDeliveryFee, loadPodDeliveryFeeMap } from "@/lib/podDeliveryFee";
import { syncPosReceiptToCustomerAccount } from "@/lib/posCustomerAccountSync";
import { waitForReceiptById } from "@/lib/receiptReadAfterWrite";

const normalizePaymentMethod = (value: unknown): "MPESA" | "CASH" | null => {
  if (typeof value !== "string") return null;
  const candidate = value.toUpperCase().trim();
  if (candidate === "CASH") return "CASH";
  if (candidate === "MPESA") return "MPESA";
  return null;
};

export const dynamic = "force-dynamic";

const IMMEDIATE_THRESHOLD = Number(process.env.IMMEDIATE_COMMISSION_THRESHOLD || 500000);
const RECEIPT_PRODUCT_SELECT = {
  id: true,
  lastBuyingPrice: true,
  variableCost: true,
  commissionEnabled: true,
  commissionAmount: true,
  commissionRequiresApproval: true,
} satisfies Prisma.ProductSelect;

export async function GET(req: NextRequest) {
  try {
    try {
      await auth(); // soft guard: require session but allow attendants/supervisors/admins
    } catch (e) {
      // allow unauthenticated fetch to still fall through if middleware handled already
    }

    const url = new URL(req.url);
    const q = url.searchParams.get("q") || undefined;
  const phoneParam = url.searchParams.get("phone") || undefined;
  const docTypeParam = url.searchParams.get("docType") || undefined;
  const includeLedgerParam = url.searchParams.get("includeLedger");
  const includeLedger = includeLedgerParam === null ? true : includeLedgerParam !== "false";
  const paidOnly = ["1", "true", "yes"].includes((url.searchParams.get("paidOnly") || "").toLowerCase());
  const carryForwardPending = ["1", "true", "yes"].includes((url.searchParams.get("carryForwardPending") || "").toLowerCase());
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  const paymentMethodParam = normalizePaymentMethod(url.searchParams.get("paymentMethod"));
  const includeItems = url.searchParams.get("includeItems") === "true";
  const attendantFilterParam = (url.searchParams.get("attendantId") || "").trim() || undefined;
  const onlyPos = ["1", "true", "yes"].includes((url.searchParams.get("onlyPos") || "").toLowerCase());
  const summaryView = (url.searchParams.get("summaryView") || "all").toLowerCase();
  const isProfitSummaryView = summaryView === "profit";
  const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
  const size = Math.min(200, Math.max(1, Number(url.searchParams.get("size") || "50")));
  const identity = await resolveTargetUserId(req);
  const meta = identity;
  // Allow public callers to specify an attendantId via querystring so
  // the receipts listing can be viewed without a session (public page).
  // Prefer resolved session user id when present, otherwise use explicit param.
  const explicitAttendant = attendantFilterParam;
  let attendantId = identity.resolvedUserId ?? undefined;
  const role = identity.actorRole;
  const canGlobal = role === "ADMIN" || role === "SUPERVISOR";
  if (explicitAttendant && attendantId && explicitAttendant !== attendantId && !canGlobal) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if ((!attendantId || canGlobal) && explicitAttendant) {
    attendantId = explicitAttendant;
  }
  if (!attendantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();
  const startDefault = new Date(today);
  startDefault.setHours(0, 0, 0, 0);
  const endDefault = new Date(today);
  endDefault.setHours(23, 59, 59, 999);
  const startDate = start ? new Date(start) : startDefault;
  const endDate = end ? new Date(end) : endDefault;

  const normalizedDocType = docTypeParam ? docTypeParam.toUpperCase() : undefined;
  const isMarketingDocType = normalizedDocType === "MARKETING";
  const isSupportDocType = normalizedDocType === "SUPPORT";
  const includePosReceipts = !normalizedDocType || (!isMarketingDocType && !isSupportDocType);
  const includeMarketingReceipts = !onlyPos && (isMarketingDocType || (includeLedger && !normalizedDocType));
  const includeSupportReceipts = !onlyPos && (isSupportDocType || (includeLedger && !normalizedDocType));
  let profitContributors: ProfitReceiptContributor[] = [];
  const profitContributorBySourceId = new Map<string, ProfitReceiptContributor>();
  const profitContributorBySourceKey = new Map<string, ProfitReceiptContributor>();

  const registerProfitContributor = (contributor: ProfitReceiptContributor) => {
    if (contributor.id) {
      profitContributorBySourceId.set(`${contributor.source}:${contributor.id}`, contributor);
    }
    profitContributorBySourceKey.set(`${contributor.source}:${contributor.key}`, contributor);
    if (contributor.receiptNumber) {
      const canonical = canonicalReceiptNumber(contributor.receiptNumber);
      if (canonical) profitContributorBySourceKey.set(`${contributor.source}:${canonical}`, contributor);
    }
  };

  const getProfitContributorForRow = (row: {
    id?: string | null;
    source?: "pos" | "marketing" | "support";
    orderRef?: string | null;
    receiptNumber?: string | null;
  }) => {
    const source = row.source ?? "pos";
    const rawId = row.id ? String(row.id).replace(/^(marketing|support)-/, "") : "";
    if (rawId) {
      const byId = profitContributorBySourceId.get(`${source}:${rawId}`);
      if (byId) return byId;
    }
    const keys = [
      row.orderRef,
      row.receiptNumber,
      row.orderRef ? canonicalReceiptNumber(row.orderRef) : null,
      row.receiptNumber ? canonicalReceiptNumber(row.receiptNumber) : null,
    ].filter((value): value is string => Boolean(value));
    for (const key of keys) {
      const contributor = profitContributorBySourceKey.get(`${source}:${key}`);
      if (contributor) return contributor;
    }
    return null;
  };

  const and: Prisma.ReceiptWhereInput[] = [];
  if (!carryForwardPending) {
    and.push({ generatedAt: { gte: startDate, lte: endDate } });
  }

  if (normalizedDocType && !isMarketingDocType && !isSupportDocType) {
    and.push({ docType: normalizedDocType as any });
  }

  if (paymentMethodParam) {
    and.push({ data: { path: ["paymentMethod"], equals: paymentMethodParam } });
  }

  const searchOr: Prisma.ReceiptWhereInput[] = [];
  if (q) {
    searchOr.push(
      { order: { customerName: { contains: q, mode: "insensitive" } } },
      { order: { customerPhone: { contains: q, mode: "insensitive" } } },
      { order: { customerEmail: { contains: q, mode: "insensitive" } } },
      { order: { orderNumber: { contains: q, mode: "insensitive" } } },
      { order: { attendant: { name: { contains: q, mode: "insensitive" } } } },
      { issuedBy: { name: { contains: q, mode: "insensitive" } } },
    );
  }

  if (phoneParam) {
    const pRaw = String(phoneParam).replace(/[^+0-9]/g, "");
    let local = pRaw;
    if (pRaw.startsWith("+254")) local = "0" + pRaw.slice(4);
    else if (pRaw.startsWith("254")) local = "0" + pRaw.slice(3);
    else if (/^[7][0-9]{8}$/.test(pRaw)) local = "0" + pRaw;

    searchOr.push({ order: { customerPhone: { contains: pRaw, mode: "insensitive" } } });
    if (local) searchOr.push({ order: { customerPhone: { contains: local, mode: "insensitive" } } });
  }

  if (searchOr.length) and.push({ OR: searchOr });

  // Scope decision (strict)
  const isImpersonating = Boolean(identity.impersonateId && identity.resolvedUserId && identity.actorId && identity.resolvedUserId !== identity.actorId);
  const requestedScope = url.searchParams.get("scope"); // "mine" | "global"
  const wantsGlobal = requestedScope === "global";
  const allowGlobalScope = canGlobal && (wantsGlobal || Boolean(attendantFilterParam && attendantFilterParam !== identity.resolvedUserId));
  // Rules: impersonating forces mine; otherwise admins/supervisors (or the special viewer) may request global explicitly (or automatically)
  const scope = isImpersonating ? "mine" : allowGlobalScope ? "global" : "mine";
  const metaWithScope = { ...meta, scope };

  if (scope === "mine") {
    and.push({
      OR: [
        { order: { attendantId } },
        { data: { path: ["attendantId"], equals: attendantId } },
      ],
    });
  }
  if (scope === "global" && attendantFilterParam) {
    and.push({
      OR: [
        { order: { attendantId: attendantFilterParam } },
        { data: { path: ["attendantId"], equals: attendantFilterParam } as any },
      ],
    });
  }

  // Optional filter: customerType=pod to show POD receipts only, customerType=normal to exclude POD receipts.
  const customerType = url.searchParams.get('customerType') || undefined;
  const podStatus = url.searchParams.get('status') || undefined; // expected values: 'pending'|'delivered'|'delivery_failed'
    if (customerType === 'pod') {
    if (podStatus) {
      and.push({ data: { path: ['podDelivery', 'status'], equals: podStatus } });
    } else {
      // any receipt that has podDelivery metadata
      and.push({ data: { path: ['podDelivery'], not: Prisma.JsonNull } });
    }
  } else if (customerType === 'normal') {
    and.push({ data: { path: ['podDelivery'], equals: Prisma.JsonNull } });
  } else {
    // Do not exclude POD-pending receipts from the list API — the admin
    // UI wants to display POD receipts in the listing. Aggregation and
    // counting logic should exclude pending POD receipts (handled client-
    // side in the admin UI and in dedicated summary endpoints).
    // If the caller explicitly requests POD receipts via `customerType=pod`,
    // the earlier branch above will apply the appropriate filter.
  }

  if (isProfitSummaryView) {
    try {
      const summaryOptions = {
        start: startDate,
        end: endDate,
        attendantId,
        paymentMethod: paymentMethodParam,
        search: q,
        docType: normalizedDocType,
        includeLedger: true,
        scope,
        currentUserId: identity.resolvedUserId ?? null,
        customerType,
        podStatus,
        onlyPos,
      } as const;

      profitContributors = await getProfitReceiptContributorsForAdminFilters(summaryOptions);

      for (const contributor of profitContributors) {
        registerProfitContributor(contributor);
      }
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.warn("/api/receipts: failed to compute profit contributors:", err?.message ?? err);
      profitContributors = [];
    }
  }

  const where: Prisma.ReceiptWhereInput = { AND: and };

  let posReceipts: any[] = [];
  if (includePosReceipts) {
    if (isProfitSummaryView) {
      try {
        const profitIds = profitContributors
          .filter((contributor) => contributor.source === "pos" && contributor.id)
          .map((contributor) => contributor.id as string);
        const profitReceiptNumbers = Array.from(
          new Set(
            profitContributors
              .filter((contributor) => contributor.source === "pos")
              .flatMap((contributor) => [
                canonicalReceiptNumber(contributor.receiptNumber ?? ""),
                canonicalReceiptNumber(contributor.key ?? ""),
                canonicalReceiptNumber(String(contributor.key ?? "").split(":").pop() ?? ""),
              ])
              .filter((value): value is string => Boolean(value)),
          ),
        );
        if (profitIds.length) {
          posReceipts = await prisma.receipt.findMany({
            where: {
              OR: [
                { id: { in: profitIds } },
                ...(profitReceiptNumbers.length
                  ? [
                      { order: { orderNumber: { in: profitReceiptNumbers } } },
                      { receiptNumber: { in: profitReceiptNumbers } },
                    ]
                  : []),
              ],
            },
            include: {
              order: {
                include: {
                  items: {
                    include: {
                      orderCosts: { select: { unitCost: true } },
                      profitSnapshots: {
                        orderBy: { computedAt: "desc" },
                        take: 1,
                        select: { unitCost: true, profit: true, qty: true },
                      },
                      product: { select: { lastBuyingPrice: true } },
                    },
                  },
                  attendant: { select: { id: true, name: true } },
                },
              },
              issuedBy: { select: { id: true, name: true } },
            },
            orderBy: { generatedAt: "desc" },
          });
        } else if (profitReceiptNumbers.length) {
          posReceipts = await prisma.receipt.findMany({
            where: {
              OR: [
                { order: { orderNumber: { in: profitReceiptNumbers } } },
                { receiptNumber: { in: profitReceiptNumbers } },
              ],
            },
            include: {
              order: {
                include: {
                  items: {
                    include: {
                      orderCosts: { select: { unitCost: true } },
                      profitSnapshots: {
                        orderBy: { computedAt: "desc" },
                        take: 1,
                        select: { unitCost: true, profit: true, qty: true },
                      },
                      product: { select: { lastBuyingPrice: true } },
                    },
                  },
                  attendant: { select: { id: true, name: true } },
                },
              },
              issuedBy: { select: { id: true, name: true } },
            },
            orderBy: { generatedAt: "desc" },
          });
        } else {
          posReceipts = [];
        }
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.warn("/api/receipts: failed to query profit receipts:", err?.message ?? err);
        posReceipts = [];
      }
    } else {
      try {
        posReceipts = await prisma.receipt.findMany({
          where,
          include: {
            order: includeItems || isProfitSummaryView
              ? {
                  include: {
                    items: {
                      include: {
                        orderCosts: { select: { unitCost: true } },
                        profitSnapshots: {
                          orderBy: { computedAt: "desc" },
                          take: 1,
                          select: { unitCost: true, profit: true, qty: true },
                        },
                        product: { select: { lastBuyingPrice: true } },
                      },
                    },
                    attendant: { select: { id: true, name: true } },
                  },
                }
              : {
                  select: {
                    orderNumber: true,
                    customerName: true,
                    attendantId: true,
                    attendant: { select: { id: true, name: true } },
                    status: true,
                    paymentStatus: true,
                    totalAmount: true,
                  },
                },
            issuedBy: { select: { id: true, name: true } },
          },
          orderBy: { generatedAt: "desc" },
        });
      } catch (err: any) {
        const msg = String(err?.message ?? err);
        // eslint-disable-next-line no-console
        console.warn("/api/receipts: failed to query receipts table:", msg);
        if (msg.includes("does not exist")) {
          posReceipts = [];
        } else {
          throw err;
        }
      }
    }
  }

  const isPodPaidReceipt = (row: any) => Boolean((row?.data as any)?.podDelivery?.paidAt);
  const podStatusOf = (row: any) => ((row?.data as any)?.podDelivery?.status ?? "").toString().toLowerCase();
  const isPodReceipt = (row: any) => Boolean((row?.data as any)?.podDelivery);
  const isPosPaidReceipt = (row: any) =>
    ((row?.order?.paymentStatus ?? "").toString().toUpperCase().trim() === "PAID");
  const isPodSettledForSales = (row: any) => {
    if (!isPodReceipt(row)) return false;
    if (podStatusOf(row) === "pending") return false;
    return isPodPaidReceipt(row) || isPosPaidReceipt(row);
  };
  const issuerLockedPosReceipts =
    onlyPos && attendantFilterParam
      ? posReceipts.filter((row: any) => {
          const dataAttendantId =
            row?.data && typeof row.data === "object" ? String((row.data as any).attendantId ?? "").trim() : "";
          return row?.order?.attendantId === attendantFilterParam || dataAttendantId === attendantFilterParam;
        })
      : posReceipts;
  const filteredPosReceipts = paidOnly
    ? issuerLockedPosReceipts.filter((row: any) => {
        if (isPodReceipt(row)) {
          return isPodSettledForSales(row);
        }
        return isPosPaidReceipt(row);
      })
    : issuerLockedPosReceipts;

  const canonicalPosReceiptNumbers = Array.from(
    new Set(
      filteredPosReceipts
        .flatMap((row: any) => {
          const orderNumber = canonicalReceiptNumber((row?.order as any)?.orderNumber ?? "");
          const receiptNumber = canonicalReceiptNumber(row?.receiptNumber ?? "");
          return [orderNumber, receiptNumber].filter((value): value is string => Boolean(value));
        })
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const datedPosReceiptKeys = Array.from(
    new Set(
      filteredPosReceipts
        .flatMap((row: any) => {
          const createdAt = row?.generatedAt instanceof Date ? row.generatedAt : row?.createdAt instanceof Date ? row.createdAt : null;
          const orderNumber = canonicalReceiptNumber((row?.order as any)?.orderNumber ?? "");
          const receiptNumber = canonicalReceiptNumber(row?.receiptNumber ?? "");
          if (!createdAt) return [orderNumber, receiptNumber].filter((value): value is string => Boolean(value));
          const businessDate = createdAt.toISOString().slice(0, 10);
          return [orderNumber, receiptNumber]
            .filter((value): value is string => Boolean(value))
            .map((value) => `${businessDate}:${value}`);
        })
        .filter((value): value is string => Boolean(value)),
    ),
  );
  let supportReceiptProfitRows: any[] = [];
  if (canonicalPosReceiptNumbers.length || datedPosReceiptKeys.length) {
    try {
      supportReceiptProfitRows = await prisma.supportReceipt.findMany({
        where: {
          OR: [
            ...(canonicalPosReceiptNumbers.length ? [{ receiptNumber: { in: canonicalPosReceiptNumbers } }] : []),
            ...(datedPosReceiptKeys.length ? [{ receiptKey: { in: datedPosReceiptKeys } }] : []),
          ],
        },
        select: {
          receiptNumber: true,
          receiptKey: true,
          buyingTotal: true,
          items: { select: { buyingPrice: true } },
        },
      });
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      // eslint-disable-next-line no-console
      console.warn("/api/receipts: failed to query supportReceipt table:", msg);
      if (msg.includes("does not exist")) {
        supportReceiptProfitRows = [];
      } else {
        throw err;
      }
    }
  }
  const supportBuyingTotalsByReceipt = new Map<string, number>();
  for (const row of supportReceiptProfitRows) {
    const itemsBuyingTotal = Array.isArray(row.items)
      ? row.items.reduce((sum, item) => sum + Number(item.buyingPrice ?? 0), 0)
      : 0;
    const buyingTotal = Math.max(Number(row.buyingTotal ?? 0), itemsBuyingTotal);
    if (!(buyingTotal > 0)) continue;
    const keys = [
      canonicalReceiptNumber(row.receiptNumber ?? ""),
      canonicalReceiptNumber(row.receiptKey ?? ""),
      canonicalReceiptNumber(String(row.receiptKey ?? "").split(":").pop() ?? ""),
    ].filter((value): value is string => Boolean(value));
    for (const key of keys) {
      if (!supportBuyingTotalsByReceipt.has(key)) supportBuyingTotalsByReceipt.set(key, buyingTotal);
    }
  }

  const mapPosRow = (r: any) => {
    const podDeliveryData = (r.data as any)?.podDelivery;
    const agentSaleCommission = Number((r.data as any)?.agentSale?.commissionAmount ?? 0) || 0;
    const podDeliveryFee = getPodDeliveryFee(r.data);
    const total = Number((r.totals as any)?.total ?? (r.order as any)?.totalAmount ?? 0) || 0;
    const canonicalReceipt =
      canonicalReceiptNumber((r.order as any)?.orderNumber ?? "") || canonicalReceiptNumber(r.receiptNumber ?? "");
    const supportBuyingTotal = canonicalReceipt ? Number(supportBuyingTotalsByReceipt.get(canonicalReceipt) ?? 0) : 0;
    const itemBuyingTotal = Array.isArray((r.order as any)?.items)
      ? (r.order as any).items.reduce((sum: number, item: any) => {
          const qty = Math.max(1, Math.trunc(Number(item?.quantity ?? 1)));
          const costRows = Array.isArray(item?.orderCosts) ? item.orderCosts : [];
          const orderCost = costRows.reduce((inner: number, cost: any) => inner + Number(cost?.unitCost ?? 0), 0);
          const snapshot = Array.isArray(item?.profitSnapshots) ? item.profitSnapshots[0] : null;
          const snapshotCost = Number(snapshot?.unitCost ?? 0);
          const productCost = Number(item?.product?.lastBuyingPrice ?? 0);
          const unitCost = orderCost > 0 ? orderCost : snapshotCost > 0 ? snapshotCost : productCost > 0 ? productCost : 0;
          return sum + unitCost * qty;
        }, 0)
      : 0;
    const buyingTotal = supportBuyingTotal > 0 ? supportBuyingTotal : itemBuyingTotal;
    const contributor = getProfitContributorForRow({
      id: r.id,
      source: "pos",
      orderRef: (r.order as any)?.orderNumber ?? null,
      receiptNumber: r.receiptNumber ?? null,
    });
    const explicitProfitRaw = (r as any)?.profit ?? (r.data as any)?.profit ?? (r.totals as any)?.profit;
    const explicitProfit =
      typeof explicitProfitRaw === "number" && Number.isFinite(explicitProfitRaw)
        ? Number(explicitProfitRaw)
        : typeof explicitProfitRaw === "string" && explicitProfitRaw.trim() !== "" && !Number.isNaN(Number(explicitProfitRaw))
          ? Number(explicitProfitRaw)
          : null;
    const resolvedBuyingTotal = contributor?.buyingTotal ?? buyingTotal;
    const baseProfit = contributor?.profit ?? explicitProfit ?? (resolvedBuyingTotal > 0 ? total - resolvedBuyingTotal : null);
    const profit =
      typeof baseProfit === "number"
        ? adjustProfitForPodDeliveryFee(baseProfit - agentSaleCommission, podDeliveryFee)
        : baseProfit;
    return {
      id: r.id,
      source: "pos" as const,
      orderRef: r.order?.orderNumber,
      receiptNumber: r.receiptNumber ?? null,
      docType: r.docType,
      createdAt: r.generatedAt,
      customerName: r.order?.customerName,
      customerPhone: (r.order as any)?.customerPhone ?? null,
      customerEmail: (r.order as any)?.customerEmail ?? null,
      total,
      buyingTotal: resolvedBuyingTotal > 0 ? resolvedBuyingTotal : null,
      profit,
      attendantName: (r.order as any)?.attendant?.name ?? r.issuedBy?.name ?? null,
      status: r.order?.status ?? r.order?.paymentStatus ?? null,
      items: includeItems ? ((r.order as any)?.items ?? []) : undefined,
      paymentMethod: normalizePaymentMethod((r.data as any)?.paymentMethod) ?? null,
      paymentStatus: (r.order as any)?.paymentStatus ?? null,
      detailUrl: `/receipts/${r.id}`,
      isPodDelivery: Boolean(podDeliveryData?.status),
      podDeliveryStatus: podDeliveryData?.status ?? null,
      podDeliveryNote: podDeliveryData?.note ?? null,
      podEvidenceUrl: podDeliveryData?.evidenceUrl ?? null,
      podDeliveryFee: podDeliveryFee > 0 ? podDeliveryFee : null,
    };
  };

  const mapMarketingRow = (receipt: any) => {
    const total = Number(receipt.sellingTotal ?? 0);
    const canonical = canonicalReceiptNumber(receipt.receiptNumber ?? receipt.receiptKey ?? undefined);
    const deliveryFee = canonical ? podDeliveryFeeMap.get(canonical) ?? 0 : 0;
    const contributor = getProfitContributorForRow({
      id: receipt.id,
      source: "marketing",
      orderRef: receipt.receiptNumber ?? null,
      receiptNumber: receipt.receiptNumber ?? null,
    });
    const itemBuyingTotal = Array.isArray(receipt.items)
      ? receipt.items.reduce((sum: number, item: any) => sum + Number(item.buyingPrice ?? 0) * (Number(item.quantity ?? 1) || 1), 0)
      : 0;
    const storedBuyingTotal = Number(receipt.buyingTotal ?? (receipt.data as any)?.buyingTotal ?? 0);
    const buyingTotal = contributor?.buyingTotal ?? (storedBuyingTotal > 0 ? storedBuyingTotal : itemBuyingTotal);
    const profit = contributor?.profit ?? (buyingTotal > 0 ? total - buyingTotal - deliveryFee : null);
    return {
      id: `marketing-${receipt.id}`,
      source: "marketing" as const,
      orderRef: receipt.receiptNumber || undefined,
      receiptNumber: receipt.receiptNumber ?? null,
      docType: "MARKETING",
      createdAt: receipt.createdAt,
      customerName: null,
      customerPhone: null,
      customerEmail: null,
      total,
      buyingTotal: buyingTotal > 0 ? buyingTotal : null,
      profit,
      attendantName:
        receipt.dailyEntry?.submittedBy?.name ?? receipt.dailyEntry?.submittedByName ?? null,
      status: "COMPLETED",
      items: includeItems
        ? (receipt.items || []).map((item: any) => ({
            id: item.id,
            productName: item.productName,
            buyingPrice: Number(item.buyingPrice ?? 0),
          }))
        : undefined,
      paymentMethod: normalizePaymentMethod(receipt.paymentMethod) ?? null,
      paymentStatus: "PAID",
      detailUrl: `/receipts/history/marketing/${receipt.id}`,
    };
  };

  const mapSupportRow = (receipt: any) => {
    const total = Number(receipt.sellingTotal ?? 0);
    const canonical = canonicalReceiptNumber(receipt.receiptNumber ?? receipt.receiptKey ?? undefined);
    const deliveryFee = canonical ? podDeliveryFeeMap.get(canonical) ?? 0 : 0;
    const contributor = getProfitContributorForRow({
      id: receipt.id,
      source: "support",
      orderRef: receipt.receiptNumber ?? null,
      receiptNumber: receipt.receiptNumber ?? null,
    });
    const itemBuyingTotal = Array.isArray(receipt.items)
      ? receipt.items.reduce((sum: number, item: any) => sum + Number(item.buyingPrice ?? 0) * (Number(item.quantity ?? 1) || 1), 0)
      : 0;
    const storedBuyingTotal = Number(receipt.buyingTotal ?? (receipt.data as any)?.buyingTotal ?? 0);
    const buyingTotal = contributor?.buyingTotal ?? (storedBuyingTotal > 0 ? storedBuyingTotal : itemBuyingTotal);
    const profit = contributor?.profit ?? (buyingTotal > 0 ? total - buyingTotal - deliveryFee : null);
    return {
      id: `support-${receipt.id}`,
      source: "support" as const,
      orderRef: receipt.receiptNumber || undefined,
      receiptNumber: receipt.receiptNumber ?? null,
      docType: "SUPPORT",
      createdAt: receipt.createdAt,
      customerName: null,
      customerPhone: null,
      customerEmail: null,
      total,
      buyingTotal: buyingTotal > 0 ? buyingTotal : null,
      profit,
      attendantName:
        receipt.dailyEntry?.submittedBy?.name ?? receipt.dailyEntry?.submittedByName ?? null,
      status: "COMPLETED",
      items: includeItems
        ? (receipt.items || []).map((item: any) => ({
            id: item.id,
            productName: item.productName,
            buyingPrice: Number(item.buyingPrice ?? 0),
          }))
        : undefined,
      paymentMethod: normalizePaymentMethod(receipt.paymentMethod) ?? null,
      paymentStatus: "PAID",
      detailUrl: `/receipts/history/support/${receipt.id}`,
    };
  };

  const marketingFilter: any = {
    dailyEntry: {
      date: { gte: startDate, lte: endDate },
    },
  };
  const marketingStaffId = scope === "mine" ? attendantId : attendantFilterParam;
  if (marketingStaffId) marketingFilter.dailyEntry.submittedById = marketingStaffId;
  if (paymentMethodParam) marketingFilter.paymentMethod = paymentMethodParam;
  if (q) {
    marketingFilter.OR = [
      { receiptNumber: { contains: q, mode: "insensitive" } },
      { dailyEntry: { submittedByName: { contains: q, mode: "insensitive" } } },
      { items: { some: { productName: { contains: q, mode: "insensitive" } } } },
    ];
  }

  const supportFilter: any = {
    dailyEntry: {
      date: { gte: startDate, lte: endDate },
    },
  };
  const supportStaffId = scope === "mine" ? attendantId : attendantFilterParam;
  if (supportStaffId) supportFilter.dailyEntry.submittedById = supportStaffId;
  if (paymentMethodParam) supportFilter.paymentMethod = paymentMethodParam;
  if (q) {
    supportFilter.OR = [
      { receiptNumber: { contains: q, mode: "insensitive" } },
      {
        dailyEntry: {
          submittedBy: { name: { contains: q, mode: "insensitive" } },
        },
      },
      { items: { some: { productName: { contains: q, mode: "insensitive" } } } },
    ];
  }

  let marketingReceipts: any[] = [];
  const profitMarketingIds = isProfitSummaryView
    ? profitContributors
        .filter((contributor) => contributor.source === "marketing" && contributor.id)
        .map((contributor) => contributor.id as string)
    : [];
  const profitMarketingReceiptNumbers = isProfitSummaryView
    ? Array.from(
        new Set(
          profitContributors
            .filter((contributor) => contributor.source === "marketing")
            .flatMap((contributor) => [
              canonicalReceiptNumber(contributor.receiptNumber ?? ""),
              canonicalReceiptNumber(contributor.key ?? ""),
              canonicalReceiptNumber(String(contributor.key ?? "").split(":").pop() ?? ""),
            ])
            .filter((value): value is string => Boolean(value)),
        ),
      )
    : [];
  if (includeMarketingReceipts || profitMarketingIds.length || profitMarketingReceiptNumbers.length) {
    try {
      marketingReceipts = await prisma.marketingReceipt.findMany({
        where:
          profitMarketingIds.length || profitMarketingReceiptNumbers.length
            ? {
                OR: [
                  ...(profitMarketingIds.length ? [{ id: { in: profitMarketingIds } }] : []),
                  ...(profitMarketingReceiptNumbers.length
                    ? [{ receiptNumber: { in: profitMarketingReceiptNumbers } }]
                    : []),
                ],
              }
            : marketingFilter,
        include: {
          items: true,
          dailyEntry: {
            include: {
              submittedBy: { select: { id: true, name: true } },
            },
          },
        },
      });
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      // eslint-disable-next-line no-console
      console.warn("/api/receipts: failed to query marketingReceipt table:", msg);
      if (msg.includes("does not exist")) {
        marketingReceipts = [];
      } else {
        throw err;
      }
    }
  }

  const profitSupportIds = isProfitSummaryView
    ? profitContributors
        .filter((contributor) => contributor.source === "support" && contributor.id)
        .map((contributor) => contributor.id as string)
    : [];
  const profitSupportReceiptNumbers = isProfitSummaryView
    ? Array.from(
        new Set(
          profitContributors
            .filter((contributor) => contributor.source === "support")
            .flatMap((contributor) => [
              canonicalReceiptNumber(contributor.receiptNumber ?? ""),
              canonicalReceiptNumber(contributor.key ?? ""),
              canonicalReceiptNumber(String(contributor.key ?? "").split(":").pop() ?? ""),
            ])
            .filter((value): value is string => Boolean(value)),
        ),
      )
    : [];
  const supportReceipts = includeSupportReceipts || profitSupportIds.length || profitSupportReceiptNumbers.length
    ? await prisma.supportReceipt.findMany({
        where:
          profitSupportIds.length || profitSupportReceiptNumbers.length
            ? {
                OR: [
                  ...(profitSupportIds.length ? [{ id: { in: profitSupportIds } }] : []),
                  ...(profitSupportReceiptNumbers.length
                    ? [
                        { receiptNumber: { in: profitSupportReceiptNumbers } },
                        { receiptKey: { in: profitSupportReceiptNumbers } },
                      ]
                    : []),
                ],
              }
            : supportFilter,
        include: {
          items: true,
          dailyEntry: {
            include: {
              submittedBy: { select: { id: true, name: true } },
            },
          },
        },
      })
    : [];

  const podDeliveryFeeMap = await loadPodDeliveryFeeMap(
    prisma,
    [
      ...marketingReceipts.map((receipt: any) => receipt.receiptNumber ?? receipt.receiptKey ?? null),
      ...supportReceipts.map((receipt: any) => receipt.receiptNumber ?? receipt.receiptKey ?? null),
    ],
  );

  const combined = [
    ...filteredPosReceipts.map(mapPosRow),
    ...marketingReceipts.map(mapMarketingRow),
    ...supportReceipts.map(mapSupportRow),
  ];

  const sourcePriority: Record<"pos" | "marketing" | "support", number> = {
    pos: 3,
    marketing: 2,
    support: 1,
  };

  const uniqueReceipts = new Map<string, typeof combined[number]>();
  for (const row of combined) {
    const normalized = row.orderRef ? canonicalReceiptNumber(row.orderRef) : "";
    const key = normalized || row.id;
    const existing = uniqueReceipts.get(key);
    const priority = sourcePriority[row.source ?? "pos"];
    const existingPriority = existing ? sourcePriority[existing.source ?? "pos"] : 0;
    const hasContribution = Boolean(getProfitContributorForRow(row));
    const existingHasContribution = existing ? Boolean(getProfitContributorForRow(existing)) : false;
    if (!existing || (hasContribution && !existingHasContribution) || (hasContribution === existingHasContribution && priority > existingPriority)) {
      uniqueReceipts.set(key, row);
    }
  }

  const deduped = Array.from(uniqueReceipts.values()).filter((row) => {
    if (!isProfitSummaryView) return true;
    const contributor = getProfitContributorForRow(row);
    if (contributor) return true;
    const explicitProfit = (row as any).profit;
    const buyingTotal = Number((row as any).buyingTotal ?? 0);
    return (
      (typeof explicitProfit === 'number' && Number.isFinite(explicitProfit)) ||
      buyingTotal > 0
    );
  });

  // Ensure each returned row has a computed `profit` where possible so the
  // UI can always sum and display a meaningful value.
  for (const row of deduped) {
    const total = Number(row.total ?? 0);
    const buying = Number((row as any).buyingTotal ?? 0);
    const explicit = typeof (row as any).profit === 'number' ? (row as any).profit : undefined;
    if (explicit !== undefined) {
      (row as any).profit = explicit;
    } else if (buying > 0) {
      (row as any).profit = total - buying;
    } else {
      (row as any).profit = undefined;
    }
  }

  deduped.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const totalCount = deduped.length;
  const paged = deduped.slice((page - 1) * size, page * size);
  const totalPages = Math.max(1, Math.ceil(totalCount / size));
    const data = { receipts: paged, paging: { page, size, totalCount, totalPages } };
    return NextResponse.json(composeIdentityResponse(metaWithScope, data));
  } catch (err: any) {
    // Log and return error details to help debugging during development
    // eslint-disable-next-line no-console
    console.error("/api/receipts GET error:", err);
    const body = { error: String(err?.message ?? err), stack: err?.stack ?? null };
    return NextResponse.json(body, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let guard;
  try {
    guard = await requireAttendant(req as unknown as Request);
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }

  const payload = (await req.json()) as any;
  const isPodPaymentMethod = (value: unknown) => {
    const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
    if (!raw) return false;
    const compact = raw.replace(/[\s_-]+/g, "");
    return compact === "pod" || compact.includes("payondelivery");
  };
  const normalizeCustomerType = (value: unknown) => {
    const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
    if (!raw) return "";
    return raw.replace(/[\s_-]+/g, "");
  };
  const isPodDelivery =
    Boolean(payload?.podDelivery) ||
    isPodPaymentMethod(payload?.paymentMethod) ||
    normalizeCustomerType(payload?.customerType) === "pod";
  const requestId = randomUUID();

  // use shared parse helpers from src/lib/parseNumber

  const serial = normalizeReceiptSerial(payload?.serial);
  const docType = (String(payload?.docType || "RECEIPT")).toUpperCase();
  const resolvedUserId = guard?.user?.id ?? null;
  // Attendant (who gets credited) should come from the payload (attendantId/servedBy)
  // and only fall back to the resolved/logged-in user when not provided.
  const attendantId = payload?.attendantId ?? payload?.servedBy ?? resolvedUserId ?? null;
  // issuedById MUST be the logged-in user (who clicked Save). Do not trust payload. This prevents
  // admins or impersonation sessions from altering the recorded creator/issuer of a receipt.
  const issuedById = resolvedUserId;

  // Diagnostic logging: capture incoming attribution candidates to help debug misattributed sales
  try {
    console.info('[receipts] incoming save attribution', {
      serial: serial ?? null,
      docType: docType ?? null,
      payloadAttendantId: payload?.attendantId ?? null,
      payloadServedBy: payload?.servedBy ?? null,
      resolvedUserId,
      computedAttendantId: attendantId ?? null,
      computedIssuedById: issuedById ?? null,
    });
  } catch (e) {
    // ignore logging errors
  }

  // compute totals
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const subtotal = items.reduce((s: number, it: any) => s + (parseNumber(it.unitPrice || it.sellingPrice || 0) * Math.max(1, parseNumber(it.quantity || 1, 1))), 0);
  const taxRate = parseNumber(payload?.taxRate || 0);
  const taxAmount = payload?.showTax ? (subtotal * (taxRate / 100)) : 0;
  const discount = parseNumber(payload?.discount || 0);
  const total = subtotal + taxAmount - discount;
  const deposit = docType === "LAYAWAY" ? parseNumber(payload?.deposit || 0) : 0;
  const balance = docType === "LAYAWAY" ? Math.max(0, total - deposit) : 0;

  try {
    // allow linking when caller opts-in via ?link=1 or payload.link = true
    let allowLink = Boolean(payload?.link);
    try {
      const url = req && req.url ? new URL(req.url) : null as any;
      if (url) {
        allowLink = url.searchParams.get("link") === "1" || url.searchParams.get("link") === "true" || allowLink;
      }
    } catch (e) {
      // malformed or missing URL in test mocks - fall back to payload.link
      allowLink = Boolean(payload?.link);
    }

    // Early duplicate guard: check across POS, marketing, support
    const existing = await findReceiptOwner(String(serial));
    if (existing && !allowLink) {
      const msg = buildDuplicateMessage(serial, existing);
      return NextResponse.json({ ok: false, code: "DUPLICATE_RECEIPT", message: msg, owner: existing }, { status: 409 });
    }

    // If linking is allowed and an existing owner is found, we'll link to it inside the transaction.
    const ownerToLink = existing ?? null;

    const result = await prisma.$transaction(async (tx) => {
      const entryDate = payload?.date ? new Date(payload.date) : new Date();
      const entryDateIso = entryDate.toISOString();
      const metadataFromPayload =
        payload?.metadata ?? (payload?.deliveryAddress ? { deliveryAddress: payload.deliveryAddress } : undefined);
      const podMetadata = isPodDelivery
        ? {
            ...(metadataFromPayload ?? {}),
            podDelivery: {
              status: 'pending',
              type: 'pay_on_delivery',
              note: payload?.podDelivery?.note ?? null,
              createdAt: entryDateIso,
              createdById: issuedById ?? null,
            },
          }
        : metadataFromPayload;
      const dayOfWeek = entryDate.toLocaleDateString("en-KE", { weekday: "long" });

      const orderStatus = docType === "LAYAWAY" ? "PENDING" : isPodDelivery ? "PENDING" : "COMPLETED";
      const orderPaymentStatus = docType === "LAYAWAY" ? "PARTIAL" : isPodDelivery ? "UNPAID" : "PAID";
      const paidAmountValue = docType === "LAYAWAY" ? deposit : isPodDelivery ? 0 : Number(total) || 0;
      // choose shop: provided or first active
      let shopId = payload?.shopId;
      if (!shopId) {
        const shop = await tx.shop.findFirst({ where: { isActive: true }, select: { id: true } });
        shopId = shop?.id ?? null;
      }
      if (!shopId) throw new Error("No active shop found for receipt");

      // ensure products exist for items (prefer selected catalog products, otherwise create lightweight manual records)
      const createdItems: any[] = [];
      for (const it of items) {
        const fullTitle = String(it.title || it.product || it.name || "Item").trim() || "Item";
        const title = fullTitle.slice(0, 255);
        const selectedProductId = typeof it.productId === "string" ? it.productId.trim() : "";
        let product = selectedProductId
          ? await tx.product.findUnique({
              where: { id: selectedProductId },
              select: RECEIPT_PRODUCT_SELECT,
            })
          : await tx.product.findFirst({
              where: { name: title },
              select: RECEIPT_PRODUCT_SELECT,
            });
        if (!product) {
          product = await tx.product.create({
            data: {
              sku: `manual-${generateRandomId()}`,
              name: title,
              category: "manual",
              sellingPrice: Number(it.unitPrice || it.sellingPrice || 0) || 0,
            },
          });
        }
        const quantity = Math.max(1, parseIntLike(it.quantity ?? 1, 1));
        const unitPrice = parseNumber(it.unitPrice ?? it.sellingPrice ?? 0);
        const itemSerial = typeof it.serial === "string" ? it.serial.trim() || null : null;
        const itemWarranty = typeof it.warranty === "string" ? it.warranty.trim() || null : null;
        const variableCost = Boolean((product as any).variableCost);
        const unitBuyingPrice = variableCost
          ? null
          : parseNumber(it.costPrice ?? it.buyingPrice ?? product.lastBuyingPrice ?? 0);
        const commissionEnabled = Boolean((product as any).commissionEnabled);
        const commissionAmount = commissionEnabled ? parseNumber((product as any).commissionAmount ?? 0) : 0;
        const commissionRequiresApproval = Boolean((product as any).commissionRequiresApproval);
        createdItems.push({
          product,
          selectedProductId: selectedProductId || null,
          quantity,
          unitPrice,
          isDeliveryFee: isDeliveryFeePayloadItem(it),
          serial: itemSerial,
          warranty: itemWarranty,
          title,
          fullTitle,
          costPrice: unitBuyingPrice,
          variableCost,
          commissionEnabled,
          commissionAmount,
          commissionRequiresApproval,
        });
      }

      // upsert order by orderNumber (use serial as orderNumber)
      const orderUpsert = await tx.order.upsert({
        where: { orderNumber: serial },
        create: {
          orderNumber: serial,
          customerName: payload?.customerName ?? payload?.customer ?? "",
          customerPhone: payload?.customerPhone ?? null,
          customerEmail: payload?.customerEmail ?? null,
          attendantId: attendantId ?? null,
          // persist deliveryAddress inside `metadata` JSON to avoid schema mismatch
          metadata: podMetadata,
          shopId,
          status: orderStatus,
          paymentStatus: orderPaymentStatus,
          totalAmount: Number(total) || 0,
          paidAmount: paidAmountValue,
          // metadata already set above (may include deliveryAddress)
        },
        update: {
          customerName: payload?.customerName ?? undefined,
          customerPhone: payload?.customerPhone ?? undefined,
          customerEmail: payload?.customerEmail ?? undefined,
          attendantId: attendantId ?? undefined,
          // merge/update metadata to include deliveryAddress when present
          metadata: podMetadata,
          totalAmount: Number(total) || undefined,
          paidAmount: paidAmountValue,
          status: orderStatus,
          paymentStatus: orderPaymentStatus,
          // metadata already set above (may include deliveryAddress)
        },
      });

      // clear existing order items for update case (simple approach)
      await tx.orderItem.deleteMany({ where: { orderId: orderUpsert.id } });

      const createdOrderItems: any[] = [];
      let totalBuying = 0;
      let hasVariableCostItems = false;
      for (const it of createdItems) {
        if (it.variableCost) hasVariableCostItems = true;
        // Ensure numeric and integer types are strictly coerced for Prisma
        const qty = Math.max(1, Math.trunc(Number(it.quantity ?? 1)));
        const rawUnitPriceInput = it.unitPrice ?? '';
        if (typeof rawUnitPriceInput === 'string') {
          console.info('[receipts] raw item.unitPrice before parsing', {
            orderNumber: serial,
            itemTitle: it.title,
            rawUnitPrice: rawUnitPriceInput,
          });
        }
        const normalizedUnitPriceInput =
          typeof rawUnitPriceInput === 'string'
            ? rawUnitPriceInput.replace(/[^0-9.\-]/g, '').trim()
            : rawUnitPriceInput;
        if (
          typeof rawUnitPriceInput === 'string' &&
          normalizedUnitPriceInput !== rawUnitPriceInput
        ) {
          console.warn('[receipts] cleaned unitPrice string', {
            raw: rawUnitPriceInput,
            cleaned: normalizedUnitPriceInput,
          });
        }
        const sellingPrice = Number(parseNumber(normalizedUnitPriceInput));
        const orderItemPayload = {
          orderId: orderUpsert.id,
          productId: String(it.product?.id ?? it.product),
          quantity: qty,
          sellingPrice: sellingPrice,
          serial: it.serial ?? null,
          warranty: it.warranty ?? null,
        } as const;

        if (!Number.isFinite(orderItemPayload.sellingPrice)) {
          throw new Error(`Invalid selling price for item ${it.title} -> ${String(it.unitPrice)}`);
        }

        // Extra logging to help diagnose DB-level "trailing characters" errors
        console.debug("[receipts] persist order item payload types", {
          orderIdType: typeof orderItemPayload.orderId,
          productIdType: typeof orderItemPayload.productId,
          quantityType: typeof orderItemPayload.quantity,
          sellingPriceType: typeof orderItemPayload.sellingPrice,
          serialType: typeof orderItemPayload.serial,
          warrantyType: typeof orderItemPayload.warranty,
        });

        let safePayload: any = undefined;
        try {
          safePayload = {
            orderId: String(orderItemPayload.orderId),
            productId: String(orderItemPayload.productId),
            quantity: Number(orderItemPayload.quantity) || 0,
            sellingPrice: Number(orderItemPayload.sellingPrice) || 0,
            serial:
              orderItemPayload.serial === null || orderItemPayload.serial === undefined
                ? undefined
                : typeof orderItemPayload.serial === 'string'
                ? orderItemPayload.serial
                : String(orderItemPayload.serial),
            warranty:
              orderItemPayload.warranty === null || orderItemPayload.warranty === undefined
                ? undefined
                : typeof orderItemPayload.warranty === 'string'
                ? orderItemPayload.warranty
                : String(orderItemPayload.warranty),
          };
          console.info('[receipts] creating orderItem', JSON.stringify(safePayload), {
            serialType: safePayload.serial === undefined ? 'undefined' : safePayload.serial === null ? 'null' : typeof safePayload.serial,
            warrantyType: safePayload.warranty === undefined ? 'undefined' : safePayload.warranty === null ? 'null' : typeof safePayload.warranty,
          });
          // Diagnostic: log UTF-8 byte arrays to detect hidden/trailing characters
          try {
            console.info('[receipts] creating orderItem bytes', {
              serialBytes: safePayload.serial ? Array.from(Buffer.from(String(safePayload.serial), 'utf8')) : [],
              warrantyBytes: safePayload.warranty ? Array.from(Buffer.from(String(safePayload.warranty), 'utf8')) : [],
            });
          } catch (e) {
            // ignore diagnostics failing
          }
          const item = await tx.orderItem.create({ data: safePayload });
          createdOrderItems.push(item);
          const unitCost = it.variableCost ? 0 : Number(it.costPrice || 0);
          totalBuying += unitCost * qty;
          if (unitCost > 0 && (tx as any).orderCost) {
            try {
              await (tx as any).orderCost.create({
                data: {
                  orderItemId: item.id,
                  unitCost,
                  costSource: it.selectedProductId ? "POS_CATALOG" : "MANUAL_RECEIPT",
                },
              });
            } catch {
              // best-effort for DBs without the relation available
            }
          }
        } catch (orderItemError) {
          const orderItemErrorMsg = (orderItemError as any)?.message ?? String(orderItemError);
          console.error('[receipts] failed to persist order item', {
            payload: orderItemPayload,
            safePayload,
            serialType: typeof orderItemPayload.serial,
            warrantyType: typeof orderItemPayload.warranty,
            error: orderItemErrorMsg,
            errorMeta: (orderItemError as any)?.meta ?? undefined,
            errorStack: (orderItemError as any)?.stack ?? undefined,
          });
          throw orderItemError;
        }
      }

      // Layaway plan creation/update (guarded for test tx mocks)
      if (docType === "LAYAWAY" && tx.layawayPlan) {
        try {
          const existingPlan = await tx.layawayPlan.findUnique({ where: { orderId: orderUpsert.id } });
          if (existingPlan) {
            await tx.layawayPlan.update({
              where: { id: existingPlan.id },
              data: { deposit, balance, isComplete: balance <= 0 },
            });
          } else {
            await tx.layawayPlan.create({
              data: {
                orderId: orderUpsert.id,
                deposit,
                balance,
                isComplete: balance <= 0,
                payments: deposit > 0 ? { create: { amount: deposit, method: payload?.depositMethod ?? "CASH", ref: payload?.depositRef ?? null } } : undefined,
              },
            });
          }
        } catch (e) {
          // best-effort in environments with partial tx mocks
        }
      }

      // create or update receipt
      const receiptSerialCanonical =
        canonicalReceiptNumber(serial) ??
        canonicalReceiptNumber(orderUpsert.orderNumber) ??
        `ID:${orderUpsert.id}`;

      const computedBuyingTotal = totalBuying;
      const computedProfit = computedBuyingTotal > 0 ? total - computedBuyingTotal : 0;
      const receiptData = {
        orderId: orderUpsert.id,
        receiptNumber: receiptSerialCanonical,
        docType: docType as any,
        issuedById: issuedById ?? null,
        taxRate: payload?.taxRate ? String(payload.taxRate) : undefined,
        discount: payload?.discount ? String(payload.discount) : undefined,
        showTax: Boolean(payload?.showTax),
        showDiscount: Boolean(payload?.showDiscount),
        paymentDetailsShown: Boolean(payload?.paymentDetailsShown),
        notes: payload?.notes ?? null,
        warrantyText: payload?.warrantyText ?? null,
        totals: {
          subtotal,
          tax: taxAmount,
          total,
          balance,
          buyingTotal: computedBuyingTotal,
          profit: computedProfit,
          needsPricing: hasVariableCostItems,
        },
        data: {
          ...payload,
          orderRef: serial,
          needsPricing: hasVariableCostItems,
          totals: {
            subtotal,
            tax: taxAmount,
            total,
            balance,
            buyingTotal: computedBuyingTotal,
            profit: computedProfit,
            needsPricing: hasVariableCostItems,
          },
          attendantId,
          issuedById,
          items,
          buyingTotal: computedBuyingTotal,
          profit: computedProfit,
          ...(isPodDelivery
            ? {
                podDelivery: {
                  status: 'pending',
                  type: 'pay_on_delivery',
                  note: payload?.podDelivery?.note ?? null,
                  createdAt: entryDateIso,
                  createdById: issuedById ?? null,
                },
              }
            : {}),
        },
      } as any;

      // upsert receipt by orderId, or link to existing owner when requested
      let receipt;
      if (ownerToLink && ownerToLink.type === "pos" && ownerToLink.id) {
        // Link: update the existing POS receipt record with merged data and any linking metadata
        try {
          const existingPos = await tx.receipt.findUnique({ where: { id: ownerToLink.id } });
          if (existingPos) {
            const leftData = existingPos.data && typeof existingPos.data === "object" && !Array.isArray(existingPos.data)
              ? (existingPos.data as Record<string, any>)
              : {};
            const rightData = receiptData.data && typeof receiptData.data === "object" && !Array.isArray(receiptData.data)
              ? (receiptData.data as Record<string, any>)
              : {};
            const mergedData = { ...leftData, ...rightData };
            // attach linking hints if provided
            if (payload?.marketingEntryId) mergedData.marketingEntryId = payload.marketingEntryId;
            if (payload?.marketingReceiptId) mergedData.marketingReceiptId = payload.marketingReceiptId;
            if (payload?.supportEntryId) mergedData.supportEntryId = payload.supportEntryId;
            if (payload?.supportReceiptId) mergedData.supportReceiptId = payload.supportReceiptId;
            receipt = await tx.receipt.update({ where: { id: ownerToLink.id }, data: { ...receiptData, data: mergedData } });
          } else {
            receipt = await tx.receipt.create({ data: receiptData });
          }
        } catch (e) {
          // fallback to normal upsert behavior
          const existingReceipt = await tx.receipt.findUnique({ where: { orderId: orderUpsert.id } });
          if (existingReceipt) {
            receipt = await tx.receipt.update({ where: { id: existingReceipt.id }, data: receiptData });
          } else {
            receipt = await tx.receipt.create({ data: receiptData });
          }
        }
      } else {
        // normal upsert by orderId
        const existingReceipt = await tx.receipt.findUnique({ where: { orderId: orderUpsert.id } });
        if (existingReceipt) {
          receipt = await tx.receipt.update({ where: { id: existingReceipt.id }, data: receiptData });
        } else {
          receipt = await tx.receipt.create({ data: receiptData });
        }
      }

      // Seed CommissionEarning rows (pending) for this order's items; recompute jobs can overwrite
      if (createdOrderItems.length && attendantId && tx.commissionEarning && typeof tx.commissionEarning.createMany === 'function') {
        try {
          if (!isPodDelivery) {
            await tx.commissionEarning.createMany({
              data: createdOrderItems.map((it) => ({
                staffId: attendantId,
                orderItemId: it.id,
                basis: "gross",
                qty: it.quantity,
                amount: 0,
                status: docType === "LAYAWAY" ? "PENDING" : (total >= IMMEDIATE_THRESHOLD ? "RELEASED" : "PENDING"),
                calcDetail: { reason: "receipt_seed", total },
              })),
            });
          } else {
            // For POD receipts, seed earnings as PENDING so no immediate releases occur
            await tx.commissionEarning.createMany({
              data: createdOrderItems.map((it) => ({
                staffId: attendantId,
                orderItemId: it.id,
                basis: "gross",
                qty: it.quantity,
                amount: 0,
                status: "PENDING",
                calcDetail: { reason: "receipt_seed_pod", total },
              })),
            });
          }
        } catch (e) {
          // ignore if tx mock doesn't implement commissionEarning
        }
      }

      // Record support daily entry + receipt so support commission ledger can include this sale
      if (attendantId && !isPodDelivery) {
        const startOfDay = new Date(entryDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(entryDate);
        endOfDay.setHours(23, 59, 59, 999);

        // Support daily entry + receipts (idempotent upsert with deltas)
        if (tx.supportDailyEntry && tx.supportReceipt) {
          try {
            const existingEntry = await tx.supportDailyEntry.findFirst({
              where: { submittedById: attendantId, date: { gte: startOfDay, lte: endOfDay } },
              select: { id: true, totalSales: true, totalProfit: true },
            });

            const supportReceiptItems = createdItems.map((it) => ({
              productName: String(it.fullTitle || it.title || "Item").trim(),
              buyingPrice: it.variableCost
                ? null
                : Math.max(0, Math.round(Number(it.costPrice || 0) * Number(it.quantity || 1))),
            })).filter((item, index) => !createdItems[index]?.isDeliveryFee);
            const supportReceiptBuyingTotal = supportReceiptItems.reduce((sum, item) => sum + (item.buyingPrice || 0), 0);
            const supportSellingTotal = Math.round(Number(total) || 0);

            const normalizedSerial = canonicalReceiptNumber(serial);
            const receiptKey = buildReceiptKey(entryDate, normalizedSerial);
            const paymentMethod = parsePaymentMethod(payload?.paymentMethod, PaymentMethod);

            const entryId = existingEntry?.id ?? (
              await tx.supportDailyEntry.create({
                data: {
                  date: entryDate,
                  dayOfWeek,
                  totalSales: 0,
                  totalProfit: 0,
                  newBatteries: 0,
                  changedBatteries: 0,
                  submittedById: attendantId,
                },
                select: { id: true },
              })
            ).id;

            let deltaSales = supportSellingTotal;
            let deltaProfit = supportReceiptBuyingTotal > 0 ? supportSellingTotal - supportReceiptBuyingTotal : 0;

            if (receiptKey) {
              const prev = await tx.supportReceipt.findUnique({
                where: { receiptKey },
                select: { sellingTotal: true, buyingTotal: true },
              });

              const prevSelling = Number(prev?.sellingTotal ?? 0);
              const prevBuying = Number(prev?.buyingTotal ?? 0);

              deltaSales = supportSellingTotal - prevSelling;
              const prevProfit = prevBuying > 0 ? prevSelling - prevBuying : 0;
              const nextProfit = supportReceiptBuyingTotal > 0 ? supportSellingTotal - supportReceiptBuyingTotal : 0;
              deltaProfit = nextProfit - prevProfit;

              await tx.supportReceipt.upsert({
                where: { receiptKey },
                create: {
                  dailyEntryId: entryId,
                  receiptNumber: normalizedSerial || undefined,
                  receiptKey,
                  paymentMethod,
                  sellingTotal: supportSellingTotal,
                  buyingTotal: supportReceiptBuyingTotal,
                  items: supportReceiptItems.length ? { create: supportReceiptItems } : undefined,
                },
                update: {
                  paymentMethod,
                  sellingTotal: supportSellingTotal,
                  buyingTotal: supportReceiptBuyingTotal,
                  items: {
                    deleteMany: {},
                    ...(supportReceiptItems.length ? { create: supportReceiptItems } : {}),
                  },
                },
              });
            } else {
              await tx.supportReceipt.create({
                data: {
                  dailyEntryId: entryId,
                  receiptNumber: null,
                  receiptKey: null,
                  paymentMethod,
                  sellingTotal: supportSellingTotal,
                  buyingTotal: supportReceiptBuyingTotal,
                  items: supportReceiptItems.length ? { create: supportReceiptItems } : undefined,
                },
              });
            }

            if (deltaSales || deltaProfit) {
              await tx.supportDailyEntry.update({
                where: { id: entryId },
                data: { totalSales: { increment: deltaSales }, totalProfit: { increment: deltaProfit } },
              });
            }
          } catch (e) {
            // ignore support ledger errors in test mocks
          }
        }
      }

      if (attendantId && !isPodDelivery && tx.marketingDailyEntry && tx.marketingReceipt) {
        try {
          const marketingStart = new Date(entryDate);
          marketingStart.setHours(0, 0, 0, 0);
          const marketingEnd = new Date(entryDate);
          marketingEnd.setHours(23, 59, 59, 999);

          const normalizedSerial = canonicalReceiptNumber(serial);
          const receiptSellingTotal = Math.round(Number(total) || 0);
          const receiptItemsPayload = createdItems.map((it) => ({
            productName: String(it.fullTitle || it.title || "Item").trim(),
            buyingPrice: it.variableCost
              ? 0
              : Math.max(0, Math.round(Number(it.costPrice || 0) * Number(it.quantity || 1))),
          }));
          const receiptBuyingTotal = receiptItemsPayload.reduce((s, i) => s + i.buyingPrice, 0);
          const receiptKey = buildReceiptKey(entryDate, normalizedSerial);
          const paymentMethod = parsePaymentMethod(payload?.paymentMethod, PaymentMethod);

          let entry = await tx.marketingDailyEntry.findFirst({
            where: { submittedById: attendantId, date: { gte: marketingStart, lte: marketingEnd } },
          });

          const actorName = guard.user?.name ?? guard.user?.email ?? null;
          const actorEmail = guard.user?.email ?? null;

          if (!entry) {
            entry = await tx.marketingDailyEntry.create({
              data: {
                date: entryDate,
                dayOfWeek,
                submittedById: attendantId,
                submittedByName: actorName,
                submittedByEmail: actorEmail,
                totalSales: 0,
                totalProfit: 0,
              },
            });
          }

          let deltaSales = receiptSellingTotal;
          let deltaProfit = receiptBuyingTotal > 0 ? receiptSellingTotal - receiptBuyingTotal : 0;

          if (receiptKey) {
            const prev = await tx.marketingReceipt.findUnique({
              where: { receiptKey },
              select: { sellingTotal: true, buyingTotal: true },
            });

            const prevSelling = Number(prev?.sellingTotal ?? 0);
            const prevBuying = Number(prev?.buyingTotal ?? 0);

            deltaSales = receiptSellingTotal - prevSelling;
            const prevProfit = prevBuying > 0 ? prevSelling - prevBuying : 0;
            const nextProfit = receiptBuyingTotal > 0 ? receiptSellingTotal - receiptBuyingTotal : 0;
            deltaProfit = nextProfit - prevProfit;

            await tx.marketingReceipt.upsert({
              where: { receiptKey },
              create: {
                dailyEntryId: entry.id,
                receiptNumber: normalizedSerial || undefined,
                receiptKey,
                paymentMethod,
                sellingTotal: receiptSellingTotal,
                buyingTotal: receiptBuyingTotal,
                items: receiptItemsPayload.length ? { create: receiptItemsPayload } : undefined,
              },
              update: {
                paymentMethod,
                sellingTotal: receiptSellingTotal,
                buyingTotal: receiptBuyingTotal,
                items: {
                  deleteMany: {},
                  ...(receiptItemsPayload.length ? { create: receiptItemsPayload } : {}),
                },
              },
            });
          } else {
            await tx.marketingReceipt.create({
              data: {
                dailyEntryId: entry.id,
                receiptNumber: null,
                receiptKey: null,
                sellingTotal: receiptSellingTotal,
                buyingTotal: receiptBuyingTotal,
                paymentMethod,
                items: receiptItemsPayload.length ? { create: receiptItemsPayload } : undefined,
              },
            });
          }

          if ((deltaSales || deltaProfit) && entry.id) {
            await tx.marketingDailyEntry.update({
              where: { id: entry.id },
              data: { totalSales: { increment: deltaSales }, totalProfit: { increment: deltaProfit } },
            });
          }
        } catch (e) {
          console.error("[receipts] failed to update marketing entry", e);
        }
      }

      // create provisional commission record
      const provisional = await tx.commissionRecord.create({
        data: {
          orderId: orderUpsert.id,
          attendantId: attendantId ?? null,
          amount: null,
          status: "PENDING",
          data: { subtotal, tax: taxAmount, total, docType },
        },
      });

      // Preserve the existing gross-based commission seed behavior, then add POS product commissions.
      if (createdOrderItems.length && attendantId && tx.commissionEarning && typeof tx.commissionEarning.createMany === 'function') {
        try {
          if (!isPodDelivery) {
            const perItemEarnings = createdOrderItems.map((it) => {
              const gross = Number(it.sellingPrice || 0) * Number(it.quantity || 1);
              const status = docType === "LAYAWAY" ? "PENDING" : (total >= IMMEDIATE_THRESHOLD ? "RELEASED" : "PENDING");
              return { staffId: attendantId, orderItemId: it.id, basis: "gross", qty: it.quantity, amount: gross, status, calcDetail: { reason: "receipt_seed", total } };
            });
            await tx.commissionEarning.createMany({ data: perItemEarnings });

            // If immediate threshold hit, also release commission record now
            if (total >= IMMEDIATE_THRESHOLD && tx.commissionRecord) {
              try {
                await tx.commissionRecord.update({ where: { id: provisional.id }, data: { status: "RELEASED", amount: String(total), releasedAt: new Date() } });
              } catch (e) {
                // ignore in partial mocks
              }
            }
          } else {
            // For POD receipts, create per-item earnings but leave as PENDING (no immediate releases)
            const perItemEarnings = createdOrderItems.map((it) => {
              const gross = Number(it.sellingPrice || 0) * Number(it.quantity || 1);
              return { staffId: attendantId, orderItemId: it.id, basis: "gross", qty: it.quantity, amount: gross, status: "PENDING", calcDetail: { reason: "receipt_seed_pod", total } };
            });
            await tx.commissionEarning.createMany({ data: perItemEarnings });
          }

          const posProductEarnings = createdOrderItems
            .map((orderItem, index) => {
              const sourceItem = createdItems[index];
              const amount = Number(sourceItem?.commissionAmount || 0) * Number(orderItem.quantity || 1);
              if (!sourceItem?.commissionEnabled || amount <= 0) return null;
              const requiresAdminApproval = isPodDelivery || Boolean(sourceItem.commissionRequiresApproval);
              const status =
                requiresAdminApproval
                  ? "PENDING_APPROVAL"
                  : docType === "LAYAWAY"
                    ? "PENDING"
                    : "RELEASED";
              return {
                staffId: attendantId,
                orderItemId: orderItem.id,
                basis: "product_flat",
                qty: orderItem.quantity,
                amount,
                status,
                calcDetail: {
                  reason: "pos_product_commission",
                  productId: sourceItem.product.id,
                  productName: sourceItem.title,
                  orderNumber: serial,
                  receiptId: receipt.id,
                  requiresApproval: requiresAdminApproval,
                  unitCommission: Number(sourceItem.commissionAmount || 0),
                  customerType: payload?.customerType ?? null,
                },
              };
            })
            .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

          if (posProductEarnings.length) {
            await tx.commissionEarning.createMany({ data: posProductEarnings });
          }
        } catch (e) {
          // ignore commission earnings in partial tx mocks
        }
      }

      // If layaway is fully paid on creation, release pending commissions
      if (docType === "LAYAWAY" && balance <= 0 && attendantId) {
        await tx.commissionRecord.update({
          where: { id: provisional.id },
          data: { status: "RELEASED", amount: String(total), releasedAt: new Date() },
        });
        await tx.commissionEarning.updateMany({
          where: { orderItem: { orderId: orderUpsert.id }, status: "PENDING" },
          data: { status: "RELEASED" },
        });
      }

      // Optionally release immediately if threshold met (skip for POD receipts).
      // This must never block receipt persistence: if commission release bookkeeping fails,
      // keep the receipt and log the failure for follow-up repair.
      if (!isPodDelivery && Number(total) >= IMMEDIATE_THRESHOLD && attendantId) {
        try {
          console.info("[receipts] immediate threshold branch start", {
            orderNumber: orderUpsert.orderNumber,
            receiptId: receipt?.id ?? null,
            attendantId,
            total,
            threshold: IMMEDIATE_THRESHOLD,
          });
          const { period, tiers } = await getOrCreateCommissionPeriod(new Date());
          const totalsAgg = await tx.order.aggregate({
            where: { attendantId, createdAt: { gte: period.startDate, lte: period.endDate }, status: "COMPLETED" },
            _sum: { totalAmount: true, paidAmount: true },
          });
          const totalSales = Number(totalsAgg._sum.totalAmount ?? 0);
          const totalProfit = totalSales; // fallback; real profit calc omitted here
          const salesCommission = computeSalesCommissionFromTiers(totalSales, totalProfit, tiers as any);
          console.info("[receipts] immediate threshold commission computed", {
            orderNumber: orderUpsert.orderNumber,
            receiptId: receipt?.id ?? null,
            attendantId,
            totalSales,
            totalProfit,
            salesCommission,
            periodId: period.id,
          });
          await tx.commissionRecord.update({
            where: { id: provisional.id },
            data: { amount: String(salesCommission), status: "RELEASED", releasedAt: new Date(), periodId: period.id },
          });
          // Upsert attendant balance to reflect immediate release
          if (attendantId && tx.balance) {
            try {
              await tx.balance.upsert({
                where: { userId: attendantId },
                create: { userId: attendantId, available: Number(salesCommission), pending: 0 },
                update: { available: { increment: Number(salesCommission) } as any },
              });
            } catch (e) {
              console.error("[receipts] failed to upsert balance during immediate threshold release", {
                attendantId,
                salesCommission,
                error: e instanceof Error ? e.message : String(e),
              });
            }
          }

          // Create a CommissionLedger entry for audit (best-effort)
          if (tx.commissionLedger) {
            try {
              await tx.commissionLedger.upsert({
                where: {
                  userId_periodStart_periodEnd: {
                    userId: attendantId,
                    periodStart: period.startDate,
                    periodEnd: period.endDate,
                  },
                },
                create: {
                  userId: attendantId,
                  periodStart: period.startDate,
                  periodEnd: period.endDate,
                  grossCommission: Number(salesCommission),
                  penalties: 0,
                  netCommission: Number(salesCommission),
                  commissionTotal: Number(salesCommission),
                  detail: { reason: "Immediate release on threshold" },
                },
                update: {
                  grossCommission: Number(salesCommission),
                  netCommission: Number(salesCommission),
                  commissionTotal: Number(salesCommission),
                  detail: { reason: "Immediate release on threshold" },
                },
              });
            } catch (e) {
              console.error("[receipts] failed to create CommissionLedger entry during immediate threshold release", {
                attendantId,
                periodStart: period.startDate,
                periodEnd: period.endDate,
                salesCommission,
                error: e instanceof Error ? e.message : String(e),
              });
            }
          }
        } catch (thresholdErr) {
          console.error("[receipts] immediate threshold release failed but receipt will still be saved", {
            orderNumber: orderUpsert.orderNumber,
            receiptId: receipt?.id ?? null,
            attendantId,
            total,
            threshold: IMMEDIATE_THRESHOLD,
            error: thresholdErr instanceof Error ? thresholdErr.message : String(thresholdErr),
            stack: thresholdErr instanceof Error ? thresholdErr.stack : undefined,
          });
        }
      }

            try {
              console.info('[receipts] created order/receipt', {
                orderNumber: orderUpsert.orderNumber,
                orderAttendantId: orderUpsert.attendantId ?? null,
                receiptId: receipt?.id ?? null,
                receiptDataAttendantId: (receipt && receipt.data && receipt.data.attendantId) ? receipt.data.attendantId : null,
              });
            } catch (e) {
              // ignore
            }

      if (payload?.websiteOrderId && (tx as any).websiteOrder) {
        try {
          const existingWebsiteOrder = await (tx as any).websiteOrder.findUnique({
            where: { id: String(payload.websiteOrderId) },
            select: { metadata: true },
          });
          const existingMetadata =
            existingWebsiteOrder?.metadata && typeof existingWebsiteOrder.metadata === "object"
              ? (existingWebsiteOrder.metadata as Record<string, unknown>)
              : {};
          await (tx as any).websiteOrder.update({
            where: { id: String(payload.websiteOrderId) },
            data: {
              receiptId: receipt.id,
              metadata: {
                ...existingMetadata,
                ...(payload?.metadata && typeof payload.metadata === "object" ? payload.metadata : {}),
                linkedReceiptId: receipt.id,
                linkedReceiptNumber: receiptData.receiptNumber,
                linkedAt: new Date().toISOString(),
              },
            },
          });
        } catch (websiteOrderLinkErr) {
          console.error("[receipts] failed to link website order to receipt", websiteOrderLinkErr);
        }
      }

      return { orderRef: orderUpsert.orderNumber, receiptId: receipt.id };
    });

    waitForReceiptById<{
      id: string;
      orderId: string;
      receiptNumber: string | null;
    }>({
      receiptId: result.receiptId,
      orderRef: result.orderRef,
      loggerPrefix: "[receipts] post-save verification",
      select: { id: true, orderId: true, receiptNumber: true },
    })
      .then((verifiedReceipt) => {
        if (!verifiedReceipt) {
          console.warn("[receipts] post-save verification miss", {
            requestId,
            receiptId: result.receiptId,
            orderRef: result.orderRef,
            serial: serial ?? null,
          });
          return;
        }
        console.info("[receipts] post-save verification passed", {
          requestId,
          receiptId: verifiedReceipt.id,
          orderId: verifiedReceipt.orderId,
          receiptNumber: verifiedReceipt.receiptNumber ?? null,
          orderRef: result.orderRef,
        });
      })
      .catch((verifyErr) => {
        console.warn("[receipts] post-save verification failed", {
          requestId,
          receiptId: result.receiptId,
          error: verifyErr instanceof Error ? verifyErr.message : String(verifyErr),
        });
      });

    await waitForReceiptById({
      receiptId: result.receiptId,
      orderRef: result.orderRef,
      loggerPrefix: "[receipts] pre-send readiness",
      select: { id: true },
    });

    try {
      const customerAccountSync = await syncPosReceiptToCustomerAccount(result.receiptId);
      console.info("[receipts] synced POS receipt to customer account", {
        requestId,
        receiptId: result.receiptId,
        orderRef: result.orderRef,
        customerAccountSync,
      });
    } catch (customerSyncErr) {
      console.error("[receipts] failed to sync POS receipt to customer account", {
        requestId,
        receiptId: result.receiptId,
        orderRef: result.orderRef,
        error: customerSyncErr instanceof Error ? customerSyncErr.message : String(customerSyncErr),
      });
    }

    // Recompute support commission ledger after committing the transaction
    if (attendantId) {
      try {
        const period = getTradingPeriodFor(payload?.date ? new Date(payload.date) : new Date());
        await recomputeSupportCommissionLedger({ userId: attendantId, period });
      } catch (ledgerErr) {
        console.error("[receipts] failed to recompute support commission ledger", ledgerErr);
      }
    }

    // notify SSE subscribers about the new receipt so streams can push immediate updates
    try {
      publishSummaryUpdate({ attendantId: attendantId ?? null, receiptId: result.receiptId, timestamp: new Date().toISOString() });
    } catch (err) {
      console.warn("[receipts] failed to publish summary update", err);
    }
 
    let sendResult: any = null;
    if (!isPodDelivery) {
      const internalPromise = (async () => {
        try {
          await notifyInternalReceipt(result.receiptId, docType, requestId);
        } catch (internalErr) {
          console.error("[receipts] failed to notify internal ops", internalErr);
        }
      })();

      console.info(`[receiptSender][${requestId}] START send pipeline`);
      try {
        sendResult = await sendReceiptChannels(result.receiptId, [], { requestId });
        console.info(`[receiptSender][${requestId}] SEND:ok`, {
          channelStatus: sendResult.channelStatus,
        });
      } catch (sendErr) {
        console.error(`[receiptSender][${requestId}] SEND:error`, sendErr);
        sendResult = {
          ok: false,
          sent: [],
          errors: [{ channel: 'send', error: String(sendErr) }],
          channelStatus: {},
        };
      }
 
      // Ensure internal admin notification completes within the request lifecycle
      // (important for serverless runtimes).
      await internalPromise;
    } else {
      // For POD receipts, still trigger an immediate WhatsApp via Chatrace at
      // creation time (whatsapp-only). This sends using the POD dispatch tag and
      // skips default tags so downstream routing can treat it as a POD event.
      console.info(`[receiptSender][${requestId}] START send pipeline (pod_delivery)`);
      try {
        sendResult = await sendReceiptChannels(result.receiptId, ['whatsapp', 'email', 'sms'], {
          requestId,
          chatraceTag: (process.env.CHATRACE_POD_CUSTOMER_TAG || 'pod_dispatch_speedaf').trim(),
          skipDefaultChatraceTags: true,
          markPodSent: true,
        });
        console.info(`[receiptSender][${requestId}] SEND:ok`, { channelStatus: sendResult.channelStatus });
      } catch (sendErr) {
        console.error(`[receiptSender][${requestId}] SEND:error (pod)`, sendErr);
        sendResult = {
          ok: false,
          sent: [],
          errors: [{ channel: 'send', error: String(sendErr) }],
          channelStatus: {},
        };
      }

      // IMPORTANT: For POD receipts, do not send the "normal" internal admin receipt notification.
      // POD has dedicated internal flows (admin + follow-up) handled below.

      // Additional POD-specific internal notifications (admin + follow-up responsible).
      try {
        await notifyInternalPodAlerts(result.receiptId, { requestId });
      } catch (e) {
        console.error("[receipts] failed to send POD internal alerts", e);
      }
    }

    return NextResponse.json({ ok: true, ...result, send: sendResult });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    try {
      console.error('[receipts.POST] unexpected error', err);
    } catch (e) {
      // ignore logging failures
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

