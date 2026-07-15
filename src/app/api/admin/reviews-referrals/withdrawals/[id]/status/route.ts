import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/api";
import { updateReferralWithdrawalStatus } from "@/lib/reviewsReferrals";

const updateWithdrawalStatusSchema = z.object({
  status: z.enum(["approved", "paid", "rejected", "held"]),
  reference: z.string().trim().optional().nullable(),
  reason: z.string().trim().optional().nullable(),
});

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = updateWithdrawalStatusSchema.safeParse(body);
  if (!id || !parsed.success) {
    const firstIssue = parsed.success ? null : parsed.error.issues[0];
    return NextResponse.json({ ok: false, error: firstIssue?.message || "Invalid withdrawal update." }, { status: 400 });
  }

  try {
    const withdrawal = await updateReferralWithdrawalStatus({
      id,
      ...parsed.data,
    });
    return NextResponse.json({ ok: true, withdrawal });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update withdrawal.";
    const status = /not found/i.test(message) ? 404 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
