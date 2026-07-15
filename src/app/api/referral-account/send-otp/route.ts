import { NextResponse } from "next/server";
import { sendReferralAccountOtp } from "@/lib/reviewsReferrals";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { token?: string };
  const token = String(body.token || "").trim();
  if (!token) {
    return NextResponse.json({ ok: false, error: "Referral account token is required." }, { status: 400 });
  }

  try {
    const result = await sendReferralAccountOtp(token);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to send OTP." },
      { status: 400 },
    );
  }
}
