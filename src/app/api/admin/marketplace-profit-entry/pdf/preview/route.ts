import { NextRequest, NextResponse } from "next/server";
import { Platform, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRoleOrBenjamin } from "@/lib/api";
import { aggregateMarketplaceStatementRows } from "@/lib/marketplaceStatementCsv";
import { filterOrdersToCurrentWeek, parseKilimallReceiptPdf } from "@/lib/kilimallReceiptPdf";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { upsertManualWeeklySale } from "@/lib/manualWeeklySaleUpsert";
import { createHash } from "node:crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s._-]+/gu, "");
}

function normalizeSku(value: unknown): string {
  return normalizeText(value).replace(/\s+/g, "");
}

function moneyKey(value: number): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0.00";
  return n.toFixed(2);
}

async function resolveAccountAndShopId(inputId: string) {
  const asAccount = await prisma.marketplaceAccount.findUnique({
    where: { id: inputId },
    select: { id: true, platform: true, displayName: true, isActive: true, jumiaShopSid: true, kilimallShopCode: true },
  });
  if (asAccount) {
    const key = String(asAccount.jumiaShopSid ?? asAccount.kilimallShopCode ?? "").trim();
    const name = String(asAccount.displayName ?? "").trim();
    const shop =
      (key
        ? await prisma.shop.findFirst({
            where: { platform: asAccount.platform as any, apiConfig: { is: { apiKey: key } } as any },
            select: { id: true },
          })
        : null) ??
      (name
        ? await prisma.shop.findFirst({
            where: { platform: asAccount.platform as any, name: { equals: name, mode: "insensitive" } as any },
            select: { id: true },
          })
        : null);
    return { account: asAccount, shopId: shop?.id ?? inputId };
  }

  const shop = await prisma.shop.findUnique({
    where: { id: inputId },
    select: { id: true, name: true, platform: true, apiConfig: { select: { apiKey: true } } },
  });
  if (!shop) return { account: null as any, shopId: null as any };

  const apiKey = (shop as any).apiConfig?.apiKey ? String((shop as any).apiConfig.apiKey) : null;
  const name = shop.name?.trim() ?? "";

  const account =
    (apiKey
      ? await prisma.marketplaceAccount.findFirst({
          where: {
            isActive: true,
            platform: shop.platform as any,
            OR: [{ jumiaShopSid: apiKey }, { kilimallShopCode: apiKey }],
          },
          select: { id: true, platform: true, displayName: true, isActive: true, jumiaShopSid: true, kilimallShopCode: true },
        })
      : null) ??
    (name
      ? await prisma.marketplaceAccount.findFirst({
          where: { isActive: true, platform: shop.platform as any, displayName: { equals: name, mode: "insensitive" } as any },
          select: { id: true, platform: true, displayName: true, isActive: true, jumiaShopSid: true, kilimallShopCode: true },
        })
      : null);

  return { account, shopId: shop.id };
}

export async function POST(req: NextRequest) {
  const auth = await requireRoleOrBenjamin(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const actorId = (auth.session?.user as { id?: string } | undefined)?.id;
  if (!actorId) return NextResponse.json({ error: "Missing actor id" }, { status: 401 });

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Invalid form data" }, { status: 400 });

  const accountId = String(form.get("accountId") ?? "").trim();
  const userIdRaw = String(form.get("userId") ?? "").trim();
  const file = form.get("file");

  if (!accountId) return NextResponse.json({ error: "accountId is required" }, { status: 400 });
  if (!file || typeof file !== "object" || !("arrayBuffer" in (file as any))) {
    return NextResponse.json({ error: "PDF file is required" }, { status: 400 });
  }

  const resolved = await resolveAccountAndShopId(accountId);
  const account = resolved.account;
  if (!account) {
    return NextResponse.json(
      { error: "Shop account not found. Select a marketplace shop that has Kilimall code configured." },
      { status: 404 },
    );
  }
  if (!account.isActive) return NextResponse.json({ error: "Shop account is inactive" }, { status: 400 });
  if (account.platform !== "KILIMALL") return NextResponse.json({ error: "This upload is only for Kilimall accounts" }, { status: 400 });

  const buf = Buffer.from(await (file as File).arrayBuffer());
  const hash = createHash("sha1").update(buf).digest("hex").slice(0, 12);

  const { orders } = await parseKilimallReceiptPdf(buf);
  const { weekStart, weekEnd, inWeek, excluded } = filterOrdersToCurrentWeek(orders, new Date());
  const weekKey = weekStart.toISOString().slice(0, 10);
  const draftKey = `pdf:${resolved.shopId}:${weekKey}:${hash}`;
  const periodKey = getTradingPeriodFor(weekStart).key;

  let draftTableAvailable = true;
  try {
    const existingDraft = await prisma.marketplaceStatementDraft.findUnique({
      where: { draftKey },
      select: { id: true },
    });
    if (existingDraft) {
      return NextResponse.json({
        alreadyUploaded: true,
        account: { id: account.id, displayName: account.displayName, platform: account.platform as Platform },
        resolvedShopId: resolved.shopId,
        draftId: existingDraft.id,
        week: { weekStart: weekStart.toISOString(), weekEnd: weekEnd.toISOString() },
        excluded,
      });
    }
  } catch (err: any) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2021") {
      draftTableAvailable = false;
    } else {
      throw err;
    }
  }

  // Convert to the same aggregate row structure used by the existing statement tools.
  const statementRows = inWeek.map((o) => ({
    transactionDate: o.orderDate.toISOString(),
    // Reuse Jumia-style aggregator by treating payable amount as the "credit" line.
    transactionType: "Item Price Credit",
    transactionNumber: o.orderNo,
    transactionState: "APPROVED",
    details: [o.productName, o.specification].filter(Boolean).join(" "),
    sellerSku: o.productId ?? "",
    jumiaSku: "",
    amount: o.payableAmount,
    statementStartDate: weekStart.toISOString(),
    statementEndDate: weekEnd.toISOString(),
    paidStatus: "",
    orderNo: o.orderNo,
    orderItemNo: "",
    orderItemStatus: "",
    shippingProvider: "",
    trackingNumber: o.trackingNo ?? "",
    comment: "",
    localExchangeRate: "",
    countryCode: "KE",
    statementNumber: "",
  }));

  // Reuse aggregator to produce rows with gross/fees/net.
  const aggregated = aggregateMarketplaceStatementRows({
    rows: statementRows as any[],
    weekStartUtc: weekStart,
    weekEndUtc: weekEnd,
  });

  const totals = aggregated.aggregates.reduce(
    (acc, row) => {
      acc.netPayout += row.netPayout;
      acc.grossSale += row.grossSale;
      return acc;
    },
    { netPayout: 0, grossSale: 0 },
  );

  // Prefill buying prices from recent matching productId/name/price.
  const suggestedBuyingByTxn: Record<string, number> = {};
  try {
    const skus = Array.from(
      new Set(
        aggregated.aggregates
          .map((r) => String(r.sellerSku || "").trim())
          .filter(Boolean)
          .slice(0, 2000),
      ),
    );
    if (skus.length) {
      const since = new Date();
      since.setDate(since.getDate() - 180);
      const recent = await (prisma as any).marketplaceProfitEntry.findMany({
        where: { platform: account.platform as any, sku: { in: skus }, date: { gte: since } },
        select: { accountId: true, sku: true, productName: true, itemCreditAmount: true, buyingPrice: true, date: true, createdAt: true },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: 2000,
      });

      const keyForEntry = (e: any) => {
        const skuNorm = normalizeSku(e?.sku);
        const nameNorm = normalizeText(e?.productName);
        const price = moneyKey(Number(e?.itemCreditAmount ?? 0));
        return `${skuNorm}|${nameNorm}|${price}`;
      };

      const bestSameAccount = new Map<string, { buyingPrice: number; ts: number }>();
      const bestAny = new Map<string, { buyingPrice: number; ts: number }>();
      for (const e of recent as any[]) {
        const key = keyForEntry(e);
        if (!key || key.startsWith("|")) continue;
        const buying = Number(e?.buyingPrice ?? 0);
        if (!Number.isFinite(buying) || buying <= 0) continue;
        const ts = new Date(e?.date ?? e?.createdAt ?? 0).getTime();
        if (e?.accountId === account.id) {
          if (!bestSameAccount.has(key) || (bestSameAccount.get(key)?.ts ?? 0) < ts) {
            bestSameAccount.set(key, { buyingPrice: buying, ts });
          }
        }
        if (!bestAny.has(key) || (bestAny.get(key)?.ts ?? 0) < ts) {
          bestAny.set(key, { buyingPrice: buying, ts });
        }
      }

      for (const r of aggregated.aggregates) {
        const sku = normalizeSku(r.sellerSku || "");
        const name = normalizeText(r.details || "");
        const price = moneyKey(Number(r.grossSale ?? 0));
        const key = `${sku}|${name}|${price}`;
        const match = bestSameAccount.get(key) ?? bestAny.get(key) ?? null;
        if (match && r.itemCreditTxn) {
          suggestedBuyingByTxn[r.itemCreditTxn] = match.buyingPrice;
        }
      }
    }
  } catch (err) {
    console.error("[pdf-preview] buying prefill failed", err);
  }

  const itemTxns = aggregated.aggregates.map((a) => a.itemCreditTxn).filter(Boolean);
  const existing = itemTxns.length
    ? await (prisma as any).marketplaceProfitEntry.findMany({
        where: { accountId: account.id, itemCreditTxn: { in: itemTxns } },
        select: { itemCreditTxn: true },
        take: 500,
      })
    : [];
  const existingTxns = existing.map((r: any) => String(r.itemCreditTxn));

  const rowPayload = aggregated.aggregates.map((r) => ({
    key: r.key,
    dateUtc: r.dateUtc.toISOString(),
    orderNo: r.orderNo,
    orderItemNo: r.orderItemNo,
    details: r.details,
    sellerSku: r.sellerSku,
    jumiaSku: r.jumiaSku,
    itemCreditTxn: r.itemCreditTxn,
    commissionTxn: r.commissionTxn,
    shippingTxn: r.shippingTxn,
    otherTxn: r.otherTxn,
    grossSale: r.grossSale,
    commission: r.commission,
    shippingFee: r.shippingFee,
    otherFees: r.otherFees,
    netPayout: r.netPayout,
    statementNumber: r.statementNumber,
    paidStatus: r.paidStatus,
    orderItemStatus: r.orderItemStatus,
    shippingProvider: r.shippingProvider,
    trackingNumber: r.trackingNumber,
    countryCode: r.countryCode,
  }));

  let draftId: string | null = null;
  if (draftTableAvailable) {
    try {
      const draft = await prisma.marketplaceStatementDraft.create({
        data: {
          draftKey,
          platform: account.platform as Platform,
          shopId: resolved.shopId,
          accountId: account.id,
          weekStart,
          weekEnd,
          periodKey,
          statementNumber: null,
          fileName: (file as File).name || null,
          rowCount: aggregated.aggregates.length,
          totalNetPayout: totals.netPayout,
          rows: rowPayload as any,
          buyingByTxn: suggestedBuyingByTxn as any,
          submittedByTxn: {},
          createdById: actorId,
        },
        select: { id: true },
      });
      draftId = draft.id;
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2021") {
        draftTableAvailable = false;
      } else {
        throw err;
      }
    }
  }

  // Mirror WeeklySale immediately for quick stats/manual weekly pages.
  try {
    let effectiveUserId = userIdRaw ? userIdRaw : null;
    if (!effectiveUserId) {
      const primary = await prisma.marketplaceAccountAssignment.findFirst({
        where: { accountId: account.id, endsAt: null },
        orderBy: { startsAt: "desc" },
        select: { attendantId: true },
      });
      effectiveUserId = primary?.attendantId ?? null;
    }
    await upsertManualWeeklySale({
      shopId: resolved.shopId,
      weekStart,
      weekEnd,
      amount: totals.netPayout,
      userId: effectiveUserId,
      actorId,
    });
  } catch (err) {
    console.error("[pdf-preview] weekly sale upsert failed", err);
  }

  return NextResponse.json({
    account: { id: account.id, displayName: account.displayName, platform: account.platform as Platform },
    resolvedShopId: resolved.shopId,
    draftId,
    week: { weekStart: weekStart.toISOString(), weekEnd: weekEnd.toISOString() },
    existingTxns,
    suggestedBuyingByTxn,
    totals,
    items: aggregated.aggregates,
    excluded,
    draftTableAvailable,
  });
}
