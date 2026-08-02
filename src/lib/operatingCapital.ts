import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getWeekEndInputFromExclusive } from "@/lib/dividedReport";
import { canonicalNairobiWeekStartUtc, mondayToSundayNairobiWindow, parseDateOnlyUtc } from "@/lib/weekWindow";
import type { PricingWeekSummary } from "@/lib/pricingWeekWhatsapp";
import {
  buildOperatingCapitalCompletionSnapshot,
  calculateOperatingCapitalFigures,
  isOperatingCapitalReadyToFinalize,
  resolveOperatingCapitalInputs,
} from "@/lib/operatingCapitalMath";

export const OPERATING_CAPITAL_ENTITY = "MarketplaceOperatingCapitalWeek";
export const OPERATING_CAPITAL_FINAL_ACTION = "OPERATING_CAPITAL_FINALIZED";
export const OPERATING_CAPITAL_AUTO_FINAL_ACTION = "OPERATING_CAPITAL_AUTO_FINALIZED";
export const OPERATING_CAPITAL_REOPEN_ACTION = "OPERATING_CAPITAL_REOPENED";
export const OPERATING_CAPITAL_RECALCULATE_ACTION = "OPERATING_CAPITAL_RECALCULATED";

export type OperatingCapitalSummary = {
  weekStart: string;
  weekEnd: string;
  periodKey: string;
  accountId: string | null;
  scopeKey: string;
  grossSalesBeforeDeduction: number;
  profit: number;
  currentNetPayout: number;
  operatingCapital: number;
  netPayoutAfterDeduction: number;
  adjustedNetPayout: number;
  label: "Estimated operating capital (50% of profit)" | "Final operating capital (50% of profit)";
  statusLabel: "Estimated" | "Final";
  isFinal: boolean;
  canFinalize: boolean;
  completion: {
    accountsSubmitted: number;
    totalAccounts: number;
    accountsNotSubmitted: number;
    accountsNotLoaded: number;
    missingPricing: number;
    accountsMarkedZero: number;
  };
  finalizedRecordId: string | null;
  finalizedAt: string | null;
};

function roundKes(value: Prisma.Decimal | number | string | null | undefined) {
  return new Prisma.Decimal(String(value ?? 0)).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
}

function toNumber(value: Prisma.Decimal) {
  return Number(value.toFixed(0));
}

function figuresMatchRecord(
  record: any,
  figures: ReturnType<typeof calculateOperatingCapitalFigures>,
) {
  return (
    roundKes(record?.profitAmount).equals(figures.profit) &&
    roundKes(record?.currentNetPayout).equals(figures.currentNetPayout) &&
    roundKes(record?.operatingCapital).equals(figures.operatingCapital) &&
    roundKes(record?.adjustedNetPayout).equals(figures.adjustedNetPayout)
  );
}

function buildScopeKey(weekStartInput: string, accountId?: string | null) {
  return accountId ? `ACCOUNT:${accountId}:${weekStartInput}` : `ALL:${weekStartInput}`;
}

function snapshotRecord(record: any) {
  if (!record) return null;
  return {
    id: String(record.id ?? ""),
    scopeKey: String(record.scopeKey ?? ""),
    accountId: record.accountId ? String(record.accountId) : null,
    weekStart: record.weekStart ? new Date(record.weekStart).toISOString() : null,
    weekEnd: record.weekEnd ? new Date(record.weekEnd).toISOString() : null,
    periodKey: String(record.periodKey ?? ""),
    profitAmount: Number(record.profitAmount ?? 0),
    currentNetPayout: Number(record.currentNetPayout ?? 0),
    operatingCapital: Number(record.operatingCapital ?? 0),
    adjustedNetPayout: Number(record.adjustedNetPayout ?? 0),
    status: String(record.status ?? ""),
    finalizedAt: record.finalizedAt ? new Date(record.finalizedAt).toISOString() : null,
    finalizedById: record.finalizedById ? String(record.finalizedById) : null,
    reopenedAt: record.reopenedAt ? new Date(record.reopenedAt).toISOString() : null,
    reopenedById: record.reopenedById ? String(record.reopenedById) : null,
    createdAt: record.createdAt ? new Date(record.createdAt).toISOString() : null,
    updatedAt: record.updatedAt ? new Date(record.updatedAt).toISOString() : null,
  };
}

async function getExistingRecord(scopeKey: string) {
  try {
    return await (prisma as any).marketplaceOperatingCapitalWeek.findUnique({
      where: { scopeKey },
    });
  } catch (err: any) {
    if (err?.code === "P2021") return null;
    throw err;
  }
}

async function writeFinalRecord(input: {
  action: string;
  actorId: string;
  weekStart: Date;
  weekEnd: Date;
  weekStartInput: string;
  periodKey: string;
  accountId?: string | null;
  figures: ReturnType<typeof calculateOperatingCapitalFigures>;
}) {
  const scopeKey = buildScopeKey(input.weekStartInput, input.accountId);
  const before = await getExistingRecord(scopeKey);
  const finalizedAt = new Date();

  const record = await (prisma as any).marketplaceOperatingCapitalWeek.upsert({
    where: { scopeKey },
    update: {
      accountId: input.accountId ?? null,
      weekStart: input.weekStart,
      weekEnd: input.weekEnd,
      periodKey: input.periodKey,
      profitAmount: input.figures.profit,
      currentNetPayout: input.figures.currentNetPayout,
      operatingCapital: input.figures.operatingCapital,
      adjustedNetPayout: input.figures.adjustedNetPayout,
      status: "FINAL",
      finalizedAt,
      finalizedById: input.actorId,
      reopenedAt: null,
      reopenedById: null,
    },
    create: {
      scopeKey,
      accountId: input.accountId ?? null,
      weekStart: input.weekStart,
      weekEnd: input.weekEnd,
      periodKey: input.periodKey,
      profitAmount: input.figures.profit,
      currentNetPayout: input.figures.currentNetPayout,
      operatingCapital: input.figures.operatingCapital,
      adjustedNetPayout: input.figures.adjustedNetPayout,
      status: "FINAL",
      finalizedAt,
      finalizedById: input.actorId,
    },
  });

  await prisma.actionLog.create({
    data: {
      actorId: input.actorId,
      entity: OPERATING_CAPITAL_ENTITY,
      entityId: scopeKey,
      action: input.action,
      before: snapshotRecord(before) as Prisma.InputJsonValue,
      after: snapshotRecord(record) as Prisma.InputJsonValue,
    },
  });

  return record;
}

export async function getOperatingCapitalSummary(input: {
  weekStartRaw: string;
  periodKey: string;
  completionSummary: PricingWeekSummary;
  profit: number;
  currentNetPayout: number;
  accountId?: string | null;
  actorId?: string | null;
}): Promise<OperatingCapitalSummary> {
  const parsed = parseDateOnlyUtc(input.weekStartRaw);
  if (!parsed) throw new Error("Invalid weekStart");

  const weekStart = canonicalNairobiWeekStartUtc(parsed);
  const { weekEnd } = mondayToSundayNairobiWindow(weekStart);
  const weekEndInput = getWeekEndInputFromExclusive(weekEnd);
  const scopeKey = buildScopeKey(input.weekStartRaw, input.accountId);
  const completion = buildOperatingCapitalCompletionSnapshot(input.completionSummary);
  const figures = calculateOperatingCapitalFigures({ profit: input.profit, currentNetPayout: input.currentNetPayout });

  let existing = await getExistingRecord(scopeKey);
  if ((!existing || String(existing.status) !== "FINAL") && isOperatingCapitalReadyToFinalize(input.completionSummary) && input.actorId) {
    try {
      existing = await writeFinalRecord({
        action: existing ? OPERATING_CAPITAL_RECALCULATE_ACTION : OPERATING_CAPITAL_AUTO_FINAL_ACTION,
        actorId: input.actorId,
        weekStart,
        weekEnd,
        weekStartInput: input.weekStartRaw,
        periodKey: input.periodKey,
        accountId: input.accountId ?? null,
        figures,
      });
    } catch (err: any) {
      if (err?.code !== "P2021") throw err;
    }
  }

  if (
    existing &&
    String(existing.status) === "FINAL" &&
    !figuresMatchRecord(existing, figures) &&
    input.actorId
  ) {
    try {
      existing = await writeFinalRecord({
        action: OPERATING_CAPITAL_RECALCULATE_ACTION,
        actorId: input.actorId,
        weekStart,
        weekEnd,
        weekStartInput: input.weekStartRaw,
        periodKey: input.periodKey,
        accountId: input.accountId ?? null,
        figures,
      });
    } catch (err: any) {
      if (err?.code !== "P2021") throw err;
    }
  }

  const finalRecord = existing && String(existing.status) === "FINAL" ? existing : null;
  const useFinalRecord = finalRecord ? figuresMatchRecord(finalRecord, figures) : false;
  const profit = useFinalRecord ? roundKes((finalRecord as any).profitAmount) : figures.profit;
  const currentNetPayout = useFinalRecord ? roundKes((finalRecord as any).currentNetPayout) : figures.currentNetPayout;
  const operatingCapital = useFinalRecord ? roundKes((finalRecord as any).operatingCapital) : figures.operatingCapital;
  const adjustedNetPayout = useFinalRecord ? roundKes((finalRecord as any).adjustedNetPayout) : figures.adjustedNetPayout;
  const isFinal = Boolean(finalRecord);

  return {
    weekStart: input.weekStartRaw,
    weekEnd: weekEndInput,
    periodKey: input.periodKey,
    accountId: input.accountId ?? null,
    scopeKey,
    grossSalesBeforeDeduction: toNumber(currentNetPayout),
    profit: toNumber(profit),
    currentNetPayout: toNumber(currentNetPayout),
    operatingCapital: toNumber(operatingCapital),
    netPayoutAfterDeduction: toNumber(adjustedNetPayout),
    adjustedNetPayout: toNumber(adjustedNetPayout),
    label: isFinal ? "Final operating capital (50% of profit)" : "Estimated operating capital (50% of profit)",
    statusLabel: isFinal ? "Final" : "Estimated",
    isFinal,
    canFinalize: isOperatingCapitalReadyToFinalize(input.completionSummary),
    completion,
    finalizedRecordId: finalRecord ? String((finalRecord as any).id) : null,
    finalizedAt: finalRecord && (finalRecord as any).finalizedAt ? new Date((finalRecord as any).finalizedAt).toISOString() : null,
  };
}

export function resolveOperatingCapitalSummaryInputs(input: {
  completionSummary?: PricingWeekSummary | null;
  fallbackProfit?: number | null;
  fallbackCurrentNetPayout?: number | null;
}) {
  return resolveOperatingCapitalInputs(input);
}

export async function finalizeOperatingCapital(input: {
  weekStartRaw: string;
  periodKey: string;
  completionSummary: PricingWeekSummary;
  profit: number;
  currentNetPayout: number;
  actorId: string;
  accountId?: string | null;
}) {
  const parsed = parseDateOnlyUtc(input.weekStartRaw);
  if (!parsed) throw new Error("Invalid weekStart");
  if (!isOperatingCapitalReadyToFinalize(input.completionSummary)) throw new Error("Week is not ready to finalize operating capital");

  const weekStart = canonicalNairobiWeekStartUtc(parsed);
  const { weekEnd } = mondayToSundayNairobiWindow(weekStart);
  const figures = calculateOperatingCapitalFigures({ profit: input.profit, currentNetPayout: input.currentNetPayout });

  await writeFinalRecord({
    action: OPERATING_CAPITAL_RECALCULATE_ACTION,
    actorId: input.actorId,
    weekStart,
    weekEnd,
    weekStartInput: input.weekStartRaw,
    periodKey: input.periodKey,
    accountId: input.accountId ?? null,
    figures,
  });

  return getOperatingCapitalSummary({
    weekStartRaw: input.weekStartRaw,
    periodKey: input.periodKey,
    completionSummary: input.completionSummary,
    profit: input.profit,
    currentNetPayout: input.currentNetPayout,
    actorId: input.actorId,
    accountId: input.accountId ?? null,
  });
}

export async function reopenOperatingCapital(input: {
  weekStartRaw: string;
  periodKey: string;
  completionSummary: PricingWeekSummary;
  profit: number;
  currentNetPayout: number;
  actorId: string;
  accountId?: string | null;
}) {
  const scopeKey = buildScopeKey(input.weekStartRaw, input.accountId);
  const existing = await getExistingRecord(scopeKey);
  if (!existing || String((existing as any).status) !== "FINAL") {
    throw new Error("No final operating capital record exists for this week");
  }

  const updated = await (prisma as any).marketplaceOperatingCapitalWeek.update({
    where: { scopeKey },
    data: {
      status: "REOPENED",
      reopenedAt: new Date(),
      reopenedById: input.actorId,
    },
  });

  await prisma.actionLog.create({
    data: {
      actorId: input.actorId,
      entity: OPERATING_CAPITAL_ENTITY,
      entityId: scopeKey,
      action: OPERATING_CAPITAL_REOPEN_ACTION,
      before: snapshotRecord(existing) as Prisma.InputJsonValue,
      after: snapshotRecord(updated) as Prisma.InputJsonValue,
    },
  });

  return getOperatingCapitalSummary({
    weekStartRaw: input.weekStartRaw,
    periodKey: input.periodKey,
    completionSummary: input.completionSummary,
    profit: input.profit,
    currentNetPayout: input.currentNetPayout,
    accountId: input.accountId ?? null,
    actorId: null,
  });
}
