import React from "react";
import ReceiptsAdminClient from "./list/ReceiptsAdminClient";
import { absUrl, withParams } from "@/lib/abs-url";

export const dynamic = "force-dynamic";

export default async function ReceiptsPage() {
  try {
    const apiUrl = await absUrl('/api/receipts/list');
    const res = await fetch(withParams(apiUrl, { includeItems: true }), { cache: "no-store" });
    const data = await res.json().catch(() => ({ receipts: [] }));
    return (
      <div className="p-4">
        <h1 className="mb-2 text-2xl font-semibold">Receipts</h1>
        <p className="mb-4 text-sm text-slate-600">Search by date, phone, name or reference. Expand rows to view serials and warranties.</p>
        <ReceiptsAdminClient initial={data.receipts || []} allowEdit={false} />
      </div>
    );
  } catch (e) {
    // keep minimal output to the page; server logs will contain details
    return <div className="p-4">Failed to load receipts</div>;
  }
}
