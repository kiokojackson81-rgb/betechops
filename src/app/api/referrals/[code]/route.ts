import { NextResponse } from "next/server";
import {
  CUSTOMER_REFERRAL_COOKIE_NAME,
  CUSTOMER_REFERRAL_COOKIE_TTL_SECONDS,
} from "@/lib/referralCookies";
import {
  getReferralLandingByCode,
  recordReferralClick,
} from "@/lib/reviewsReferrals";

export const dynamic = "force-dynamic";

function buildSessionId() {
  return typeof crypto?.randomUUID === "function"
    ? crypto.randomUUID()
    : `ref_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  const landing = await getReferralLandingByCode(code);
  if (!landing) {
    return NextResponse.json({ ok: false, error: "Referral link not found." }, { status: 404 });
  }

  const sessionId = buildSessionId();
  await recordReferralClick({
    referralCode: code,
    sessionId,
    source: "landing_get",
    metadata: {
      userAgent: request.headers.get("user-agent"),
      referer: request.headers.get("referer"),
    },
  });

  const response = NextResponse.json({ ok: true, referral: landing });
  response.cookies.set(CUSTOMER_REFERRAL_COOKIE_NAME, code, {
    httpOnly: false,
    sameSite: "lax",
    secure: true,
    maxAge: CUSTOMER_REFERRAL_COOKIE_TTL_SECONDS,
    path: "/",
  });
  return response;
}
