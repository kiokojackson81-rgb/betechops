import { noStoreJson } from "@/lib/api";
import { ingestOnlineMarketplaceEmails } from "@/lib/jobs/onlineEmailIngest";

async function handle(request: Request) {
  const url = new URL(request.url);
  const cronSecretHeader = request.headers.get("x-cron-secret") || "";
  const vercelCronHeader = request.headers.get("x-vercel-cron") || "";
  const cronSecretQuery = (url.searchParams.get("cronSecret") || "").trim();

  const envSecret = (process.env.ONLINE_EMAIL_CRON_SECRET || process.env.CRON_SECRET || "").trim();
  const isCronBySecret = !!envSecret && (cronSecretHeader === envSecret || cronSecretQuery === envSecret);
  const isCronByVercelHeader = vercelCronHeader !== "";
  const isCron = isCronBySecret || isCronByVercelHeader;

  if (!isCron) {
    return noStoreJson({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const lookbackDaysParam = url.searchParams.get("lookbackDays");
  const maxMessagesParam = url.searchParams.get("maxMessages");
  const lookbackDays = lookbackDaysParam ? Number.parseInt(lookbackDaysParam, 10) : undefined;
  const maxMessages = maxMessagesParam ? Number.parseInt(maxMessagesParam, 10) : undefined;

  try {
    const summary = await ingestOnlineMarketplaceEmails({
      lookbackDays: Number.isFinite(lookbackDays) && (lookbackDays as number) > 0 ? (lookbackDays as number) : undefined,
      maxMessages: Number.isFinite(maxMessages) && (maxMessages as number) > 0 ? (maxMessages as number) : undefined,
    });
    return noStoreJson({ ok: true, cron: true, summary });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return noStoreJson({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return handle(request);
}

export async function GET(request: Request) {
  return handle(request);
}

