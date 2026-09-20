import { noStoreJson } from "@/lib/api";
import { backfillReviewInvitationsForRecentSales, processDueReviewInvitations } from "@/lib/reviewsReferrals";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(request: Request) {
  const url = new URL(request.url);
  const cronSecretHeader = request.headers.get("x-cron-secret") || "";
  const vercelCronHeader = request.headers.get("x-vercel-cron") || "";
  const cronSecretQuery = (url.searchParams.get("cronSecret") || "").trim();
  const authHeader = request.headers.get("authorization") || "";

  const envSecret = (process.env.REVIEW_REFERRAL_CRON_SECRET || process.env.CRON_SECRET || "").trim();
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
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : undefined;

  try {
    // Delivery is intentionally isolated from the optional 90-day backfill.
    // An older record with a schema/data problem must not prevent due review
    // invitations from sending on this run.
    const dueProcessing = await processDueReviewInvitations({ limit, dryRun });
    let backfill: Awaited<ReturnType<typeof backfillReviewInvitationsForRecentSales>> | null = null;
    let backfillError: string | null = null;

    try {
      backfill = await backfillReviewInvitationsForRecentSales({
        lookbackDays: 90,
        limit,
        dryRun,
        processDue: false,
      });
    } catch (error) {
      backfillError = error instanceof Error ? error.message : "Unable to backfill recent review invitations.";
      console.error("[reviews] review invitation backfill failed after due invitations were processed", error);
    }

    // A recovered receipt can already be more than seven days old.  Run the
    // due queue once more after backfill so it is delivered in this cron run
    // rather than waiting for the next hourly schedule.
    const recoveredDueProcessing = await processDueReviewInvitations({ limit, dryRun });

    return noStoreJson({
      ok: true,
      cron: true,
      dryRun,
      summary: dueProcessing,
      recoveredDueProcessing,
      backfill,
      backfillError,
    });
  } catch (error) {
    return noStoreJson(
      { ok: false, error: error instanceof Error ? error.message : "Unable to process due review invitations." },
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
