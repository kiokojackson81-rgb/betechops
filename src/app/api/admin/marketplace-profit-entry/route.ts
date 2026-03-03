import { NextRequest, NextResponse } from "next/server";
import { Platform, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRoleOrBenjamin } from "@/lib/api";
import { mondayToSundayNairobiWindow } from "@/lib/weekWindow";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { extractProfitTransactions } from "@/lib/marketplaceProfitExtractor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = await requireRoleOrBenjamin(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const body = (await req.json().catch(() => null)) as
    | {
        accountId?: string;
        transactionText?: string;
        buyingPriceKes?: number | string;
        orderId?: string | null;
        sku?: string | null;
        productName?: string | null;
        allowDuplicates?: boolean;
      }
    | null;

  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const rawText = (body.transactionText ?? "").trim();
  if (!rawText) return NextResponse.json({ error: "transactionText is required" }, { status: 400 });

  const accountId = (body.accountId ?? "").trim();
  if (!accountId) return NextResponse.json({ error: "accountId is required" }, { status: 400 });

  const buying = typeof body.buyingPriceKes === "string" ? Number(body.buyingPriceKes) : body.buyingPriceKes;
  if (typeof buying !== "number" || !Number.isFinite(buying) || buying < 0) {
    return NextResponse.json({ error: "buyingPriceKes must be a non-negative number" }, { status: 400 });
  }

  const account = await prisma.marketplaceAccount.findUnique({
    where: { id: accountId },
    select: { id: true, platform: true, displayName: true, isActive: true },
  });
  if (!account) return NextResponse.json({ error: "Shop account not found" }, { status: 404 });
  if (!account.isActive) return NextResponse.json({ error: "Shop account is inactive" }, { status: 400 });
  const platform = account.platform as Platform;

  let extractedList: Awaited<ReturnType<typeof extractProfitTransactions>>;
  try {
    extractedList = await extractProfitTransactions(rawText, { max: 25 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not parse transaction text" }, { status: 400 });
  }

  const actorId = (auth.session?.user as { id?: string } | undefined)?.id;
  if (!actorId) return NextResponse.json({ error: "Missing actor id" }, { status: 401 });

  if (!Array.isArray(extractedList) || extractedList.length === 0) {
    return NextResponse.json({ error: "No transactions detected" }, { status: 400 });
  }

  if (!body.allowDuplicates) {
    const txns = extractedList.map((e) => e.itemPriceCredit?.txn).filter(Boolean) as string[];
    if (txns.length > 0) {
      const existing = await (prisma as any).marketplaceProfitEntry.findMany({
        where: { accountId: account.id, itemCreditTxn: { in: txns } },
        select: { itemCreditTxn: true },
        take: 25,
      });
      const existingTxns = existing.map((row: any) => String(row.itemCreditTxn));
      if (existingTxns.length > 0) {
        return NextResponse.json(
          {
            error: "Duplicate unique number detected. Confirm to continue.",
            existingTxns,
          },
          { status: 409 },
        );
      }
    }
  }

  const createdItems: any[] = [];
  const duplicateTxns: string[] = [];
  const failed: { txn?: string; error: string }[] = [];

  for (const extracted of extractedList) {
    if (!extracted.itemPriceCredit?.txn || !Number.isFinite(extracted.itemPriceCredit.amount)) {
      failed.push({ error: "Missing item price credit" });
      continue;
    }
    if (!extracted.commission?.txn || !Number.isFinite(extracted.commission.amount)) {
      failed.push({ txn: extracted.itemPriceCredit.txn, error: "Missing commission" });
      continue;
    }
    if (!extracted.shippingFee?.txn || !Number.isFinite(extracted.shippingFee.amount)) {
      failed.push({ txn: extracted.itemPriceCredit.txn, error: "Missing shipping fee" });
      continue;
    }
    if ((extracted.confidence ?? 0) < 0.7) {
      failed.push({ txn: extracted.itemPriceCredit.txn, error: "Low confidence extraction" });
      continue;
    }

    const { weekStart, weekEnd } = mondayToSundayNairobiWindow(extracted.date);
    const period = getTradingPeriodFor(extracted.date);

    const netPayout = extracted.itemPriceCredit.amount + extracted.commission.amount + extracted.shippingFee.amount;
    const profit = netPayout - buying;
    const marginPct = netPayout !== 0 ? (profit / netPayout) * 100 : 0;
    const commissionRatePct =
      extracted.itemPriceCredit.amount !== 0 ? (Math.abs(extracted.commission.amount) / extracted.itemPriceCredit.amount) * 100 : 0;
    const isLoss = profit < 0;

    const extractionMeta: { method: "regex" | "openai"; confidence: number; notes: string[] } = {
      method: extracted.method,
      confidence: extracted.confidence ?? 0.5,
      notes: extracted.notes ?? [],
    };

    try {
      const createDataBase = {
        platform,
        date: extracted.date,
        weekStart,
        weekEnd,
        periodKey: period.key,
        accountId: account.id,
        itemCreditTxn: extracted.itemPriceCredit.txn,
        itemCreditAmount: extracted.itemPriceCredit.amount,
        commissionTxn: extracted.commission.txn,
        commissionAmount: extracted.commission.amount,
        shippingTxn: extracted.shippingFee.txn,
        shippingAmount: extracted.shippingFee.amount,
        netPayout,
        buyingPrice: buying,
        profit,
        marginPct,
        commissionRatePct,
        orderId: body.orderId?.trim() || null,
        sku: body.sku?.trim() || null,
        productName: body.productName?.trim() || null,
        rawText,
        enteredByAdminId: actorId,
      };

      let created: any;
      try {
        created = await (prisma as any).marketplaceProfitEntry.create({
          data: { ...createDataBase, isLoss },
        });
      } catch (err: any) {
        if (err?.code === "P2022") {
          // Backward compatible: database hasn't migrated to include `isLoss` yet.
          created = await (prisma as any).marketplaceProfitEntry.create({
            data: createDataBase,
          });
        } else {
          throw err;
        }
      }

      createdItems.push({
        id: created.id,
        platform: created.platform,
        date: created.date,
        weekStart: created.weekStart,
        weekEnd: created.weekEnd,
        periodKey: created.periodKey,
        accountId: created.accountId,
        extraction: extractionMeta,
        itemCreditTxn: created.itemCreditTxn,
        itemCreditAmount: Number(created.itemCreditAmount),
        commissionAmount: Number(created.commissionAmount),
        shippingAmount: Number(created.shippingAmount),
        netPayout: Number(created.netPayout),
        buyingPrice: Number(created.buyingPrice),
        profit: Number(created.profit),
        marginPct: Number(created.marginPct),
        commissionRatePct: Number(created.commissionRatePct),
        isLoss: typeof created.isLoss === "boolean" ? Boolean(created.isLoss) : isLoss,
      });
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2021") {
        return NextResponse.json(
          { error: "Profit capture is not available yet (database migration pending). Please redeploy and try again." },
          { status: 503 },
        );
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        duplicateTxns.push(extracted.itemPriceCredit.txn);
        continue;
      }
      if (err?.code === "P2022") {
        return NextResponse.json(
          { error: "Profit capture schema is not ready (missing columns). Redeploy to apply migrations, then try again." },
          { status: 503 },
        );
      }
      failed.push({ txn: extracted.itemPriceCredit.txn, error: err instanceof Error ? err.message : "Failed to save" });
    }
  }

  // Single create: preserve old shape for clients that expect it.
  if (createdItems.length === 1 && extractedList.length === 1) {
    return NextResponse.json(createdItems[0], { status: 201 });
  }

  return NextResponse.json(
    {
      mode: extractedList.length > 1 ? "batch" : "single",
      createdCount: createdItems.length,
      duplicateCount: duplicateTxns.length,
      failedCount: failed.length,
      duplicates: duplicateTxns,
      failed,
      items: createdItems,
    },
    { status: createdItems.length ? 201 : 400 },
  );
}
