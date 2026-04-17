import { Prisma, WeeklySaleStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getWeekEndInputFromExclusive } from "@/lib/dividedReport";
import { resolveShopIdsForMarketplaceAccount } from "@/lib/marketplaceAccountShopResolve";
import { isMarketplaceStatementDraftTableAvailable } from "@/lib/statementDraftTable";
import { syncDividedChatraceContact } from "@/lib/integrations/chatraceDivided";
import { canonicalNairobiWeekStartUtc, mondayToSundayNairobiWindow, parseDateOnlyUtc } from "@/lib/weekWindow";

export const PRICING_WEEK_TEMPLATE_NAME = "pricing_week_complete_admin_v2";
export const PRICING_WEEK_READY_TAG = "pricing_week_complete_ready";
export const PRICING_WEEK_SENT_TAG = "pricing_week_complete_admin_sent";
export const PRICING_WEEK_FLOW = "pricing_week_complete_admin_flow";
export const PRICING_WEEK_ENTITY = "PricingWeekCompleteWhatsApp";
export const PRICING_WEEK_SUCCESS_ACTION = "SEND_SUCCESS";

const DEFAULT_ADMIN_PHONE = "254705663175";

export type PricingWeekAccountStatus = {
  accountId: string;
  displayName: string;
  platform: string;
  shopIds: string[];
  markedZero: boolean;
  hasDraft: boolean;
  draftComplete: boolean;
  hasProfitEntries: boolean;
  missingPricing: number;
  complete: boolean;
};

export type PricingWeekSummary = {
  week_start: string;
  week_end: string;
  accounts_total: number;
  accounts_completed: number;
  accounts_zero: number;
  missing_pricing: number;
  total_net_payout: number;
  gross_profit: number;
  net_profit: number;
  returns: number;
  loss_entries: number;
  avg_commission_pct: number;
  priced_entries: number;
  completed_accounts_list: string;
  zero_accounts_list: string;
  reference: string;
  eligible: boolean;
  accounts: PricingWeekAccountStatus[];
};

function money(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function sanitizeNames(items: string[]) {
  const clean = items.map((item) => String(item ?? "").trim()).filter(Boolean);
  return clean.length ? clean.join(", ") : "None";
}

function buildReference(weekEndInput: string) {
  return `OPS-${weekEndInput}`;
}

function getAdminPhone() {
  return (
    process.env.CHATRACE_INTERNAL_ADMIN_PHONE ||
    process.env.ADMIN_PHONE ||
    process.env.DIVIDED_ADMIN_PHONE ||
    DEFAULT_ADMIN_PHONE
  )
    .toString()
    .trim();
}

async function loadAccounts(accountIds?: string[]) {
  return prisma.marketplaceAccount.findMany({
    where: {
      isActive: true,
      ...(accountIds?.length ? { id: { in: accountIds } } : {}),
    },
    select: {
      id: true,
      displayName: true,
      platform: true,
    },
    orderBy: [{ platform: "asc" }, { displayName: "asc" }],
  });
}

export async function getPricingWeekSummary(weekStartRaw: string, opts?: { accountIds?: string[] }): Promise<PricingWeekSummary> {
  const parsed = parseDateOnlyUtc(weekStartRaw);
  if (!parsed) throw new Error("Invalid weekStart");

  const weekStart = canonicalNairobiWeekStartUtc(parsed);
  const { weekEnd } = mondayToSundayNairobiWindow(weekStart);
  const weekEndInput = getWeekEndInputFromExclusive(weekEnd);
  const accounts = await loadAccounts(opts?.accountIds);

  const accountsWithShops = await Promise.all(
    accounts.map(async (account) => ({
      account,
      shopIds: await resolveShopIdsForMarketplaceAccount(account.id),
    })),
  );

  const allAccountIds = accounts.map((account) => account.id);
  const allShopIds = [...new Set(accountsWithShops.flatMap((entry) => entry.shopIds))];

  const [weeklySales, draftTableAvailable, profitRows] = await Promise.all([
    allShopIds.length
      ? prisma.weeklySale.findMany({
          where: {
            shopId: { in: allShopIds },
            weekStart,
            weekEnd,
            status: { not: WeeklySaleStatus.REJECTED },
          },
          select: { shopId: true, amount: true },
        })
      : Promise.resolve([]),
    isMarketplaceStatementDraftTableAvailable(),
    allAccountIds.length
      ? (prisma as any).marketplaceProfitEntry.findMany({
          where: { weekStart, weekEnd, accountId: { in: allAccountIds } },
          select: {
            accountId: true,
            netPayout: true,
            profit: true,
            buyingPrice: true,
            commissionRatePct: true,
          },
          take: 50000,
        })
      : Promise.resolve([]),
  ]);

  const latestDraftByAccountId = new Map<string, { rowCount: number; submittedCount: number; updatedAt: number }>();
  if (draftTableAvailable && (allShopIds.length || allAccountIds.length)) {
    try {
      const drafts = await prisma.marketplaceStatementDraft.findMany({
        where: {
          weekStart,
          weekEnd,
          OR: [{ shopId: { in: allShopIds } }, { accountId: { in: allAccountIds } }],
        },
        select: { shopId: true, accountId: true, rowCount: true, submittedByTxn: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: Math.max(50, allAccountIds.length * 4),
      });

      const accountIdByShopId = new Map<string, string>();
      for (const entry of accountsWithShops) {
        for (const shopId of entry.shopIds) accountIdByShopId.set(shopId, entry.account.id);
      }

      for (const draft of drafts) {
        const resolvedAccountId =
          String(draft.accountId ?? "").trim() ||
          accountIdByShopId.get(String(draft.shopId ?? "").trim()) ||
          "";
        if (!resolvedAccountId) continue;
        if (latestDraftByAccountId.has(resolvedAccountId)) continue;
        const submittedCount =
          draft.submittedByTxn && typeof draft.submittedByTxn === "object" ? Object.keys(draft.submittedByTxn as any).length : 0;
        latestDraftByAccountId.set(resolvedAccountId, {
          rowCount: Number(draft.rowCount ?? 0),
          submittedCount,
          updatedAt: draft.updatedAt.getTime(),
        });
      }
    } catch (err: any) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2021")) throw err;
    }
  }

  const weeklySalesByShopId = new Map<string, number[]>();
  for (const row of weeklySales) {
    const shopId = String(row.shopId ?? "").trim();
    if (!shopId) continue;
    if (!weeklySalesByShopId.has(shopId)) weeklySalesByShopId.set(shopId, []);
    weeklySalesByShopId.get(shopId)!.push(money(row.amount));
  }

  const profitRowsByAccountId = new Map<
    string,
    Array<{ netPayout: number; profit: number; buyingPrice: number; commissionRatePct: number }>
  >();
  for (const row of profitRows as any[]) {
    const accountId = String(row.accountId ?? "").trim();
    if (!accountId) continue;
    if (!profitRowsByAccountId.has(accountId)) profitRowsByAccountId.set(accountId, []);
    profitRowsByAccountId.get(accountId)!.push({
      netPayout: money(row.netPayout),
      profit: money(row.profit),
      buyingPrice: money(row.buyingPrice),
      commissionRatePct: money(row.commissionRatePct),
    });
  }

  const accountStatuses: PricingWeekAccountStatus[] = accountsWithShops.map(({ account, shopIds }) => {
    const accountProfitRows = profitRowsByAccountId.get(account.id) ?? [];
    const accountWeeklySales = shopIds.flatMap((shopId) => weeklySalesByShopId.get(shopId) ?? []);
    const markedZero = accountWeeklySales.length > 0 && accountWeeklySales.every((amount) => amount === 0);
    const draftState = latestDraftByAccountId.get(account.id) ?? null;
    const hasDraft = Boolean(draftState);
    const draftComplete = Boolean(draftState && draftState.rowCount > 0 && draftState.submittedCount >= draftState.rowCount);
    const hasProfitEntries = accountProfitRows.length > 0;
    const missingPricing = markedZero ? 0 : accountProfitRows.filter((row) => row.buyingPrice <= 0).length;
    const complete = markedZero || (missingPricing === 0 && ((hasDraft && draftComplete) || (!hasDraft && hasProfitEntries)));

    return {
      accountId: account.id,
      displayName: String(account.displayName ?? account.id),
      platform: String(account.platform),
      shopIds,
      markedZero,
      hasDraft,
      draftComplete,
      hasProfitEntries,
      missingPricing,
      complete,
    };
  });

  const totalNetFromWeeklySales = weeklySales.reduce((sum, row) => sum + money(row.amount), 0);
  const totalNetFromProfitRows = (profitRows as any[]).reduce((sum, row) => sum + money(row.netPayout), 0);
  const totalNetPayout = totalNetFromWeeklySales !== 0 ? totalNetFromWeeklySales : totalNetFromProfitRows;
  const netProfit = (profitRows as any[]).reduce((sum, row) => sum + money(row.profit), 0);
  const returns = (profitRows as any[]).reduce((sum, row) => {
    const net = money(row.netPayout);
    return sum + (net < 0 ? Math.abs(net) : 0);
  }, 0);
  const grossProfit = netProfit + returns;
  const lossEntries = (profitRows as any[]).filter((row) => money(row.profit) < 0).length;
  const avgCommissionPct =
    (profitRows as any[]).length > 0
      ? (profitRows as any[]).reduce((sum, row) => sum + money(row.commissionRatePct), 0) / (profitRows as any[]).length
      : 0;
  const pricedEntries = (profitRows as any[]).filter((row) => money(row.buyingPrice) > 0).length;
  const accountsCompleted = accountStatuses.filter((account) => account.complete).length;
  const accountsZero = accountStatuses.filter((account) => account.markedZero).length;
  const missingPricing = accountStatuses.reduce((sum, account) => sum + account.missingPricing, 0);

  return {
    week_start: weekStart.toISOString().slice(0, 10),
    week_end: weekEndInput,
    accounts_total: accountStatuses.length,
    accounts_completed: accountsCompleted,
    accounts_zero: accountsZero,
    missing_pricing: missingPricing,
    total_net_payout: Math.round(totalNetPayout),
    gross_profit: Math.round(grossProfit),
    net_profit: Math.round(netProfit),
    returns: Math.round(returns),
    loss_entries: lossEntries,
    avg_commission_pct: Number(avgCommissionPct.toFixed(1)),
    priced_entries: pricedEntries,
    completed_accounts_list: sanitizeNames(accountStatuses.filter((account) => account.complete).map((account) => account.displayName)),
    zero_accounts_list: sanitizeNames(accountStatuses.filter((account) => account.markedZero).map((account) => account.displayName)),
    reference: buildReference(weekEndInput),
    eligible: accountStatuses.length > 0 && accountsCompleted === accountStatuses.length && missingPricing === 0,
    accounts: accountStatuses,
  };
}

async function logPricingWeekAttempt(input: {
  actorId: string;
  weekStart: string;
  action: string;
  payload: Record<string, unknown>;
}) {
  await prisma.actionLog.create({
    data: {
      actorId: input.actorId,
      entity: PRICING_WEEK_ENTITY,
      entityId: input.weekStart,
      action: input.action,
      after: input.payload as unknown as Prisma.InputJsonValue,
    },
  });
}

async function findExistingSuccess(weekStart: string, reference: string) {
  return prisma.actionLog.findFirst({
    where: {
      entity: PRICING_WEEK_ENTITY,
      entityId: weekStart,
      action: PRICING_WEEK_SUCCESS_ACTION,
      after: {
        path: ["reference"],
        equals: reference,
      } as any,
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true, after: true },
  });
}

export async function sendPricingWeekWhatsapp(input: {
  weekStartRaw: string;
  actorId: string;
  force?: boolean;
}) {
  const summary = await getPricingWeekSummary(input.weekStartRaw);
  const templateName = PRICING_WEEK_TEMPLATE_NAME;
  const recipient = getAdminPhone();

  if (!summary.eligible) {
    const payload = {
      week_start: summary.week_start,
      week_end: summary.week_end,
      reference: summary.reference,
      template_name: templateName,
      tag_applied: PRICING_WEEK_READY_TAG,
      recipient,
      payload_snapshot: summary,
      status: "not_eligible",
      provider_message_id: null,
      error:
        summary.accounts_completed !== summary.accounts_total
          ? "not all accounts complete"
          : summary.missing_pricing !== 0
            ? "missing pricing still exists"
            : "week not eligible",
      created_at: new Date().toISOString(),
    };
    await logPricingWeekAttempt({
      actorId: input.actorId,
      weekStart: summary.week_start,
      action: "SEND_SKIPPED_NOT_ELIGIBLE",
      payload,
    });
    return { ok: false, status: "not_eligible", reason: payload.error, summary };
  }

  if (!input.force) {
    const existing = await findExistingSuccess(summary.week_start, summary.reference);
    if (existing) {
      const payload = {
        week_start: summary.week_start,
        week_end: summary.week_end,
        reference: summary.reference,
        template_name: templateName,
        tag_applied: PRICING_WEEK_READY_TAG,
        recipient,
        payload_snapshot: summary,
        status: "already_sent",
        provider_message_id: null,
        error: null,
        created_at: new Date().toISOString(),
        existing_log_id: existing.id,
      };
      await logPricingWeekAttempt({
        actorId: input.actorId,
        weekStart: summary.week_start,
        action: "SEND_SKIPPED_ALREADY_SENT",
        payload,
      });
      return { ok: true, status: "already_sent", summary, existing_log_id: existing.id };
    }
  }

  const chatracePayload = {
    week_start: summary.week_start,
    week_end: summary.week_end,
    accounts_completed: summary.accounts_completed,
    accounts_zero: summary.accounts_zero,
    missing_pricing: summary.missing_pricing,
    total_net_payout: summary.total_net_payout,
    gross_profit: summary.gross_profit,
    net_profit: summary.net_profit,
    returns: summary.returns,
    loss_entries: summary.loss_entries,
    avg_commission_pct: summary.avg_commission_pct,
    priced_entries: summary.priced_entries,
    completed_accounts_list: summary.completed_accounts_list,
    zero_accounts_list: summary.zero_accounts_list,
    reference: summary.reference,
    pricing_week_template_name: templateName,
    pricing_week_flow: PRICING_WEEK_FLOW,
  };

  try {
    const syncResult = await syncDividedChatraceContact({
      phone: recipient,
      firstName: "Pricing Admin",
      fields: chatracePayload,
      tagsToRemove: [PRICING_WEEK_READY_TAG],
      tagsToAdd: [PRICING_WEEK_READY_TAG],
      tagDelayMs: 1500,
    });
    if (!syncResult.ok) {
      throw new Error(`Failed to trigger Chatrace pricing week flow: ${syncResult.debug.error ?? "unknown"}`);
    }

    const payload = {
      week_start: summary.week_start,
      week_end: summary.week_end,
      reference: summary.reference,
      template_name: templateName,
      tag_applied: PRICING_WEEK_READY_TAG,
      recipient,
      payload_snapshot: summary,
      status: "triggered",
      provider_message_id: null,
      error: null,
      created_at: new Date().toISOString(),
      chatrace: syncResult.debug,
    };
    await logPricingWeekAttempt({
      actorId: input.actorId,
      weekStart: summary.week_start,
      action: PRICING_WEEK_SUCCESS_ACTION,
      payload,
    });

    return {
      ok: true,
      status: "triggered",
      summary,
      template_name: templateName,
      tag_applied: PRICING_WEEK_READY_TAG,
      recipient,
      chatrace: syncResult.debug,
    };
  } catch (err: any) {
    const payload = {
      week_start: summary.week_start,
      week_end: summary.week_end,
      reference: summary.reference,
      template_name: templateName,
      tag_applied: PRICING_WEEK_READY_TAG,
      recipient,
      payload_snapshot: summary,
      status: "failed",
      provider_message_id: null,
      error: err?.message || String(err),
      created_at: new Date().toISOString(),
    };
    await logPricingWeekAttempt({
      actorId: input.actorId,
      weekStart: summary.week_start,
      action: "SEND_FAILED",
      payload,
    });
    throw err;
  }
}

export async function maybeAutoSendPricingWeekWhatsapp(input: {
  weekStartRaw: string;
  actorId: string;
  source: string;
}) {
  const result = await sendPricingWeekWhatsapp({
    weekStartRaw: input.weekStartRaw,
    actorId: input.actorId,
    force: false,
  });

  return {
    source: input.source,
    ...result,
  };
}
