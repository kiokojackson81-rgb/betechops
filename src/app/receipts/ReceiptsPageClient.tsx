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
        <button className={`rounded-xl border px-4 py-2 ${view === "create" ? "bg-blue-600 text-white" : ""}`} onClick={() => setView("create")}>Create Receipt</button>
        <button className={`rounded-xl border px-4 py-2 ${view === "list" ? "bg-blue-600 text-white" : ""}`} onClick={() => setView("list")}>View Receipts</button>
      </div>

      {view === "create" && <ReceiptFormClient onCreated={refreshList} />}
      {view === "list" && <ReceiptsAdminClient initial={rows} allowEdit />}
    </div>
  );
}
