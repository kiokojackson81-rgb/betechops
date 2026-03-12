import { NextRequest, NextResponse } from "next/server";
import { Platform, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRoleOrBenjamin } from "@/lib/api";
import { mondayToSundayNairobiWindow } from "@/lib/weekWindow";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const normalizeName = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

type RowPayload = {
  itemCreditTxn: string;
  dateUtc: string;
  orderNo?: string;
  orderItemNo?: string;
  details?: string;
  sellerSku?: string;
  jumiaSku?: string;
  statementNumber?: string;
  paidStatus?: string;
  orderItemStatus?: string;
  shippingProvider?: string;
  trackingNumber?: string;
  countryCode?: string;
  grossSale: number;
  commission: number;
  shippingFee: number;
  otherFees?: number;
  commissionTxn?: string | null;
  shippingTxn?: string | null;
  otherTxn?: string[];
};

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(req: NextRequest) {
  const auth = await requireRoleOrBenjamin(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const actorId = (auth.session?.user as { id?: string } | undefined)?.id;
  if (!actorId) return NextResponse.json({ error: "Missing actor id" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | {
        accountId?: string;
        buyingPriceKes?: number | string;
        allowDuplicates?: boolean;
        row?: RowPayload;
      }
    | null;
  if (!body || !isRecord(body)) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const accountId = String(body.accountId ?? "").trim();
  if (!accountId) return NextResponse.json({ error: "accountId is required" }, { status: 400 });

  const row = body.row;
  if (!row || !isRecord(row)) return NextResponse.json({ error: "row is required" }, { status: 400 });

  const txn = String((row as any).itemCreditTxn ?? "").trim();
  if (!txn) return NextResponse.json({ error: "row.itemCreditTxn is required" }, { status: 400 });

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

  const allowDuplicates = Boolean(body.allowDuplicates);
  const existing = await (prisma as any).marketplaceProfitEntry.findFirst({
    where: { accountId: account.id, itemCreditTxn: txn },
    select: { id: true, itemCreditTxn: true },
  });

  if (existing && !allowDuplicates) {
    return NextResponse.json(
      { error: "Duplicate unique number detected. Confirm to continue.", existingTxns: [txn] },
      { status: 409 },
    );
  }

  if (existing && allowDuplicates) {
    return NextResponse.json({
      ok: true,
      existing: true,
      entry: { id: String(existing.id), itemCreditTxn: txn },
    });
  }

  const date = new Date(String((row as any).dateUtc ?? ""));
  if (Number.isNaN(date.getTime())) return NextResponse.json({ error: "Invalid row date" }, { status: 400 });

  const grossSale = Number((row as any).grossSale ?? 0);
  const commission = Number((row as any).commission ?? 0);
  const shippingFee = Number((row as any).shippingFee ?? 0);
  const otherFees = Number((row as any).otherFees ?? 0);
  const netPayout = grossSale + commission + shippingFee + otherFees;

  const profit = netPayout - buying;
  const marginPct = netPayout !== 0 ? (profit / netPayout) * 100 : 0;
  const commissionRatePct = grossSale !== 0 ? (Math.abs(commission) / grossSale) * 100 : 0;
  const isLoss = profit < 0;

  const { weekStart, weekEnd } = mondayToSundayNairobiWindow(date);
  const periodKey = getTradingPeriodFor(date).key;

  const rawText = JSON.stringify({
    source: "csv",
    orderNo: (row as any).orderNo ?? null,
    orderItemNo: (row as any).orderItemNo ?? null,
    details: (row as any).details ?? null,
    sellerSku: (row as any).sellerSku ?? null,
    jumiaSku: (row as any).jumiaSku ?? null,
    statementNumber: (row as any).statementNumber ?? null,
    paidStatus: (row as any).paidStatus ?? null,
    orderItemStatus: (row as any).orderItemStatus ?? null,
    shippingProvider: (row as any).shippingProvider ?? null,
    trackingNumber: (row as any).trackingNumber ?? null,
    countryCode: (row as any).countryCode ?? null,
    txn: {
      itemCredit: txn,
      commission: (row as any).commissionTxn ? String((row as any).commissionTxn) : null,
      shipping: (row as any).shippingTxn ? String((row as any).shippingTxn) : null,
      other: Array.isArray((row as any).otherTxn) ? ((row as any).otherTxn as any[]).slice(0, 10) : [],
    },
    amounts: { grossSale, commission, shippingFee, otherFees, netPayout },
  });

  let created: any;
  try {
    created = await (prisma as any).marketplaceProfitEntry.create({
      data: {
        platform: account.platform as Platform,
        date,
        weekStart,
        weekEnd,
        periodKey,
        accountId: account.id,
        itemCreditTxn: txn,
        itemCreditAmount: grossSale,
        commissionTxn: (row as any).commissionTxn ? String((row as any).commissionTxn) : null,
        commissionAmount: commission,
        shippingTxn: (row as any).shippingTxn ? String((row as any).shippingTxn) : null,
        shippingAmount: shippingFee,
        netPayout,
        buyingPrice: buying,
        profit,
        marginPct,
        commissionRatePct,
        isLoss,
        orderId: String((row as any).orderNo ?? "").trim() || null,
        sku: String((row as any).jumiaSku ?? "").trim() || String((row as any).sellerSku ?? "").trim() || null,
        productName: String((row as any).details ?? "").trim() || null,
        rawText,
        enteredByAdminId: actorId,
      },
    });
  } catch (err: any) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "Duplicate unique number detected. Confirm to continue.", existingTxns: [txn] },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to create profit entry" }, { status: 400 });
  }

  // Persist a reusable buying-price template so re-uploads can prefill even
  // after profit entries are deleted.
  try {
    const normalizedProductName = normalizeName((row as any).details);
    if (normalizedProductName && Number.isFinite(grossSale) && grossSale > 0 && Number.isFinite(buying) && buying > 0) {
      await prisma.marketplacePricingTemplate.upsert({
        where: {
          platform_normalizedProductName_sellingPrice: {
            platform: account.platform as Platform,
            normalizedProductName,
            sellingPrice: grossSale,
          },
        },
        create: {
          platform: account.platform as Platform,
          normalizedProductName,
          sellingPrice: grossSale,
          defaultBuyingPrice: buying,
          updatedById: actorId,
        },
        update: {
          defaultBuyingPrice: buying,
          updatedById: actorId,
          updatedAt: new Date(),
        },
      });
    }
  } catch (err) {
    console.error("[csv-submit-row] pricing template upsert failed", err);
  }

  return NextResponse.json({
    ok: true,
    entry: {
      id: created.id,
      itemCreditTxn: txn,
      netPayout: Number(created.netPayout),
      buyingPrice: Number(created.buyingPrice),
      profit: Number(created.profit),
      isLoss: Boolean(created.isLoss),
    },
  });
}
