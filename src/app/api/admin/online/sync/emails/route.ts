import { noStoreJson, requireRole } from "@/lib/api";
import { ingestOnlineMarketplaceEmails } from "@/lib/jobs/onlineEmailIngest";

export async function POST(request: Request) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const url = new URL(request.url);
  const lookbackDaysParam = url.searchParams.get("lookbackDays");
  const maxMessagesParam = url.searchParams.get("maxMessages");
  const lookbackDays = lookbackDaysParam ? Number.parseInt(lookbackDaysParam, 10) : undefined;
  const maxMessages = maxMessagesParam ? Number.parseInt(maxMessagesParam, 10) : undefined;

  try {
    const summary = await ingestOnlineMarketplaceEmails({
      lookbackDays: Number.isFinite(lookbackDays) && (lookbackDays as number) > 0 ? (lookbackDays as number) : undefined,
      maxMessages: Number.isFinite(maxMessages) && (maxMessages as number) > 0 ? (maxMessages as number) : undefined,
    });
    return noStoreJson({ ok: true, summary });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return noStoreJson({ ok: false, error: message }, { status: 500 });
  }
}

