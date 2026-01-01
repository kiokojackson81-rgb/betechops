"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import Card from "@/app/_components/Card";
import Input from "@/app/_components/Input";
import { getCategoryLabel } from "@/lib/getLandingPage";
import type { PayrollRow } from "./types";

const categoryOrder = [
  "DIRECT_SALES_OPS",
  "MARKETING_OPS",
  "JUMIA_KILIMALL_OPS",
  "SUPPORT_OPS",
  "BETECH_OPS",
];

const formatCurrency = (value: number) => `KES ${value.toLocaleString("en-US")}`;

const getDisplayName = (row?: PayrollRow | null) => {
  if (!row) return "—";
  return row.name ?? row.email ?? "Unassigned";
};

type PerformanceSummary = {
  bestSales: PayrollRow;
  bestProfit: PayrollRow;
  bestReceipts: PayrollRow;
  bestItems: PayrollRow;
  bestProductWork: PayrollRow;
  productWorkCount: number;
};

type PerformanceTileProps = {
  label: string;
  value: ReactNode;
  meta: ReactNode;
};

function PerformanceTile({ label, value, meta }: PerformanceTileProps) {
  return (
    <div className="rounded-2xl border border-white/5 bg-slate-950/30 p-3">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-100">{value}</p>
      <p className="text-[11px] text-slate-500">{meta}</p>
    </div>
  );
}

export default function PayrollTableClient({
  rows,
  periodLabel,
}: {
  rows: PayrollRow[];
  periodLabel: string;
}) {
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [search, setSearch] = useState("");

  const availableCategories = useMemo(() => {
    const seen = new Set<string>(
      rows
        .map((row) => row.attendantCategory)
        .filter((value): value is string => Boolean(value)),
    );
    return categoryOrder.filter((value) => seen.has(value)).concat(
      Array.from(seen).filter((value) => !categoryOrder.includes(value)),
    );
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (categoryFilter !== "ALL" && row.attendantCategory !== categoryFilter) return false;
      if (statusFilter === "ACTIVE" && !row.isActive) return false;
      if (statusFilter === "INACTIVE" && row.isActive) return false;
      if (search) {
        const term = search.toLowerCase();
        const haystack = `${row.name ?? ""} ${row.email ?? ""}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [categoryFilter, rows, search, statusFilter]);

  const totals = useMemo(() => {
    return filteredRows.reduce(
      (acc, row) => {
        acc.baseTransport += row.baseSalary + row.transportAllowance;
        acc.commission += row.commission;
        acc.bonus += row.bonusTotal;
        acc.deductions += row.deductionTotal;
        acc.net += row.netPay;
        return acc;
      },
      { baseTransport: 0, commission: 0, bonus: 0, deductions: 0, net: 0 },
    );
  }, [filteredRows]);

  const performanceSummary = useMemo<PerformanceSummary | null>(() => {
    if (!filteredRows.length) return null;
    const getProductActivity = (row: PayrollRow) => row.newProducts + row.editedProducts + row.copiedProducts;
    const bestBy = (selector: (row: PayrollRow) => number) =>
      filteredRows.reduce((best, current) => (selector(current) > selector(best) ? current : best), filteredRows[0]);

    const bestSales = bestBy((row) => row.totalSales);
    const bestProfit = bestBy((row) => row.totalProfit);
    const bestReceipts = bestBy((row) => row.totalReceipts);
    const bestItems = bestBy((row) => row.totalItems);
    const bestProductWork = bestBy(getProductActivity);

    return {
      bestSales,
      bestProfit,
      bestReceipts,
      bestItems,
      bestProductWork,
      productWorkCount: getProductActivity(bestProductWork),
    };
  }, [filteredRows]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">Current period</p>
          <h1 className="text-2xl font-semibold">Payroll · {periodLabel}</h1>
          <p className="text-xs text-slate-500 mt-1">
            Marketing Ops rows have a darker treatment and Brendah is pinned to the rose border for quick reference.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <div className="rounded-full border border-slate-700 bg-slate-900/40 px-3 py-1 text-slate-200">Marketing Ops highlight</div>
          <div className="rounded-full border border-rose-500/40 bg-rose-500/10 px-3 py-1 text-rose-200">Brendah focus</div>
          <a
            href="#performances"
            className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-emerald-200 transition hover:border-emerald-400 hover:text-emerald-100"
          >
            Performances
          </a>
        </div>
      </div>

      <Card className="divide-y divide-white/5 bg-slate-900/60 border-slate-800">
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
          <div>
            <label className="text-xs text-slate-400">Category</label>
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
            >
              <option value="ALL">All categories</option>
              {availableCategories.map((category) => (
                <option key={category} value={category}>
                  {getCategoryLabel(category)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400">Status</label>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as any)}
              className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
            >
              <option value="ALL">All</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
          <div className="md:col-span-2 lg:col-span-3">
            <label className="text-xs text-slate-400">Search</label>
            <Input
              placeholder="Name or email"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="bg-slate-950/60 border-slate-800 text-sm text-slate-100"
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 py-3">
          <div className="rounded-xl border border-white/5 bg-slate-950/30 p-3">
            <p className="text-xs uppercase text-slate-400">Base + allowance</p>
            <p className="text-lg font-semibold">{formatCurrency(totals.baseTransport)}</p>
            <p className="text-[11px] text-slate-500">Includes transport allowance</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-slate-950/30 p-3">
            <p className="text-xs uppercase text-slate-400">Commission</p>
            <p className="text-lg font-semibold">{formatCurrency(totals.commission)}</p>
            <p className="text-[11px] text-slate-500">Net only</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-slate-950/30 p-3">
            <p className="text-xs uppercase text-slate-400">Bonuses</p>
            <p className="text-lg font-semibold">{formatCurrency(totals.bonus)}</p>
            <p className="text-[11px] text-slate-500">Includes commission top-ups</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-slate-950/30 p-3">
            <p className="text-xs uppercase text-slate-400">Net pay</p>
            <p className="text-lg font-semibold">{formatCurrency(totals.net)}</p>
            <p className="text-[11px] text-slate-500">After deductions</p>
          </div>
        </div>
      </Card>

      {performanceSummary && (
        <div id="performances">
          <Card className="bg-slate-900/70 border border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">Performances</p>
              <h2 className="text-lg font-semibold text-slate-100">AI-curated performance menu</h2>
              <p className="text-xs text-slate-400">
                Compares receipts, direct sales, Kilimall uploads/edits, and product actions to spotlight who is driving value.
              </p>
            </div>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-200 uppercase tracking-wide">
              Compare
            </span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <PerformanceTile
              label="Top sales"
              value={formatCurrency(performanceSummary.bestSales.totalSales)}
              meta={getDisplayName(performanceSummary.bestSales)}
            />
            <PerformanceTile
              label="Highest profit"
              value={formatCurrency(performanceSummary.bestProfit.totalProfit)}
              meta={getDisplayName(performanceSummary.bestProfit)}
            />
            <PerformanceTile
              label="Most receipts"
              value={performanceSummary.bestReceipts.totalReceipts.toLocaleString("en-US")}
              meta={getDisplayName(performanceSummary.bestReceipts)}
            />
            <PerformanceTile
              label="Items sold"
              value={performanceSummary.bestItems.totalItems.toLocaleString("en-US")}
              meta={getDisplayName(performanceSummary.bestItems)}
            />
            <PerformanceTile
              label="Product uploads/edits"
              value={performanceSummary.productWorkCount.toLocaleString("en-US")}
              meta={`${getDisplayName(performanceSummary.bestProductWork)} · new/edited/copied`}
            />
          </div>
        </Card>
      )}

      <Card className="bg-slate-900/60 border-slate-800">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-900/80 border-b border-white/10 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left">Attendant</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-right">Sales</th>
                <th className="px-4 py-3 text-right">Base + Allowance</th>
                <th className="px-4 py-3 text-right">Commission</th>
                <th className="px-4 py-3 text-right">Bonuses</th>
                <th className="px-4 py-3 text-right">Deductions</th>
                <th className="px-4 py-3 text-right">Net pay</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => {
                const isMarketing = row.attendantCategory === "MARKETING_OPS";
                const isBrendah =
                  (row.name ?? "").toLowerCase().includes("brendah") ||
                  (row.email ?? "").toLowerCase().includes("brendah");
                const deductionParts = ([
                  ["Chama", row.adjustmentBreakdown.chama],
                  ["Lateness", row.adjustmentBreakdown.lateness],
                  ["Discipline", row.adjustmentBreakdown.discipline],
                  ["Other", row.adjustmentBreakdown.other],
                  ["Penalties", row.adjustmentBreakdown.penalties],
                ] as [string, number][]).filter(([, amount]) => {
                  const n = Number(amount);
                  return !Number.isNaN(n) && n > 0;
                });
                const additionEntries = row.adjustmentEntries.filter((entry) => entry.kind === "ADDITION");
                const deductionEntries = row.adjustmentEntries.filter((entry) => entry.kind === "DEDUCTION");

                return (
                  <tr
                    key={row.attendantId}
                    className={`border-t border-white/5 ${isMarketing ? "bg-slate-900/60" : ""} ${isBrendah ? "border-rose-500/40" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <div className="font-semibold text-slate-100">
                          <Link className="underline-offset-2 hover:underline" href={`/admin/attendants/${row.attendantId}/payroll`}>
                            {row.name ?? row.email ?? "No name"}
                          </Link>
                        </div>
                        <div className="text-xs text-slate-500">{row.email ?? "No email"}</div>
                        {isBrendah && <span className="text-xs text-rose-300">Brendah (focus)</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-400">{getCategoryLabel(row.attendantCategory)}</span>
                      {isMarketing && (
                        <span className="ml-2 rounded-full bg-blue-500/20 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-blue-100">
                          Marketing Ops
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right space-y-1">
                      <div className="font-semibold text-slate-100">{row.totalSales.toLocaleString("en-US")}</div>
                      <div className="text-[11px] text-slate-500">
                        Profit {row.totalProfit.toLocaleString("en-US")}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {row.totalReceipts.toLocaleString("en-US")} receipts · {row.totalItems.toLocaleString("en-US")} items
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="font-semibold text-slate-100">{formatCurrency(row.baseSalary)}</div>
                      <div className="text-[11px] text-slate-500">Transport {formatCurrency(row.transportAllowance)}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="font-semibold text-emerald-300">{formatCurrency(row.commission)}</div>
                      <div className="text-[11px] text-slate-500">Gross {formatCurrency(row.commissionGross)}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="text-slate-100">{formatCurrency(row.bonusTotal)}</div>
                      <div className="text-[11px] text-slate-500">
                        Bonus {row.adjustmentBreakdown.bonus.toLocaleString("en-US")} · Top-ups {row.adjustmentBreakdown.commissionTopUp.toLocaleString("en-US")}
                      </div>
                      {additionEntries.length > 0 && (
                        <div className="text-[11px] text-slate-400">
                          {additionEntries.map((entry) => (
                            <div key={entry.id} className="flex items-center justify-between">
                              <span>{entry.label || entry.adjustmentType}</span>
                              <span>{formatCurrency(entry.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="text-slate-100">{formatCurrency(row.deductionTotal)}</div>
                      {deductionParts.length > 0 && (
                        <div className="text-[11px] text-slate-500">
                          {deductionParts.map(([label, amount], index) => (
                            <span key={label}>
                              {label} {Number(amount).toLocaleString("en-US")}
                              {index < deductionParts.length - 1 && " · "}
                            </span>
                          ))}
                        </div>
                      )}
                      {deductionEntries.length > 0 && (
                        <div className="text-[11px] text-slate-400">
                          {deductionEntries.map((entry) => (
                            <div key={entry.id} className="flex items-center justify-between">
                              <span>{entry.label || entry.adjustmentType}</span>
                              <span>{formatCurrency(entry.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="text-lg font-semibold text-emerald-300">{formatCurrency(row.netPay)}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        className="text-xs rounded-full border border-slate-600 px-3 py-1 hover:bg-slate-800"
                        href={`/admin/attendants/${row.attendantId}/payroll`}
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-slate-500">
                    No attendants match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
