import { NextRequest, NextResponse } from "next/server";
import { Platform, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api";
import { mondayToSundayNairobiWindow } from "@/lib/weekWindow";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { extractProfitTransaction } from "@/lib/marketplaceProfitExtractor";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const body = (await req.json().catch(() => null)) as
    | {
        accountId?: string;
        transactionText?: string;
        buyingPriceKes?: number | string;
        orderId?: string | null;
        sku?: string | null;
        productName?: string | null;
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

  let extracted: Awaited<ReturnType<typeof extractProfitTransaction>>;
  try {
    extracted = await extractProfitTransaction(rawText);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not parse transaction text" }, { status: 400 });
  }

  if (!extracted.itemPriceCredit?.txn || !Number.isFinite(extracted.itemPriceCredit.amount)) {
    return NextResponse.json({ error: "Missing item price credit" }, { status: 400 });
  }
  if (!extracted.commission?.txn || !Number.isFinite(extracted.commission.amount)) {
    return NextResponse.json({ error: "Missing commission" }, { status: 400 });
  }
  if (!extracted.shippingFee?.txn || !Number.isFinite(extracted.shippingFee.amount)) {
    return NextResponse.json({ error: "Missing shipping fee" }, { status: 400 });
  }
  if ((extracted.confidence ?? 0) < 0.7) {
    return NextResponse.json(
      { error: "Low confidence extraction. Please paste a more complete transaction block.", confidence: extracted.confidence, notes: extracted.notes },
      { status: 400 },
    );
  }

  const { weekStart, weekEnd } = mondayToSundayNairobiWindow(extracted.date);
  const period = getTradingPeriodFor(extracted.date);

  const netPayout = extracted.itemPriceCredit.amount + extracted.commission.amount + extracted.shippingFee.amount;
  const profit = netPayout - buying;
  const marginPct = netPayout !== 0 ? (profit / netPayout) * 100 : 0;
  const commissionRatePct =
    extracted.itemPriceCredit.amount !== 0 ? (Math.abs(extracted.commission.amount) / extracted.itemPriceCredit.amount) * 100 : 0;
  const isLoss = profit < 0;

  const actorId = (auth.session?.user as { id?: string } | undefined)?.id;
  if (!actorId) return NextResponse.json({ error: "Missing actor id" }, { status: 401 });

  const extractionMeta: { method: "regex" | "openai"; confidence: number; notes: string[] } = {
    method: extracted.method,
    confidence: extracted.confidence ?? 0.5,
    notes: extracted.notes ?? [],
  };

  try {
    const created = await (prisma as any).marketplaceProfitEntry.create({
      data: {
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
        isLoss,
        orderId: body.orderId?.trim() || null,
        sku: body.sku?.trim() || null,
        productName: body.productName?.trim() || null,
        rawText,
        enteredByAdminId: actorId,
      },
    });

    return NextResponse.json(
      {
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
        isLoss: Boolean(created.isLoss),
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2021") {
      return NextResponse.json(
        { error: "Profit capture is not available yet (database migration pending). Please redeploy and try again." },
        { status: 503 },
      );
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "Already captured for this shop (duplicate item credit transaction)" }, { status: 409 });
    }
    console.error("[marketplace-profit-entry] create failed", err);
    return NextResponse.json({ error: "Failed to save profit entry" }, { status: 500 });
  }
}
