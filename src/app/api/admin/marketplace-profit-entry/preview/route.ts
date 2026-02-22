import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api";
import { extractProfitTransaction } from "@/lib/marketplaceProfitExtractor";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const body = (await req.json().catch(() => null)) as
    | {
        accountId?: string;
        buyingPriceKes?: number | string;
        transactionText?: string;
      }
    | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const accountId = (body.accountId ?? "").trim();
  if (!accountId) return NextResponse.json({ error: "accountId is required" }, { status: 400 });
  const account = await prisma.marketplaceAccount.findUnique({
    where: { id: accountId },
    select: { id: true, platform: true, displayName: true, isActive: true },
  });
  if (!account) return NextResponse.json({ error: "Shop account not found" }, { status: 404 });
  if (!account.isActive) return NextResponse.json({ error: "Shop account is inactive" }, { status: 400 });

  const rawText = (body.transactionText ?? "").trim();
  if (!rawText) return NextResponse.json({ error: "transactionText is required" }, { status: 400 });

  const buying = typeof body.buyingPriceKes === "string" ? Number(body.buyingPriceKes) : body.buyingPriceKes;
  if (typeof buying !== "number" || !Number.isFinite(buying) || buying < 0) {
    return NextResponse.json({ error: "buyingPriceKes must be a non-negative number" }, { status: 400 });
  }

  const extracted = await extractProfitTransaction(rawText);
  if (!extracted.itemPriceCredit.txn || !Number.isFinite(extracted.itemPriceCredit.amount)) {
    return NextResponse.json({ error: "Missing item price credit" }, { status: 400 });
  }
  if (!extracted.commission.txn || !Number.isFinite(extracted.commission.amount)) {
    return NextResponse.json({ error: "Missing commission" }, { status: 400 });
  }
  if (!extracted.shippingFee.txn || !Number.isFinite(extracted.shippingFee.amount)) {
    return NextResponse.json({ error: "Missing shipping fee" }, { status: 400 });
  }
  if ((extracted.confidence ?? 0) < 0.7) {
    return NextResponse.json(
      { error: "Low confidence extraction. Please paste a more complete transaction block.", confidence: extracted.confidence, notes: extracted.notes },
      { status: 400 },
    );
  }

  const netPayout = extracted.itemPriceCredit.amount + extracted.commission.amount + extracted.shippingFee.amount;
  const profit = netPayout - buying;
  const marginPct = netPayout !== 0 ? (profit / netPayout) * 100 : 0;
  const commissionRatePct =
    extracted.itemPriceCredit.amount !== 0 ? (Math.abs(extracted.commission.amount) / extracted.itemPriceCredit.amount) * 100 : 0;

  return NextResponse.json({
    account: { id: account.id, displayName: account.displayName, platform: account.platform },
    extracted: {
      method: extracted.method,
      confidence: extracted.confidence,
      notes: extracted.notes,
      date: extracted.date.toISOString(),
      currency: extracted.currency,
      item_price_credit: extracted.itemPriceCredit,
      commission: extracted.commission,
      shipping_fee: extracted.shippingFee,
    },
    computed: {
      netPayout,
      buyingPriceKes: buying,
      profit,
      marginPct,
      commissionRatePct,
      isLoss: profit < 0,
    },
  });
}

