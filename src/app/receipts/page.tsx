import ReceiptsPageClient from "./ReceiptsPageClient";
import { absUrl, withParams } from "@/lib/abs-url";

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
