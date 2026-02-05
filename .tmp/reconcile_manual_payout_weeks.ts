#!/usr/bin/env ts-node
import { promises as fs } from "node:fs";
import { prisma } from "../src/lib/prisma.ts";

type ManualRow = {
  statementNumber: string;
  expectedPayoutAmount: number;
  expectedIsPaid: boolean;
  expectedWeekStartDate: string;
  expectedWeekEndDate?: string;
  expectedAccountDisplayName?: string | null;
};

type SummaryStats = {
  UPDATED: number;
  STATEMENT_NUMBER_REMAP: number;
  SKIPPED_NEEDS_HUMAN: number;
  NOT_FOUND: number;
};

const DEFAULT_INPUT_PATH = ".tmp/manual_payout_truth.json";

const cliArgs = process.argv.slice(2);
const apply = cliArgs.includes("--apply");
const dryRun = cliArgs.includes("--dry-run") || !apply;
let inputPath = DEFAULT_INPUT_PATH;
for (let i = 0; i < cliArgs.length; i++) {
  const arg = cliArgs[i];
  if (arg === "--input" && cliArgs[i + 1]) {
    inputPath = cliArgs[i + 1];
    i += 1;
  } else if (!arg.startsWith("-") && arg !== inputPath) {
    inputPath = arg;
  }
}

function normalizeAccountName(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function parseDateOnlyUtc(s?: string | null) {
  if (!s) return null;
  const datePart = String(s).slice(0, 10);
  const parts = datePart.split("-").map((v) => Number(v));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [y, m, d] = parts;
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
}

function mondayToSundayUtcWindow(baseDate: Date) {
  const d = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate(), 0, 0, 0, 0));
  const day = d.getUTCDay(); // 0 = Sunday, 1 = Monday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diffToMonday);
  const weekStart = new Date(d.getTime());
  const weekEnd = new Date(d.getTime());
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  weekEnd.setUTCHours(23, 59, 59, 999);
  return { weekStart, weekEnd };
}

function amountAlmostEqual(a: number, b: number) {
  return Math.abs(a - b) <= 0.01;
}

async function loadManualRows(path: string): Promise<ManualRow[]> {
  const payload = await fs.readFile(path, "utf-8");
  const parsed = JSON.parse(payload);
  if (!Array.isArray(parsed)) {
    throw new Error(`Expected a JSON array of manual rows in ${path}`);
  }
  return parsed;
}

async function reconcile() {
  console.log(`[reconcile] Mode: ${apply ? "apply" : "dry-run"}; loading ${inputPath}`);
  const manualRows = await loadManualRows(inputPath);
  const stats: SummaryStats = {
    UPDATED: 0,
    STATEMENT_NUMBER_REMAP: 0,
    SKIPPED_NEEDS_HUMAN: 0,
    NOT_FOUND: 0,
  };

  for (const manualRow of manualRows) {
    console.log(`\n[reconcile] Processing statement ${manualRow.statementNumber}`);
    const baseDate = parseDateOnlyUtc(manualRow.expectedWeekStartDate);
    if (!baseDate) {
      console.warn(`[reconcile] Invalid expectedWeekStartDate (${manualRow.expectedWeekStartDate}); skipping`);
      stats.SKIPPED_NEEDS_HUMAN += 1;
      continue;
    }

    const expectedWindow = mondayToSundayUtcWindow(baseDate);
    const stmtMatch = await prisma.marketplacePayoutWeek.findFirst({
      where: { statementNumber: manualRow.statementNumber },
      include: { account: true },
    });

    let targetRow = stmtMatch;
    let remapped = false;

    if (!targetRow) {
      const candidates = await prisma.marketplacePayoutWeek.findMany({
        where: { weekStart: expectedWindow.weekStart },
        include: { account: true },
      });
      const manualName = normalizeAccountName(manualRow.expectedAccountDisplayName);
      const filteredByAccount = candidates.filter((row) => {
        if (!manualName) return true;
        return normalizeAccountName(row.account?.displayName) === manualName;
      });
      const amountMatches = filteredByAccount.filter((row) => amountAlmostEqual(Number(row.payoutAmount ?? 0), manualRow.expectedPayoutAmount));

      if (amountMatches.length === 1) {
        targetRow = amountMatches[0];
        remapped = true;
        console.warn(`[reconcile] STATEMENT_NUMBER_REMAP ${manualRow.statementNumber} -> row id=${targetRow.id} account=${targetRow.account?.displayName ?? targetRow.accountId}`);
      } else {
        const summary = amountMatches.map((row) => ({
          id: row.id,
          account: row.account?.displayName ?? row.accountId,
          payoutAmount: Number(row.payoutAmount ?? 0),
          weekStart: row.weekStart?.toISOString(),
        }));
        if (amountMatches.length === 0) {
          console.warn(`[reconcile] NEEDS_HUMAN ${manualRow.statementNumber}; no candidates for ${manualRow.expectedWeekStartDate}`);
          stats.NOT_FOUND += 1;
        } else {
          console.warn(`[reconcile] NEEDS_HUMAN ${manualRow.statementNumber}; multiple candidates: ${JSON.stringify(summary)}`);
          stats.SKIPPED_NEEDS_HUMAN += 1;
        }
        continue;
      }
    }

    if (!targetRow) {
      stats.NOT_FOUND += 1;
      console.warn(`[reconcile] ${manualRow.statementNumber} not found and no remap candidate`);
      continue;
    }

    if (remapped) {
      stats.STATEMENT_NUMBER_REMAP += 1;
    }

    const desiredWeekLabel = `${expectedWindow.weekStart.toISOString().slice(0, 10)} - ${expectedWindow.weekEnd.toISOString().slice(0, 10)}`;
    const currentWeekLabel = `${targetRow.weekStart?.toISOString().slice(0, 10)} - ${targetRow.weekEnd?.toISOString().slice(0, 10)}`;

    const updates = {
      grossSales: manualRow.expectedPayoutAmount,
      payoutAmount: manualRow.expectedPayoutAmount,
      isPaid: manualRow.expectedIsPaid,
      weekStart: expectedWindow.weekStart,
      weekEnd: expectedWindow.weekEnd,
    };

    const needsUpdate =
      !amountAlmostEqual(Number(targetRow.payoutAmount ?? 0), manualRow.expectedPayoutAmount) ||
      targetRow.isPaid !== manualRow.expectedIsPaid ||
      targetRow.weekStart?.getTime() !== expectedWindow.weekStart.getTime() ||
      targetRow.weekEnd?.getTime() !== expectedWindow.weekEnd.getTime();

    if (!needsUpdate) {
      console.log(`[reconcile] ${manualRow.statementNumber} already matches expected data (week ${currentWeekLabel})`);
      continue;
    }

    console.log(`[reconcile] ${manualRow.statementNumber} will update week ${currentWeekLabel} -> ${desiredWeekLabel}, payout ${targetRow.payoutAmount} -> ${manualRow.expectedPayoutAmount}, isPaid ${targetRow.isPaid} -> ${manualRow.expectedIsPaid}`);
    if (!dryRun) {
      await prisma.marketplacePayoutWeek.update({
        where: { id: targetRow.id },
        data: updates,
      });
      console.log(`[reconcile] Updated row id=${targetRow.id}`);
    } else {
      console.log(`[reconcile] Dry-run: skipping update for row id=${targetRow.id}`);
    }

    stats.UPDATED += 1;
  }

  console.log("\nSummary:");
  console.log(`UPDATED (includes dry-run history): ${stats.UPDATED}`);
  console.log(`STATEMENT_NUMBER_REMAP: ${stats.STATEMENT_NUMBER_REMAP}`);
  console.log(`SKIPPED_NEEDS_HUMAN: ${stats.SKIPPED_NEEDS_HUMAN}`);
  console.log(`NOT_FOUND: ${stats.NOT_FOUND}`);
}

reconcile()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
