"use client";

import { useState } from "react";
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

export default function ReceiptsPageClient({ initial }: { initial: ReceiptRow[] }) {
  const [view, setView] = useState<"create" | "list">("create");
  const [rows, setRows] = useState<ReceiptRow[]>(initial || []);

  const refreshList = async () => {
    try {
      const res = await fetch("/api/receipts?includeItems=true");
      const json = await res.json();
      setRows(json?.receipts || []);
    } catch {
      // ignore
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="mb-4 flex gap-3">
          <button
            className={`${view === "create"
              ? "tab-active rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-slate-100 shadow-sm hover:border-white/40 hover:bg-white/15"
              : "rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-300 hover:border-slate-500 hover:bg-slate-800"
            }`}
            onClick={() => setView("create")}
          >
            Create Receipt
          </button>
          <button
            className={`${view === "list"
              ? "tab-active rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-slate-100 shadow-sm hover:border-white/40 hover:bg-white/15"
              : "rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-300 hover:border-slate-500 hover:bg-slate-800"
            }`}
            onClick={() => setView("list")}
          >
            View Receipts
          </button>
        </div>
      </div>

      <div className="space-y-6 rounded-2xl border border-white/10 bg-[var(--card,#171b23)] card-top-accent bg-slate-900/80 p-6 shadow-xl shadow-black/30">
        {view === "create" && <ReceiptFormClient onCreated={refreshList} />}
        {view === "list" && <ReceiptsAdminClient initial={rows} allowEdit />}
      </div>
    </div>
  );
}
