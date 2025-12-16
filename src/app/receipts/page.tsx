import ReceiptsPageClient from "./ReceiptsPageClient";
import { absUrl, withParams } from "@/lib/abs-url";

export const dynamic = "force-dynamic";

export default async function ReceiptsPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  try {
    const apiUrl = await absUrl("/api/receipts");
    // If the page was opened with an attendantId query param, forward it
    const params: Record<string, string | undefined> = { includeItems: "true" };
    const attendantId = searchParams && typeof searchParams.attendantId === "string" ? searchParams.attendantId : undefined;
    if (attendantId) params.attendantId = attendantId;

    const res = await fetch(withParams(apiUrl, params), { cache: "no-store" });
    const data = await res.json().catch(() => ({ receipts: [] }));
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-4">
        <ReceiptsPageClient initial={data.receipts || []} />
      </div>
    );
  } catch (e) {
    return <div className="p-4">Failed to load receipts</div>;
  }
}
