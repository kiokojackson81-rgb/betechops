import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api";
import { retryReviewInvitationSend } from "@/lib/reviewsReferrals";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ ok: false, error: "Invitation id is required." }, { status: 400 });
  }

  try {
    const result = await retryReviewInvitationSend(id);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to retry invitation send.";
    const status = /not found/i.test(message) ? 404 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
