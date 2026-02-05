#!/usr/bin/env ts-node
import { prisma } from "../src/lib/prisma.ts";

type ManualRow = {
  statementNumber: string;
  isPaid: boolean;
  payoutAmount: number;
  displayName: string;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

const expectedStartDate = "2025-12-29";
const expectedEndDate = "2026-01-04";
const weekStart = new Date(Date.UTC(2025, 11, 29, 0, 0, 0, 0));
const weekEnd = new Date(Date.UTC(2026, 0, 4, 23, 59, 59, 999));
const expectedWeekLabel = `${expectedStartDate} - ${expectedEndDate}`;

const manual: ManualRow[] = [
  { statementNumber: "PS251229KE12DBU", isPaid: true, payoutAmount: 424086.62, displayName: "BETECH STORE" },
  { statementNumber: "PS251229KE12DWN", isPaid: true, payoutAmount: 176488.18, displayName: "JM COLLECTION" },
  { statementNumber: "PS251229KE12Y26", isPaid: true, payoutAmount: 196243.91, displayName: "HITECH POWER" },
  { statementNumber: "PS251229KE133G3", isPaid: true, payoutAmount: 171407.13, displayName: "JUDE COLLECTION" },
  { statementNumber: "PS251229KE13ZAF", isPaid: true, payoutAmount: 239368.33, displayName: "SKY STORE" },
  { statementNumber: "PS251229KE13LSZ", isPaid: true, payoutAmount: 82472.25, displayName: "BETECH SOLAR SOLUTIONS" },
  { statementNumber: "PS251229KE14JOD", isPaid: false, payoutAmount: 0.0, displayName: "LABTECH" },
  { statementNumber: "PS251229KE13XZB", isPaid: true, payoutAmount: 8527.82, displayName: "MAXTON ENTERPRICES" },
];

const stmtNums = manual.map((m) => m.statementNumber);

async function main() {
  const dbByStmt = await prisma.marketplacePayoutWeek.findMany({
    where: { statementNumber: { in: stmtNums } },
    include: { account: true },
  });

  const dbByWeek = await prisma.marketplacePayoutWeek.findMany({
    where: { weekStart },
    include: { account: true },
  });

  const toDateOnly = (value?: Date | string | null) => (value ? new Date(value).toISOString().slice(0, 10) : null);

  const results: Array<any> = [];
  const failReasons: Record<string, string[]> = { MISSING: [], DUPLICATE: [], AMOUNT_MISMATCH: [], PAID_MISMATCH: [], WEEK_WINDOW_MISMATCH: [] };

  for (const rowManual of manual) {
    const matches = dbByStmt.filter((r) => r.statementNumber === rowManual.statementNumber);
    if (matches.length === 0) {
      failReasons.MISSING.push(rowManual.statementNumber);
      const candidateRows = dbByWeek
        .map((r) => {
          const payout = round2(Number(r.payoutAmount ?? 0));
          return {
            statementNumber: r.statementNumber,
            account: r.account?.displayName ?? r.accountId,
            payoutAmount: payout,
            isPaid: Boolean(r.isPaid),
            weekStartDate: toDateOnly(r.weekStart),
            weekEndDate: toDateOnly(r.weekEnd),
            payoutDiff: Math.abs(payout - rowManual.payoutAmount),
          };
        })
        .sort((a, b) => a.payoutDiff - b.payoutDiff);

      const closest = candidateRows.slice(0, 5).map(({ payoutDiff, ...rest }) => rest);

      results.push({
        statementNumber: rowManual.statementNumber,
        shop: rowManual.displayName,
        expectedPaid: rowManual.isPaid,
        dbPaid: null,
        expectedAmount: round2(rowManual.payoutAmount),
        dbAmount: null,
        expectedWeek: expectedWeekLabel,
        dbWeek: null,
        RESULT: "MISSING",
        reason: `No DB row found for statementNumber. Closest matches for ${expectedWeekLabel}: ${JSON.stringify(closest)}`,
      });
      continue;
    }

    if (matches.length > 1) {
      failReasons.DUPLICATE.push(rowManual.statementNumber);
      const ids = matches.map((x) => ({ id: x.id, accountId: x.accountId, weekStart: toDateOnly(x.weekStart), weekEnd: toDateOnly(x.weekEnd) }));
      results.push({
        statementNumber: rowManual.statementNumber,
        shop: rowManual.displayName,
        expectedPaid: rowManual.isPaid,
        dbPaid: matches.map((x) => x.isPaid),
        expectedAmount: round2(rowManual.payoutAmount),
        dbAmount: matches.map((x) => round2(Number(x.payoutAmount ?? 0))),
        expectedWeek: expectedWeekLabel,
        dbWeek: matches.map((x) => `${toDateOnly(x.weekStart)} - ${toDateOnly(x.weekEnd)}`),
        RESULT: "DUPLICATE",
        reason: ids,
      });
      continue;
    }

    const match = matches[0];
    const dbAmount = round2(Number(match.payoutAmount ?? 0));
    const dbPaid = Boolean(match.isPaid);
    const expectedAmount = round2(rowManual.payoutAmount);
    const amountMatch = Math.abs(dbAmount - expectedAmount) <= 0.01;
    const paidMatch = dbPaid === rowManual.isPaid;

    const dbWeekStartDate = toDateOnly(match.weekStart);
    const dbWeekEndDate = toDateOnly(match.weekEnd);
    const windowMatch = dbWeekStartDate === expectedStartDate && dbWeekEndDate === expectedEndDate;

    let result = "PASS";
    const reasons: string[] = [];
    if (!amountMatch) {
      result = "FAIL";
      reasons.push(`AMOUNT_MISMATCH expected=${expectedAmount} db=${dbAmount}`);
      failReasons.AMOUNT_MISMATCH.push(rowManual.statementNumber);
    }
    if (!paidMatch) {
      result = "FAIL";
      reasons.push(`PAID_MISMATCH expected=${rowManual.isPaid} db=${dbPaid}`);
      failReasons.PAID_MISMATCH.push(rowManual.statementNumber);
    }
    if (!windowMatch) {
      result = "FAIL";
      reasons.push(`WEEK_WINDOW_MISMATCH expected=${expectedWeekLabel} db=${dbWeekStartDate}-${dbWeekEndDate}`);
      failReasons.WEEK_WINDOW_MISMATCH.push(rowManual.statementNumber);
    }

    results.push({
      statementNumber: rowManual.statementNumber,
      shop: match.account?.displayName ?? match.accountId,
      expectedPaid: rowManual.isPaid,
      dbPaid,
      expectedAmount,
      dbAmount,
      expectedWeek: expectedWeekLabel,
      dbWeek: `${dbWeekStartDate} - ${dbWeekEndDate}`,
      RESULT: result,
      reason: reasons.join("; "),
    });
  }

  const manualPaidTotal = round2(manual.filter((m) => m.isPaid).reduce((sum, row) => sum + row.payoutAmount, 0));
  const dbPaidRows = dbByStmt.filter((r) => stmtNums.includes(r.statementNumber) && r.isPaid);
  const dbPaidTotal = round2(dbPaidRows.reduce((sum, r) => sum + Number(r.payoutAmount ?? 0), 0));
  const dbWeekTotal = round2(dbByWeek.reduce((sum, r) => sum + Number(r.payoutAmount ?? 0), 0));
  const totalsMatch = Math.abs(manualPaidTotal - dbPaidTotal) <= 0.01;

  console.log("statementNumber | shop(displayName) | expectedPaid | dbPaid | expectedAmount | dbAmount | expectedWeek | dbWeek | RESULT | reason");
  for (const entry of results) {
    console.log(
      `${entry.statementNumber} | ${entry.shop} | ${entry.expectedPaid} | ${entry.dbPaid} | ${entry.expectedAmount} | ${entry.dbAmount} | ${entry.expectedWeek} | ${entry.dbWeek} | ${entry.RESULT} | ${Array.isArray(entry.reason) ? JSON.stringify(entry.reason) : entry.reason}`,
    );
  }

  const failCount = Object.values(failReasons).reduce((total, arr) => total + arr.length, 0);
  console.log("\nSummary:");
  console.log(`PASS count: ${results.filter((r) => r.RESULT === "PASS").length} / ${results.length}`);
  console.log(`FAIL count: ${failCount}`);
  console.log(`Manual paid total: ${manualPaidTotal} KES`);
  console.log(`DB paid total (matched statements & isPaid=true): ${dbPaidTotal} KES`);
  console.log(`DB week total (all payouts for week window): ${dbWeekTotal} KES`);
  console.log(`Totals match within 0.01: ${totalsMatch}`);

  console.log("\nFail reasons grouped:");
  for (const key of Object.keys(failReasons)) {
    const list = failReasons[key];
    if (list.length) console.log(`${key}: ${list.join(", ")}`);
  }

  console.log("\nDB rows within weekStart query:");
  for (const entry of dbByWeek) {
    console.log(
      `${entry.statementNumber} | account=${entry.account?.displayName ?? entry.accountId} | payout=${round2(Number(entry.payoutAmount ?? 0))} | isPaid=${entry.isPaid} | weekStart=${toDateOnly(entry.weekStart)} | weekEnd=${toDateOnly(entry.weekEnd)}`,
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
