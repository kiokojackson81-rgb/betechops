import { NextResponse } from "next/server";
import { REFERRAL_ACTIVATION_SESSION_COOKIE } from "@/lib/referralCookies";
import { verifyReferralAccountOtp } from "@/lib/reviewsReferrals";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { token?: string; code?: string };
  const token = String(body.token || "").trim();
  const code = String(body.code || "").trim();

  if (!token || !code) {
    return NextResponse.json({ ok: false, error: "Referral account token and OTP code are required." }, { status: 400 });
  }

  try {
    const result = await verifyReferralAccountOtp(token, code);
    const response = NextResponse.json({
      ok: true,
      dashboard: result.dashboard,
      verificationToken: result.verificationToken,
      redirectTo: result.redirectTo,
    });
    response.cookies.set(REFERRAL_ACTIVATION_SESSION_COOKIE, result.sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 60 * 60 * 8,
    });
    return response;
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to verify OTP." },
      { status: 400 },
    );
  }
}
