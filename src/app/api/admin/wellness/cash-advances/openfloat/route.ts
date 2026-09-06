import { NextResponse } from "next/server";

import { requireRole } from "@/lib/api";
import { buildCashAdvanceOpenfloatRow } from "@/lib/cashAdvanceOpenfloat";
import { buildOpenfloatWorkbook, workbookToBuffer } from "@/lib/payrollOpenfloat";
import { prisma } from "@/lib/prisma";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  const cashAdvanceId = (url.searchParams.get("cashAdvanceId") || "").trim();
  if (!cashAdvanceId) {
    return NextResponse.json({ error: "cashAdvanceId is required" }, { status: 400 });
  }

  const advance = await prisma.cashAdvance.findUnique({
    where: { id: cashAdvanceId },
    select: {
      id: true,
      approvedAmount: true,
      status: true,
      approvedAt: true,
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
  });

  if (!advance || advance.status !== "APPROVED" || Number(advance.approvedAmount ?? 0) <= 0) {
    return NextResponse.json(
      { error: "This cash advance must be approved with a positive amount before it can be exported to OpenFloat." },
      { status: 400 },
    );
  }

  const period = getTradingPeriodFor(advance.approvedAt ?? new Date());
  const row = buildCashAdvanceOpenfloatRow(advance, period);
  if (!row.isValid || row.isSkipped) {
    return NextResponse.json(
      {
        error: "payout_profile_incomplete",
        detail: row.validationErrors.join("; ") || row.skipReason || "The approved amount is not valid for payout",
      },
      { status: 400 },
    );
  }

  const buffer = workbookToBuffer(buildOpenfloatWorkbook([row]));
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="openfloat-cash-advance-${advance.id}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
