import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api";
import { getReviewInvitationOperations } from "@/lib/reviewsReferrals";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const url = new URL(request.url);
  const status = String(url.searchParams.get("status") || "all").trim().toLowerCase();
  const limit = Number.parseInt(url.searchParams.get("limit") || "", 10);

  const invitations = await getReviewInvitationOperations({
    status: ["due", "sent", "failed", "all"].includes(status) ? (status as "due" | "sent" | "failed" | "all") : "all",
    limit: Number.isFinite(limit) && limit > 0 ? limit : undefined,
  });

  return NextResponse.json({ ok: true, invitations });
}
