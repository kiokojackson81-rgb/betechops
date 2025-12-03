import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/nextAuth";
import { getEarningsSummaryForUser } from "@/lib/earningsSummary";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const impersonateId = url.searchParams.get("impersonateId");
  const session = await getServerSession(authOptions as any);
  const actorId = session?.user?.id;

  if (!actorId && !impersonateId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (impersonateId && session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const userId = impersonateId ?? actorId;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await getEarningsSummaryForUser({ userId });
  return NextResponse.json(summary);
}
