import Link from "next/link";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/api";
import { buildOpenfloatReviewRows } from "@/lib/payrollOpenfloat";
import { getTradingPeriodFor, parseTradingPeriodKey } from "@/lib/tradingPeriod";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

const formatCurrency = (value: number) => `KES ${Number(value || 0).toLocaleString("en-US")}`;

export default async function AdminPayrollOpenfloatPage({
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
  const period = parseTradingPeriodKey(rawPeriodParam ?? undefined) ?? getTradingPeriodFor(new Date());
  const rows = await buildOpenfloatReviewRows(period);
  const readyRows = rows.filter((row) => row.isValid && !row.isSkipped);
  const skippedRows = rows.filter((row) => row.isSkipped);
  const invalidRows = rows.filter((row) => !row.isValid && !row.isSkipped);
  const totalAmount = readyRows.reduce((sum, row) => sum + row.amount, 0);

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Openfloat payout review</h1>
            <p className="mt-1 text-sm text-slate-400">
              Review payout details, notification phones, and payroll net pay for {period.label}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={`/api/admin/payroll/openfloat/review?periodKey=${encodeURIComponent(period.key)}`}
              className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-sm font-semibold hover:bg-slate-800"
            >
              Download PDF review
            </a>
            <a
              href={`/api/admin/payroll/openfloat?periodKey=${encodeURIComponent(period.key)}`}
              className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/20"
            >
              Download Openfloat XLSX
            </a>
            <Link
              href={`/admin/payroll?period=${encodeURIComponent(period.key)}`}
              className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-sm font-semibold hover:bg-slate-800"
            >
              Back to payroll
            </Link>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-400">Ready rows</div>
            <div className="mt-2 text-3xl font-semibold text-emerald-300">{readyRows.length}</div>
            <div className="mt-1 text-xs text-slate-500">Rows that can be exported to Openfloat now.</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-400">Rows with issues</div>
            <div className="mt-2 text-3xl font-semibold text-rose-300">{invalidRows.length}</div>
            <div className="mt-1 text-xs text-slate-500">Complete the missing payout profile fields first.</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-400">Skipped rows</div>
            <div className="mt-2 text-3xl font-semibold text-slate-300">{skippedRows.length}</div>
            <div className="mt-1 text-xs text-slate-500">Zero or negative payroll balances are excluded from the file.</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-400">Ready amount</div>
            <div className="mt-2 text-3xl font-semibold text-slate-100">{formatCurrency(totalAmount)}</div>
            <div className="mt-1 text-xs text-slate-500">Total payroll value for valid export rows.</div>
          </div>
        </div>

        {invalidRows.length > 0 ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-100">
            {invalidRows.length} employee{invalidRows.length === 1 ? "" : "s"} still have incomplete payout details. The XLSX route will stay blocked until these are fixed.
          </div>
        ) : (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
            All exportable payout rows are complete. The Openfloat workbook is ready for download and upload.
          </div>
        )}
        {skippedRows.length > 0 ? (
          <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 text-sm text-slate-300">
            {skippedRows.length} employee{skippedRows.length === 1 ? "" : "s"} have zero or negative payroll balances and will be skipped from the Openfloat XLSX.
          </div>
        ) : null}

        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/60">
          <table className="min-w-full text-sm">
            <thead className="border-b border-white/10 bg-slate-900/80 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left">Employee</th>
                <th className="px-4 py-3 text-left">Method</th>
                <th className="px-4 py-3 text-left">Destination</th>
                <th className="px-4 py-3 text-left">Notification</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.attendantId} className="border-t border-white/5 align-top">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-100">{row.name}</div>
                    <div className="text-xs text-slate-500">{row.email || "No email"}</div>
                  </td>
                  <td className="px-4 py-3">{row.accountType || "Missing"}</td>
                  <td className="px-4 py-3 text-xs text-slate-300">
                    <div>{row.accountName || "No account name"}</div>
                    {row.accountNumber ? <div>Account: {row.accountNumber}</div> : null}
                    {row.tillOrPaybillNumber ? <div>Till/Paybill: {row.tillOrPaybillNumber}</div> : null}
                    {row.tillOrPaybillBusinessName ? <div>Business: {row.tillOrPaybillBusinessName}</div> : null}
                  </td>
                  <td className="px-4 py-3">{row.notificationPhoneNumber || "Missing"}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-100">{formatCurrency(row.amount)}</td>
                  <td className="px-4 py-3 text-xs">
                    {row.isSkipped ? (
                      <span className="rounded-full border border-white/10 bg-slate-800 px-2 py-1 text-slate-300">{row.skipReason}</span>
                    ) : row.isValid ? (
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-emerald-200">Ready</span>
                    ) : (
                      <div className="space-y-1 text-rose-200">
                        {row.validationErrors.map((error) => (
                          <div key={error}>{error}</div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/attendants/${row.attendantId}`}
                      className="rounded-full border border-white/10 px-3 py-1 text-xs hover:bg-slate-800"
                    >
                      Edit employee
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
