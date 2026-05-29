import { NextRequest, NextResponse } from "next/server";
import { Platform, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRoleOrBenjamin } from "@/lib/api";
import { normalizeWeekStartFromParam } from "@/lib/weekWindow";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { upsertManualWeeklySale } from "@/lib/manualWeeklySaleUpsert";
import { maybeAutoSendDividedWhatsappReport } from "@/lib/dividedWhatsapp";
import { maybeAutoSendPricingWeekWhatsapp } from "@/lib/pricingWeekWhatsapp";
import { parseKilimallOrdersXlsx, filterOrdersToLastFullWeek, filterOrdersToWeekStart } from "@/lib/kilimallOrdersXlsx";
import { isMarketplaceStatementDraftTableAvailable } from "@/lib/statementDraftTable";
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
  const weekStartParam = String(form.get("weekStart") ?? "").trim();
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
        error: `No orders detected in this XLSX. Detected columns: ${headers.slice(0, 12).join(", ")}${headers.length > 12 ? "..." : ""}`,
        headers,
      },
      { status: 400 },
    );
  }

  const selectedWeekStart = normalizeWeekStartFromParam(weekStartParam);
  if (weekStartParam && !selectedWeekStart) {
    return NextResponse.json({ error: "Invalid weekStart" }, { status: 400 });
  }

  // Use selected week when provided; otherwise use most recent completed Mon–Sun week.
  const { weekStart, weekEnd, inWeek, excluded } = selectedWeekStart
    ? filterOrdersToWeekStart(orders, selectedWeekStart)
    : filterOrdersToLastFullWeek(orders, new Date());
  const weekKey = weekStart.toISOString().slice(0, 10);

  const txnFor = (o: any) => {
    const orderNo = String(o?.orderNo ?? "").trim();
    const sku = String(o?.productId ?? "").trim();
    return sku ? `${orderNo}:${sku}` : orderNo;
  };

  // Stable content hash (prevents duplication even if the file bytes differ).
  const contentHash = createHash("sha1")
    .update(
      inWeek
        .map((o) => `${txnFor(o)}|${o.orderDate.toISOString()}|${o.payableAmount}|${o.productName ?? ""}`)
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

      // Fallback memory: reusable pricing templates survive statement deletes.
      const templateByKey = new Map<string, number>();
      const normalizedNames = Array.from(new Set(inWeek.map((o) => normalizeText(o.productName)).filter(Boolean)));
      if (normalizedNames.length) {
        const templates = await prisma.marketplacePricingTemplate.findMany({
          where: { platform: account.platform as any, normalizedProductName: { in: normalizedNames } },
          select: { normalizedProductName: true, sellingPrice: true, defaultBuyingPrice: true, updatedAt: true },
          orderBy: { updatedAt: "desc" },
          take: 5000,
        });
        for (const t of templates) {
          const key = `${normalizeText(t.normalizedProductName)}|${moneyKey(Number(t.sellingPrice ?? 0))}`;
          if (!templateByKey.has(key)) templateByKey.set(key, Number(t.defaultBuyingPrice ?? 0));
        }
      }

      for (const o of inWeek) {
        const key = `${normalizeSku(o.productId)}|${normalizeText(o.productName)}|${moneyKey(Number(o.payableAmount ?? 0))}`;
        const match =
          bestSameAccount.get(key) ??
          bestAny.get(key) ??
          (() => {
            const t = templateByKey.get(`${normalizeText(o.productName)}|${moneyKey(Number(o.payableAmount ?? 0))}`);
            return typeof t === "number" && Number.isFinite(t) && t > 0 ? { buyingPrice: t, ts: 0 } : null;
          })();
        if (match) suggestedBuyingByTxn[txnFor(o)] = match.buyingPrice;
      }
    }
  } catch (err) {
    console.error("[xlsx-preview] buying prefill failed", err);
  }

  // Existing profit entries by orderNo (unique number).
  const existing = inWeek.length
    ? await (prisma as any).marketplaceProfitEntry.findMany({
        where: { accountId: account.id, itemCreditTxn: { in: inWeek.map((o) => txnFor(o)) } },
        select: { itemCreditTxn: true },
        take: 500,
      })
    : [];
  const existingTxns = existing.map((r: any) => String(r.itemCreditTxn));

  const items = inWeek.map((o) => ({
    key: `kilimall:${txnFor(o)}`,
    dateUtc: o.orderDate.toISOString(),
    orderNo: o.orderNo,
    orderItemNo: "",
    details: o.productName ?? "",
    sellerSku: o.productId ?? "",
    jumiaSku: "",
    itemCreditTxn: txnFor(o),
    commissionTxn: null,
    shippingTxn: null,
    otherTxn: [],
    grossSale: Number(o.productAmount ?? o.payableAmount ?? 0),
    commission: Number(o.commissionAmount ?? 0),
    shippingFee: 0,
    // Returns/refunds: if qty is negative or settlement is negative, treat payout as 0 (but keep negative economics in otherFees).
    otherFees:
      (Number(o.qty ?? 0) < 0 || Number(o.settlementAmount ?? 0) < 0 || Number(o.payableAmount ?? 0) < 0) &&
      Number(o.settlementAmount ?? o.payableAmount ?? 0)
        ? Number(o.settlementAmount ?? o.payableAmount ?? 0)
        : 0,
    netPayout:
      Number(o.qty ?? 0) < 0 || Number(o.settlementAmount ?? 0) < 0 || Number(o.payableAmount ?? 0) < 0
        ? 0
        : Number(o.settlementAmount ?? o.payableAmount ?? 0),
    statementNumber: "",
    paidStatus: "",
    orderItemStatus:
      Number(o.qty ?? 0) < 0 || Number(o.settlementAmount ?? 0) < 0 || Number(o.payableAmount ?? 0) < 0 ? "RETURN" : "",
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
  let draftTableAvailable = await isMarketplaceStatementDraftTableAvailable();

  if (draftTableAvailable) {
    try {
      const existingDraft = await prisma.marketplaceStatementDraft.findUnique({ where: { draftKey }, select: { id: true } });
      if (existingDraft) {
        const fullDraft = await prisma.marketplaceStatementDraft.findUnique({
          where: { id: existingDraft.id },
          select: { id: true, buyingByTxn: true },
        });
        const existingBuying =
          fullDraft?.buyingByTxn && typeof fullDraft.buyingByTxn === "object" && !Array.isArray(fullDraft.buyingByTxn)
            ? (fullDraft.buyingByTxn as Record<string, any>)
            : {};
        const mergedBuying: Record<string, any> = { ...suggestedBuyingByTxn };
        for (const [k, v] of Object.entries(existingBuying)) mergedBuying[k] = v;

        await prisma.marketplaceStatementDraft.update({
          where: { id: existingDraft.id },
          data: {
            rowCount: items.length,
            totalNetPayout: totals.netPayout,
            rows: items as any,
            buyingByTxn: mergedBuying as any,
            fileName: (file as File).name || null,
          },
        });

        // Keep weeklySale synced with latest statement totals even when draft exists.
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

        return NextResponse.json({
          alreadyUploaded: true,
          account: { id: account.id, displayName: account.displayName, platform: account.platform as Platform },
          resolvedShopId: resolved.shopId,
          draftId: existingDraft.id,
          week: { weekStart: weekStart.toISOString(), weekEnd: weekEnd.toISOString() },
          totals,
          excluded,
        });
      }

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

  try {
    await maybeAutoSendDividedWhatsappReport({
      weekStartRaw: weekStart.toISOString().slice(0, 10),
      actorId,
      source: "xlsx-preview",
    });
    await maybeAutoSendPricingWeekWhatsapp({
      weekStartRaw: weekStart.toISOString().slice(0, 10),
      actorId,
      source: "xlsx-preview",
    });
  } catch (err) {
    console.error("[xlsx-preview] auto-send failed", err);
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
    noOrdersInWeek: items.length === 0,
    draftTableAvailable,
  });
}
