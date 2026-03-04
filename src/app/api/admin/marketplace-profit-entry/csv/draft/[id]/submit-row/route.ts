import { NextRequest, NextResponse } from "next/server";
import { Platform, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRoleOrBenjamin } from "@/lib/api";
import { mondayToSundayNairobiWindow } from "@/lib/weekWindow";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  const auth = await requireRoleOrBenjamin(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const actorId = (auth.session?.user as { id?: string } | undefined)?.id;
  if (!actorId) return NextResponse.json({ error: "Missing actor id" }, { status: 401 });

  const params = await Promise.resolve(ctx.params);
  const draftId = String(params?.id ?? "").trim();
  if (!draftId) return NextResponse.json({ error: "Missing draft id" }, { status: 400 });

  const body = (await req.json().catch(() => null)) as
    | {
        itemCreditTxn?: string;
        buyingPriceKes?: number | string;
        allowDuplicates?: boolean;
      }
    | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const txn = String(body.itemCreditTxn ?? "").trim();
  if (!txn) return NextResponse.json({ error: "itemCreditTxn is required" }, { status: 400 });

  const buying = typeof body.buyingPriceKes === "string" ? Number(body.buyingPriceKes) : body.buyingPriceKes;
  if (typeof buying !== "number" || !Number.isFinite(buying) || buying < 0) {
    return NextResponse.json({ error: "buyingPriceKes must be a non-negative number" }, { status: 400 });
  }

  const draft = await prisma.marketplaceStatementDraft.findUnique({
    where: { id: draftId },
    select: {
      id: true,
      platform: true,
      shopId: true,
      accountId: true,
      rows: true,
      buyingByTxn: true,
      submittedByTxn: true,
    },
  });
  if (!draft) return NextResponse.json({ error: "Draft not found" }, { status: 404 });

  const rows = Array.isArray(draft.rows) ? (draft.rows as any[]) : [];
  const row = rows.find((r) => String(r?.itemCreditTxn ?? "").trim() === txn) as RowPayload | undefined;
  if (!row) return NextResponse.json({ error: "Row not found in draft" }, { status: 404 });

  const submittedByTxn = isRecord(draft.submittedByTxn) ? { ...draft.submittedByTxn } : {};
  const existingEntryId = submittedByTxn[txn] ? String(submittedByTxn[txn]) : null;

  if (!existingEntryId && !body.allowDuplicates) {
    const existing = await (prisma as any).marketplaceProfitEntry.findFirst({
      where: { accountId: draft.accountId, itemCreditTxn: txn },
      select: { id: true, itemCreditTxn: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Duplicate unique number detected. Confirm to continue.", existingTxns: [txn] },
        { status: 409 },
      );
    }
  }

  const date = new Date(String(row.dateUtc ?? ""));
  if (Number.isNaN(date.getTime())) return NextResponse.json({ error: "Invalid row date" }, { status: 400 });

  const grossSale = Number(row.grossSale ?? 0);
  const commission = Number(row.commission ?? 0);
  const shippingFee = Number(row.shippingFee ?? 0);
  const otherFees = Number(row.otherFees ?? 0);
  const netPayout = grossSale + commission + shippingFee + otherFees;
  if (netPayout < 0) {
    return NextResponse.json({ error: "Return detected (negative payout). Buying price is not required for this row." }, { status: 400 });
  }

  const profit = netPayout - buying;
  const marginPct = netPayout !== 0 ? (profit / netPayout) * 100 : 0;
  const commissionRatePct = grossSale !== 0 ? (Math.abs(commission) / grossSale) * 100 : 0;
  const isLoss = profit < 0;

  const { weekStart, weekEnd } = mondayToSundayNairobiWindow(date);
  const periodKey = getTradingPeriodFor(date).key;

  const rawText = JSON.stringify({
    source: "csv",
    draftId: draft.id,
    orderNo: row.orderNo ?? null,
    orderItemNo: row.orderItemNo ?? null,
    details: row.details ?? null,
    sellerSku: row.sellerSku ?? null,
    jumiaSku: row.jumiaSku ?? null,
    statementNumber: row.statementNumber ?? null,
    paidStatus: row.paidStatus ?? null,
    orderItemStatus: row.orderItemStatus ?? null,
    shippingProvider: row.shippingProvider ?? null,
    trackingNumber: row.trackingNumber ?? null,
    countryCode: row.countryCode ?? null,
    txn: {
      itemCredit: txn,
      commission: row.commissionTxn ?? null,
      shipping: row.shippingTxn ?? null,
      other: Array.isArray(row.otherTxn) ? row.otherTxn.slice(0, 10) : [],
    },
    amounts: { grossSale, commission, shippingFee, otherFees, netPayout },
  });

  let createdOrUpdated: any;
  try {
    if (existingEntryId) {
      createdOrUpdated = await (prisma as any).marketplaceProfitEntry.update({
        where: { id: existingEntryId },
        data: {
          buyingPrice: buying,
          profit,
          marginPct,
          commissionRatePct,
          isLoss,
          orderId: row.orderNo?.trim() || null,
          sku: row.jumiaSku?.trim() || row.sellerSku?.trim() || null,
          productName: row.details?.trim() || null,
        },
        select: { id: true, netPayout: true, buyingPrice: true, profit: true, isLoss: true },
      });
    } else {
      createdOrUpdated = await (prisma as any).marketplaceProfitEntry.create({
        data: {
          platform: draft.platform as Platform,
          date,
          weekStart,
          weekEnd,
          periodKey,
          accountId: draft.accountId,
          itemCreditTxn: txn,
          itemCreditAmount: grossSale,
          commissionTxn: row.commissionTxn ? String(row.commissionTxn) : null,
          commissionAmount: commission,
          shippingTxn: row.shippingTxn ? String(row.shippingTxn) : null,
          shippingAmount: shippingFee,
          netPayout,
          buyingPrice: buying,
          profit,
          marginPct,
          commissionRatePct,
          isLoss,
          orderId: row.orderNo?.trim() || null,
          sku: row.jumiaSku?.trim() || row.sellerSku?.trim() || null,
          productName: row.details?.trim() || null,
          rawText,
          enteredByAdminId: actorId,
        },
        select: { id: true, netPayout: true, buyingPrice: true, profit: true, isLoss: true },
      });
      submittedByTxn[txn] = createdOrUpdated.id;
    }
  } catch (err: any) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "Duplicate unique number detected. Confirm to continue.", existingTxns: [txn] },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to save profit entry" }, { status: 400 });
  }

  const buyingByTxn = isRecord(draft.buyingByTxn) ? { ...draft.buyingByTxn } : {};
  buyingByTxn[txn] = buying;

  await prisma.marketplaceStatementDraft.update({
    where: { id: draft.id },
    data: { buyingByTxn, submittedByTxn },
  });

  return NextResponse.json({
    ok: true,
    entry: {
      id: createdOrUpdated.id,
      itemCreditTxn: txn,
      netPayout: Number(createdOrUpdated.netPayout),
      buyingPrice: Number(createdOrUpdated.buyingPrice),
      profit: Number(createdOrUpdated.profit),
      isLoss: Boolean(createdOrUpdated.isLoss),
    },
  });
}
