import { NextRequest, NextResponse } from "next/server";
import { Platform, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRoleOrBenjamin } from "@/lib/api";
import { canonicalNairobiWeekStartUtc, mondayToSundayNairobiWindow, parseDateOnlyUtc } from "@/lib/weekWindow";
import { isMarketplaceStatementDraftTableAvailable } from "@/lib/statementDraftTable";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TARGETS = [
  { key: "betech-store", label: "Betech Store", match: ["Betech Store"] },
  { key: "jude-collection", label: "Jude Collection", match: ["Jude Collection"] },
  { key: "hitech-power", label: "Hitech Power", match: ["Hitech Power"] },
  { key: "jm-latest", label: "JM Latest Collections", match: ["JM Latest Collections", "JM Collection", "JM Collections"] },
];

type AccountCandidate = {
  id: string;
  displayName: string | null;
  platform: Platform;
  jumiaShopSid: string | null;
};

type TargetResolved = {
  key: string;
  label: string;
  accountIds: string[];
  shopIds: string[];
};

function money(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function normalize(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeNameForMatch(value: unknown): string {
  return normalize(value)
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function draftTxn(row: any): string {
  const direct = normalize(
    row?.itemCreditTxn ??
      row?.txn ??
      row?.transactionNumber ??
      row?.uniqueTxn ??
      row?.uniqueNumber ??
      row?.itemCreditTransaction,
  ).toLowerCase();
  if (direct) return direct;
  // Fallback key when statement export omits explicit txn id.
  const fallback = [
    normalize(row?.orderNo ?? row?.orderId),
    normalize(row?.orderItemNo ?? row?.orderItemId),
    normalize(row?.dateUtc ?? row?.date),
    String(money(row?.netPayout)),
    normalize(row?.details ?? row?.productName),
  ]
    .filter(Boolean)
    .join("|")
    .toLowerCase();
  return fallback;
}

function summarizeDraftRows(rows: any[]): { dedupNet: number; returns: number; duplicateCount: number } {
  let dedupNet = 0;
  let returns = 0;
  let duplicateCount = 0;
  const seen = new Set<string>();
  for (const row of rows) {
    const net = money((row as any)?.netPayout);
    const txn = draftTxn(row);
    if (txn) {
      if (seen.has(txn)) {
        duplicateCount += 1;
        continue;
      }
      seen.add(txn);
    }
    dedupNet += net;
    if (net < 0) returns += Math.abs(net);
  }
  return { dedupNet, returns, duplicateCount };
}

function summarizeProfitRows(rows: Array<{ itemCreditTxn: string; netPayout: number; buyingPrice: number; profit: number }>) {
  let net = 0;
  let buying = 0;
  let profit = 0;
  let duplicateCount = 0;
  const seen = new Set<string>();
  for (const row of rows) {
    const txn = normalize(row.itemCreditTxn).toLowerCase();
    if (txn) {
      if (seen.has(txn)) {
        duplicateCount += 1;
        continue;
      }
      seen.add(txn);
    }
    net += money(row.netPayout);
    buying += money(row.buyingPrice);
    profit += money(row.profit);
  }
  return { net, buying, profit, duplicateCount };
}

async function resolveShopForAccount(account: { platform: Platform; displayName: string | null; jumiaShopSid: string | null }) {
  const sid = normalize(account.jumiaShopSid);
  const name = normalize(account.displayName);
  const normalizedAccountName = normalizeNameForMatch(name);

  const shop =
    (sid
      ? await prisma.shop.findFirst({
          where: { platform: account.platform as any, jumiaShopSid: sid },
          select: { id: true, name: true },
        })
      : null) ??
    (sid
      ? await prisma.shop.findFirst({
          where: { platform: account.platform as any, apiConfig: { is: { apiKey: sid } } as any },
          select: { id: true, name: true },
        })
      : null) ??
    (name
      ? await prisma.shop.findFirst({
          where: { platform: account.platform as any, name: { equals: name, mode: "insensitive" } as any },
          select: { id: true, name: true },
        })
      : null);

  if (shop) return { id: shop.id, name: shop.name };

  if (!normalizedAccountName) return null;
  const allJumiaShops = await prisma.shop.findMany({
    where: { platform: account.platform as any },
    select: { id: true, name: true },
    take: 200,
  });
  const fallback =
    allJumiaShops.find((s) => normalizeNameForMatch(s.name) === normalizedAccountName) ??
    allJumiaShops.find((s) => {
      const n = normalizeNameForMatch(s.name);
      return n.includes(normalizedAccountName) || normalizedAccountName.includes(n);
    }) ??
    null;

  return fallback ? { id: fallback.id, name: fallback.name } : null;
}

export async function GET(req: NextRequest) {
  const auth = await requireRoleOrBenjamin(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(req.url);
  const weekStartRaw = normalize(searchParams.get("weekStart"));
  if (!weekStartRaw) return NextResponse.json({ error: "weekStart is required (YYYY-MM-DD)" }, { status: 400 });

  const parsed = parseDateOnlyUtc(weekStartRaw);
  if (!parsed) return NextResponse.json({ error: "Invalid weekStart" }, { status: 400 });
  const weekStart = canonicalNairobiWeekStartUtc(parsed);
  const { weekEnd } = mondayToSundayNairobiWindow(weekStart);

  const accounts = await prisma.marketplaceAccount.findMany({
    where: {
      isActive: true,
      platform: "JUMIA",
      OR: TARGETS.flatMap((t) => t.match.map((m) => ({ displayName: { contains: m, mode: "insensitive" } as any }))),
    },
    select: { id: true, displayName: true, platform: true, jumiaShopSid: true },
  });

  const targetResolved: TargetResolved[] = [];
  for (const t of TARGETS) {
    const candidates: AccountCandidate[] = accounts.filter((x) =>
      t.match.some((m) => normalize(x.displayName).toLowerCase().includes(m.toLowerCase())),
    );
    const accountIds = [...new Set(candidates.map((c) => c.id))];
    const shopIds: string[] = [];
    for (const candidate of candidates) {
      const shop = await resolveShopForAccount(candidate);
      if (shop?.id) shopIds.push(shop.id);
    }
    targetResolved.push({
      key: t.key,
      label: t.label,
      accountIds,
      shopIds: [...new Set(shopIds)],
    });
  }

  const allAccountIds = [...new Set(targetResolved.flatMap((t) => t.accountIds))];
  const allShopIds = [...new Set(targetResolved.flatMap((t) => t.shopIds))];

  const profitRows = allAccountIds.length
    ? await (prisma as any).marketplaceProfitEntry.findMany({
        where: { platform: "JUMIA", accountId: { in: allAccountIds }, weekStart, weekEnd },
        select: { accountId: true, itemCreditTxn: true, netPayout: true, buyingPrice: true, profit: true },
        take: 15000,
      })
    : [];

  const profitRowsByAccountId = new Map<string, Array<{ itemCreditTxn: string; netPayout: number; buyingPrice: number; profit: number }>>();
  for (const row of profitRows as any[]) {
    const key = String(row.accountId);
    if (!profitRowsByAccountId.has(key)) profitRowsByAccountId.set(key, []);
    profitRowsByAccountId.get(key)!.push({
      itemCreditTxn: String(row.itemCreditTxn ?? ""),
      netPayout: money(row.netPayout),
      buyingPrice: money(row.buyingPrice),
      profit: money(row.profit),
    });
  }

  const draftTableAvailable = await isMarketplaceStatementDraftTableAvailable();
  const draftMetricsByShopId = new Map<string, { dedupNet: number; returns: number; duplicateCount: number }>();
  if (draftTableAvailable && allShopIds.length) {
    try {
      const drafts = await prisma.marketplaceStatementDraft.findMany({
        where: { platform: "JUMIA", weekStart, weekEnd, shopId: { in: allShopIds } },
        orderBy: { updatedAt: "desc" },
        select: { shopId: true, rows: true },
        take: 200,
      });
      for (const d of drafts) {
        const sid = String(d.shopId);
        if (draftMetricsByShopId.has(sid)) continue; // latest draft per shop
        const rows = Array.isArray(d.rows) ? (d.rows as any[]) : [];
        draftMetricsByShopId.set(sid, summarizeDraftRows(rows));
      }
    } catch (err: any) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2021")) throw err;
    }
  }

  const perAccount = targetResolved.map((target) => {
    const allProfitRowsForTarget = target.accountIds.flatMap((id) => profitRowsByAccountId.get(id) ?? []);
    const profitSummary = summarizeProfitRows(allProfitRowsForTarget);

    const draftCandidates = target.shopIds
      .map((sid) => draftMetricsByShopId.get(sid))
      .filter(Boolean) as Array<{ dedupNet: number; returns: number; duplicateCount: number }>;
    const draftSummary = draftCandidates.reduce(
      (acc, cur) => {
        acc.dedupNet += cur.dedupNet;
        acc.returns += cur.returns;
        acc.duplicateCount += cur.duplicateCount;
        return acc;
      },
      { dedupNet: 0, returns: 0, duplicateCount: 0 },
    );
    const hasDraft = draftCandidates.length > 0;

    // Use captured/deduped statement/profit rows as source of truth for divided
    // to avoid duplicated weeklySale aggregates.
    const sales = hasDraft ? draftSummary.dedupNet : profitSummary.net;
    const returns = hasDraft ? draftSummary.returns : 0;
    const duplicateCount = (hasDraft ? draftSummary.duplicateCount : 0) + profitSummary.duplicateCount;

    return {
      key: target.key,
      label: target.label,
      accountId: target.accountIds[0] ?? null,
      shopId: target.shopIds[0] ?? null,
      salesNetPayout: sales,
      profit: profitSummary.profit,
      buyingTotal: profitSummary.buying,
      pricedNetPayout: profitSummary.net,
      returns,
      duplicateCount,
      grossProfit: profitSummary.profit + returns,
    };
  });

  const totals = perAccount.reduce(
    (acc, row) => {
      acc.sales += money(row.salesNetPayout);
      acc.profit += money(row.profit);
      acc.returns += money(row.returns);
      acc.grossProfit += money(row.grossProfit);
      acc.duplicates += Number(row.duplicateCount ?? 0);
      return acc;
    },
    { sales: 0, profit: 0, returns: 0, grossProfit: 0, duplicates: 0 },
  );

  return NextResponse.json(
    {
      week: { weekStart: weekStart.toISOString(), weekEnd: weekEnd.toISOString(), weekStartInput: weekStartRaw },
      draftTableAvailable,
      accounts: perAccount,
      totals,
      generatedAt: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
        Pragma: "no-cache",
      },
    },
  );
}
