import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { backfillReviewInvitationsForRecentSales } from "@/lib/reviewsReferrals";

export async function POST(request: Request) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role ?? "";

  if (!session || (role !== "ADMIN" && role !== "SUPERVISOR")) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = (await request.json().catch(() => ({}))) as {
      lookbackDays?: number;
      limit?: number;
      dryRun?: boolean;
      processDue?: boolean;
    };

    const summary = await backfillReviewInvitationsForRecentSales({
      lookbackDays: payload.lookbackDays,
      limit: payload.limit,
      dryRun: payload.dryRun,
      processDue: payload.processDue,
    });

    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to backfill review invitations." },
      { status: 500 },
    );
  }
}
