"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Card from "@/app/_components/Card";
import Input from "@/app/_components/Input";
import Button from "@/app/_components/Button";
import DeleteSupportEntryClient from "./DeleteSupportEntryClient";

const dayOptions = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const formatKES = (value: number) => `KES ${value.toLocaleString("en-KE")}`;

export type SupportReportEntry = {
  id: string;
  date: string;
  dayOfWeek: string;
  attendantId: string | null;
  attendantName: string;
  attendantEmail: string | null;
  totalSales: number;
  totalProfit: number;
  itemsSold: number;
  receipts: number;
  newBatteries: number;
  changedBatteries: number;
  performanceEarnings: number;
  commission: number;
};

export type SupportReportSummary = {
  periodSales: number;
  itemsSold: number;
  newBatteries: number;
  changedBatteries: number;
  performanceEarnings: number;
  commission: number;
  receipts: number;
};

export default function ClientSupportReport({
  periodLabel,
  entries,
  summary,
  initialFilters,
}: {
  periodLabel: string;
  entries: SupportReportEntry[];
  summary: SupportReportSummary;
  initialFilters: { from: string; to: string; day: string; attendantId: string; search: string };
}) {
  const router = useRouter();
  
  const [entriesState, setEntriesState] = useState<SupportReportEntry[]>(entries);
  const [selectedEntry, setSelectedEntry] = useState<SupportReportEntry | null>(null);

  useEffect(() => {
    setEntriesState(entries);
  }, [entries]);
  const totals = useMemo(() => ({
    cards: [
      { label: "Total sales", value: formatKES(summary.periodSales) },
      { label: "Receipts", value: summary.receipts.toLocaleString() },
      { label: "Items sold", value: summary.itemsSold.toLocaleString() },
      { label: "Performance bonus", value: formatKES(summary.performanceEarnings) },
      { label: "Commission", value: formatKES(summary.commission) },
      { label: "New batteries", value: summary.newBatteries.toLocaleString() },
      { label: "Changed batteries", value: summary.changedBatteries.toLocaleString() },
    ],
  }), [summary]);

  const handleSubmit = (formData: FormData) => {
    const params = new URLSearchParams();
    const from = (formData.get("from") as string) || initialFilters.from;
    const to = (formData.get("to") as string) || initialFilters.to;
    const day = formData.get("day") as string;
    const attendantId = formData.get("attendantId") as string;
    const search = formData.get("search") as string;
    params.set("from", from);
    params.set("to", to);
    if (day) params.set("day", day);
    if (attendantId) params.set("attendantId", attendantId);
    if (search) params.set("search", search);
    router.push(`/admin/support-report?${params.toString()}`);
  };

  const handleReset = () => {
    router.push("/admin/support-report");
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-emerald-300">Admin</p>
        <h1 className="text-3xl font-semibold">Support Operations Report</h1>
        <p className="text-sm text-slate-400">
          Track support attendants' daily sales, performance and payouts across the trading period.
        </p>
      </header>

      <Card className="space-y-4 border-slate-800 bg-slate-900/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Current window</p>
            <p className="text-lg font-semibold text-slate-100">{periodLabel}</p>
          </div>
        </div>

        <form
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            handleSubmit(new FormData(event.currentTarget));
          }}
        >
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            <span className="text-xs uppercase tracking-wide text-slate-500">From</span>
            <Input type="date" name="from" defaultValue={initialFilters.from} className="bg-slate-950/60 border-slate-800" />
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            <span className="text-xs uppercase tracking-wide text-slate-500">To</span>
            <Input type="date" name="to" defaultValue={initialFilters.to} className="bg-slate-950/60 border-slate-800" />
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            <span className="text-xs uppercase tracking-wide text-slate-500">Day of week</span>
            <select
              name="day"
              defaultValue={initialFilters.day}
              className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
            >
              {dayOptions.map((day) => (
                <option key={day || "ALL"} value={day}>
                  {day || "Any day"}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            <span className="text-xs uppercase tracking-wide text-slate-500">Attendant ID</span>
            <Input
              name="attendantId"
              placeholder="User ID"
              defaultValue={initialFilters.attendantId}
              className="bg-slate-950/60 border-slate-800"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-300 md:col-span-2">
            <span className="text-xs uppercase tracking-wide text-slate-500">Search (name or email)</span>
            <Input
              name="search"
              placeholder="e.g. justus@betech.co.ke"
              defaultValue={initialFilters.search}
              className="bg-slate-950/60 border-slate-800"
            />
          </label>
          <div className="flex items-center gap-3 md:col-span-2 lg:col-span-4">
            <Button type="submit" variant="primary" className="bg-emerald-500 px-5 text-black hover:brightness-95">
              Apply filters
            </Button>
            <Button type="button" variant="secondary" onClick={handleReset}>
              Reset
            </Button>
          </div>
        </form>
      </Card>

      <Card className="space-y-4 border-slate-800 bg-slate-900/70">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {totals.cards.map((card) => (
            <div key={card.label} className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-400">{card.label}</p>
              <p className="mt-1 text-xl font-semibold text-emerald-300">{card.value}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="border-slate-800 bg-slate-900/70">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-950/70 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                {["Date", "Day", "Attendant", "Sales (KES)", "Items", "New batteries", "Changed", "Performance", "Commission", "Actions"].map((heading) => (
                  <th key={heading} className="px-3 py-2">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entriesState.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-6 text-center text-slate-500">
                    No support submissions match your filters.
                  </td>
                </tr>
              ) : (
                entriesState.map((entry, idx) => (
                  <tr key={entry.id} className="border-t border-slate-800">
                    <td className="px-3 py-2 text-slate-200">{entry.date}</td>
                    <td className="px-3 py-2 text-slate-300">{entry.dayOfWeek}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col text-slate-100">
                        <span>{entry.attendantName}</span>
                        <span className="text-[11px] text-slate-500">{entry.attendantEmail ?? "-"}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-emerald-300">
                      {formatKES(entry.totalSales)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-100">{entry.itemsSold.toLocaleString()}</td>
                    <td className="px-3 py-2 text-center text-slate-100">{entry.newBatteries}</td>
                    <td className="px-3 py-2 text-center text-slate-100">{entry.changedBatteries}</td>
                    <td className="px-3 py-2 text-right text-slate-100">{formatKES(entry.performanceEarnings)}</td>
                    <td className="px-3 py-2 text-right text-slate-100">{formatKES(entry.commission)}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2 items-center">
                        <button type="button" className="rounded-full border border-slate-600 px-3 py-1 text-[11px] text-slate-300" disabled>
                          View
                        </button>
                        <button type="button" className="rounded-full border border-slate-600 px-3 py-1 text-[11px] text-slate-300" disabled>
                          Export
                        </button>
                        <button type="button" className="rounded-full border border-slate-600 px-3 py-1 text-[11px] text-slate-300" disabled>
                          Edit
                        </button>
                        <DeleteSupportEntryClient
                          entryId={entry.id}
                          entry={entry}
                          onDeleted={(id) => {
                            // optimistic removal: remove from local state immediately
                            setEntriesState((prev) => prev.filter((e) => e.id !== id));
                            // clear selected detail view if it was the deleted entry
                            if (selectedEntry?.id === id) setSelectedEntry(null);
                          }}
                          onRestore={(entryObj) => {
                            // rollback: insert at original index
                            setEntriesState((prev) => {
                              const copy = prev.slice();
                              copy.splice(idx, 0, entryObj as any);
                              return copy;
                            });
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
