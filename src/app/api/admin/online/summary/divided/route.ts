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

async function resolveShopForAccount(account: { id: string; platform: Platform; displayName: string | null; jumiaShopSid: string | null }) {
  const sid = normalize(account.jumiaShopSid);
  const name = normalize(account.displayName);
  const normalizedAccountName = normalizeNameForMatch(name);

  const shop =
    // Primary: canonical shop SID mapping.
    (sid
      ? await prisma.shop.findFirst({
          where: { platform: account.platform as any, jumiaShopSid: sid },
          select: { id: true, name: true },
        })
      : null) ??
    // Backward compatibility: older rows where SID was stored in apiConfig.apiKey.
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

  // Last resort: normalized display-name matching (handles "(JUMIA)" suffixes
  // and punctuation differences between account names and shop names).
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

  // Find the 4 Jumia accounts by displayName.
  const accounts = await prisma.marketplaceAccount.findMany({
    where: {
      isActive: true,
      platform: "JUMIA",
      OR: TARGETS.flatMap((t) => t.match.map((m) => ({ displayName: { contains: m, mode: "insensitive" } as any }))),
    },
    select: { id: true, displayName: true, platform: true, jumiaShopSid: true },
  });

  const chosen: Array<{
    key: string;
    label: string;
    accountId: string;
    displayName: string;
    shopId: string | null;
    shopName: string | null;
  }> = [];

  for (const t of TARGETS) {
    const a =
      accounts.find((x) => t.match.some((m) => (x.displayName ?? "").toLowerCase().includes(m.toLowerCase()))) ?? null;
    if (!a) {
      chosen.push({
        key: t.key,
        label: t.label,
        accountId: "",
        displayName: t.label,
        shopId: null,
        shopName: null,
      });
      continue;
    }
    const shop = await resolveShopForAccount(a as any);
    chosen.push({
      key: t.key,
      label: t.label,
      accountId: a.id,
      displayName: a.displayName ?? t.label,
      shopId: shop?.id ?? null,
      shopName: shop?.name ?? null,
    });
  }

  const shopIds = chosen.map((c) => c.shopId).filter(Boolean) as string[];
  const accountIds = chosen.map((c) => c.accountId).filter(Boolean) as string[];

  const weeklySales = shopIds.length
    ? await prisma.weeklySale.findMany({
        where: { platform: "JUMIA", shopId: { in: shopIds }, weekStart, weekEnd },
        select: { shopId: true, amount: true },
      })
    : [];
  const salesByShopId = new Map(weeklySales.map((r) => [String(r.shopId), money(r.amount)]));
  const salesShopIdSet = new Set(weeklySales.map((r) => String(r.shopId)));

  const profitRows = accountIds.length
    ? await (prisma as any).marketplaceProfitEntry.findMany({
        where: { platform: "JUMIA", accountId: { in: accountIds }, weekStart, weekEnd },
        select: { accountId: true, netPayout: true, buyingPrice: true, profit: true },
        take: 5000,
      })
    : [];

  const profitAggByAccountId = new Map<string, { net: number; buying: number; profit: number }>();
  for (const row of profitRows as any[]) {
    const id = String(row.accountId);
    const acc = profitAggByAccountId.get(id) ?? { net: 0, buying: 0, profit: 0 };
    acc.net += money(row.netPayout);
    acc.buying += money(row.buyingPrice);
    acc.profit += money(row.profit);
    profitAggByAccountId.set(id, acc);
  }

  // Returns from drafts (best-effort; only when DB draft table exists).
  const draftTableAvailable = await isMarketplaceStatementDraftTableAvailable();
  const returnsByShopId = new Map<string, number>();
  if (draftTableAvailable && shopIds.length) {
    try {
      const drafts = await prisma.marketplaceStatementDraft.findMany({
        where: { platform: "JUMIA", weekStart, weekEnd, shopId: { in: shopIds } },
        orderBy: { updatedAt: "desc" },
        select: { shopId: true, rows: true },
        take: 50,
      });

      for (const d of drafts) {
        const sid = String(d.shopId);
        if (returnsByShopId.has(sid)) continue;
        const rows = Array.isArray(d.rows) ? (d.rows as any[]) : [];
        const returns = rows.reduce((sum, r) => {
          const net = money((r as any)?.netPayout);
          return net < 0 ? sum + Math.abs(net) : sum;
        }, 0);
        returnsByShopId.set(sid, returns);
      }
    } catch (err: any) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2021")) throw err;
    }
  }

  const perAccount = chosen.map((c) => {
    const prof = c.accountId ? profitAggByAccountId.get(c.accountId) ?? { net: 0, buying: 0, profit: 0 } : { net: 0, buying: 0, profit: 0 };
    const salesFromWeekly = c.shopId ? salesByShopId.get(c.shopId) ?? 0 : 0;
    // If weeklySale row is missing for a mapped shop/account, fall back to
    // captured statement net payouts so divided stays accurate.
    const sales = c.shopId && salesShopIdSet.has(c.shopId) ? salesFromWeekly : prof.net;
    const returns = c.shopId ? returnsByShopId.get(c.shopId) ?? 0 : 0;
    return {
      key: c.key,
      label: c.label,
      accountId: c.accountId || null,
      shopId: c.shopId,
      salesNetPayout: sales,
      profit: prof.profit,
      buyingTotal: prof.buying,
      pricedNetPayout: prof.net,
      returns,
      grossProfit: prof.profit + returns,
    };
  });

  const totals = perAccount.reduce(
    (acc, r) => {
      acc.sales += money(r.salesNetPayout);
      acc.profit += money(r.profit);
      acc.returns += money(r.returns);
      acc.grossProfit += money(r.grossProfit);
      return acc;
    },
    { sales: 0, profit: 0, returns: 0, grossProfit: 0 },
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
