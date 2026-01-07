import { canonicalNairobiWeekStartUtc, parseDateOnlyUtc } from "./weekWindow";
import { deriveStatementStatus } from "./statementStatus";
import type { Decimal } from "@prisma/client/runtime";

type StatementRowLike = {
  weekStart: Date;
  updatedAt?: Date | null;
  createdAt?: Date | null;
  statementNumber?: string | null;
  payoutAmount?: number | Decimal | null;
  grossSales?: number | Decimal | null;
  rawPayload?: any;
  isPaid?: boolean | null;
  account?: { displayName?: string | null };
};

const STATUS_PRIORITY: Record<string, number> = {
  PAID: 3,
  OPEN: 2,
  UNPAID: 1,
};

function getUpdatedTimestamp(row: StatementRowLike): number {
  return row.updatedAt?.getTime() ?? row.createdAt?.getTime() ?? 0;
}

function normalizedStatementNumber(row: StatementRowLike) {
  return String(row.statementNumber ?? "").toUpperCase();
}

function hasStatementSuffix(row: StatementRowLike) {
  return /(OPEN|PAID|UNPAID)$/.test(normalizedStatementNumber(row));
}

export function chooseAuthoritativeCandidate(rows: StatementRowLike[], canonicalWeekStart: Date): StatementRowLike | null {
  if (!rows.length) return null;
  let best: StatementRowLike | null = null;
  const canonicalStartMs = canonicalWeekStart.getTime();

  const computeRank = (row: StatementRowLike) => {
    const rowStart = canonicalNairobiWeekStartUtc(new Date(row.weekStart));
    const parsedPeriodStart = parseDateOnlyUtc((row.rawPayload as any)?.period?.startDate ?? null);
    const periodMatch =
      parsedPeriodStart &&
      canonicalNairobiWeekStartUtc(parsedPeriodStart).getTime() === canonicalStartMs
        ? 1
        : 0;
    const statusLabel = deriveStatementStatus(row.statementNumber, row.isPaid).label;
    const statusRank = STATUS_PRIORITY[statusLabel] ?? 0;
    const updatedScore = getUpdatedTimestamp(row);
    const payoutValue = Number(row.payoutAmount ?? row.grossSales ?? 0);
    const diff = Math.abs(rowStart.getTime() - canonicalStartMs);
    return {
      periodMatch,
      statusRank,
      updatedScore,
      payoutValue,
      diff,
      suffixBonus: hasStatementSuffix(row) ? 1 : 0,
    };
  };

  for (const row of rows) {
    if (!best) {
      best = row;
      continue;
    }
    const currentRank = computeRank(row);
    const bestRank = computeRank(best);
    if (currentRank.periodMatch !== bestRank.periodMatch) {
      if (currentRank.periodMatch > bestRank.periodMatch) best = row;
      continue;
    }
    if (currentRank.statusRank !== bestRank.statusRank) {
      if (currentRank.statusRank > bestRank.statusRank) best = row;
      continue;
    }
    if (currentRank.updatedScore !== bestRank.updatedScore) {
      if (currentRank.updatedScore > bestRank.updatedScore) best = row;
      continue;
    }
    if (currentRank.diff !== bestRank.diff) {
      if (currentRank.diff < bestRank.diff) best = row;
      continue;
    }
    if (currentRank.payoutValue !== bestRank.payoutValue) {
      if (currentRank.payoutValue > bestRank.payoutValue) best = row;
      continue;
    }
    if (currentRank.suffixBonus !== bestRank.suffixBonus) {
      if (currentRank.suffixBonus > bestRank.suffixBonus) best = row;
      continue;
    }
  }

  return best;
}

export function ensureCanonicalWeekStart(date: Date): Date {
  return canonicalNairobiWeekStartUtc(date);
}
