import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { REFERRAL_ACTIVATION_SESSION_COOKIE } from "@/lib/referralCookies";
import {
  createReferralWithdrawalRequest,
  createReferralWithdrawalSchema,
} from "@/lib/reviewsReferrals";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = createReferralWithdrawalSchema.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return NextResponse.json({ ok: false, error: firstIssue?.message || "Invalid withdrawal request." }, { status: 400 });
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(REFERRAL_ACTIVATION_SESSION_COOKIE)?.value || "";
  if (!sessionToken) {
    return NextResponse.json({ ok: false, error: "Verify your phone number again before requesting a withdrawal." }, { status: 401 });
  }

  try {
    const withdrawal = await createReferralWithdrawalRequest(parsed.data, sessionToken);
    return NextResponse.json({ ok: true, withdrawal });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to create withdrawal request." },
      { status: 400 },
    );
  }
}
