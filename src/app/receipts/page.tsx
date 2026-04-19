import ReceiptsPageClient from "./ReceiptsPageClient";
import { absUrl, withParams } from "@/lib/abs-url";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";

export const dynamic = "force-dynamic";

export default async function ReceiptsPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  try {
    const apiUrl = await absUrl("/api/receipts");
    const params: Record<string, string | undefined> = {
      includeItems: "true",
      onlyPos: "1",
      scope: "mine",
    };
    const attendantId = searchParams && typeof searchParams.attendantId === "string" ? searchParams.attendantId : undefined;
    if (attendantId) params.attendantId = attendantId;
    const start = searchParams && typeof searchParams.start === "string" ? searchParams.start : undefined;
    const end = searchParams && typeof searchParams.end === "string" ? searchParams.end : undefined;
    if (start) params.start = start;
    if (end) params.end = end;
    if (attendantId && !start && !end) {
      const period = getTradingPeriodFor(new Date());
      params.start = period.start.toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });
      params.end = period.end.toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });
    }
    const initialOnlyPos =
      !searchParams || typeof searchParams.onlyPos !== "string"
        ? true
        : ["1", "true", "yes"].includes(searchParams.onlyPos.toLowerCase());

    const res = await fetch(withParams(apiUrl, params), { cache: "no-store" });
    const data = await res.json().catch(() => ({ receipts: [] }));
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-4">
        <ReceiptsPageClient initial={data.receipts || []} initialOnlyPos={initialOnlyPos} />
      </div>
    );
  } catch (e) {
    return <div className="p-4">Failed to load receipts</div>;
  }
}
