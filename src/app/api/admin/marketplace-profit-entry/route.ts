import { NextRequest, NextResponse } from "next/server";
import { Platform, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api";
import { parseMarketplaceProfitTransaction } from "@/lib/marketplaceProfitParser";
import { mondayToSundayNairobiWindow } from "@/lib/weekWindow";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";

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

  let parsed;
  try {
    parsed = parseMarketplaceProfitTransaction(rawText);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not parse transaction text" }, { status: 400 });
  }

  const { weekStart, weekEnd } = mondayToSundayNairobiWindow(parsed.date);
  const period = getTradingPeriodFor(parsed.date);

  const netPayout = parsed.itemCreditAmount + parsed.commissionAmount + parsed.shippingAmount;
  const profit = netPayout - buying;
  const marginPct = netPayout !== 0 ? (profit / netPayout) * 100 : 0;
  const commissionRatePct = parsed.itemCreditAmount !== 0 ? (Math.abs(parsed.commissionAmount) / parsed.itemCreditAmount) * 100 : 0;

  const actorId = (auth.session?.user as { id?: string } | undefined)?.id;
  if (!actorId) return NextResponse.json({ error: "Missing actor id" }, { status: 401 });

  try {
    const created = await (prisma as any).marketplaceProfitEntry.create({
      data: {
        platform,
        date: parsed.date,
        weekStart,
        weekEnd,
        periodKey: period.key,
        accountId: account.id,
        itemCreditTxn: parsed.itemCreditTxn,
        itemCreditAmount: parsed.itemCreditAmount,
        commissionTxn: parsed.commissionTxn,
        commissionAmount: parsed.commissionAmount,
        shippingTxn: parsed.shippingTxn,
        shippingAmount: parsed.shippingAmount,
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
        itemCreditTxn: created.itemCreditTxn,
        itemCreditAmount: Number(created.itemCreditAmount),
        commissionAmount: Number(created.commissionAmount),
        shippingAmount: Number(created.shippingAmount),
        netPayout: Number(created.netPayout),
        buyingPrice: Number(created.buyingPrice),
        profit: Number(created.profit),
        marginPct: Number(created.marginPct),
        commissionRatePct: Number(created.commissionRatePct),
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "This item credit transaction was already recorded" }, { status: 409 });
    }
    console.error("[marketplace-profit-entry] create failed", err);
    return NextResponse.json({ error: "Failed to save profit entry" }, { status: 500 });
  }
}
