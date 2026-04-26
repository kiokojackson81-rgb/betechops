import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/nextAuth";
import { prisma } from "@/lib/prisma";
import { getTradingPeriodFor, parseTradingPeriodKey } from "@/lib/tradingPeriod";
import { buildPayrollRow } from "@/lib/adminPayroll";

export const dynamic = "force-dynamic";

function parsePeriod(url: URL) {
  return parseTradingPeriodKey(url.searchParams.get("periodKey") ?? undefined) ?? getTradingPeriodFor(new Date());
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const session: any = await getServerSession(authOptions as any);
  const actorId = session?.user?.id ?? null;
  const role = session?.user?.role ?? null;
  const attendantIdParam = url.searchParams.get("attendantId");

  let period;
  try {
    period = parsePeriod(url);
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 400 });
  }

  if (role === "ADMIN" || role === "SUPERVISOR") {
    const targetId = attendantIdParam ?? null;
    if (targetId) {
      const attendant = await prisma.user.findUnique({
        where: { id: targetId },
        select: { id: true, name: true, email: true, attendantCategory: true, isActive: true },
      });
      if (!attendant) {
        return NextResponse.json({ error: "Attendant not found" }, { status: 404 });
      }
      const row = await buildPayrollRow(attendant, period);
      const payloadRow = { periodLabel: period.label, ...row };
      return NextResponse.json({ periodLabel: period.label, rows: [payloadRow], row: payloadRow });
    }

    const attendants = await prisma.user.findMany({
      where: { role: { in: ["ATTENDANT", "SUPERVISOR"] } },
      orderBy: [{ attendantCategory: "asc" }, { name: "asc" }],
      select: { id: true, name: true, email: true, attendantCategory: true, isActive: true },
    });
    const builtRows = await Promise.all(attendants.map((attendant) => buildPayrollRow(attendant, period)));
    const rows = builtRows.map((row) => ({ periodLabel: period.label, ...row }));
    return NextResponse.json({ periodLabel: period.label ?? "", rows });
  }

  const targetAttendant = actorId;
  if (!targetAttendant) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const attendant = await prisma.user.findUnique({
    where: { id: targetAttendant },
    select: { id: true, name: true, email: true, attendantCategory: true, isActive: true },
  });
  if (!attendant) {
    return NextResponse.json({ error: "Attendant not found" }, { status: 404 });
  }
  const row = await buildPayrollRow(attendant, period);
  const payloadRow = { periodLabel: period.label, ...row };
  return NextResponse.json({ periodLabel: period.label, rows: [payloadRow], row: payloadRow });
}
