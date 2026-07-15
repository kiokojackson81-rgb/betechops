import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api";
import { getReviewsReferralsAdminSummary } from "@/lib/reviewsReferrals";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const summary = await getReviewsReferralsAdminSummary();
  return NextResponse.json({ ok: true, summary });
}
