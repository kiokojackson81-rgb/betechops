import { NextResponse } from "next/server";

import { requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { buildPayrollRow } from "@/lib/adminPayroll";
import { applyCanonicalPayrollOverrides } from "@/lib/payrollCanonical";
import { computePayrollAppraisal } from "@/lib/payrollAppraisal";
import { getTradingPeriodFor, parseTradingPeriodKey } from "@/lib/tradingPeriod";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.res;

  const attendantId = params.id;
  if (!attendantId) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  const url = new URL(req.url);
  const periodKey = (url.searchParams.get("periodKey") || "").trim();
  const period = parseTradingPeriodKey(periodKey) ?? getTradingPeriodFor(new Date());

  const attendant = await prisma.user.findUnique({
    where: { id: attendantId },
    select: { id: true, name: true, email: true, attendantCategory: true, isActive: true },
  });
  if (!attendant) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const payrollRow = await applyCanonicalPayrollOverrides(await buildPayrollRow(attendant, period), period);
  const appraisal = await computePayrollAppraisal(attendantId, payrollRow, period);
  return NextResponse.json({ ok: true, appraisal });
}
