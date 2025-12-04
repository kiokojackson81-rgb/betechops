/* eslint-disable no-console */
import "dotenv/config";
import type { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { getTradingPeriodFor, type TradingPeriod } from "../src/lib/tradingPeriod";
import {
  recomputeSupportCommissionLedger,
  summarizeSupportEntriesForPeriod,
} from "../src/lib/supportCommission";

type CliArgs = {
  start?: string;
  end?: string;
  asOf?: string;
  userId?: string;
  email?: string;
  dryRun: boolean;
};

function printUsage() {
  console.log(`
Usage: tsx scripts/upsert-support-commissions.ts [options]

Options:
  --start=YYYY-MM-DD      Period start (overrides trading period when paired with --end)
  --end=YYYY-MM-DD        Period end   (inclusive; pairs with --start)
  --as-of=YYYY-MM-DD      Use the trading period that contains this date (default: today)
  --user=<USER_ID>        Limit to a single attendant by ID
  --email=<EMAIL>         Limit to a single attendant by email (looks up ID)
  --dry-run               Compute and log totals without writing CommissionLedger rows
  --help                  Show this message
`);
}

function parseArgs(): CliArgs {
  const args: CliArgs = { dryRun: false };
  for (const token of process.argv.slice(2)) {
    if (token === "--dry-run") {
      args.dryRun = true;
    } else if (token === "--help" || token === "-h") {
      printUsage();
      process.exit(0);
    } else if (token.startsWith("--start=")) {
      args.start = token.split("=", 2)[1];
    } else if (token.startsWith("--end=")) {
      args.end = token.split("=", 2)[1];
    } else if (token.startsWith("--as-of=")) {
      args.asOf = token.split("=", 2)[1];
    } else if (token.startsWith("--user=")) {
      args.userId = token.split("=", 2)[1];
    } else if (token.startsWith("--email=")) {
      args.email = token.split("=", 2)[1];
    } else {
      console.warn(`Unrecognized option: ${token}`);
    }
  }
  return args;
}

function buildCustomPeriod(startInput: string, endInput: string): TradingPeriod {
  const start = new Date(startInput);
  const end = new Date(endInput);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error(`Invalid date range. start="${startInput}" end="${endInput}"`);
  }
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  const label = `${startInput} - ${endInput}`;
  const key = `${startInput}_${endInput}`;
  return { start, end, label, key };
}

function resolvePeriod(args: CliArgs): TradingPeriod {
  if (args.start && args.end) {
    return buildCustomPeriod(args.start, args.end);
  }
  const basis = args.asOf ? new Date(args.asOf) : new Date();
  if (Number.isNaN(basis.getTime())) {
    throw new Error(`Invalid as-of date: ${args.asOf}`);
  }
  return getTradingPeriodFor(basis);
}

async function resolveUserId(args: CliArgs) {
  if (args.userId) return args.userId;
  if (args.email) {
    const user = await prisma.user.findUnique({ where: { email: args.email } });
    if (!user) {
      throw new Error(`No attendant found for email ${args.email}`);
    }
    return user.id;
  }
  return undefined;
}

async function main() {
  const args = parseArgs();
  const period = resolvePeriod(args);
  const singleUserId = await resolveUserId(args);

  console.log(
    `[support-ledger] scanning entries in period ${period.key} (${period.label}) dryRun=${
      args.dryRun ? "yes" : "no"
    }`,
  );

  const entryWhere: Prisma.SupportDailyEntryWhereInput = {
    date: { gte: period.start, lte: period.end },
  };
  if (singleUserId) {
    entryWhere.submittedById = singleUserId;
  } else {
    entryWhere.submittedById = { not: null };
  }

  const attendants = await prisma.supportDailyEntry.findMany({
    where: entryWhere,
    distinct: ["submittedById"],
    select: { submittedById: true },
  });

  const userIds = attendants
    .map((row) => row.submittedById)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  if (userIds.length === 0) {
    console.log("[support-ledger] no support entries found for the specified filters");
    return;
  }

  const profiles = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true },
  });
  const profileMap = new Map(profiles.map((user) => [user.id, user]));

  for (const userId of userIds) {
    const profile = profileMap.get(userId);
    try {
      if (args.dryRun) {
        const { totals } = await summarizeSupportEntriesForPeriod({ userId, period });
        const supportCommission = Math.max(0, Math.round(totals.totalProfit * 0.05));
        console.log(
          `[support-ledger] DRY_RUN user=${userId} name=${profile?.name ?? "n/a"} email=${
            profile?.email ?? "n/a"
          } sales=${totals.totalSales} profit=${totals.totalProfit} commission=${supportCommission}`,
        );
        continue;
      }

      const result = await recomputeSupportCommissionLedger({ userId, period });
      console.log(
        `[support-ledger] upserted ledgerId=${result.ledgerId} user=${userId} name=${
          profile?.name ?? "n/a"
        } email=${profile?.email ?? "n/a"} sales=${result.totals.totalSales} profit=${
          result.totals.totalProfit
        } commission=${result.supportCommission}`,
      );
    } catch (err) {
      console.error(`[support-ledger] failed for user=${userId}`, err);
    }
  }
}

main()
  .catch((err) => {
    console.error("[support-ledger] fatal error", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
