import Link from "next/link";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import {
  getNextTradingPeriod,
  getTradingPeriodFor,
  parseTradingPeriodKey,
} from "@/lib/tradingPeriod";
import { requireRole } from "@/lib/api";
import PayrollTableClient from "./PayrollTableClient";
import type { PayrollRow } from "./types";
import { buildPayrollRow } from "@/lib/adminPayroll";
import { applyCanonicalPayrollOverrides } from "@/lib/payrollCanonical";
import { payrollEligibleUserWhere } from "@/lib/payrollEligibility";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AdminPayrollPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams | undefined>;
}) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) {
    redirect("/admin/login");
  }

  const resolvedSearchParams = (await searchParams) ?? {};
  const rawPeriodParam = Array.isArray(resolvedSearchParams.period)
    ? resolvedSearchParams.period[0]
    : resolvedSearchParams.period;
  const requestedPeriod = parseTradingPeriodKey(rawPeriodParam ?? undefined);
  const currentPeriod = getTradingPeriodFor(new Date());
  const period = requestedPeriod ?? currentPeriod;
  const isCurrentPeriod = period.key === currentPeriod.key;
  const previousPeriod = getTradingPeriodFor(new Date(period.start.getTime() - 24 * 60 * 60 * 1000));
  const nextPeriod = isCurrentPeriod ? null : getNextTradingPeriod(period);

  const attendants = await prisma.user.findMany({
    where: payrollEligibleUserWhere(),
    orderBy: [{ attendantCategory: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      attendantCategory: true,
      isActive: true,
    },
  });

  const rows: PayrollRow[] = await Promise.all(
    attendants.map(async (attendant) => applyCanonicalPayrollOverrides(await buildPayrollRow(attendant, period), period)),
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <header className="mb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Admin payroll</h1>
            <p className="text-sm text-slate-400">
              Snapshot for {period.label}. Data comes from commission-ledger, comp plans and adjustments.
            </p>
            {!isCurrentPeriod && (
              <p className="text-xs text-slate-500">
                Showing archived period. The latest period is {currentPeriod.label}.
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`/api/admin/payroll/payslips?periodKey=${encodeURIComponent(period.key)}`}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-100 border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20"
            >
              Export all payslips
            </a>
            <Link
              href={`/admin/payroll?period=${encodeURIComponent(previousPeriod.key)}`}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-100 border border-white/10 bg-slate-900 hover:bg-slate-800"
            >
              View previous period
            </Link>
            {nextPeriod && (
              <Link
                href={`/admin/payroll?period=${encodeURIComponent(nextPeriod.key)}`}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-100 border border-white/10 bg-slate-900 hover:bg-slate-800"
              >
                View next period
              </Link>
            )}
            {!isCurrentPeriod && (
              <Link
                href="/admin/payroll"
                className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-100 border border-white/10 bg-slate-900 hover:bg-slate-800"
              >
                Return to current
              </Link>
            )}
          </div>
        </div>
      </header>
      <PayrollTableClient
        rows={rows}
        periodLabel={period.label}
        periodKey={period.key}
        previousPeriodKey={previousPeriod.key}
        printHref={`/api/admin/payroll/print?periodKey=${encodeURIComponent(period.key)}`}
      />
    </div>
  );
}
