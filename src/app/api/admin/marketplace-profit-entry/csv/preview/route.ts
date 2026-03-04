import { NextRequest, NextResponse } from "next/server";
import { Platform } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRoleOrBenjamin } from "@/lib/api";
import { mondayToSundayNairobiWindow } from "@/lib/weekWindow";
import { aggregateMarketplaceStatementRows, parseMarketplaceStatementCsv } from "@/lib/marketplaceStatementCsv";
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
    // Try to resolve the canonical Shop id for cross-user sync (admin + supervisor) and manual-weekly linkage.
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
    return NextResponse.json({ error: "CSV file is required" }, { status: 400 });
  }

  const resolved = await resolveAccountAndShopId(accountId);
  const account = resolved.account;
  if (!account) {
    return NextResponse.json(
      { error: "Shop account not found. Select a marketplace shop that has Jumia SID / Kilimall code configured." },
      { status: 404 },
    );
  }
  if (!account.isActive) return NextResponse.json({ error: "Shop account is inactive" }, { status: 400 });

  const csvText = await (file as File).text();
  const parsed = parseMarketplaceStatementCsv(csvText);

  // Infer week from CSV if weekStart was not supplied.
  // Choose the most common Nairobi Mon→Sun week among statement rows.
  const candidateWeekCounts = new Map<string, { weekStart: Date; weekEnd: Date; count: number }>();
  for (const r of parsed.rows as any[]) {
    const date = (r as any)?.transactionDateUtc instanceof Date ? ((r as any).transactionDateUtc as Date) : null;
    if (!date || Number.isNaN(date.getTime())) continue;
    const w = mondayToSundayNairobiWindow(date);
    const key = w.weekStart.toISOString();
    const prev = candidateWeekCounts.get(key);
    candidateWeekCounts.set(key, { weekStart: w.weekStart, weekEnd: w.weekEnd, count: (prev?.count ?? 0) + 1 });
  }
  const detected = Array.from(candidateWeekCounts.values()).sort((a, b) => b.count - a.count)[0] ?? null;
  if (!detected) {
    return NextResponse.json({ error: "Unable to detect week from CSV. Ensure it includes transaction dates." }, { status: 400 });
  }

  const weekStart = detected.weekStart;
  const weekEnd = detected.weekEnd;

  const aggregated = aggregateMarketplaceStatementRows({
    rows: parsed.rows,
    weekStartUtc: weekStart,
    weekEndUtc: weekEnd,
  });

  // Prefill buying prices from the most recent matching SKU+name+price in prior profit entries.
  const suggestedBuyingByTxn: Record<string, number> = {};
  try {
    const skus = Array.from(
      new Set(
        aggregated.aggregates
          .map((r) => String(r.jumiaSku || r.sellerSku || "").trim())
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
        const sku = normalizeSku(r.jumiaSku || r.sellerSku || "");
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
    console.error("[csv-preview] buying prefill failed", err);
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

  const totals = aggregated.aggregates.reduce(
    (acc, row) => {
      acc.netPayout += row.netPayout;
      acc.grossSale += row.grossSale;
      acc.lossCandidates += row.netPayout < 0 ? 1 : 0;
      return acc;
    },
    { netPayout: 0, grossSale: 0, lossCandidates: 0 },
  );

  const statementNumberCounts = new Map<string, number>();
  for (const r of aggregated.aggregates) {
    const n = String(r.statementNumber ?? "").trim();
    if (!n) continue;
    statementNumberCounts.set(n, (statementNumberCounts.get(n) ?? 0) + 1);
  }
  const statementNumber =
    Array.from(statementNumberCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const hash = createHash("sha1").update(csvText).digest("hex").slice(0, 12);
  const weekKey = weekStart.toISOString().slice(0, 10);
  const draftKey = `csv:${resolved.shopId}:${weekKey}:${hash}`;
  const periodKey = getTradingPeriodFor(weekStart).key;

  let draftId: string | null = null;
  // Prevent statement duplication: if this shop+week already has a draft for the same statement number, resume it instead of creating a new one.
  if (statementNumber) {
    try {
      const existingSameStatement = await prisma.marketplaceStatementDraft.findFirst({
        where: { shopId: resolved.shopId, weekStart, statementNumber },
        orderBy: { updatedAt: "desc" },
        select: { id: true, draftKey: true },
      });
      if (existingSameStatement && String(existingSameStatement.draftKey) !== draftKey) {
        return NextResponse.json({
          alreadyUploaded: true,
          account: { id: account.id, displayName: account.displayName, platform: account.platform as Platform },
          resolvedShopId: resolved.shopId,
          draftId: existingSameStatement.id,
          week: { weekStart: weekStart.toISOString(), weekEnd: weekEnd.toISOString() },
          statementNumber,
        });
      }
    } catch (err) {
      console.error("[csv-preview] statement duplication check failed", err);
    }
  }
  try {
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

    const existingDraft = await prisma.marketplaceStatementDraft.findUnique({
      where: { draftKey },
      select: { id: true, buyingByTxn: true, submittedByTxn: true },
    });

    if (!existingDraft) {
      const draft = await prisma.marketplaceStatementDraft.create({
        data: {
          draftKey,
          platform: account.platform as Platform,
          shopId: resolved.shopId,
          accountId: account.id,
          weekStart,
          weekEnd,
          periodKey,
          statementNumber,
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
    } else {
      const existingBuying = (existingDraft.buyingByTxn && typeof existingDraft.buyingByTxn === "object"
        ? (existingDraft.buyingByTxn as any)
        : {}) as Record<string, any>;
      const mergedBuying: Record<string, any> = { ...suggestedBuyingByTxn };
      for (const [k, v] of Object.entries(existingBuying)) {
        mergedBuying[k] = v;
      }

      const draft = await prisma.marketplaceStatementDraft.update({
        where: { id: existingDraft.id },
        data: {
          rowCount: aggregated.aggregates.length,
          totalNetPayout: totals.netPayout,
          rows: rowPayload as any,
          buyingByTxn: mergedBuying as any,
        },
        select: { id: true },
      });
      draftId = draft.id;
    }
  } catch (err) {
    // Draft persistence shouldn't block preview; still return parsed rows.
    console.error("[csv-preview] failed to persist draft", err);
  }

  // Mirror to WeeklySale (manual) immediately so admin doesn't have to re-enter in manual weekly.
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
    console.error("[csv-preview] weekly sale upsert failed", err);
  }

  return NextResponse.json({
    account: { id: account.id, displayName: account.displayName, platform: account.platform as Platform },
    resolvedShopId: resolved.shopId,
    draftId,
    week: { weekStart: weekStart.toISOString(), weekEnd: weekEnd.toISOString() },
    parsed: { rows: parsed.rows.length, errors: parsed.errors },
    aggregated: { rows: aggregated.aggregates.length, skipped: aggregated.skipped, errors: aggregated.errors },
    existingTxns,
    suggestedBuyingByTxn,
    totals,
    items: aggregated.aggregates,
  });
}
