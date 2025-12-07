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
    <div className="p-4">
      <div className="mb-4 flex gap-3">
        <button
          className={`rounded-xl px-4 py-2 border ${view === "create"
            ? "tab-active"
            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          }`}
          onClick={() => setView("create")}
        >
          Create Receipt
        </button>
        <button
          className={`rounded-xl px-4 py-2 border ${view === "list"
            ? "tab-active"
            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          }`}
          onClick={() => setView("list")}
        >
          View Receipts
        </button>
      </div>

      {view === "create" && <ReceiptFormClient onCreated={refreshList} />}
      {view === "list" && <ReceiptsAdminClient initial={rows} allowEdit />}
    </div>
  );
}
