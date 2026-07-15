import { NextResponse } from "next/server";
import { getReferralAccountDashboardByToken } from "@/lib/reviewsReferrals";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = String(url.searchParams.get("token") || "").trim();
  if (!token) {
    return NextResponse.json({ ok: false, error: "Referral account token is required." }, { status: 400 });
  }

  try {
    const dashboard = await getReferralAccountDashboardByToken(token);
    if (!dashboard) {
      return NextResponse.json({ ok: false, error: "Referral account not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, dashboard });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to load referral dashboard." },
      { status: 400 },
    );
  }
}
