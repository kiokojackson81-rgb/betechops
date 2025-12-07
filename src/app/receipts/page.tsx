import React from "react";
import ReceiptsAdminClient from "./list/ReceiptsAdminClient";

export const dynamic = "force-dynamic";

export default async function ReceiptsPage() {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "";
  try {
    const res = await fetch(`${base}/api/receipts/list?includeItems=true`, { cache: "no-store" });
    const data = await res.json().catch(() => ({ receipts: [] }));
    return (
      <div className="p-4">
        <h1 className="mb-2 text-2xl font-semibold">Receipts</h1>
        <p className="mb-4 text-sm text-slate-600">Search by date, phone, name or reference. Expand rows to view serials and warranties.</p>
        <ReceiptsAdminClient initial={data.receipts || []} allowEdit={false} />
      </div>
    );
  } catch {
    return <div className="p-4">Failed to load receipts</div>;
  }
}
