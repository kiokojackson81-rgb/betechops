import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/api";
import { releaseReferralOwnershipLock } from "@/lib/referralFraud";

export const dynamic = "force-dynamic";

const schema = z.object({
  note: z.string().trim().min(5),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ ok: false, error: "Lock id is required." }, { status: 400 });
  }

  try {
    const parsed = schema.parse(await request.json().catch(() => ({})));
    const lock = await releaseReferralOwnershipLock({
      lockId: id,
      note: parsed.note,
      adminUserId: (auth.session?.user as { id?: string } | undefined)?.id ?? null,
    });
    return NextResponse.json({ ok: true, lock });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to release referral lock.";
    const status = /not found/i.test(message) ? 404 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
