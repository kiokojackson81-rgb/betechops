"use client";

import { useMemo, useState } from "react";
import ReceiptFormClient from "./ReceiptFormClient";
import ReceiptsAdminClient from "./ReceiptsAdminClient";

type ReceiptRow = {
  id: string;
  orderRef?: string;
  docType: string;
  createdAt: string;
  customerName?: string | null;
  attendantName?: string | null;
  total?: number | null;
  status?: string | null;
  items?: any[];
};

type ReceiptSummary = {
  totalCount: number;
  totalValue: number;
  averageValue: number;
  lastReceipt?: { id: string; createdAt: string; customerName?: string | null };
};

const computeSummary = (rows: ReceiptRow[]): ReceiptSummary => {
  const totalValue = rows.reduce((sum, row) => sum + Number(row.total ?? 0), 0);
  const totalCount = rows.length;
  const averageValue = totalCount ? totalValue / totalCount : 0;
  const head = rows[0];
  const lastReceipt = head
    ? { id: head.id, createdAt: head.createdAt, customerName: head.customerName }
    : undefined;
  return { totalCount, totalValue, averageValue, lastReceipt };
};

export default function ReceiptsPageClient({ initial }: { initial: ReceiptRow[] }) {
  const [summary, setSummary] = useState<ReceiptSummary>(() => computeSummary(initial || []));
  const [view, setView] = useState<"create" | "list">("list");
  const [refreshSignal, setRefreshSignal] = useState(0);

  const summaryCards = useMemo(
    () => [
      { label: "Receipts loaded", value: summary.totalCount.toLocaleString() },
      {
        label: "Total value",
        value: `KES ${summary.totalValue.toLocaleString("en-KE", { maximumFractionDigits: 0 })}`,
      },
      {
        label: "Average value",
        value: `KES ${summary.averageValue.toLocaleString("en-KE", { maximumFractionDigits: 0 })}`,
      },
      {
        label: "Last entry",
        value: summary.lastReceipt
          ? `${new Date(summary.lastReceipt.createdAt).toLocaleString()} - ${
              summary.lastReceipt.customerName || "Walk-in"
            }`
          : "-",
      },
    ],
    [summary],
  );

  const handleCreated = () => {
    setView("list");
    setRefreshSignal((val) => val + 1);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-inner shadow-black/40">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Receipts desk</p>
            <h1 className="text-2xl font-semibold text-white">Betech Customers Operations</h1>
            <p className="text-sm text-slate-400">
              Track every printable document, search by customer, and open the PDF drawer without leaving this page.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              className={"rounded-full px-4 py-2 text-sm font-semibold " + (view === "create" ? "bg-emerald-500 text-black" : "border border-white/10 text-slate-200")}
              onClick={() => setView("create")}
            >
              Create
            </button>
            <button
              className={"rounded-full px-4 py-2 text-sm font-semibold " + (view === "list" ? "bg-emerald-500 text-black" : "border border-white/10 text-slate-200")}
              onClick={() => setView("list")}
            >
              View receipts
            </button>
          </div>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {summaryCards.map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-white/5 bg-slate-950/40 px-4 py-3 text-sm text-slate-300"
            >
              <p className="text-xs uppercase tracking-wide text-slate-500">{card.label}</p>
              <p className="mt-2 text-lg font-semibold text-white">{card.value}</p>
            </div>
          ))}
        </div>
      </section>

      {view === "create" && (
        <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl shadow-black/40">
          <ReceiptFormClient onCreated={handleCreated} />
        </section>
      )}

      {view === "list" && (
        <div className="rounded-3xl border border-white/5 bg-slate-950/60 p-4 sm:p-6 shadow-inner shadow-black/40">
          <ReceiptsAdminClient
            initial={initial}
            allowEdit
            onSummaryChange={setSummary}
            refreshSignal={refreshSignal}
          />
        </div>
      )}
    </div>
  );
}
