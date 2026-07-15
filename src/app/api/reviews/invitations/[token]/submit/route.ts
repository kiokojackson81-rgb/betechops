import { NextResponse } from "next/server";
import { submitReviewByToken, submitReviewSchema } from "@/lib/reviewsReferrals";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;

  try {
    const payload = submitReviewSchema.parse(await request.json());
    const invitation = await submitReviewByToken(token, payload);
    return NextResponse.json({ ok: true, invitation });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to submit review.",
      },
      { status: 400 },
    );
  }
}
