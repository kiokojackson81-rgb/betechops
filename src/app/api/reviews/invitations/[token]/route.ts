import { NextResponse } from "next/server";
import { getReviewInvitationDetailsByToken } from "@/lib/reviewsReferrals";

export const dynamic = "force-dynamic";

export async function GET(_: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const invitation = await getReviewInvitationDetailsByToken(token);
  if (!invitation) {
    return NextResponse.json({ ok: false, error: "Review invitation not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, invitation });
}
