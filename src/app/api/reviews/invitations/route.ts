import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api";
import { createReviewInvitation, createReviewInvitationSchema } from "@/lib/reviewsReferrals";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  try {
    const payload = createReviewInvitationSchema.parse(await request.json());
    const result = await createReviewInvitation(payload);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to create review invitation.",
      },
      { status: 400 },
    );
  }
}
