import { NextRequest, NextResponse } from "next/server";
import { Platform, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRoleOrBenjamin } from "@/lib/api";
import { mondayToSundayNairobiWindow, normalizeWeekStartFromParam } from "@/lib/weekWindow";
import { upsertManualWeeklySale } from "@/lib/manualWeeklySaleUpsert";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function resolveAccountAndShopId(inputId: string) {
  const asAccount = await prisma.marketplaceAccount.findUnique({
    where: { id: inputId },
    select: { id: true, platform: true, displayName: true, isActive: true, jumiaShopSid: true, kilimallShopCode: true },
  });
  if (asAccount) {
    const shop = await prisma.shop.findUnique({ where: { id: inputId }, select: { id: true } });
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
          select: { id: true, platform: true, displayName: true, isActive: true },
        })
      : null) ??
    (name
      ? await prisma.marketplaceAccount.findFirst({
          where: { isActive: true, platform: shop.platform as any, displayName: { equals: name, mode: "insensitive" } as any },
          select: { id: true, platform: true, displayName: true, isActive: true },
        })
      : null);

  return { account, shopId: shop.id };
}

type CsvImportRow = {
  dateUtc: string;
  orderNo?: string;
  orderItemNo?: string;
  details?: string;
  sellerSku?: string;
  jumiaSku?: string;
  itemCreditTxn: string;
  grossSale: number;
  commission: number;
  shippingFee: number;
  otherFees?: number;
  commissionTxn?: string | null;
  shippingTxn?: string | null;
  otherTxn?: string[];
  buyingPriceKes?: number | string | null;
  statementNumber?: string;
  paidStatus?: string;
  orderItemStatus?: string;
  shippingProvider?: string;
  trackingNumber?: string;
  countryCode?: string;
};

export async function POST(req: NextRequest) {
  const auth = await requireRoleOrBenjamin(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const actorId = (auth.session?.user as { id?: string } | undefined)?.id;
  if (!actorId) return NextResponse.json({ error: "Missing actor id" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | {
        accountId?: string;
        weekStart?: string;
        userId?: string | null;
        allowDuplicates?: boolean;
        rows?: CsvImportRow[];
      }
    | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const accountId = String(body.accountId ?? "").trim();
  if (!accountId) return NextResponse.json({ error: "accountId is required" }, { status: 400 });

  const weekStartParam = String(body.weekStart ?? "").trim();
  const weekStartParsed = normalizeWeekStartFromParam(weekStartParam);
  if (!weekStartParsed) return NextResponse.json({ error: "weekStart is required" }, { status: 400 });
  const { weekStart, weekEnd } = mondayToSundayNairobiWindow(weekStartParsed);

  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (!rows.length) return NextResponse.json({ error: "rows are required" }, { status: 400 });
  if (rows.length > 2000) return NextResponse.json({ error: "Too many rows (max 2000)" }, { status: 400 });

  const resolved = await resolveAccountAndShopId(accountId);
  const account = resolved.account;
  if (!account) {
    return NextResponse.json(
      { error: "Shop account not found. Select a marketplace shop that has Jumia SID / Kilimall code configured." },
      { status: 404 },
    );
  }
  if (!account.isActive) return NextResponse.json({ error: "Shop account is inactive" }, { status: 400 });

  const platform = account.platform as Platform;

  const actorRole = (auth.session?.user as { role?: string } | undefined)?.role ?? "";
  const effectiveUserId = actorRole === "ATTENDANT" ? actorId : (body.userId ?? null);

  const requestedTxns = rows.map((r) => String(r.itemCreditTxn ?? "").trim()).filter(Boolean);
  if (!body.allowDuplicates && requestedTxns.length) {
    const existing = await (prisma as any).marketplaceProfitEntry.findMany({
      where: { accountId: account.id, itemCreditTxn: { in: requestedTxns } },
      select: { itemCreditTxn: true },
      take: 500,
    });
    const existingTxns = existing.map((row: any) => String(row.itemCreditTxn));
    if (existingTxns.length) {
      return NextResponse.json(
        { error: "Duplicate unique number detected. Confirm to continue.", existingTxns },
        { status: 409 },
      );
    }
  }

  const createdItems: any[] = [];
  const duplicateTxns: string[] = [];
  const failed: { txn?: string; error: string }[] = [];

  const totalNetPayout = rows.reduce((sum, r) => {
    const gross = Number(r.grossSale ?? 0);
    const comm = Number(r.commission ?? 0);
    const ship = Number(r.shippingFee ?? 0);
    const other = Number(r.otherFees ?? 0);
    return sum + (gross + comm + ship + other);
  }, 0);

  // Create entries first, then upsert weekly sale. Keep creation resilient (skip duplicates).
  for (const row of rows) {
    const itemCreditTxn = String(row.itemCreditTxn ?? "").trim();
    if (!itemCreditTxn) {
      failed.push({ error: "Missing unique transaction number" });
      continue;
    }

    const date = new Date(String(row.dateUtc ?? ""));
    if (Number.isNaN(date.getTime())) {
      failed.push({ txn: itemCreditTxn, error: "Invalid dateUtc" });
      continue;
    }

    const grossSale = Number(row.grossSale ?? 0);
    const commission = Number(row.commission ?? 0);
    const shippingFee = Number(row.shippingFee ?? 0);
    const otherFees = Number(row.otherFees ?? 0);
    const netPayout = grossSale + commission + shippingFee + otherFees;

    const buying = row.buyingPriceKes === null || row.buyingPriceKes === undefined ? 0 : Number(row.buyingPriceKes);
    const buyingPriceKes = Number.isFinite(buying) && buying >= 0 ? buying : 0;

    const profit = netPayout - buyingPriceKes;
    const marginPct = netPayout !== 0 ? (profit / netPayout) * 100 : 0;
    const commissionRatePct = grossSale !== 0 ? (Math.abs(commission) / grossSale) * 100 : 0;
    const isLoss = profit < 0;

    const rawText = JSON.stringify({
      source: "csv",
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
        itemCredit: itemCreditTxn,
        commission: row.commissionTxn ?? null,
        shipping: row.shippingTxn ?? null,
        other: Array.isArray(row.otherTxn) ? row.otherTxn.slice(0, 10) : [],
      },
      amounts: { grossSale, commission, shippingFee, otherFees, netPayout },
    });

    const { weekStart: canonicalWeekStart, weekEnd: canonicalWeekEnd } = mondayToSundayNairobiWindow(date);
    // Ensure entries are stored under their own canonical week, but also allow importing "selected week" CSV.
    // This keeps data consistent even if the statement contains a stray row.
    const createDataBase = {
      platform,
      date,
      weekStart: canonicalWeekStart,
      weekEnd: canonicalWeekEnd,
      periodKey: getTradingPeriodFor(date).key,
      accountId: account.id,
      itemCreditTxn,
      itemCreditAmount: grossSale,
      commissionTxn: row.commissionTxn ? String(row.commissionTxn) : null,
      commissionAmount: commission,
      shippingTxn: row.shippingTxn ? String(row.shippingTxn) : null,
      shippingAmount: shippingFee,
      netPayout,
      buyingPrice: buyingPriceKes,
      profit,
      marginPct,
      commissionRatePct,
      orderId: row.orderNo?.trim() || null,
      sku: row.jumiaSku?.trim() || row.sellerSku?.trim() || null,
      productName: row.details?.trim() || null,
      rawText,
      enteredByAdminId: actorId,
    };

    try {
      let created: any;
      try {
        created = await (prisma as any).marketplaceProfitEntry.create({
          data: { ...createDataBase, isLoss },
        });
      } catch (err: any) {
        if (err?.code === "P2022") {
          created = await (prisma as any).marketplaceProfitEntry.create({
            data: createDataBase,
          });
        } else {
          throw err;
        }
      }

      createdItems.push({
        id: created.id,
        itemCreditTxn: created.itemCreditTxn,
        netPayout: Number(created.netPayout),
        buyingPrice: Number(created.buyingPrice),
        profit: Number(created.profit),
        isLoss: typeof created.isLoss === "boolean" ? Boolean(created.isLoss) : isLoss,
      });
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        duplicateTxns.push(itemCreditTxn);
        continue;
      }
      failed.push({ txn: itemCreditTxn, error: err instanceof Error ? err.message : "Failed to save" });
    }
  }

  // Upsert WeeklySale for the selected week using computed total net payout.
  let weeklySale: any = null;
  try {
    weeklySale = await upsertManualWeeklySale({
      shopId: resolved.shopId ?? account.id,
      weekStart,
      weekEnd,
      amount: totalNetPayout,
      userId: effectiveUserId,
      actorId,
    });
  } catch (err) {
    // Keep import successful even if weekly sale mirroring fails.
    console.error("[csv-import] weekly sale upsert failed", err);
  }

  return NextResponse.json(
    {
      account: { id: account.id, displayName: account.displayName, platform: account.platform },
      resolvedShopId: resolved.shopId,
      week: { weekStart: weekStart.toISOString(), weekEnd: weekEnd.toISOString() },
      weeklySale,
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
