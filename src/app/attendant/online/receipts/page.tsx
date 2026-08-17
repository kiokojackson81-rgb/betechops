import ReceiptsPageClient from "@/app/receipts/ReceiptsPageClient";
import { absUrl, withParams } from "@/lib/abs-url";

export const dynamic = "force-dynamic";

type SearchParams = {
  view?: string;
  attendantId?: string;
  start?: string;
  end?: string;
  impersonateId?: string;
};

export default async function OnlineReceiptsWorkspace({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const resolved = await Promise.resolve(searchParams ?? {});
  const apiUrl = await absUrl("/api/receipts");
  const params: Record<string, string | undefined> = {
    includeItems: "true",
    onlyPos: "1",
    scope: "mine",
    attendantId: resolved.attendantId,
    start: resolved.start,
    end: resolved.end,
    impersonateId: resolved.impersonateId,
  };

  try {
    const response = await fetch(withParams(apiUrl, params), { cache: "no-store" });
    const data = await response.json().catch(() => ({ receipts: [] }));
    return (
      <section className="min-w-0 rounded-[28px] border border-white/10 bg-[#091223] p-3 shadow-2xl shadow-black/20 sm:p-5">
        <ReceiptsPageClient
          initial={Array.isArray(data?.receipts) ? data.receipts : []}
          initialOnlyPos
          initialView={resolved.view === "history" ? "list" : "create"}
        />
      </section>
    );
  } catch {
    return (
      <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-5 text-sm text-rose-100">
        Failed to load the receipts workspace.
      </div>
    );
  }
}
