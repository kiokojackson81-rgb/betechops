import { Platform, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  canonicalNairobiWeekStartUtc,
  mondayToSundayNairobiWindow,
  parseDateOnlyUtc,
} from "@/lib/weekWindow";
import { isMarketplaceStatementDraftTableAvailable } from "@/lib/statementDraftTable";

export const DIVIDED_FIXED_DEDUCTION = 35000;
export const DIVIDED_RATE_PCT = 7;
export const DIVIDED_SHARE_PHONE =
  (process.env.DIVIDED_SHARE_PHONE || "").toString().trim() || "254725492923";
export const DIVIDED_ADMIN_PHONE =
  (process.env.DIVIDED_ADMIN_PHONE || "").toString().trim() || "254705663175";

export const DIVIDED_TARGETS = [
  { key: "betech-store", label: "Betech Store", primary: "Betech Store", fallback: ["Betech"] },
  { key: "jude-collection", label: "Jude Collection", primary: "Jude Collection", fallback: ["Jude"] },
  { key: "hitech-power", label: "Hitech Power", primary: "Hitech Power", fallback: ["Hitech"] },
  {
    key: "jm-latest",
    label: "JM Latest Collections",
    primary: "JM Latest Collections",
    fallback: ["JM Collection", "JM Collections"],
  },
] as const;

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

export type DividedAccountRow = {
  key: string;
  label: string;
  accountId: string | null;
  shopId: string | null;
  salesNetPayout: number;
  profit: number;
  buyingTotal: number;
  pricedNetPayout: number;
  returns: number;
  duplicateCount: number;
  grossProfit: number;
};

export type DividedReportPayload = {
  week: { weekStart: string; weekEnd: string; weekStartInput: string; weekEndInput: string };
  draftTableAvailable: boolean;
  accounts: DividedAccountRow[];
  totals: { sales: number; profit: number; returns: number; grossProfit: number; duplicates: number };
  generatedAt: string;
};

export type DividedComputedValues = {
  totalSales: number;
  returns: number;
  grossProfit: number;
  baseProfit: number;
  divided: number;
  hitechPayout: number;
  equity: number;
  reference: string;
};

export type DividedCompletionTargetState = {
  key: string;
  label: string;
  accountId: string | null;
  shopId: string | null;
  hasDraft: boolean;
  draftComplete: boolean;
  markedZero: boolean;
  hasProfitEntries: boolean;
  ready: boolean;
};

export type DividedCompletionState = {
  weekStartInput: string;
  weekEndInput: string;
  ready: boolean;
  targets: DividedCompletionTargetState[];
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

function containsNormalized(haystack: unknown, needle: unknown): boolean {
  const h = normalizeNameForMatch(haystack);
  const n = normalizeNameForMatch(needle);
  return Boolean(h && n && h.includes(n));
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

function summarizeProfitRows(
  rows: Array<{ itemCreditTxn: string; netPayout: number; buyingPrice: number; profit: number }>,
) {
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

async function resolveShopForAccount(account: {
  platform: Platform;
  displayName: string | null;
  jumiaShopSid: string | null;
}) {
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

async function resolveDividedTargets(): Promise<TargetResolved[]> {
  const accounts = await prisma.marketplaceAccount.findMany({
    where: {
      isActive: true,
      platform: "JUMIA",
      OR: DIVIDED_TARGETS.flatMap((t) => [
        { displayName: { contains: t.primary, mode: "insensitive" } as any },
        ...t.fallback.map((m) => ({ displayName: { contains: m, mode: "insensitive" } as any })),
      ]),
    },
    select: { id: true, displayName: true, platform: true, jumiaShopSid: true },
  });

  const shops = await prisma.shop.findMany({
    where: { platform: "JUMIA" as any },
    select: { id: true, name: true },
    take: 400,
  });

  const targetResolved: TargetResolved[] = [];
  for (const t of DIVIDED_TARGETS) {
    const primaryCandidates: AccountCandidate[] = accounts.filter((x) => containsNormalized(x.displayName, t.primary));
    const fallbackCandidates: AccountCandidate[] =
      primaryCandidates.length > 0
        ? primaryCandidates
        : accounts.filter((x) => t.fallback.some((m) => containsNormalized(x.displayName, m)));
    const candidates = fallbackCandidates;
    const accountIds = [...new Set(candidates.map((c) => c.id))];
    const shopIdsSet = new Set<string>();
    for (const candidate of candidates) {
      const shop = await resolveShopForAccount(candidate);
      if (shop?.id) shopIdsSet.add(shop.id);
    }
    const primaryShops = shops.filter((s) => containsNormalized(s.name, t.primary));
    const fallbackShops =
      primaryShops.length > 0 ? primaryShops : shops.filter((s) => t.fallback.some((m) => containsNormalized(s.name, m)));
    for (const s of fallbackShops) {
      shopIdsSet.add(s.id);
    }
    targetResolved.push({
      key: t.key,
      label: t.label,
      accountIds,
      shopIds: [...shopIdsSet],
    });
  }

  return targetResolved;
}

export function getWeekEndInputFromExclusive(weekEndExclusive: Date) {
  return new Date(weekEndExclusive.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function buildDividedReference(weekEndInput: string) {
  return `DIV-${weekEndInput}`;
}

export function computeDividedValues(report: Pick<DividedReportPayload, "accounts" | "totals" | "week">): DividedComputedValues {
  const totalSales = money(report.totals.sales);
  const returns = money(report.totals.returns);
  const grossProfit = money(report.totals.grossProfit);
  const baseProfit = grossProfit - DIVIDED_FIXED_DEDUCTION;
  const divided = Math.max(0, Math.round((baseProfit * DIVIDED_RATE_PCT) / 100));
  const hitechPayout = money(report.accounts.find((row) => row.key === "hitech-power")?.salesNetPayout);
  const equity = Math.round(hitechPayout - divided - DIVIDED_FIXED_DEDUCTION);
  const reference = buildDividedReference(report.week.weekEndInput);

  return {
    totalSales,
    returns,
    grossProfit,
    baseProfit,
    divided,
    hitechPayout,
    equity,
    reference,
  };
}

export async function getDividedReportForWeek(weekStartRaw: string): Promise<DividedReportPayload> {
  const parsed = parseDateOnlyUtc(weekStartRaw);
  if (!parsed) {
    throw new Error("Invalid weekStart");
  }
  const weekStart = canonicalNairobiWeekStartUtc(parsed);
  const { weekEnd } = mondayToSundayNairobiWindow(weekStart);
  const weekEndInput = getWeekEndInputFromExclusive(weekEnd);

  const targetResolved = await resolveDividedTargets();

  const allAccountIds = [...new Set(targetResolved.flatMap((t) => t.accountIds))];
  const allShopIds = [...new Set(targetResolved.flatMap((t) => t.shopIds))];

  const profitRows = allAccountIds.length
    ? await (prisma as any).marketplaceProfitEntry.findMany({
        where: { platform: "JUMIA", accountId: { in: allAccountIds }, weekStart, weekEnd },
        select: { accountId: true, itemCreditTxn: true, netPayout: true, buyingPrice: true, profit: true },
        take: 15000,
      })
    : [];

  const profitRowsByAccountId = new Map<
    string,
    Array<{ itemCreditTxn: string; netPayout: number; buyingPrice: number; profit: number }>
  >();
  for (const row of profitRows as any[]) {
    const key = String(row.accountId);
    if (!profitRowsByAccountId.has(key)) {
      profitRowsByAccountId.set(key, []);
    }
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
        if (draftMetricsByShopId.has(sid)) continue;
        const rows = Array.isArray(d.rows) ? (d.rows as any[]) : [];
        draftMetricsByShopId.set(sid, summarizeDraftRows(rows));
      }
    } catch (err: any) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2021")) {
        throw err;
      }
    }
  }

  const perAccount: DividedAccountRow[] = targetResolved.map((target) => {
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

  return {
    week: {
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      weekStartInput: weekStartRaw,
      weekEndInput,
    },
    draftTableAvailable,
    accounts: perAccount,
    totals,
    generatedAt: new Date().toISOString(),
  };
}

export async function getDividedCompletionStateForWeek(weekStartRaw: string): Promise<DividedCompletionState> {
  const parsed = parseDateOnlyUtc(weekStartRaw);
  if (!parsed) {
    throw new Error("Invalid weekStart");
  }
  const weekStart = canonicalNairobiWeekStartUtc(parsed);
  const { weekEnd } = mondayToSundayNairobiWindow(weekStart);
  const weekEndInput = getWeekEndInputFromExclusive(weekEnd);
  const targetResolved = await resolveDividedTargets();
  const allAccountIds = [...new Set(targetResolved.flatMap((target) => target.accountIds))];
  const allShopIds = [...new Set(targetResolved.flatMap((target) => target.shopIds))];

  const weeklySales = allShopIds.length
    ? await prisma.weeklySale.findMany({
        where: { shopId: { in: allShopIds }, weekStart, weekEnd },
        select: { shopId: true, amount: true },
      })
    : [];
  const zeroShopIds = new Set(
    weeklySales.filter((row) => money(row.amount) === 0).map((row) => String(row.shopId ?? "").trim()).filter(Boolean),
  );

  const draftTableAvailable = await isMarketplaceStatementDraftTableAvailable();
  const latestDraftByTargetKey = new Map<string, { rowCount: number; submittedCount: number }>();
  if (draftTableAvailable && (allShopIds.length || allAccountIds.length)) {
    try {
      const drafts = await prisma.marketplaceStatementDraft.findMany({
        where: {
          platform: "JUMIA",
          weekStart,
          weekEnd,
          OR: [{ shopId: { in: allShopIds } }, { accountId: { in: allAccountIds } }],
        },
        orderBy: { updatedAt: "desc" },
        select: { shopId: true, accountId: true, rowCount: true, submittedByTxn: true },
        take: Math.max(20, targetResolved.length * 4),
      });
      for (const draft of drafts) {
        const target = targetResolved.find(
          (item) => item.shopIds.includes(String(draft.shopId ?? "")) || item.accountIds.includes(String(draft.accountId ?? "")),
        );
        if (!target || latestDraftByTargetKey.has(target.key)) continue;
        const submittedCount =
          draft.submittedByTxn && typeof draft.submittedByTxn === "object" ? Object.keys(draft.submittedByTxn as any).length : 0;
        latestDraftByTargetKey.set(target.key, {
          rowCount: Number(draft.rowCount ?? 0),
          submittedCount,
        });
      }
    } catch (err: any) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2021")) {
        throw err;
      }
    }
  }

  const profitRows = allAccountIds.length
    ? await (prisma as any).marketplaceProfitEntry.findMany({
        where: { platform: "JUMIA", accountId: { in: allAccountIds }, weekStart, weekEnd },
        select: { accountId: true },
        take: 15000,
      })
    : [];
  const profitCountByAccountId = new Map<string, number>();
  for (const row of profitRows as any[]) {
    const accountId = String(row.accountId ?? "").trim();
    if (!accountId) continue;
    profitCountByAccountId.set(accountId, (profitCountByAccountId.get(accountId) ?? 0) + 1);
  }

  const targets: DividedCompletionTargetState[] = targetResolved.map((target) => {
    const draftState = latestDraftByTargetKey.get(target.key) ?? null;
    const hasDraft = Boolean(draftState);
    const draftComplete = Boolean(draftState && draftState.rowCount > 0 && draftState.submittedCount >= draftState.rowCount);
    const markedZero = target.shopIds.some((shopId) => zeroShopIds.has(shopId));
    const hasProfitEntries = target.accountIds.some((accountId) => (profitCountByAccountId.get(accountId) ?? 0) > 0);
    const ready = markedZero || draftComplete || (!hasDraft && hasProfitEntries);

    return {
      key: target.key,
      label: target.label,
      accountId: target.accountIds[0] ?? null,
      shopId: target.shopIds[0] ?? null,
      hasDraft,
      draftComplete,
      markedZero,
      hasProfitEntries,
      ready,
    };
  });

  return {
    weekStartInput: weekStart.toISOString().slice(0, 10),
    weekEndInput,
    ready: targets.every((target) => target.ready),
    targets,
  };
}
