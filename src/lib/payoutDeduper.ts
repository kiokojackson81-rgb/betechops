import { canonicalNairobiWeekStartUtc, parseDateOnlyUtc } from "./weekWindow";
import { deriveStatementStatus } from "./statementStatus";

type NumericLike = {
  toNumber?: () => number;
  toString?: () => string;
};

export type Candidate = {
  id?: string | null;
  weekStart?: Date;
  updatedAt?: Date | null;
  createdAt?: Date | null;
  statementNumber?: string | null;
  payoutAmount?: number | NumericLike | null;
  grossSales?: number | NumericLike | null;
  amount?: number;
  rawPayload?: any;
  isPaid?: boolean | null;
  account?: { displayName?: string | null };
};

const STATUS_PRIORITY: Record<string, number> = {
  PAID: 3,
  OPEN: 2,
  UNPAID: 1,
};

function normalizedStatementNumber(row: Candidate) {
  return String(row.statementNumber ?? "").toUpperCase();
}

function hasStatementSuffix(row: Candidate) {
  return /(OPEN|PAID|UNPAID)$/.test(normalizedStatementNumber(row));
}

function isPlaceholder(row: Candidate): boolean {
  return Boolean((row.rawPayload as any)?.placeholder === true);
}

function isAuto(row: Candidate): boolean {
  return normalizedStatementNumber(row).startsWith("AUTO:");
}

function getUpdatedTimestamp(row: Candidate): number {
  const payloadUpdated = (row.rawPayload as any)?.updatedAt ?? (row.rawPayload as any)?.createdAt;
  if (payloadUpdated) {
    const d = new Date(payloadUpdated);
    if (!Number.isNaN(d.getTime())) return d.getTime();
  }
  return row.updatedAt?.getTime() ?? row.createdAt?.getTime() ?? 0;
}

export function chooseAuthoritativeCandidate(
  rows: Candidate[],
  canonicalWeekStart: Date,
): Candidate | null {
  if (!rows?.length) return null;
  const realRows = rows.filter((r) => !isPlaceholder(r));
  const pool = realRows.length ? realRows : rows;
  let best: Candidate | null = null;
  const canonicalStartMs = canonicalWeekStart.getTime();

  const rank = (row: Candidate) => {
    const periodStart = parseDateOnlyUtc((row.rawPayload as any)?.period?.startDate ?? null);
    const periodMatch =
      periodStart &&
      canonicalNairobiWeekStartUtc(periodStart).getTime() === canonicalStartMs
        ? 1
        : 0;

    const statusLabel = deriveStatementStatus(row.statementNumber, row.isPaid).label;
    const statusRank = STATUS_PRIORITY[statusLabel] ?? 0;

    const updatedScore = getUpdatedTimestamp(row);
    const payoutValue = Number((row.payoutAmount as any) ?? (row.grossSales as any) ?? 0);

    const rowStart = canonicalNairobiWeekStartUtc(new Date(row.weekStart ?? canonicalWeekStart));
    const diff = Math.abs(rowStart.getTime() - canonicalStartMs);

    return {
      periodMatch,
      statusRank,
      updatedScore,
      diff,
      payoutValue,
      suffixBonus: hasStatementSuffix(row) ? 1 : 0,
      autoPenalty: isAuto(row) ? 1 : 0,
    };
  };

  for (const row of pool) {
    if (!best) {
      best = row;
      continue;
    }
    const current = rank(row);
    const bestRank = rank(best);

    if (current.periodMatch !== bestRank.periodMatch) {
      if (current.periodMatch > bestRank.periodMatch) best = row;
      continue;
    }
    if (current.statusRank !== bestRank.statusRank) {
      if (current.statusRank > bestRank.statusRank) best = row;
      continue;
    }
    if (current.updatedScore !== bestRank.updatedScore) {
      if (current.updatedScore > bestRank.updatedScore) best = row;
      continue;
    }
    if (current.diff !== bestRank.diff) {
      if (current.diff < bestRank.diff) best = row;
      continue;
    }
    if (current.payoutValue !== bestRank.payoutValue) {
      if (current.payoutValue > bestRank.payoutValue) best = row;
      continue;
    }
    if (current.suffixBonus !== bestRank.suffixBonus) {
      if (current.suffixBonus > bestRank.suffixBonus) best = row;
      continue;
    }
    if (current.autoPenalty !== bestRank.autoPenalty) {
      if (current.autoPenalty < bestRank.autoPenalty) best = row;
      continue;
    }
  }

  return best;
}

export function ensureCanonicalWeekStart(date: Date): Date {
  return canonicalNairobiWeekStartUtc(date);
}
