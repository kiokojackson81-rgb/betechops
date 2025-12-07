import ReceiptsPageClient from "./ReceiptsPageClient";
import { absUrl, withParams } from "@/lib/abs-url";

export const dynamic = "force-dynamic";

export default async function ReceiptsPage() {
  try {
    const apiUrl = await absUrl("/api/receipts");
    const res = await fetch(withParams(apiUrl, { includeItems: true }), { cache: "no-store" });
    const data = await res.json().catch(() => ({ receipts: [] }));
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 p-4">
        <ReceiptsPageClient initial={data.receipts || []} />
      </div>
    );
  } catch (e) {
    return <div className="p-4">Failed to load receipts</div>;
  }
}
