import { NextResponse } from "next/server";
import { requireRole, getActorId } from "@/lib/api";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  const dateStr = url.searchParams.get("date");
  const impersonateId = url.searchParams.get("impersonateId");
  const actorId = await getActorId();
  const targetUserId = impersonateId && auth.role === "ADMIN" ? impersonateId : actorId;
  if (!targetUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const basisDate = dateStr ? new Date(dateStr) : new Date();
  const period = getTradingPeriodFor(basisDate);
  const start = period.start;
  const end = period.end;

  try {
    const ledger = await prisma.commissionLedger.findUnique({
      where: { userId_periodStart_periodEnd: { userId: targetUserId, periodStart: start, periodEnd: end } },
    });
    return NextResponse.json({ ledger: ledger ?? null });
  } catch (e) {
    return NextResponse.json({ error: "Failed to read ledger" }, { status: 500 });
  }
}
