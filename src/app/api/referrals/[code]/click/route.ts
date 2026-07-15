import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { recordReferralClick } from "@/lib/reviewsReferrals";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    sessionId?: string;
    source?: string;
    metadata?: Record<string, unknown>;
  };

  const referral = await recordReferralClick({
    referralCode: code,
    sessionId: body.sessionId || null,
    source: body.source || "click_post",
    metadata: (body.metadata || {}) as Prisma.InputJsonValue,
  });

  if (!referral) {
    return NextResponse.json({ ok: false, error: "Referral link not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, referral });
}
