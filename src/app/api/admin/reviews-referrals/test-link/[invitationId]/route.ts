import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api";
import { deleteAdminTestReviewLink } from "@/lib/reviewsReferrals";

export const dynamic = "force-dynamic";

export async function DELETE(_: Request, context: { params: Promise<{ invitationId: string }> }) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  try {
    const { invitationId } = await context.params;
    const result = await deleteAdminTestReviewLink(invitationId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to delete admin test review link.",
      },
      { status: 400 },
    );
  }
}
