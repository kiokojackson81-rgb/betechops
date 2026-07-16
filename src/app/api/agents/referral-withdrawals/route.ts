import { NextRequest, NextResponse } from "next/server";
import { requireAgentSession } from "@/lib/agents/auth";
import { createReferralWithdrawalRequestForUser, getReferralAgentDashboardByUserId } from "@/lib/reviewsReferrals";

export async function GET() {
  const agentSession = await requireAgentSession();
  if (!agentSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dashboard = await getReferralAgentDashboardByUserId(agentSession.userId);
  return NextResponse.json({ ok: true, dashboard });
}

export async function POST(req: NextRequest) {
  const agentSession = await requireAgentSession();
  if (!agentSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const amount = Number(body?.amount ?? 0);

  try {
    const withdrawal = await createReferralWithdrawalRequestForUser(agentSession.userId, amount);
    return NextResponse.json({ ok: true, withdrawal });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to submit review referral withdrawal." },
      { status: 400 },
    );
  }
}
