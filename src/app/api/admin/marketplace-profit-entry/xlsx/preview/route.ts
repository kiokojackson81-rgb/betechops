import { NextRequest, NextResponse } from "next/server";
import { Platform, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRoleOrBenjamin } from "@/lib/api";
import { mondayToSundayNairobiWindow } from "@/lib/weekWindow";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { upsertManualWeeklySale } from "@/lib/manualWeeklySaleUpsert";
import { parseKilimallOrdersXlsx, filterOrdersToCurrentWeek } from "@/lib/kilimallOrdersXlsx";
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
    return NextResponse.json({ error: "XLSX file is required" }, { status: 400 });
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
  const { orders, headers } = parseKilimallOrdersXlsx(buf);
  if (!orders.length) {
    return NextResponse.json(
      {
        error:
          "No orders detected in this XLSX. Ensure it includes columns like Order No, Order Date, Product ID, Product Name, and Payable amount.",
        headers,
      },
      { status: 400 },
    );
  }

  const { weekStart, weekEnd, inWeek, excluded } = filterOrdersToCurrentWeek(orders, new Date());
  const weekKey = weekStart.toISOString().slice(0, 10);

  // Stable content hash (prevents duplication even if the file bytes differ).
  const contentHash = createHash("sha1")
    .update(
      inWeek
        .map((o) => `${o.orderNo}|${o.orderDate.toISOString()}|${o.payableAmount}|${o.productId ?? ""}|${o.productName ?? ""}`)
        .sort()
        .join("\n"),
    )
    .digest("hex")
    .slice(0, 12);
  const draftKey = `xlsx:${resolved.shopId}:${weekKey}:${contentHash}`;
  const periodKey = getTradingPeriodFor(weekStart).key;

  // Suggested buying prices from recent matches (productId/name/price).
  const suggestedBuyingByTxn: Record<string, number> = {};
  try {
    const skus = Array.from(new Set(inWeek.map((o) => String(o.productId ?? "").trim()).filter(Boolean).slice(0, 2000)));
    if (skus.length) {
      const since = new Date();
      since.setDate(since.getDate() - 180);
      const recent = await (prisma as any).marketplaceProfitEntry.findMany({
        where: { platform: account.platform as any, sku: { in: skus }, date: { gte: since } },
        select: { accountId: true, sku: true, productName: true, itemCreditAmount: true, buyingPrice: true, date: true, createdAt: true },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: 2000,
      });

      const keyForEntry = (e: any) => `${normalizeSku(e?.sku)}|${normalizeText(e?.productName)}|${moneyKey(Number(e?.itemCreditAmount ?? 0))}`;

      const bestSameAccount = new Map<string, { buyingPrice: number; ts: number }>();
      const bestAny = new Map<string, { buyingPrice: number; ts: number }>();
      for (const e of recent as any[]) {
        const key = keyForEntry(e);
        if (!key || key.startsWith("|")) continue;
        const buying = Number(e?.buyingPrice ?? 0);
        if (!Number.isFinite(buying) || buying <= 0) continue;
        const ts = new Date(e?.date ?? e?.createdAt ?? 0).getTime();
        if (e?.accountId === account.id) {
          if (!bestSameAccount.has(key) || (bestSameAccount.get(key)?.ts ?? 0) < ts) bestSameAccount.set(key, { buyingPrice: buying, ts });
        }
        if (!bestAny.has(key) || (bestAny.get(key)?.ts ?? 0) < ts) bestAny.set(key, { buyingPrice: buying, ts });
      }

      for (const o of inWeek) {
        const key = `${normalizeSku(o.productId)}|${normalizeText(o.productName)}|${moneyKey(Number(o.payableAmount ?? 0))}`;
        const match = bestSameAccount.get(key) ?? bestAny.get(key) ?? null;
        if (match) suggestedBuyingByTxn[o.orderNo] = match.buyingPrice;
      }
    }
  } catch (err) {
    console.error("[xlsx-preview] buying prefill failed", err);
  }

  // Existing profit entries by orderNo (unique number).
  const existing = inWeek.length
    ? await (prisma as any).marketplaceProfitEntry.findMany({
        where: { accountId: account.id, itemCreditTxn: { in: inWeek.map((o) => o.orderNo) } },
        select: { itemCreditTxn: true },
        take: 500,
      })
    : [];
  const existingTxns = existing.map((r: any) => String(r.itemCreditTxn));

  const items = inWeek.map((o) => ({
    key: `kilimall:${o.orderNo}`,
    dateUtc: o.orderDate.toISOString(),
    orderNo: o.orderNo,
    orderItemNo: "",
    details: o.productName ?? "",
    sellerSku: o.productId ?? "",
    jumiaSku: "",
    itemCreditTxn: o.orderNo,
    commissionTxn: null,
    shippingTxn: null,
    otherTxn: [],
    grossSale: Number(o.payableAmount ?? 0),
    commission: 0,
    shippingFee: 0,
    otherFees: 0,
    netPayout: Number(o.payableAmount ?? 0),
    statementNumber: "",
    paidStatus: "",
    orderItemStatus: "",
    shippingProvider: "",
    trackingNumber: o.trackingNo ?? "",
    countryCode: "KE",
  }));

  const totals = items.reduce(
    (acc, r) => {
      acc.netPayout += Number(r.netPayout ?? 0);
      acc.grossSale += Number(r.grossSale ?? 0);
      return acc;
    },
    { netPayout: 0, grossSale: 0 },
  );

  // Persist draft if table exists (optional).
  let draftId: string | null = null;
  let draftTableAvailable = true;
  try {
    const existingDraft = await prisma.marketplaceStatementDraft.findUnique({ where: { draftKey }, select: { id: true } });
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
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2021") draftTableAvailable = false;
    else throw err;
  }

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
          rowCount: items.length,
          totalNetPayout: totals.netPayout,
          rows: items as any,
          buyingByTxn: suggestedBuyingByTxn as any,
          submittedByTxn: {},
          createdById: actorId,
        },
        select: { id: true },
      });
      draftId = draft.id;
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2021") draftTableAvailable = false;
      else throw err;
    }
  }

  // WeeklySale mirror for stats/manual-weekly.
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
    console.error("[xlsx-preview] weekly sale upsert failed", err);
  }

  return NextResponse.json({
    account: { id: account.id, displayName: account.displayName, platform: account.platform as Platform },
    resolvedShopId: resolved.shopId,
    draftId,
    week: { weekStart: weekStart.toISOString(), weekEnd: weekEnd.toISOString() },
    existingTxns,
    suggestedBuyingByTxn,
    totals,
    items,
    excluded,
    draftTableAvailable,
  });
}

