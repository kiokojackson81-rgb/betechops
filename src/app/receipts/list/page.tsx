import React from "react";
import ReceiptsAdminClient from "./ReceiptsAdminClient";
import { absUrl, withParams } from "@/lib/abs-url";

export const dynamic = "force-dynamic";

export default async function ReceiptsListPage() {
  try {
    const apiUrl = await absUrl('/api/receipts/list');
    const res = await fetch(withParams(apiUrl, { includeItems: true }), { cache: "no-store" });
    const j = await res.json();
    const receipts = j.receipts || [];
    return (
      <div className="p-4">
        <h1 className="mb-4 text-2xl font-semibold">Receipts</h1>
        <ReceiptsAdminClient initial={receipts} allowEdit />
      </div>
    );
  } catch (e) {
    return <div className="p-4">Failed to load receipts</div>;
  }
}
