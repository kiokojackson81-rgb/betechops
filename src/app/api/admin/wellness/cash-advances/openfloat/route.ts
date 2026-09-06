import { NextResponse } from "next/server";

import { requireRole } from "@/lib/api";
import { buildCashAdvanceOpenfloatRow } from "@/lib/cashAdvanceOpenfloat";
import { buildOpenfloatWorkbook, workbookToBuffer } from "@/lib/payrollOpenfloat";
import { prisma } from "@/lib/prisma";
import { getTradingPeriodFor, parseTradingPeriodKey } from "@/lib/tradingPeriod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  const periodKey = (url.searchParams.get("periodKey") || url.searchParams.get("period") || "").trim();
  const period = parseTradingPeriodKey(periodKey) ?? getTradingPeriodFor(new Date());

  const advances = await prisma.cashAdvance.findMany({
    where: {
      status: "APPROVED",
      approvedAmount: { gt: 0 },
      approvedAt: { gte: period.start, lte: period.end },
    },
    select: {
      id: true,
      approvedAmount: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          attendantCategory: true,
          isActive: true,
          bankName: true,
          bankAccountNumber: true,
          payoutMethod: true,
          payoutAccountName: true,
          mobileMoneyPhoneNumber: true,
          tillPaybillNumber: true,
          tillPaybillBusinessName: true,
          paybillAccountNumber: true,
          notificationPhoneNumber: true,
        },
      },
    },
    orderBy: [{ approvedAt: "asc" }, { createdAt: "asc" }],
  });

  if (advances.length === 0) {
    return NextResponse.json(
      { error: "No approved cash advances are ready for OpenFloat payout in this payroll period." },
      { status: 400 },
    );
  }

  const rows = advances.map((advance) => buildCashAdvanceOpenfloatRow(advance, period));
  const invalidRows = rows.filter((row) => !row.isValid && !row.isSkipped);
  if (invalidRows.length > 0) {
    return NextResponse.json(
      {
        error: "payout_profile_incomplete",
        detail: `${invalidRows.length} cash advance payout row(s) still have missing or invalid payment details`,
      },
      { status: 400 },
    );
  }

  const buffer = workbookToBuffer(buildOpenfloatWorkbook(rows));
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="openfloat-cash-advances-${period.key}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
