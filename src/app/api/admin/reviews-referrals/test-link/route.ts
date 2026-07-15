import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/api";
import { createAdminTestReviewLink } from "@/lib/reviewsReferrals";

export const dynamic = "force-dynamic";

const createAdminTestReviewLinkSchema = z.object({
  customerName: z.string().trim().min(2).optional(),
  customerPhone: z.string().trim().min(7).optional(),
  customerTown: z.string().trim().min(2).optional(),
});

export async function POST(request: Request) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  try {
    const parsed = createAdminTestReviewLinkSchema.parse(await request.json().catch(() => ({})));
    const result = await createAdminTestReviewLink(parsed);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to create admin test review link.",
      },
      { status: 400 },
    );
  }
}
