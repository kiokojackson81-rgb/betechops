import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/nextAuth";
import { prisma } from "@/lib/prisma";
import { getTradingPeriodFor, parseTradingPeriodKey } from "@/lib/tradingPeriod";
import { buildPayrollRow } from "@/lib/adminPayroll";
import { applyCanonicalPayrollOverrides } from "@/lib/payrollCanonical";
import type { TradingPeriod } from "@/lib/tradingPeriod";

// Compatibility route for older clients that call /api/payroll/summary
// Behaviour:
// - If the requester is ADMIN and `attendantId` is provided, return admin-style rows
// - Otherwise, if the requester has a session, return the attendant earnings summary for that user
// - Accepts `start` and `end` or `periodKey` query params to scope the period

export const dynamic = "force-dynamic";

function parsePeriod(url: URL) {
  return parseTradingPeriodKey(url.searchParams.get("periodKey") ?? undefined) ?? getTradingPeriodFor(new Date());
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const session: any = await getServerSession(authOptions as any);
  const actorId = session?.user?.id ?? null;
  const role = session?.user?.role ?? null;

  // allow query param `attendantId` for compatibility (admins may request others)
  const attendantIdParam = url.searchParams.get("attendantId");

  let period: TradingPeriod;
  try {
    period = parsePeriod(url);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 400 });
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
      const row = await applyCanonicalPayrollOverrides(await buildPayrollRow(attendant, period), period);
      const payloadRow = { periodLabel: period.label, ...row };
      return NextResponse.json({ periodLabel: period.label, rows: [payloadRow], row: payloadRow });
    }

    const attendants = await prisma.user.findMany({
      where: { role: { in: ["ATTENDANT", "SUPERVISOR"] } },
      orderBy: [{ attendantCategory: "asc" }, { name: "asc" }],
      select: { id: true, name: true, email: true, attendantCategory: true, isActive: true },
    });
    const builtRows = await Promise.all(
      attendants.map(async (attendant) =>
        applyCanonicalPayrollOverrides(await buildPayrollRow(attendant, period), period),
      ),
    );
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
  const row = await applyCanonicalPayrollOverrides(await buildPayrollRow(attendant, period), period);
  const payloadRow = { periodLabel: period.label, ...row };
  return NextResponse.json({ periodLabel: period.label, rows: [payloadRow], row: payloadRow });
}
