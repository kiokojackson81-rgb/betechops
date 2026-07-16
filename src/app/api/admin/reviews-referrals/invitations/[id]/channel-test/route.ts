import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/api";
import { sendAdminReviewInvitationChannelTest } from "@/lib/reviewsReferrals";

export const dynamic = "force-dynamic";

const schema = z.object({
  channel: z.enum(["sms", "whatsapp", "email"]),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ ok: false, error: "Invitation id is required." }, { status: 400 });
  }

  try {
    const parsed = schema.parse(await request.json().catch(() => ({})));
    const result = await sendAdminReviewInvitationChannelTest(id, parsed.channel);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send review test message.";
    const status = /not found/i.test(message) ? 404 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
