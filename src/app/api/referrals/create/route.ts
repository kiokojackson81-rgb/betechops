import { NextResponse } from "next/server";
import { createReferralFromReview, createReferralSchema } from "@/lib/reviewsReferrals";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = createReferralSchema.parse(await request.json());
    const referral = await createReferralFromReview(payload);
    return NextResponse.json({ ok: true, referral });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to create referral.",
      },
      { status: 400 },
    );
  }
}
