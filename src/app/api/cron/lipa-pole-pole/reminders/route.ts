import { noStoreJson } from "@/lib/api";
import { processDueLppReminders } from "@/lib/lipaPolePoleService";

async function handle(request: Request) {
  const url = new URL(request.url);
  const cronSecretHeader = request.headers.get("x-cron-secret") || "";
  const vercelCronHeader = request.headers.get("x-vercel-cron") || "";
  const cronSecretQuery = (url.searchParams.get("cronSecret") || "").trim();
  const authHeader = request.headers.get("authorization") || "";

  const envSecret = (process.env.LPP_REMINDER_CRON_SECRET || process.env.CRON_SECRET || "").trim();
  const isCronBySecret = !!envSecret && (cronSecretHeader === envSecret || cronSecretQuery === envSecret);
  const isCronByAuthorization =
    !!envSecret && (authHeader === envSecret || authHeader === `Bearer ${envSecret}` || authHeader === `bearer ${envSecret}`);
  const isCronByVercelHeader = vercelCronHeader !== "";
  const isCron = isCronBySecret || isCronByAuthorization || isCronByVercelHeader;

  if (!isCron) {
    return noStoreJson({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const limitParam = Number.parseInt(url.searchParams.get("limit") || "", 10);
  const dryRun = ["1", "true", "yes"].includes(String(url.searchParams.get("dryRun") || "").toLowerCase());

  try {
    const summary = await processDueLppReminders({
      limit: Number.isFinite(limitParam) && limitParam > 0 ? limitParam : undefined,
      dryRun,
    });
    return noStoreJson({ ok: true, cron: true, dryRun, summary });
  } catch (error) {
    return noStoreJson(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to process due LPP reminders.",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
