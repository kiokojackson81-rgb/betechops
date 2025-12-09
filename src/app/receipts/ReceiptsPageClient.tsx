"use client";

import Link from "next/link";
import { useMemo } from "react";
import ReceiptFormClient from "./ReceiptFormClient";

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
  const summary = useMemo(() => computeSummary(initial || []), [initial]);

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
    // placeholder for future summary refresh logic
  };

  const scrollToCreate = () => {
    if (typeof window === "undefined") return;
    document.getElementById("receipt-create")?.scrollIntoView({ behavior: "smooth", block: "start" });
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
              type="button"
              className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10"
              onClick={scrollToCreate}
            >
              Create
            </button>
            <Link
              href="/admin/receipts"
              className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:brightness-95"
            >
              View receipts
            </Link>
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

      <section
        id="receipt-create"
        className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl shadow-black/40"
      >
        <ReceiptFormClient onCreated={handleCreated} />
      </section>
    </div>
  );
}
